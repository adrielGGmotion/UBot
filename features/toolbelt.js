/**
 * @file Este arquivo centraliza a definição e a implementação das ferramentas
 * que a IA pode utilizar para interagir com o Discord.
 */

const https = require('https');
const OpenAI = require('openai');
const { ChannelType } = require('discord.js');

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
});

/**
 * Retorna o modelo de IA apropriado com base na configuração do servidor,
 * priorizando um modelo com capacidade de visão se necessário.
 * @param {object} aiConfig - A configuração da IA do servidor.
 * @param {boolean} vision - Se o modelo de visão é necessário.
 * @returns {string} - O nome do modelo a ser usado.
 */
function getModel(aiConfig, vision = false) {
  if (vision) {
    // Prioriza um modelo de visão se a configuração especificar um, caso contrário, usa um padrão.
    return aiConfig.visionModel || 'google/gemini-pro-vision';
  }
  return aiConfig.model || 'x-ai/grok-4-fast:free';
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'analyze_image_from_url',
      description: 'Analyzes an image from a given URL and describes its content. Use this tool when a user provides an image link and asks what it is, or when an image is relevant to the conversation.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The direct URL of the image to be analyzed.'
          }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'google_search',
      description: 'Searches the web using Google for up-to-date information, news, or specific topics. Use this when the user asks a question that requires current knowledge or information not available in the conversation history.',
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
      name: 'read_channel_messages',
      description: 'Reads the latest messages from a specific text channel. If you only have the channel name, use the `get_id` tool first to find its ID.',
      parameters: {
        type: 'object',
        properties: {
          channel_id: {
            type: 'string',
            description: 'The ID of the text channel you want to read.',
          },
          limit: {
            type: 'number',
            description: 'The number of messages to read (default: 10, max: 50).',
          }
        },
        required: ['channel_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_user_voice_channel',
      description: 'Finds the voice channel a specific user is currently connected to. If you only have the username, use the `get_id` tool first to find their ID.',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'string',
            description: 'The ID of the user to locate on the server.',
          },
        },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_avatar',
      description: 'Gets the profile picture (avatar) URL of a specific user. If you only have the username, use the `get_id` tool first to find their ID.',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'string',
            description: 'The ID of the user to get the profile picture from.',
          },
        },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_message',
      description: 'Deletes a specific message in a channel. Requires the message ID. If you only have the message content, use the `get_id` tool to find its ID.',
      parameters: {
        type: 'object',
        properties: {
          message_id: {
            type: 'string',
            description: 'The ID of the message to be deleted.',
          },
          reason: {
            type: 'string',
            description: 'The reason why the message is being deleted (optional).',
          }
        },
        required: ['message_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
        name: 'send_message_to_channel',
        description: 'Sends a message to a specific text channel on the server. If you only have the channel name, use the `get_id` tool first to find its ID.',
        parameters: {
            type: 'object',
            properties: {
                channel_id: {
                    type: 'string',
                    description: 'The ID of the channel where the message will be sent.'
                },
                message_content: {
                    type: 'string',
                    description: 'The content of the message to be sent.'
                },
            },
            required: ['channel_id', 'message_content'],
        },
    },
  },
  {
    type: 'function',
    function: {
        name: 'save_user_memory',
        description: 'Salva uma informação sobre o usuário que está interagindo. Use para lembrar preferências, detalhes pessoais, ou qualquer coisa que o usuário te peça para lembrar sobre ele.',
        parameters: {
            type: 'object',
            properties: {
                key: {
                    type: 'string',
                    description: 'A chave ou nome da informação a ser lembrada (ex: "cor favorita", "nome do cachorro").'
                },
                value: {
                    type: 'string',
                    description: 'O valor da informação a ser salva (ex: "azul", "Rex").'
                },
            },
            required: ['key', 'value'],
        },
    },
  },
  {
    type: 'function',
    function: {
        name: 'get_user_memory',
        description: 'Recupera uma informação previamente salva sobre o usuário que está interagindo. Use para buscar dados e personalizar suas respostas.',
        parameters: {
            type: 'object',
            properties: {
                key: {
                    type: 'string',
                    description: 'A chave ou nome da informação que você quer recuperar (ex: "cor favorita").'
                },
            },
            required: ['key'],
        },
    },
  },
  // Ferramentas de canais de voz e fotos de perfil serão adicionadas aqui.
  {
    type: 'function',
    function: {
      name: 'join_voice_channel',
      description: 'Conecta o bot a um canal de voz específico.',
      parameters: {
        type: 'object',
        properties: {
          channel_id: {
            type: 'string',
            description: 'O ID do canal de voz para se conectar.',
          },
        },
        required: ['channel_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_voice_channel_members',
      description: 'Lista os membros em um canal de voz específico.',
      parameters: {
        type: 'object',
        properties: {
          channel_id: {
            type: 'string',
            description: 'O ID do canal de voz para verificar os membros.',
          },
        },
        required: ['channel_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_text_channels',
      description: 'Lista todos os canais de texto visíveis no servidor, junto com seus IDs e descrições (tópicos).',
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
      name: 'list_channels',
      description: 'Lists all visible channels in the server, including their ID, name, and type (text, voice, category, etc.). This is crucial for understanding the server layout and finding the right channel for an action.',
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
        name: 'play_music',
        description: 'Toca uma música ou a adiciona na fila. Requer o nome ou URL da música.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'O nome da música ou um link (YouTube, Spotify, etc.) para tocar.'
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
        description: 'Pausa a reprodução da música atual no servidor.',
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
        description: 'Retoma a reprodução da música que estava pausada.',
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
        description: 'Pula a música atual e começa a tocar a próxima da fila.',
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
        description: 'Para a música completamente, limpa a fila e desconecta o bot do canal de voz.',
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
        name: 'get_id',
        description: 'Obtém o ID de um usuário, canal, cargo ou mensagem com base no nome ou conteúdo.',
        parameters: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    description: 'O tipo de item para buscar o ID (user, channel, role, message).',
                    enum: ['user', 'channel', 'role', 'message']
                },
                query: {
                    type: 'string',
                    description: 'O nome (para user, channel, role) ou conteúdo (para message) para pesquisar.'
                },
            },
            required: ['type', 'query'],
        },
    },
  },
];

/**
 * Mapeia os nomes das ferramentas para suas funções de execução.
 * @param {import('discord.js').Client} client - O cliente do Discord.
 */
const getToolFunctions = (client) => ({
  analyze_image_from_url: async ({ url }) => {
    try {
      const settingsCollection = client.getDbCollection('server-settings');
      const serverSettings = await settingsCollection.findOne({ guildId: originalMessage.guild.id }) || {};
      const aiConfig = serverSettings.aiConfig || {};
      const visionModel = getModel(aiConfig, true);

      const response = await openai.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image in detail.' },
              { type: 'image_url', image_url: { url } },
            ],
          },
        ],
        max_tokens: 300,
      });

      const description = response.choices[0].message.content;
      return { success: true, content: `Image Analysis: ${description}` };
    } catch (error) {
      console.error('Error analyzing image:', error);
      return { success: false, content: 'An error occurred while trying to analyze the image. The URL might be invalid or the vision model may be unavailable.' };
    }
  },

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
            const items = results.items?.slice(0, 5) || [];
            if (items.length === 0) {
              resolve({ success: true, content: 'No results found.' });
              return;
            }
            const formattedResults = items.map((item, index) =>
              `${index + 1}. ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}`
            ).join('\n\n');
            resolve({ success: true, content: `Here are the top search results:\n${formattedResults}` });
          } catch (error) {
            resolve({ success: false, content: 'I received a response from the web search, but I couldn\'t understand it. Please try again.' });
          }
        });
      }).on('error', (err) => {
        resolve({ success: false, content: `I couldn't connect to the web search service. Please check the connection and try again.` });
      });
    });
  },

  save_user_memory: async ({ key, value }, originalMessage) => {
    const memories = client.getDbCollection('user-memories');
    const userId = originalMessage.author.id;
    try {
      await memories.updateOne({ userId, key }, { $set: { value, userTag: originalMessage.author.tag, updatedAt: new Date() } }, { upsert: true });
      return { success: true, content: `Okay, I've remembered that "${key}" is "${value}" for you.` };
    } catch (error) {
      console.error('Error saving user memory:', error);
      return { success: false, content: 'An error occurred while trying to save this information.' };
    }
  },

  get_user_memory: async ({ key }, originalMessage) => {
    const memories = client.getDbCollection('user-memories');
    const userId = originalMessage.author.id;
    try {
      const memory = await memories.findOne({ userId, key });
      if (memory) {
        return { success: true, content: `Information found for the key "${key}": ${memory.value}` };
      }
      return { success: false, content: `I couldn't find any information with the key "${key}" for you.` };
    } catch (error) {
      console.error('Error retrieving user memory:', error);
      return { success: false, content: 'An error occurred while trying to retrieve this information.' };
    }
  },

  delete_message: async ({ message_id, reason }, originalMessage) => {
    try {
      const messageToDelete = await originalMessage.channel.messages.fetch(message_id);
      await messageToDelete.delete();
      return { success: true, content: `Message ${message_id} deleted successfully.` };
    } catch (error) {
      console.error('Error deleting message:', error);
      return { success: false, content: `Could not delete message ${message_id}. Please check if the ID is correct and if I have permission to do so.` };
    }
  },

  send_message_to_channel: async ({ channel_id, message_content }) => {
    try {
      const channel = await client.channels.fetch(channel_id);
      if (channel && channel.isTextBased()) {
        await channel.send(message_content);
        return { success: true, content: `Message sent to channel #${channel.name}.` };
      }
      return { success: false, content: `Channel with ID ${channel_id} not found or it is not a text channel.` };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, content: 'An error occurred while trying to send the message.' };
    }
  },

  list_text_channels: async (_, originalMessage) => {
    try {
      const guild = originalMessage.guild;
      if (!guild) return { success: false, content: 'This function can only be used inside a server.' };
      const channels = guild.channels.cache
        .filter(channel => channel.isTextBased())
        .map(channel => ({ id: channel.id, name: channel.name, topic: channel.topic || 'No description.' }));
      return { success: true, content: channels };
    } catch (error) {
      console.error('Error listing text channels:', error);
      return { success: false, content: 'An error occurred while trying to list the text channels.' };
    }
  },

  list_channels: async (_, originalMessage) => {
    try {
      const guild = originalMessage.guild;
      if (!guild) return { success: false, content: 'This function can only be used inside a server.' };
      const getChannelTypeName = (type) => {
        switch (type) {
          case ChannelType.GuildText: return 'Text Channel';
          case ChannelType.GuildVoice: return 'Voice Channel';
          case ChannelType.GuildAnnouncement: return 'Announcement Channel';
          case ChannelType.GuildForum: return 'Forum';
          case ChannelType.PublicThread: return 'Public Thread';
          case ChannelType.PrivateThread: return 'Private Thread';
          case ChannelType.GuildStageVoice: return 'Stage Channel';
          case ChannelType.GuildCategory: return 'Category';
          default: return 'Other';
        }
      };
      const channels = guild.channels.cache.map(channel => ({ id: channel.id, name: channel.name, type: getChannelTypeName(channel.type) }));
      return { success: true, content: channels };
    } catch (error) {
      console.error('Error listing all channels:', error);
      return { success: false, content: 'An error occurred while trying to list the channels.' };
    }
  },

  read_channel_messages: async ({ channel_id, limit = 10 }) => {
    try {
      const channel = await client.channels.fetch(channel_id);
      if (!channel || !channel.isTextBased()) {
        return { success: false, content: `Channel with ID ${channel_id} not found or it is not a text channel.` };
      }
      const messages = await channel.messages.fetch({ limit: Math.min(limit, 50) });
      if (messages.size === 0) {
        return { success: true, content: `No recent messages found in channel #${channel.name}.` };
      }
      const formattedMessages = messages.map(msg => `${msg.author.bot ? '[BOT] ' : ''}${msg.author.username}: ${msg.content}`).reverse().join('\n');
      return { success: true, content: `Last ${messages.size} messages from channel #${channel.name}:\n${formattedMessages}` };
    } catch (error) {
      if (error.code === 10003 || error.code === 50001) {
        return { success: false, content: `Could not access the channel with ID ${channel_id}. Please check if the ID is correct and if I have permission to view it.` };
      }
      return { success: false, content: 'An error occurred while trying to read the channel\'s messages.' };
    }
  },

  find_user_voice_channel: async ({ user_id }, originalMessage) => {
    const guild = originalMessage.guild;
    if (!guild) return { success: false, content: 'This function can only be used inside a server.' };
    try {
      const member = await guild.members.fetch(user_id);
      if (!member) return { success: false, content: `User with ID ${user_id} not found in this server.` };
      const voiceChannel = member.voice.channel;
      if (voiceChannel) {
        return { success: true, content: { userId: user_id, username: member.user.username, channelId: voiceChannel.id, channelName: voiceChannel.name } };
      }
      return { success: true, content: `The user ${member.user.username} is not connected to a voice channel.` };
    } catch (error) {
      if (error.code === 10007) return { success: false, content: `User with ID ${user_id} not found.` };
      return { success: false, content: 'An error occurred while trying to locate the user.' };
    }
  },

  join_voice_channel: async ({ channel_id }, originalMessage) => {
    try {
      const voiceChannel = await client.channels.fetch(channel_id);
      if (!voiceChannel || !voiceChannel.isVoiceBased()) {
        return { success: false, content: `Voice channel with ID ${channel_id} not found or is invalid.` };
      }
      if (!client.riffy) return { success: false, content: 'The music system is not currently available. Please try again later.' };
      client.riffy.createConnection({
        guildId: originalMessage.guild.id,
        voiceChannel: voiceChannel.id,
        textChannel: originalMessage.channel.id,
        selfDeaf: true,
      });
      return { success: true, content: `Connected to voice channel: ${voiceChannel.name}` };
    } catch (error) {
      console.error('Error joining voice channel:', error);
      return { success: false, content: 'An error occurred while trying to join the voice channel.' };
    }
  },

  list_voice_channel_members: async ({ channel_id }) => {
    try {
      const channel = await client.channels.fetch(channel_id);
      if (!channel || !channel.isVoiceBased()) {
        return { success: false, content: `Voice channel with ID ${channel_id} not found or is invalid.` };
      }
      const members = channel.members.map(m => ({ id: m.id, username: m.user.username, isBot: m.user.bot }));
      if (members.length === 0) return { success: true, content: `There is no one in the voice channel ${channel.name}.` };
      return { success: true, content: members };
    } catch (error) {
      console.error('Error listing voice channel members:', error);
      return { success: false, content: 'An error occurred while listing the members.' };
    }
  },

  get_user_avatar: async ({ user_id }, originalMessage) => {
    try {
      const user = await client.users.fetch(user_id).catch(() => null);
      if (!user) return { success: false, content: `User "${user_id}" not found.` };
      return { success: true, content: user.displayAvatarURL({ dynamic: true, size: 512 }) };
    } catch (error) {
      console.error('Error fetching user avatar:', error);
      return { success: false, content: 'An error occurred while trying to fetch the profile picture.' };
    }
  },

  play_music: async ({ query }, originalMessage) => {
    try {
      const member = originalMessage.member;
      if (!member.voice.channel) return { success: false, content: 'You need to be in a voice channel to use this.' };
      if (!client.riffy) return { success: false, content: 'The music system is not currently available. Please try again later.' };

      const resolve = await client.riffy.resolve({ query, requester: originalMessage.author });
      const { loadType, tracks } = resolve;

      if (loadType === 'empty' || !tracks.length) return { success: false, content: `No music found for "${query}".` };

      const player = client.riffy.players.get(originalMessage.guild.id) || client.riffy.createConnection({
        guildId: originalMessage.guild.id,
        voiceChannel: member.voice.channel.id,
        textChannel: originalMessage.channel.id,
        deaf: true,
      });

      const track = tracks.shift();
      player.queue.add(track);
      if (!player.playing && !player.paused) player.play();

      return { success: true, content: `Added to queue: "${track.info.title}".` };
    } catch (error) {
      console.error('Error playing music:', error);
      return { success: false, content: 'An error occurred while trying to play the music.' };
    }
  },

  pause_music: async (_, msg) => {
    const player = client.riffy.players.get(msg.guild.id);
    if (!player) return { success: false, content: 'I am not playing anything right now.' };
    player.pause(true);
    return { success: true, content: 'Music paused.' };
  },

  resume_music: async (_, msg) => {
    const player = client.riffy.players.get(msg.guild.id);
    if (!player) return { success: false, content: 'I am not playing anything right now.' };
    player.pause(false);
    return { success: true, content: 'Music resumed.' };
  },

  skip_music: async (_, msg) => {
    const player = client.riffy.players.get(msg.guild.id);
    if (!player) return { success: false, content: 'I am not playing anything right now.' };
    player.stop();
    return { success: true, content: 'Skipped to the next song.' };
  },

  stop_music: async (_, msg) => {
    const player = client.riffy.players.get(msg.guild.id);
    if (player) player.destroy();
    return { success: true, content: 'Music stopped and queue cleared.' };
  },

  get_id: async ({ type, query }, originalMessage) => {
    const guild = originalMessage.guild;
    if (!guild) return { success: false, content: 'Could not find the server.' };
    try {
      let found;
      switch (type) {
        case 'user':
          const members = await guild.members.search({ query, limit: 1 });
          found = members.first();
          break;
        case 'channel':
          found = guild.channels.cache.find(c => c.name.toLowerCase() === query.toLowerCase());
          break;
        case 'role':
          found = guild.roles.cache.find(r => r.name.toLowerCase() === query.toLowerCase());
          break;
        case 'message':
          const messages = await originalMessage.channel.messages.fetch({ limit: 100 });
          found = messages.find(m => m.content.includes(query));
          break;
        default:
          return { success: false, content: `Invalid type: ${type}` };
      }
      if (found) return { success: true, content: `The ID for "${query}" (${type}) is: ${found.id}` };
      return { success: false, content: `No ${type} found for "${query}".` };
    } catch (error) {
      console.error(`Error searching for ID of ${type} "${query}":`, error);
      return { success: false, content: 'An error occurred while searching for the ID.' };
    }
  },
});

module.exports = {
  tools,
  getToolFunctions,
};
