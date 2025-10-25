const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Mostra a fila de músicas atual.'),

  async execute(interaction, client) {
    const player = client.riffy.players.get(interaction.guildId);
    const settings = await client.getGuildSettings(interaction.guildId);

    if (!player || player.queue.isEmpty) {
      return interaction.editReply({ content: client.getLocale('cmd_queue_empty'), ephemeral: true });
    }

    const queue = player.queue;
    const itemsPerPage = 10;
    const totalPages = Math.ceil(queue.length / itemsPerPage);
    let page = 0;

    const generateEmbed = (start) => {
        const current = queue.slice(start, start + itemsPerPage);
        const embed = new EmbedBuilder()
            .setColor(settings.colors.primary)
            .setTitle(client.getLocale('cmd_queue_embed_title'))
            .setThumbnail(interaction.guild.iconURL())
            .setDescription(`**${client.getLocale('cmd_queue_embed_now_playing')}:** [${player.queue.current.info.title}](${player.queue.current.info.uri})\n\n**${client.getLocale('cmd_queue_embed_up_next')}:**\n` +
                current.map((track, i) => `${start + i + 1}. [${track.info.title}](${track.info.uri})`).join('\n') || client.getLocale('cmd_queue_embed_none'))
            .setFooter({ text: client.getLocale('cmd_queue_embed_footer', { page: page + 1, totalPages: totalPages, totalTracks: queue.length }) });
        return embed;
    };

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev_page').setLabel('⬅️').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('next_page').setLabel('➡️').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1)
    );

    const message = await interaction.editReply({
        embeds: [generateEmbed(page * itemsPerPage)],
        components: [row],
        fetchReply: true
    });

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000 // 2 minutes
    });

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: client.getLocale('cmd_queue_cannot_use_buttons'), ephemeral: true });
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
