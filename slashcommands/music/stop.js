const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Para a música, limpa a fila e desconecta o bot.'),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    const settings = await client.getGuildSettings(interaction.guildId);

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

    // The 'playerDestroy' event in RiffyManager will handle cleaning up the 'Now Playing' message.
    player.destroy();

    const embed = new EmbedBuilder()
        .setColor(settings.colors.primary)
        .setDescription(client.getLocale('cmd_stop_success'));

    await interaction.reply({ embeds: [embed] });
  }
};
