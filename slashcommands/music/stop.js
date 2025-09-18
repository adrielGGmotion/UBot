const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Para a música, limpa a fila e desconecta o bot.'),

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

    // O evento 'playerDestroy' no RiffyManager cuidará da limpeza da mensagem 'Now Playing'
    player.destroy();

    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setDescription('⏹️ A reprodução foi parada e a fila foi limpa.');

    await interaction.reply({ embeds: [embed] });
  }
};
