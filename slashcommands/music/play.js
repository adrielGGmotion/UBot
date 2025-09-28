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
      return interaction.reply({ content: client.getLocale('cmd_music_not_in_vc_generic'), flags: 64 });
    }
    
    const permissions = channel.permissionsFor(client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return interaction.reply({ content: client.getLocale('cmd_play_no_perms'), flags: 64 });
    }

    try {
        await interaction.deferReply();
    } catch (error) {
        console.error(client.getLocale('log_defer_reply_error'), error);
        // If defer fails, it's likely the interaction is no longer valid.
        // We log the error and return to prevent a crash.
        return;
    }

    try {
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

        switch (loadType) {
            case 'playlist':
                for (const track of tracks) {
                    player.queue.add(track);
                }
                embed.setTitle(client.getLocale('cmd_play_playlist_added_title'))
                    .setDescription(client.getLocale('cmd_play_playlist_added_description', { playlistName: playlistInfo.name, trackCount: tracks.length }));
                await interaction.editReply({ embeds: [embed] });
                if (!player.playing && !player.paused) player.play();
                break;

            case 'search':
            case 'track':
                const track = tracks.shift();
                player.queue.add(track);
                embed.setTitle(client.getLocale('cmd_play_track_added_title'))
                    .setDescription(`[${track.info.title}](${track.info.uri})`);
                await interaction.editReply({ embeds: [embed] });
                if (!player.playing && !player.paused) player.play();
                break;

            case 'empty':
                return interaction.editReply({ content: client.getLocale('cmd_play_no_results') });

            case 'error':
                console.error(client.getLocale('log_lavalink_load_error'), resolve);
                return interaction.editReply({ content: client.getLocale('cmd_play_load_error') });

            default:
                console.warn(client.getLocale('log_play_unknown_load_type', { loadType: loadType }));
                return interaction.editReply({ content: client.getLocale('cmd_play_unexpected_result') });
        }
    } catch (error) {
        console.error(client.getLocale('log_play_processing_error'), error);
        await interaction.editReply({ content: client.getLocale('cmd_play_generic_error') });
    }
  }
};