const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const mongoose = require('mongoose');

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkcluster')
    .setDescription('Checks the current status of the MongoDB cluster.'),
  async execute(interaction, client) {
    if (!client.db) {
      return interaction.reply({ content: client.getLocale('cmd_checkcluster_db_disconnected'), ephemeral: true });
    }

    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: client.getLocale('cmd_checkcluster_owner_only'), ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const stats = await mongoose.connection.db.command({ dbStats: 1 });
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => `• ${c.name}`).join('\n') || client.getLocale('cmd_checkcluster_no_collections');

      const serverInfo = await mongoose.connection.db.admin().serverInfo();

      const createGeneralEmbed = () => new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle(client.getLocale('embed_checkcluster_title_general'))
        .addFields(
          { name: client.getLocale('embed_checkcluster_field_db_name'), value: stats.db, inline: true },
          { name: client.getLocale('embed_checkcluster_field_collections'), value: `${stats.collections}`, inline: true },
          { name: client.getLocale('embed_checkcluster_field_documents'), value: `${stats.objects}`, inline: true },
          { name: client.getLocale('embed_checkcluster_field_avg_doc_size'), value: formatBytes(stats.avgObjSize || 0), inline: true },
          { name: client.getLocale('embed_checkcluster_field_indexes'), value: `${stats.indexes}`, inline: true },
          { name: client.getLocale('embed_checkcluster_field_mongo_version'), value: serverInfo.version, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: client.getLocale('embed_checkcluster_footer_text') });

      const createStorageEmbed = () => new EmbedBuilder()
        .setColor(client.config.colors.accent1)
        .setTitle(client.getLocale('embed_checkcluster_title_storage'))
        .addFields(
          { name: client.getLocale('embed_checkcluster_field_data_storage'), value: formatBytes(stats.dataSize || 0), inline: true },
          { name: client.getLocale('embed_checkcluster_field_index_storage'), value: formatBytes(stats.indexSize || 0), inline: true },
          { name: client.getLocale('embed_checkcluster_field_total_storage'), value: formatBytes(stats.storageSize || 0), inline: true },
          { name: client.getLocale('embed_checkcluster_field_total_disk_size'), value: formatBytes(stats.totalSize || 0), inline: true },
          { name: client.getLocale('embed_checkcluster_field_scale_factor'), value: `${stats.scaleFactor || 'N/A'}`, inline: true }
        )
        .setTimestamp();
        
      const createCollectionsEmbed = () => new EmbedBuilder()
        .setColor(client.config.colors.primary)
        .setTitle(client.getLocale('embed_checkcluster_title_collections'))
        .setDescription(collectionNames)
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('cluster_select')
            .setPlaceholder(client.getLocale('menu_checkcluster_placeholder'))
            .addOptions([
              { label: client.getLocale('menu_checkcluster_option_general_label'), description: client.getLocale('menu_checkcluster_option_general_desc'), value: 'general' },
              { label: client.getLocale('menu_checkcluster_option_storage_label'), description: client.getLocale('menu_checkcluster_option_storage_desc'), value: 'storage' },
              { label: client.getLocale('menu_checkcluster_option_collections_label'), description: client.getLocale('menu_checkcluster_option_collections_desc'), value: 'collections' },
            ])
        );

      const initialEmbed = createGeneralEmbed();
      const message = await interaction.editReply({ embeds: [initialEmbed], components: [row] });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === interaction.user.id,
        time: 120000
      });

      collector.on('collect', async i => {
        const selection = i.values[0];
        let newEmbed;

        if (selection === 'general') newEmbed = createGeneralEmbed();
        else if (selection === 'storage') newEmbed = createStorageEmbed();
        else if (selection === 'collections') newEmbed = createCollectionsEmbed();
        
        await i.update({ embeds: [newEmbed] });
      });

      collector.on('end', () => {
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            StringSelectMenuBuilder.from(row.components[0]).setDisabled(true).setPlaceholder(client.getLocale('menu_checkcluster_expired'))
          );
        interaction.editReply({ components: [disabledRow] });
      });

    } catch (error) {
      console.error(error);
      interaction.editReply({ content: client.getLocale('cmd_checkcluster_fetch_error') });
    }
  }
};