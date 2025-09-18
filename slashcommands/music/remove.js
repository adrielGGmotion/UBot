const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove uma música da fila.')
    .addIntegerOption(option =>
      option.setName('position')
        .setDescription('A posição da música na fila para remover.')
        .setRequired(true)
        .setMinValue(1)),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    if (!channel) {
      return interaction.reply({ content: 'Você precisa estar em um canal de voz.', ephemeral: true });
    }

    const player = client.riffy.players.get(interaction.guildId);
    if (!player || player.queue.isEmpty) {
      return interaction.reply({ content: 'A fila está vazia.', ephemeral: true });
    }

    if (player.voiceChannel !== channel.id) {
        return interaction.reply({ content: 'Você precisa estar no mesmo canal de voz que eu.', ephemeral: true });
    }

    const position = interaction.options.getInteger('position');

    if (position > player.queue.length) {
        return interaction.reply({ content: `Posição inválida. A fila tem apenas ${player.queue.length} músicas.`, ephemeral: true });
    }

    const removedTrack = player.queue.remove(position - 1);

    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setDescription(`🗑️ Removido da fila: **${removedTrack.info.title}**`);

    await interaction.reply({ embeds: [embed] });
  }
};
