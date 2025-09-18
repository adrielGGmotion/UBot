const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Toca uma música no seu canal de voz.')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('O nome da música ou URL do YouTube.')
        .setRequired(true)),

  async execute(interaction, client) {
    const { channel } = interaction.member.voice;
    const query = interaction.options.getString('query');

    if (!channel) {
      return interaction.reply({ content: 'Você precisa estar em um canal de voz para usar este comando.', ephemeral: true });
    }

    await interaction.deferReply();

    const player = client.riffy.createConnection({
      guildId: interaction.guildId,
      voiceChannel: channel.id,
      textChannel: interaction.channelId,
      deaf: true,
    });

    const resolve = await client.riffy.resolve({ query: query, requester: interaction.user });
    const { loadType, tracks, playlistInfo } = resolve;

    if (loadType === 'PLAYLIST_LOADED') {
      for (const track of tracks) {
        player.queue.add(track);
      }
      await interaction.editReply(`Playlist **${playlistInfo.name}** com ${tracks.length} músicas adicionada à fila.`);
      if (!player.playing && !player.paused) player.play();

    } else if (loadType === 'SEARCH_RESULT' || loadType === 'TRACK_LOADED') {
        const track = tracks.shift();
        player.queue.add(track);
        await interaction.editReply(`Adicionado à fila: **${track.info.title}**`);
        if (!player.playing && !player.paused) player.play();
    } else {
      return interaction.editReply('Não encontrei nenhum resultado para essa busca.');
    }
  }
};