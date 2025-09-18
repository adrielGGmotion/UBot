const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Mostra informações sobre a música que está tocando.'),

  async execute(interaction, client) {
    const player = client.riffy.players.get(interaction.guildId);

    if (!player || !player.playing) {
      return interaction.reply({ content: 'Não estou tocando nada no momento.', ephemeral: true });
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
        .setColor(client.config.colors.primary)
        .setAuthor({ name: "Tocando Agora" })
        .setTitle(track.info.title)
        .setURL(track.info.uri)
        .setThumbnail(track.info.thumbnail)
        .addFields(
            { name: "Autor", value: track.info.author, inline: true },
            { name: "Pedido por", value: `<@${track.info.requester.id}>`, inline: true },
            { name: "Volume", value: `${player.volume}%`, inline: true }
        )
        .addFields({
            name: "Progresso",
            value: `\`${formatDuration(position)}\` ${createProgressBar(position, duration)} \`${formatDuration(duration)}\``
        });

    await interaction.reply({ embeds: [embed] });
  }
};
