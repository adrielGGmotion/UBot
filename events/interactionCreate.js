const { InteractionType, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(client, interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = client.slashCommands.get(interaction.commandName);
            if (!command) return;

            // Log the command usage
            if (client.log) {
                const user = { id: interaction.user.id, tag: interaction.user.tag };
                const message = `Command used: /${interaction.commandName}`;
                client.log(interaction.guildId, 'INFO', message, user);
            }

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(`Error executing /${interaction.commandName}`, error);

                // Log the detailed error
                if (client.log) {
                    const user = { id: interaction.user.id, tag: interaction.user.tag };
                    const errorMessageLog = `Error executing /${interaction.commandName}: ${error.message}`;
                    client.log(interaction.guildId, 'ERROR', errorMessageLog, user);
                }

                // Attempt to notify the user about the error, if possible.
                try {
                    const errorMessage = client.getLocale('command_error');
                    // Use editReply if we already deferred, otherwise reply.
                    if (interaction.deferred) {
                        await interaction.editReply({ content: errorMessage, ephemeral: true, embeds: [], components: [] });
                    } else if (!interaction.replied) {
                        await interaction.reply({ content: errorMessage, ephemeral: true });
                    }
                    // If it was already replied to, we can't do much, but the error is logged.
                } catch (replyError) {
                    // If replying fails, log that too. The original interaction might be gone.
                    console.error(`Failed to send error feedback for /${interaction.commandName}`, replyError);
                }
            }
            return;
        }

        // Handle music control buttons
        if (interaction.isButton() && interaction.customId.startsWith('music_')) {
            const { guild, member } = interaction;
            const player = client.riffy.players.get(guild.id);

            if (!player) {
                return interaction.reply({ content: client.getLocale('cmd_music_not_playing'), ephemeral: true });
            }

            if (!member.voice.channel || member.voice.channel.id !== player.voiceChannel) {
                return interaction.reply({ content: client.getLocale('cmd_music_not_in_vc'), ephemeral: true });
            }

            // Defer the reply to avoid interaction timeout
            await interaction.deferUpdate();

            const action = interaction.customId.substring('music_'.length);

            try {
                switch (action) {
                    case 'pause_resume':
                        const isPaused = player.paused;
                        player.pause(!isPaused);
                        const status = !isPaused ? client.getLocale('cmd_music_status_paused') : client.getLocale('cmd_music_status_resumed');
                        await interaction.followUp({ content: client.getLocale('cmd_music_pause_resume', { status }), ephemeral: true });
                        break;

                    case 'skip':
                        if (!player.queue.current) {
                            return interaction.followUp({ content: client.getLocale('cmd_music_skip_nothing'), ephemeral: true });
                        }
                        player.stop();
                        await interaction.followUp({ content: client.getLocale('cmd_music_skip_success'), ephemeral: true });
                        break;

                    case 'stop':
                        player.destroy();
                        await interaction.followUp({ content: client.getLocale('cmd_music_stop_success'), ephemeral: true });
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
                        await interaction.followUp({ content: client.getLocale('cmd_music_loop_success', { loopMode: newLoopMode }), ephemeral: true });
                        break;
                }
            } catch (error) {
                console.error(client.getLocale('log_music_button_error'), error);
                await interaction.followUp({ content: client.getLocale('cmd_music_generic_error'), ephemeral: true });
            }
        }
    }
};