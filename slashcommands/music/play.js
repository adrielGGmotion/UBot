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
    const settings = await client.getGuildSettings(interaction.guildId);

    if (!channel) {
        return interaction.reply({ content: client.getLocale('cmd_music_not_in_vc'), ephemeral: true });
    }

    const permissions = channel.permissionsFor(client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return interaction.reply({ content: client.getLocale('cmd_play_no_perms'), ephemeral: true });
    }

    if (!client.riffy || client.riffy.nodes.size === 0) {
        console.error("Riffy client not initialized or no nodes available.");
        return interaction.reply({ content: client.getLocale('cmd_play_no_lavalink_nodes'), ephemeral: true });
    }

    try {
        await interaction.deferReply();

        const resolve = await client.riffy.resolve({ query: query, requester: interaction.user });
        const { loadType, tracks, playlistInfo } = resolve;

        if (loadType === 'error') {
            console.error('Lavalink load error:', resolve.error);
            return interaction.editReply({ content: client.getLocale('cmd_play_load_error') });
        }

        if (loadType === 'empty') {
            return interaction.editReply({ content: client.getLocale('cmd_play_no_results') });
        }

        const player = client.riffy.players.get(interaction.guildId) || client.riffy.createConnection({
            guildId: interaction.guildId,
            voiceChannel: channel.id,
            textChannel: interaction.channelId,
            deaf: true,
        });

        const destroyTimeout = player.get("destroyTimeout");
        if (destroyTimeout) clearTimeout(destroyTimeout);

        const embed = new EmbedBuilder().setColor(settings.colors.primary);

        if (loadType === 'playlist') {
            for (const track of tracks) {
                player.queue.add(track);
            }
            embed.setTitle(client.getLocale('cmd_play_playlist_added_title'))
                 .setDescription(client.getLocale('cmd_play_playlist_added_description', { playlistName: playlistInfo.name, trackCount: tracks.length }));
        } else {
            const track = tracks.shift();
            player.queue.add(track);
            embed.setTitle(client.getLocale('cmd_play_track_added_title'))
                 .setDescription(`[${track.info.title}](${track.info.uri})`);
        }

        await interaction.editReply({ embeds: [embed] });

        if (!player.playing && !player.paused) {
            player.play();
        }
    } catch (error) {
        console.error('Error in /play command:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: client.getLocale('cmd_play_generic_error'), embeds: [], components: [] });
        }
    }
  }
};