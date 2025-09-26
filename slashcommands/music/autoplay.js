const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Ativa ou desativa a reprodução automática quando a fila termina.'),

  async execute(interaction, client) {
    if (!client.db) {
      return interaction.reply({ content: 'O banco de dados não está conectado. Esta funcionalidade está indisponível no momento.', ephemeral: true });
    }

    const { guildId } = interaction;
    const settingsCollection = client.db.collection('server-settings');

    let settings = await settingsCollection.findOne({ guildId });

    // Se não houver configurações, o autoplay está efetivamente desativado.
    const currentAutoplayState = settings?.musicConfig?.autoplay || false;
    const newAutoplayState = !currentAutoplayState;

    await settingsCollection.updateOne(
      { guildId },
      { $set: { 'musicConfig.autoplay': newAutoplayState } },
      { upsert: true }
    );

    const embed = new EmbedBuilder()
      .setColor(client.config.colors.primary)
      .setTitle('🎵 Autoplay')
      .setDescription(`A reprodução automática foi **${newAutoplayState ? 'ativada' : 'desativada'}**.`);

    await interaction.reply({ embeds: [embed] });
  }
};