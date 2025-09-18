const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Limpa todas as músicas da fila.'),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    if (!channel) {
      return interaction.reply({ content: 'Você precisa estar em um canal de voz.', ephemeral: true });
    }

    const player = client.riffy.players.get(interaction.guildId);
    if (!player || player.queue.isEmpty) {
      return interaction.reply({ content: 'A fila já está vazia.', ephemeral: true });
    }

    if (player.voiceChannel !== channel.id) {
        return interaction.reply({ content: 'Você precisa estar no mesmo canal de voz que eu.', ephemeral: true });
    }

    player.queue.clear();

    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setDescription('🧹 A fila foi limpa.');

    await interaction.reply({ embeds: [embed] });
  }
};
