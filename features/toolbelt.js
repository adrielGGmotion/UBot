/**
 * @file Este arquivo centraliza a definição e a implementação das ferramentas
 * que a IA pode utilizar para interagir com o Discord.
 */

const tools = [
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
];

/**
 * Mapeia os nomes das ferramentas para suas funções de execução.
 * @param {import('discord.js').Client} client - O cliente do Discord.
 */
const getToolFunctions = (client) => ({
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

      client.riffy.create({
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
  get_user_avatar: async ({ user_id }) => {
    try {
      const user = await client.users.fetch(user_id);
      if (!user) {
        return { success: false, content: `Usuário com ID ${user_id} não encontrado.` };
      }

      const avatarURL = user.displayAvatarURL({ dynamic: true, size: 512 });
      return { success: true, content: avatarURL };
    } catch (error) {
      console.error('Erro ao buscar avatar do usuário:', error);
      return { success: false, content: 'Ocorreu um erro ao tentar buscar a foto de perfil.' };
    }
  },
});

module.exports = {
  tools,
  getToolFunctions,
};
