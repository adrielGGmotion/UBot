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
      return interaction.reply({ content: 'Database is not connected. Cannot manage settings.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const settingsCollection = client.getDbCollection('server-settings');
    const guildId = interaction.guild.id;

    if (subcommand === 'view') {
      const serverSettings = await settingsCollection.findOne({ guildId });
      const aiConfig = serverSettings?.aiConfig || {};

      const currentSettings = [
        `**Model:** \`${aiConfig.model || 'Not Set (default)'}\``,
        `**Web Search:** \`${aiConfig.webSearch ? 'Enabled' : 'Disabled'}\``,
        `**Personality:** ${aiConfig.personality ? 'Set (use `/ai-settings view` to see full text)' : 'Not Set'}`
      ];

      return interaction.reply({
        content: `## Current AI Settings\n${currentSettings.join('\n')}`,
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
        successMessage = `AI model has been set to \`${updateValue}\`.`;
        break;
      case 'web-search':
        updateField = 'aiConfig.webSearch';
        updateValue = interaction.options.getBoolean('enabled');
        successMessage = `Web search has been ${updateValue ? 'enabled' : 'disabled'}.`;
        break;
      case 'personality':
        updateField = 'aiConfig.personality';
        updateValue = interaction.options.getString('prompt');
        successMessage = 'AI personality has been updated.';
        break;
      default:
        return interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }

    try {
      await settingsCollection.updateOne(
        { guildId },
        { $set: { [updateField]: updateValue } },
        { upsert: true }
      );
      await interaction.reply({ content: successMessage, ephemeral: true });
    } catch (error) {
      console.error('Error updating AI settings:', error);
      await interaction.reply({ content: 'An error occurred while updating the settings.', ephemeral: true });
    }
  }
};
