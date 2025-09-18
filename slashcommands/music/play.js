const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Toca uma música ou a adiciona na fila.')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('O nome da música ou um link (YouTube, Spotify, Soundcloud).')
        .setRequired(true)),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    const query = interaction.options.getString('query');

    if (!channel) {
      return interaction.reply({ content: 'Você precisa estar em um canal de voz para usar este comando.', ephemeral: true });
    }
    
    const permissions = channel.permissionsFor(client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return interaction.reply({ content: 'Eu preciso de permissão para entrar e falar no seu canal de voz!', ephemeral: true });
    }

    await interaction.deferReply();

    const resolve = await client.riffy.resolve({ query: query, requester: interaction.user });
    const { loadType, tracks, playlistInfo } = resolve;
    
    const player = client.riffy.players.get(interaction.guildId) || client.riffy.createConnection({
        guildId: interaction.guildId,
        voiceChannel: channel.id,
        textChannel: interaction.channelId,
        deaf: true,
    });
    
    const destroyTimeout = player.get("destroyTimeout");
    if (destroyTimeout) clearTimeout(destroyTimeout);

    const embed = new EmbedBuilder().setColor(client.config.colors.primary);

    // CORREÇÃO: Todos os casos agora estão em letras minúsculas para corresponder à resposta do Lavalink.
    switch (loadType) {
        case 'playlist':
            for (const track of tracks) {
                player.queue.add(track);
            }
            embed.setTitle("✅ Playlist Adicionada")
                 .setDescription(`**${playlistInfo.name}** com **${tracks.length}** músicas foi adicionada à fila.`);
            await interaction.editReply({ embeds: [embed] });
            if (!player.playing && !player.paused) {
                // Tenta usar o método de reprodução correto com base na API do riffy
                try {
                    player.play();
                } catch (error) {
                    console.error("Error playing track:", error);
                    // Método alternativo se play() não existir
                    if (typeof player.start === 'function') {
                        player.start();
                    }
                }
            }
            break;

        case 'search':
        case 'track':
            const track = tracks.shift();
            player.queue.add(track);
            embed.setTitle("👍 Adicionado à Fila")
                 .setDescription(`[${track.info.title}](${track.info.uri})`);
            await interaction.editReply({ embeds: [embed] });
            if (!player.playing && !player.paused) {
                // Tenta usar o método de reprodução correto com base na API do riffy
                try {
                    // Garante que a música será reproduzida completamente
                    player.play({ track: track });
                } catch (error) {
                    console.error("Error playing track:", error);
                    // Método alternativo se play() não existir
                    if (typeof player.start === 'function') {
                        player.start(track);
                    }
                }
            }
            break;

        case 'empty':
            return interaction.editReply({ content: '❌ Não encontrei nenhum resultado para essa busca.', ephemeral: true });

        case 'error':
            console.error("Lavalink load failed. Resolve object:", resolve);
            return interaction.editReply({ content: '🔥 Ocorreu um erro ao tentar carregar a música. Verifique os logs do seu servidor Lavalink.', ephemeral: true });

        default:
            console.warn(`[Debug] Tipo de carga desconhecido: ${loadType}`);
            return interaction.editReply({ content: '❓ Ocorreu um resultado inesperado do serviço de música.', ephemeral: true });
    }
  }
};