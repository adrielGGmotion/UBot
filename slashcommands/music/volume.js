const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ajusta o volume da música.')
    .addIntegerOption(option =>
      option.setName('level')
        .setDescription('O nível do volume (de 0 a 100).')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    if (!channel) {
      return interaction.reply({ content: 'Você precisa estar em um canal de voz.', ephemeral: true });
    }

    const player = client.riffy.players.get(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: 'Não estou tocando nada no momento.', ephemeral: true });
    }

    if (player.voiceChannel !== channel.id) {
        return interaction.reply({ content: 'Você precisa estar no mesmo canal de voz que eu.', ephemeral: true });
    }

    const volume = interaction.options.getInteger('level');
    player.setVolume(volume);

    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setDescription(`🔊 O volume foi ajustado para **${volume}%**.`);

    await interaction.reply({ embeds: [embed] });
  }
};
