const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Limpa todas as músicas da fila.'),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    const settings = await client.getGuildSettings(interaction.guildId);

    if (!channel) {
      return interaction.editReply({ content: client.getLocale('cmd_music_not_in_vc_generic'), ephemeral: true });
    }

    const player = client.riffy.players.get(interaction.guildId);
    if (!player || player.queue.isEmpty) {
      return interaction.editReply({ content: client.getLocale('cmd_clear_queue_empty'), ephemeral: true });
    }

    if (player.voiceChannel !== channel.id) {
        return interaction.editReply({ content: client.getLocale('cmd_music_not_in_same_vc'), ephemeral: true });
    }

    player.queue.clear();

    const embed = new EmbedBuilder()
        .setColor(settings.colors.primary)
        .setDescription(client.getLocale('cmd_clear_success'));

    await interaction.editReply({ embeds: [embed] });
  }
};
