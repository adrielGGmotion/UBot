const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Ativa ou desativa a reprodução automática quando a fila termina.'),

  async execute(interaction, client) {
    const { guildId } = interaction;
    const settings = await client.getGuildSettings(guildId);

    const newAutoplayState = !settings.music.autoplay;

    if (client.db) {
      const settingsCollection = client.getDbCollection('guild-settings');
      await settingsCollection.updateOne(
        { guildId },
        { $set: { 'music.autoplay': newAutoplayState } },
        { upsert: true }
      );
    }

    const status = newAutoplayState ? client.getLocale('cmd_autoplay_status_enabled') : client.getLocale('cmd_autoplay_status_disabled');

    const embed = new EmbedBuilder()
      .setColor(settings.colors.primary)
      .setTitle(client.getLocale('cmd_autoplay_embed_title'))
      .setDescription(client.getLocale('cmd_autoplay_embed_description', { status }));

    await interaction.editReply({ embeds: [embed] });
  }
};