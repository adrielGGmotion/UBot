/**
 * @file Este arquivo centraliza a definição e a implementação das ferramentas
 * que a IA pode utilizar para interagir com o Discord.
 */

const https = require('https');

const tools = [
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
      name: 'get_user_avatar',
      description: 'Obtém a URL da foto de perfil (avatar) de um usuário específico.',
      parameters: {
        type: 'object',
        properties: {
          user_id: {
            type: 'string',
            description: 'O ID do usuário para buscar a foto de perfil.',
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
      description: 'Exclui uma mensagem específica em um canal. Requer o ID da mensagem.',
      parameters: {
        type: 'object',
        properties: {
          message_id: {
            type: 'string',
            description: 'O ID da mensagem a ser excluída.',
          },
          reason: {
            type: 'string',
            description: 'A razão pela qual a mensagem está sendo excluída (opcional).',
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
        description: 'Envia uma mensagem para um canal de texto específico no servidor.',
        parameters: {
            type: 'object',
            properties: {
                channel_id: {
                    type: 'string',
                    description: 'O ID do canal para onde a mensagem será enviada.'
                },
                message_content: {
                    type: 'string',
                    description: 'O conteúdo da mensagem a ser enviada.'
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
      description: 'Lista todos os canais (de texto e voz) visíveis no servidor, junto com seus IDs, nomes e tipos.',
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
  google_search: async ({ query }) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;

    if (!apiKey || !cseId) {
      return { success: false, content: 'Google Search API key or CSE ID is not configured in the .env file.' };
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}`;

    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const results = JSON.parse(data);
            if (results.error) {
              console.error('Google Search API Error:', results.error);
              resolve({ success: false, content: `API Error: ${results.error.message}` });
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
            console.error('Error parsing Google Search API response:', error);
            resolve({ success: false, content: 'Failed to parse the response from Google Search API.' });
          }
        });
      }).on('error', (err) => {
        console.error('Error with Google Search API request:', err);
        resolve({ success: false, content: `Request Error: ${err.message}` });
      });
    });
  },

  save_user_memory: async ({ key, value }, originalMessage) => {
    const memories = client.getDbCollection('user-memories');
    const userId = originalMessage.author.id;
    const userTag = originalMessage.author.tag;

    try {
      await memories.updateOne(
        { userId, key },
        { $set: { value, userTag, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log(`[Memory] Saved memory for user ${userTag} (${userId}): { ${key}: "${value}" }`);
      return { success: true, content: `Ok, lembrei que "${key}" é "${value}" para você.` };
    } catch (error) {
      console.error('Erro ao salvar memória do usuário:', error);
      return { success: false, content: 'Ocorreu um erro ao tentar salvar essa informação.' };
    }
  },

  get_user_memory: async ({ key }, originalMessage) => {
    const memories = client.getDbCollection('user-memories');
    const userId = originalMessage.author.id;
    const userTag = originalMessage.author.tag;

    try {
      const memory = await memories.findOne({ userId, key });
      if (memory) {
        console.log(`[Memory] Retrieved memory for user ${userTag} (${userId}): { ${key}: "${memory.value}" }`);
        return { success: true, content: `Informação encontrada para a chave "${key}": ${memory.value}` };
      } else {
        console.log(`[Memory] No memory found for user ${userTag} (${userId}) with key "${key}"`);
        return { success: false, content: `Não encontrei nenhuma informação com a chave "${key}" para você.` };
      }
    } catch (error) {
      console.error('Erro ao recuperar memória do usuário:', error);
      return { success: false, content: 'Ocorreu um erro ao tentar buscar essa informação.' };
    }
  },

  delete_message: async ({ message_id, reason }, originalMessage) => {
    try {
      const messageToDelete = await originalMessage.channel.messages.fetch(message_id);
      await messageToDelete.delete();
      return { success: true, content: `Mensagem ${message_id} excluída com sucesso.` };
    } catch (error) {
      console.error('Erro ao excluir mensagem:', error);
      return { success: false, content: `Não foi possível excluir a mensagem ${message_id}. Verifique se o ID está correto e se eu tenho permissão.` };
    }
  },
  send_message_to_channel: async ({ channel_id, message_content }) => {
    try {
        const channel = await client.channels.fetch(channel_id);
        if (channel && channel.isTextBased()) {
            await channel.send(message_content);
            return { success: true, content: `Mensagem enviada para o canal ${channel.name}.` };
        }
        return { success: false, content: `Canal com ID ${channel_id} não encontrado ou não é um canal de texto.` };
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        return { success: false, content: 'Ocorreu um erro ao tentar enviar a mensagem.' };
    }
  },
  list_text_channels: async (_, originalMessage) => {
    try {
      const guild = originalMessage.guild;
      if (!guild) {
        return { success: false, content: 'Esta função só pode ser usada dentro de um servidor.' };
      }

      const channels = guild.channels.cache
        .filter(channel => channel.isTextBased())
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          topic: channel.topic || 'Sem descrição.',
        }));

      return { success: true, content: JSON.stringify(channels, null, 2) };
    } catch (error) {
      console.error('Erro ao listar canais:', error);
      return { success: false, content: 'Ocorreu um erro ao tentar listar os canais de texto.' };
    }
  },
  list_channels: async (_, originalMessage) => {
    try {
      const guild = originalMessage.guild;
      if (!guild) {
        return { success: false, content: 'Esta função só pode ser usada dentro de um servidor.' };
      }

      const channels = guild.channels.cache
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.isTextBased() ? 'text' : (channel.isVoiceBased() ? 'voice' : 'unknown'),
        }));

      return { success: true, content: JSON.stringify(channels, null, 2) };
    } catch (error) {
      console.error('Erro ao listar todos os canais:', error);
      return { success: false, content: 'Ocorreu um erro ao tentar listar os canais.' };
    }
  },
  join_voice_channel: async ({ channel_id }, originalMessage) => {
    try {
      const guild = originalMessage.guild;
      const voiceChannel = await client.channels.fetch(channel_id);

      if (!guild || !voiceChannel || !voiceChannel.isVoiceBased()) {
        return { success: false, content: `Canal de voz com ID ${channel_id} não encontrado ou inválido.` };
      }

      // Assumindo que o Riffy manager está no client.riffy
      if (!client.riffy) {
        return { success: false, content: 'O sistema de música (Riffy) não parece estar inicializado.' };
      }

      client.riffy.createConnection({
        guildId: guild.id,
        voiceChannel: voiceChannel.id,
        textChannel: originalMessage.channel.id,
        selfDeaf: true,
      });

      return { success: true, content: `Conectado ao canal de voz: ${voiceChannel.name}` };
    } catch (error) {
      console.error('Erro ao entrar no canal de voz:', error);
      return { success: false, content: 'Ocorreu um erro ao tentar entrar no canal de voz.' };
    }
  },
  list_voice_channel_members: async ({ channel_id }) => {
    try {
      const channel = await client.channels.fetch(channel_id);

      if (!channel || !channel.isVoiceBased()) {
        return { success: false, content: `Canal de voz com ID ${channel_id} não encontrado ou inválido.` };
      }

      const members = channel.members.map(member => ({
        id: member.id,
        username: member.user.username,
        isBot: member.user.bot,
      }));

      if (members.length === 0) {
        return { success: true, content: `Não há ninguém no canal de voz ${channel.name}.` };
      }

      return { success: true, content: JSON.stringify(members, null, 2) };
    } catch (error) {
      console.error('Erro ao listar membros do canal de voz:', error);
      return { success: false, content: 'Ocorreu um erro ao listar os membros.' };
    }
  },
  get_user_avatar: async ({ user_id }, originalMessage) => {
    try {
      let user;
      // Tenta buscar pelo ID primeiro (método mais confiável)
      try {
        user = await client.users.fetch(user_id);
      } catch (e) {
        // Se falhar, pode não ser um ID. Tenta buscar pelo nome no servidor.
        if (originalMessage.guild) {
          const members = await originalMessage.guild.members.search({ query: user_id, limit: 1 });
          const member = members.first();
          if (member) {
            user = member.user;
          }
        }
      }

      if (!user) {
        return { success: false, content: `Usuário "${user_id}" não encontrado.` };
      }

      const avatarURL = user.displayAvatarURL({ dynamic: true, size: 512 });
      return { success: true, content: avatarURL };
    } catch (error) {
      console.error('Erro ao buscar avatar do usuário:', error);
      return { success: false, content: 'Ocorreu um erro ao tentar buscar a foto de perfil.' };
    }
  },
  play_music: async ({ query }, originalMessage) => {
    try {
        const guild = originalMessage.guild;
        if (!guild) return { success: false, content: 'Comando de música apenas em servidores.' };

        const member = await guild.members.fetch(originalMessage.author.id);
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) return { success: false, content: 'Você precisa estar em um canal de voz.' };

        if (!client.riffy) return { success: false, content: 'Sistema de música não inicializado.' };

        const resolve = await client.riffy.resolve({ query, requester: originalMessage.author });
        const { loadType, tracks } = resolve;

        if (loadType === 'empty' || tracks.length === 0) {
            return { success: false, content: `Nenhuma música encontrada para "${query}".` };
        }

        const player = client.riffy.players.get(guild.id) || client.riffy.createConnection({
            guildId: guild.id,
            voiceChannel: voiceChannel.id,
            textChannel: originalMessage.channel.id,
            deaf: true,
        });

        const track = tracks.shift();
        player.queue.add(track);

        if (!player.playing && !player.paused) {
            player.play();
        }

        return { success: true, content: `Adicionado à fila: "${track.info.title}".` };
    } catch (error) {
        console.error('Erro ao tocar música:', error);
        return { success: false, content: 'Ocorreu um erro ao tentar tocar a música.' };
    }
  },
  pause_music: async (_, originalMessage) => {
      const player = client.riffy.players.get(originalMessage.guild.id);
      if (!player) return { success: false, content: 'Não estou tocando nada.' };
      player.pause(true);
      return { success: true, content: 'Música pausada.' };
  },
  resume_music: async (_, originalMessage) => {
      const player = client.riffy.players.get(originalMessage.guild.id);
      if (!player) return { success: false, content: 'Não estou tocando nada.' };
      player.pause(false);
      return { success: true, content: 'Música retomada.' };
  },
  skip_music: async (_, originalMessage) => {
      const player = client.riffy.players.get(originalMessage.guild.id);
      if (!player) return { success: false, content: 'Não estou tocando nada.' };
      player.stop();
      return { success: true, content: 'Música pulada.' };
  },
  stop_music: async (_, originalMessage) => {
      const player = client.riffy.players.get(originalMessage.guild.id);
      if (player) {
          player.destroy();
          return { success: true, content: 'Música parada e fila limpa.' };
      }
      return { success: false, content: 'Não estou tocando nada.' };
  },
  get_id: async ({ type, query }, originalMessage) => {
    const guild = originalMessage.guild;
    if (!guild) return { success: false, content: 'Não foi possível encontrar a guilda.' };
    let found;

    try {
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
                return { success: false, content: `Tipo inválido: ${type}` };
        }

        if (found) {
            return { success: true, content: `O ID para "${query}" (${type}) é: ${found.id}` };
        } else {
            return { success: false, content: `Nenhum ${type} encontrado para "${query}".` };
        }
    } catch (error) {
        console.error(`Erro ao buscar ID para ${type} "${query}":`, error);
        return { success: false, content: `Ocorreu um erro ao buscar o ID.` };
    }
  },
});

module.exports = {
  tools,
  getToolFunctions,
};
