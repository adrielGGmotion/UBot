const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ajusta o volume da música.')
    .addIntegerOption(option =>
      option.setName('level')
        .setDescription('O nível do volume (de 0 a 100).')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)),

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

    const volume = interaction.options.getInteger('level');
    player.setVolume(volume);

    const embed = new EmbedBuilder()
        .setColor(settings.colors.primary)
        .setDescription(client.getLocale('cmd_volume_success', { volume: volume }));

    await interaction.reply({ embeds: [embed] });
  }
};
