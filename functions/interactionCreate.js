const { InteractionType } = require('discord.js');

module.exports = async (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (interaction.type === InteractionType.ApplicationCommand) {
      const command = client.slashCommands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: client.getLocale('command_not_found'), ephemeral: true });
      }
      try {
        await command.execute(interaction, client);

        if (client.db) {
          const commandLogs = client.getDbCollection('command-logs');
          await commandLogs.create({
            commandName: interaction.commandName,
            userId: interaction.user.id,
            guildId: interaction.guild.id,
            timestamp: new Date()
          });
        }
        
      } catch (err) {
        console.error(err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: client.getLocale('command_error'), ephemeral: true });
        }
      }
    }
  });
};