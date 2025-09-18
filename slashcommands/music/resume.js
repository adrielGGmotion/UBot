const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Retoma a música atual.'),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    if (!channel) {
      return interaction.reply({ content: 'Você precisa estar em um canal de voz.', ephemeral: true });
    }

    const player = client.riffy.players.get(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: 'Não há nada para retomar.', ephemeral: true });
    }

    if (player.voiceChannel !== channel.id) {
        return interaction.reply({ content: 'Você precisa estar no mesmo canal de voz que eu.', ephemeral: true });
    }

    if (!player.paused) {
        return interaction.reply({ content: 'A música não está pausada.', ephemeral: true });
    }

    player.pause(false);

    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setDescription('▶️ A música foi retomada.');

    await interaction.reply({ embeds: [embed] });
  }
};
