const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Define o modo de repetição.')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('O modo de repetição a ser ativado.')
        .setRequired(true)
        .addChoices(
            { name: 'Off', value: 'off' },
            { name: 'Track', value: 'track' },
            { name: 'Queue', value: 'queue' }
        )),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    if (!channel) {
      return interaction.reply({ content: client.getLocale('cmd_music_not_in_vc_generic'), ephemeral: true });
    }

    const player = client.riffy.players.get(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: client.getLocale('cmd_music_not_playing'), ephemeral: true });
    }

    if (player.voiceChannel !== channel.id) {
        return interaction.reply({ content: client.getLocale('cmd_music_not_in_same_vc'), ephemeral: true });
    }

    const mode = interaction.options.getString('mode');
    let description;

    if (mode === 'track') {
        player.setLoop('TRACK');
        description = client.getLocale('cmd_loop_track_enabled');
    } else if (mode === 'queue') {
        player.setLoop('QUEUE');
        description = client.getLocale('cmd_loop_queue_enabled');
    } else {
        player.setLoop('NONE');
        description = client.getLocale('cmd_loop_disabled');
    }

    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setDescription(description);

    await interaction.reply({ embeds: [embed] });
  }
};
