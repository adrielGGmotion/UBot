const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Retoma a música atual.'),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    const settings = await client.getGuildSettings(interaction.guildId);

    if (!channel) {
      return interaction.reply({ content: client.getLocale('cmd_music_not_in_vc_generic'), ephemeral: true });
    }

    const player = client.riffy.players.get(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: client.getLocale('cmd_resume_nothing_to_resume'), ephemeral: true });
    }

    if (player.voiceChannel !== channel.id) {
        return interaction.reply({ content: client.getLocale('cmd_music_not_in_same_vc'), ephemeral: true });
    }

    if (!player.paused) {
        return interaction.reply({ content: client.getLocale('cmd_resume_not_paused'), ephemeral: true });
    }

    player.pause(false);

    const embed = new EmbedBuilder()
        .setColor(settings.colors.primary)
        .setDescription(client.getLocale('cmd_resume_success'));

    await interaction.reply({ embeds: [embed] });
  }
};
