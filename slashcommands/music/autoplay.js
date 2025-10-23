const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Ativa ou desativa a reprodução automática quando a fila termina.'),

  async execute(interaction, client) {
    if (!client.db) {
      return interaction.reply({ content: client.getLocale('cmd_db_not_connected_autoplay'), ephemeral: true });
    }

    const { guildId } = interaction;
    const settingsCollection = client.db.collection('server-settings');

    let settings = await settingsCollection.findOne({ guildId });

    // If there are no settings, autoplay is effectively off.
    const currentAutoplayState = settings?.musicConfig?.autoplay || false;
    const newAutoplayState = !currentAutoplayState;

    await settingsCollection.updateOne(
      { guildId },
      { $set: { 'musicConfig.autoplay': newAutoplayState } },
      { upsert: true }
    );

    const status = newAutoplayState ? client.getLocale('cmd_autoplay_status_enabled') : client.getLocale('cmd_autoplay_status_disabled');

    const embed = new EmbedBuilder()
      .setColor(client.config.colors.primary)
      .setTitle(client.getLocale('cmd_autoplay_embed_title'))
      .setDescription(client.getLocale('cmd_autoplay_embed_description', { status }));

    await interaction.editReply({ embeds: [embed] });
  }
};