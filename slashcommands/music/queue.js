const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Mostra a fila de músicas atual.'),

  async execute(interaction, client) {
    const player = client.riffy.players.get(interaction.guildId);

    if (!player || player.queue.isEmpty) {
      return interaction.reply({ content: 'A fila está vazia.', ephemeral: true });
    }

    const queue = player.queue;
    const itemsPerPage = 10;
    const totalPages = Math.ceil(queue.length / itemsPerPage);
    let page = 0;

    const generateEmbed = (start) => {
        const current = queue.slice(start, start + itemsPerPage);
        const embed = new EmbedBuilder()
            .setColor(client.config.colors.primary)
            .setTitle('Fila de Reprodução')
            .setThumbnail(interaction.guild.iconURL())
            .setDescription(`**Tocando Agora:** [${player.queue.current.info.title}](${player.queue.current.info.uri})\n\n**Próximas na Fila:**\n` +
                current.map((track, i) => `${start + i + 1}. [${track.info.title}](${track.info.uri})`).join('\n') || 'Nenhuma')
            .setFooter({ text: `Página ${page + 1} de ${totalPages} | Total de ${queue.length} músicas` });
        return embed;
    };

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev_page').setLabel('⬅️').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('next_page').setLabel('➡️').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1)
    );

    const message = await interaction.reply({
        embeds: [generateEmbed(page * itemsPerPage)],
        components: [row],
        fetchReply: true
    });

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000 // 2 minutos
    });

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: 'Você não pode usar estes botões.', ephemeral: true });
        }

        if (i.customId === 'prev_page') {
            page--;
        } else if (i.customId === 'next_page') {
            page++;
        }

        row.components[0].setDisabled(page === 0);
        row.components[1].setDisabled(page >= totalPages - 1);

        await i.update({
            embeds: [generateEmbed(page * itemsPerPage)],
            components: [row]
        });
    });

    collector.on('end', () => {
        const disabledRow = new ActionRowBuilder().addComponents(
            row.components[0].setDisabled(true),
            row.components[1].setDisabled(true)
        );
        message.edit({ components: [disabledRow] }).catch(() => {});
    });
  }
};
