const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa a música atual.'),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    if (!channel) {
      return interaction.reply({ content: 'Você precisa estar em um canal de voz.', ephemeral: true });
    }

    const player = client.riffy.players.get(interaction.guildId);
    if (!player || !player.playing) {
      return interaction.reply({ content: 'Não estou tocando nada no momento.', ephemeral: true });
    }

    if (player.voiceChannel !== channel.id) {
        return interaction.reply({ content: 'Você precisa estar no mesmo canal de voz que eu.', ephemeral: true });
    }

    if (player.paused) {
        return interaction.reply({ content: 'A música já está pausada.', ephemeral: true });
    }

    player.pause(true);

    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setDescription('⏸️ A música foi pausada.');

    await interaction.reply({ embeds: [embed] });
  }
};
