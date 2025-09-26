const { InteractionType, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(client, interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = client.slashCommands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
            return;
        }

        // Handle music control buttons
        if (interaction.isButton() && interaction.customId.startsWith('music_')) {
            const { guild, member } = interaction;
            const player = client.riffy.players.get(guild.id);

            if (!player) {
                return interaction.reply({ content: 'I am not currently playing music in this server.', ephemeral: true });
            }

            if (!member.voice.channel || member.voice.channel.id !== player.voiceChannel) {
                return interaction.reply({ content: 'You must be in the same voice channel as me to use these buttons.', ephemeral: true });
            }

            // Defer the reply to avoid interaction timeout
            await interaction.deferUpdate();

            const action = interaction.customId.substring('music_'.length);

            try {
                switch (action) {
                    case 'pause_resume':
                        const isPaused = player.paused;
                        player.pause(!isPaused);
                        await interaction.followUp({ content: `Player has been ${!isPaused ? 'paused' : 'resumed'}.`, ephemeral: true });
                        break;

                    case 'skip':
                        if (!player.queue.current) {
                            return interaction.followUp({ content: 'There is nothing to skip.', ephemeral: true });
                        }
                        player.stop();
                        await interaction.followUp({ content: 'Skipped the current track.', ephemeral: true });
                        break;

                    case 'stop':
                        player.destroy();
                        await interaction.followUp({ content: 'Stopped the music and left the channel.', ephemeral: true });
                        break;

                    case 'loop':
                        // Cycle through: off -> queue -> track -> off
                        let newLoopMode;
                        if (player.loop === 'none' || player.loop === 'off') {
                            newLoopMode = 'queue';
                        } else if (player.loop === 'queue') {
                            newLoopMode = 'track';
                        } else {
                            newLoopMode = 'none';
                        }
                        player.setLoop(newLoopMode);
                        await interaction.followUp({ content: `Looping is now set to **${newLoopMode}**.`, ephemeral: true });
                        break;
                }
            } catch (error) {
                console.error(`[MusicButtons] Error handling button interaction:`, error);
                await interaction.followUp({ content: 'An error occurred while trying to perform this action.', ephemeral: true });
            }
        }
    }
};