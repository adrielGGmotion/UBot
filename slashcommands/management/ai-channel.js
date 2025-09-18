const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ai-channel')
    .setDescription('Manages channels where the AI can chat freely.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Adds a channel to the AI free-chat list.')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to add.')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Removes a channel from the AI free-chat list.')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to remove.')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
    ),
  async execute(interaction, client) {
    if (!client.db) {
      return interaction.reply({ content: client.getLocale('cmd_checkcluster_db_disconnected'), ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel');
    const settingsCollection = client.getDbCollection('server-settings');

    const updateOperation = subcommand === 'add'
      ? { $addToSet: { aiChannelIds: channel.id } }
      : { $pull: { aiChannelIds: channel.id } };

    await settingsCollection.findOneAndUpdate(
      { guildId: interaction.guild.id },
      updateOperation,
      { upsert: true }
    );

    const localeKey = subcommand === 'add' ? 'cmd_aichannel_added' : 'cmd_aichannel_removed';
    await interaction.reply({ content: client.getLocale(localeKey, { channel: channel.name }), ephemeral: true });
  }
};