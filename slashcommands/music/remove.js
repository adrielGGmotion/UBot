const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove uma música da fila.')
    .addIntegerOption(option =>
      option.setName('position')
        .setDescription('A posição da música na fila para remover.')
        .setRequired(true)
        .setMinValue(1)),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    const settings = await client.getGuildSettings(interaction.guildId);

    if (!channel) {
      return interaction.editReply({ content: client.getLocale('cmd_music_not_in_vc_generic'), ephemeral: true });
    }

    const player = client.riffy.players.get(interaction.guildId);
    if (!player || player.queue.isEmpty) {
      return interaction.editReply({ content: client.getLocale('cmd_queue_empty'), ephemeral: true });
    }

    if (player.voiceChannel !== channel.id) {
        return interaction.editReply({ content: client.getLocale('cmd_music_not_in_same_vc'), ephemeral: true });
    }

    const position = interaction.options.getInteger('position');

    if (position > player.queue.length) {
        return interaction.editReply({ content: client.getLocale('cmd_remove_invalid_position', { queueLength: player.queue.length }), ephemeral: true });
    }

    const removedTrack = player.queue.remove(position - 1);

    const embed = new EmbedBuilder()
        .setColor(settings.colors.primary)
        .setDescription(client.getLocale('cmd_remove_success', { trackTitle: removedTrack.info.title }));

    await interaction.reply({ embeds: [embed] });
  }
};
