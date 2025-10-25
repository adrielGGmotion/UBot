const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Mostra informações sobre a música que está tocando.'),

  async execute(interaction, client) {
    const player = client.riffy.players.get(interaction.guildId);
    const settings = await client.getGuildSettings(interaction.guildId);

    if (!player || !player.playing) {
      return interaction.editReply({ content: client.getLocale('cmd_music_not_playing'), ephemeral: true });
    }

    const track = player.queue.current;
    const position = player.position;
    const duration = track.info.length;

    const createProgressBar = (pos, dur) => {
        const percentage = pos / dur;
        const progress = Math.round(18 * percentage);
        const empty = 18 - progress;
        return '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬'.substring(0, progress) + '🔘' + '▬'.repeat(empty);
    };

    const formatDuration = (ms) => {
        const seconds = Math.floor((ms / 1000) % 60).toString().padStart(2, '0');
        const minutes = Math.floor((ms / (1000 * 60)) % 60).toString().padStart(2, '0');
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    const embed = new EmbedBuilder()
        .setColor(settings.colors.primary)
        .setAuthor({ name: client.getLocale('cmd_nowplaying_author') })
        .setTitle(track.info.title)
        .setURL(track.info.uri)
        .setThumbnail(track.info.thumbnail)
        .addFields(
            { name: client.getLocale('cmd_nowplaying_field_author'), value: track.info.author, inline: true },
            { name: client.getLocale('cmd_nowplaying_field_requester'), value: `<@${track.info.requester.id}>`, inline: true },
            { name: client.getLocale('cmd_nowplaying_field_volume'), value: `${player.volume}%`, inline: true }
        )
        .addFields({
            name: client.getLocale('cmd_nowplaying_field_progress'),
            value: `\`${formatDuration(position)}\` ${createProgressBar(position, duration)} \`${formatDuration(duration)}\``
        });

    await interaction.editReply({ embeds: [embed] });
  }
};
