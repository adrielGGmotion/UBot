const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ai-settings')
    .setDescription('Manages the AI\'s configuration for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('model')
        .setDescription('Sets the AI model to be used.')
        .addStringOption(option =>
          option.setName('model_name')
            .setDescription('The name of the model from OpenRouter (e.g., openai/gpt-4o).')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('web-search')
        .setDescription('Enables or disables web search for the AI.')
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Set to true to enable, false to disable.')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('personality')
        .setDescription('Sets a custom personality for the AI.')
        .addStringOption(option =>
          option.setName('prompt')
            .setDescription('A detailed prompt describing the AI\'s personality and behavior.')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('Displays the current AI settings for this server.')
    ),
  async execute(interaction, client) {
    if (!client.db) {
      return interaction.reply({ content: client.getLocale('cmd_db_not_connected_settings'), ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const settingsCollection = client.getDbCollection('server-settings');
    const guildId = interaction.guild.id;

    if (subcommand === 'view') {
      const serverSettings = await settingsCollection.findOne({ guildId });
      const aiConfig = serverSettings?.aiConfig || {};

      const currentSettings = [
        `**${client.getLocale('cmd_aisettings_model')}:** \`${aiConfig.model || client.getLocale('cmd_aisettings_not_set_default')}\``,
        `**${client.getLocale('cmd_aisettings_web_search')}:** \`${aiConfig.webSearch ? client.getLocale('cmd_aisettings_enabled') : client.getLocale('cmd_aisettings_disabled')}\``,
        `**${client.getLocale('cmd_aisettings_personality')}:** ${aiConfig.personality ? client.getLocale('cmd_aisettings_set') : client.getLocale('cmd_aisettings_not_set')}`
      ];

      return interaction.reply({
        content: `## ${client.getLocale('cmd_aisettings_current_settings')}\n${currentSettings.join('\n')}`,
        ephemeral: true,
      });
    }

    let updateField;
    let updateValue;
    let successMessage;

    switch (subcommand) {
      case 'model':
        updateField = 'aiConfig.model';
        updateValue = interaction.options.getString('model_name');
        successMessage = client.getLocale('cmd_aisettings_model_success', { model: updateValue });
        break;
      case 'web-search':
        updateField = 'aiConfig.webSearch';
        updateValue = interaction.options.getBoolean('enabled');
        const status = updateValue ? client.getLocale('cmd_aisettings_enabled') : client.getLocale('cmd_aisettings_disabled');
        successMessage = client.getLocale('cmd_aisettings_web_search_success', { status });
        break;
      case 'personality':
        updateField = 'aiConfig.personality';
        updateValue = interaction.options.getString('prompt');
        successMessage = client.getLocale('cmd_aisettings_personality_success');
        break;
      default:
        return interaction.reply({ content: client.getLocale('command_not_found'), ephemeral: true });
    }

    try {
      await settingsCollection.updateOne(
        { guildId },
        { $set: { [updateField]: updateValue } },
        { upsert: true }
      );
      await interaction.reply({ content: successMessage, ephemeral: true });
    } catch (error) {
      console.error(client.getLocale('log_aisettings_update_error'), error);
      await interaction.reply({ content: client.getLocale('cmd_aisettings_update_error'), ephemeral: true });
    }
  }
};
