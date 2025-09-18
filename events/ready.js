const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    // A inicialização do Riffy foi movida para o index.js para evitar duplicação.
    // O evento 'clientReady' no index.js agora cuida disso.
    console.log(client.getLocale('bot_ready', { user: client.user.tag }));

    const { statuses, statusrouter } = client.config;
    const intervalMs = typeof statusrouter === 'number' ? statusrouter : 15000;

    if (!Array.isArray(statuses) || !statuses.length) return;

    let i = 0;
    
    const setPresence = async () => {
      const status = statuses[i];
      if (status && status.name) {
        try {
          const activityTypeString = (status.type || 'PLAYING').toUpperCase();
          const activityType = ActivityType[activityTypeString] ?? ActivityType.Playing;

          await client.user.setPresence({
            activities: [{ name: status.name, type: activityType }],
            status: 'online',
          });
        } catch (error) {
          console.error('Failed to set presence:', error);
        }
      }
      i = (i + 1) % statuses.length;
    };

    setPresence();
    setInterval(setPresence, intervalMs);
  },
};