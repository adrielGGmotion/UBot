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
      return interaction.reply({ content: 'Você precisa estar em um canal de voz.', ephemeral: true });
    }

    const player = client.riffy.players.get(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: 'Não estou tocando nada no momento.', ephemeral: true });
    }

    if (player.voiceChannel !== channel.id) {
        return interaction.reply({ content: 'Você precisa estar no mesmo canal de voz que eu.', ephemeral: true });
    }

    const mode = interaction.options.getString('mode');
    let description;

    if (mode === 'track') {
        player.setLoop('TRACK');
        description = '🔂 Repetição de faixa ativada.';
    } else if (mode === 'queue') {
        player.setLoop('QUEUE');
        description = '🔁 Repetição de fila ativada.';
    } else {
        player.setLoop('NONE');
        description = '▶️ Repetição desativada.';
    }

    const embed = new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setDescription(description);

    await interaction.reply({ embeds: [embed] });
  }
};
