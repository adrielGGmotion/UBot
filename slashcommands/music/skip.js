const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Pula a música atual.'),

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

    const currentTrack = player.queue.current;

    // Stops the player, which triggers the 'trackEnd' event and starts the next song
    player.stop();

    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setDescription(client.getLocale('cmd_skip_success', { trackTitle: currentTrack.info.title }));

    await interaction.reply({ embeds: [embed] });
  }
};
