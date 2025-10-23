const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa a música atual.'),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    if (!channel) {
      return interaction.editReply({ content: client.getLocale('cmd_music_not_in_vc_generic'), ephemeral: true });
    }

    const player = client.riffy.players.get(interaction.guildId);
    if (!player || !player.playing) {
      return interaction.editReply({ content: client.getLocale('cmd_music_not_playing'), ephemeral: true });
    }

    if (player.voiceChannel !== channel.id) {
        return interaction.editReply({ content: client.getLocale('cmd_music_not_in_same_vc'), ephemeral: true });
    }

    if (player.paused) {
        return interaction.editReply({ content: client.getLocale('cmd_pause_already_paused'), ephemeral: true });
    }

    player.pause(true);

    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setDescription(client.getLocale('cmd_pause_success'));

    await interaction.editReply({ embeds: [embed] });
  }
};
