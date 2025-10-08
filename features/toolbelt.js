const https = require('https');
const { Riffy } = require("riffy");

const tools = [
  {
    type: 'function',
    function: {
      name: 'google_search',
      description: 'Searches the web using Google for up-to-date information, news, or specific topics.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to send to Google.'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_faq',
      description: "Searches the server's frequently asked questions (FAQ) for an answer. Use this if a user's question might be in the FAQ.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The user\'s question or keywords to search for.'
          }
        },
        required: ['query']
      }
    }
  },
  {
      type: 'function',
      function: {
          name: 'search_knowledge_base',
          description: "Searches the server's knowledge base for specific information provided by the admins.",
          parameters: {
              type: 'object',
              properties: {
                  query: {
                      type: 'string',
                      description: 'Keywords or topics to search for in the knowledge base.'
                  }
              },
              required: ['query']
          }
      }
  },
  {
    type: 'function',
    function: {
        name: 'play_music',
        description: 'Plays a song or adds it to the queue. Requires the song name or URL.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The name of the song or a link (YouTube, Spotify, etc.) to play.'
                },
            },
            required: ['query'],
        },
    },
  },
  {
    type: 'function',
    function: {
        name: 'pause_music',
        description: 'Pauses the currently playing music on the server.',
        parameters: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
  },
  {
    type: 'function',
    function: {
        name: 'resume_music',
        description: 'Resumes the currently paused music.',
        parameters: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
  },
  {
    type: 'function',
    function: {
        name: 'skip_music',
        description: 'Skips the current song and plays the next one in the queue.',
        parameters: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
  },
  {
    type: 'function',
    function: {
        name: 'stop_music',
        description: 'Stops the music completely and clears the queue.',
        parameters: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
  },
];

const getToolFunctions = (client) => ({
  google_search: async ({ query }) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;

    if (!apiKey || !cseId) {
      return { success: false, content: 'The web search feature is not configured correctly. Please contact the administrator.' };
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}`;

    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const results = JSON.parse(data);
            if (results.error) {
              resolve({ success: false, content: `I couldn't complete the web search. The service reported an error: ${results.error.message}` });
              return;
            }
            const items = results.items?.slice(0, 3) || [];
            if (items.length === 0) {
              resolve({ success: true, content: 'No results found.' });
              return;
            }
            const formattedResults = items.map((item) =>
              `Title: ${item.title}\nSnippet: ${item.snippet}`
            ).join('\n\n');
            resolve({ success: true, content: `Here are the top search results:\n${formattedResults}` });
          } catch (error) {
            resolve({ success: false, content: 'I received a response from the web search, but I couldn\'t understand it.' });
          }
        });
      }).on('error', (err) => {
        resolve({ success: false, content: `I couldn't connect to the web search service.` });
      });
    });
  },

  read_faq: async ({ query }, originalMessage) => {
    if (!client.db) return { success: false, content: "The database is not connected." };
    const settingsCollection = client.db.collection('server-settings');
    try {
      const settings = await settingsCollection.findOne({ guildId: originalMessage.guild.id });
      const faq = settings?.aiConfig?.faq;

      if (!Array.isArray(faq) || faq.length === 0) {
        return { success: false, content: "The FAQ for this server is empty." };
      }

      const lowerQuery = query.toLowerCase();
      const foundEntry = faq.find(entry =>
        entry.question.toLowerCase().includes(lowerQuery) ||
        entry.answer.toLowerCase().includes(lowerQuery)
      );

      if (foundEntry) {
        return { success: true, content: `Found a relevant entry in the FAQ:\nQ: ${foundEntry.question}\nA: ${foundEntry.answer}` };
      }

      return { success: false, content: `I searched the FAQ but couldn't find an answer for "${query}".` };
    } catch (error) {
      console.error('Error reading FAQ from DB:', error);
      return { success: false, content: 'An error occurred while accessing the FAQ.' };
    }
  },

  search_knowledge_base: async ({ query }, originalMessage) => {
    if (!client.db) return { success: false, content: "The database is not connected." };
    const settingsCollection = client.db.collection('server-settings');
    try {
        const settings = await settingsCollection.findOne({ guildId: originalMessage.guild.id });
        const knowledge = settings?.aiConfig?.knowledge;

        if (!Array.isArray(knowledge) || knowledge.length === 0) {
            return { success: true, content: "The knowledge base for this server is empty." };
        }

        const stopWords = new Set(['a', 'an', 'the', 'is', 'in', 'it', 'of', 'for', 'on', 'with', 'to', 'was', 'and', 'or', 'but']);
        const keywords = query.toLowerCase().split(/\s+/).filter(word => !stopWords.has(word) && word.length > 1);

        if (keywords.length === 0) {
            return { success: true, content: `I couldn't extract any meaningful keywords from your query: "${query}". Please try a more specific search.` };
        }

        const scoredEntries = knowledge.map(entry => {
            const lowerContent = entry.content.toLowerCase();
            let score = 0;
            keywords.forEach(keyword => {
                if (lowerContent.includes(keyword)) {
                    score++;
                }
            });
            return { ...entry, score };
        }).filter(entry => entry.score > 0);

        if (scoredEntries.length === 0) {
            return { success: true, content: `I searched the knowledge base but couldn't find anything matching the keywords: "${keywords.join(', ')}".` };
        }

        scoredEntries.sort((a, b) => b.score - a.score);

        const topEntries = scoredEntries.slice(0, 3);
        const results = topEntries.map(entry => entry.content).join('\n---\n');
        return { success: true, content: `Found the most relevant information in the knowledge base based on your query:\n${results}` };

    } catch (error) {
        console.error('Error reading knowledge base from DB:', error);
        return { success: false, content: 'An error occurred while accessing the knowledge base.' };
    }
},

  play_music: async ({ query }, originalMessage) => {
    const member = originalMessage.member;
    if (!member || !member.voice.channel) {
        return { success: false, content: "The user who asked me to play music is not in a voice channel. I have informed them they need to join one first." };
    }

    if (!client.riffy) {
        return { success: false, content: 'The music system is not currently available.' };
    }

    try {
      const resolve = await client.riffy.resolve({ query, requester: originalMessage.author });
      const { loadType, tracks } = resolve;

      if (loadType === 'empty' || !tracks.length) {
        return { success: false, content: `No music found for "${query}".` };
      }

      const player = client.riffy.players.get(originalMessage.guild.id) || client.riffy.createConnection({
        guildId: originalMessage.guild.id,
        voiceChannel: member.voice.channel.id,
        textChannel: originalMessage.channel.id,
        deaf: true,
      });

      const track = tracks.shift();
      player.queue.add(track);
      if (!player.playing && !player.paused) {
        player.play();
      }

      return { success: true, content: `Added to queue: "${track.info.title}" by ${track.info.author}.` };
    } catch (error) {
      console.error('Error playing music:', error);
      return { success: false, content: 'An unknown error occurred while trying to play the music.' };
    }
  },

  pause_music: async (_, msg) => {
    const player = client.riffy.players.get(msg.guild.id);
    if (!player || !player.playing) return { success: false, content: 'Nothing is being played right now.' };
    player.pause(true);
    return { success: true, content: 'Music paused.' };
  },

  resume_music: async (_, msg) => {
    const player = client.riffy.players.get(msg.guild.id);
    if (!player || !player.paused) return { success: false, content: 'The music is not paused.' };
    player.pause(false);
    return { success: true, content: 'Music resumed.' };
  },

  skip_music: async (_, msg) => {
    const player = client.riffy.players.get(msg.guild.id);
    if (!player || player.queue.size === 0) return { success: false, content: 'There is nothing in the queue to skip to.' };
    player.stop();
    return { success: true, content: 'Skipped to the next song.' };
  },

  stop_music: async (_, msg) => {
    const player = client.riffy.players.get(msg.guild.id);
    if (player) {
        player.destroy();
    }
    return { success: true, content: 'Music stopped, queue cleared, and I have left the voice channel.' };
  },
});

module.exports = {
  tools,
  getToolFunctions,
};