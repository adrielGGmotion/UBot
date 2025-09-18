const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Pula a música atual.'),

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

    const currentTrack = player.queue.current;

    // Para o player, o que aciona o evento 'trackEnd' e inicia a próxima música
    player.stop();

    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setDescription(`⏭️ Música pulada: **${currentTrack.info.title}**`);

    await interaction.reply({ embeds: [embed] });
  }
};
