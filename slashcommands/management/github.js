const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('github')
    .setDescription('Manages GitHub repository notifications.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Adds a repository to monitor in a specific channel.')
        .addStringOption(option =>
          option.setName('repository')
            .setDescription('The repository to monitor (e.g., owner/repo-name).')
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to post notifications in.')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Removes a monitored repository from this server.')
        .addStringOption(option =>
          option.setName('repository')
            .setDescription('The repository to remove (e.g., owner/repo-name).')
            .setRequired(true))
    ),
  async execute(interaction, client) {
    if (!client.db) {
      return interaction.reply({ content: client.getLocale('cmd_checkcluster_db_disconnected'), ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const repoName = interaction.options.getString('repository').toLowerCase();
    const channel = interaction.options.getChannel('channel');
    const settingsCollection = client.getDbCollection('server-settings');

    if (subcommand === 'add') {
      await settingsCollection.findOneAndUpdate(
        { guildId: interaction.guild.id },
        { $addToSet: { githubRepos: { repo: repoName, channelId: channel.id } } },
        { upsert: true }
      );
      await interaction.reply({ content: client.getLocale('cmd_github_added', { repo: repoName, channel: channel.name }), ephemeral: true });
    } else if (subcommand === 'remove') {
      await settingsCollection.findOneAndUpdate(
        { guildId: interaction.guild.id },
        { $pull: { githubRepos: { repo: repoName } } }
      );
      await interaction.reply({ content: client.getLocale('cmd_github_removed', { repo: repoName }), ephemeral: true });
    }
  }
};