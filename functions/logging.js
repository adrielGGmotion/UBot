const mongoose = require('mongoose');

/**
 * A centralized function for logging bot activities.
 *
 * @param {import('discord.js').Client} client The Discord client instance.
 * @param {string} guildId The ID of the guild where the event occurred.
 * @param {string} level The log level ('INFO', 'WARN', 'ERROR').
 * @param {string} message The log message.
 * @param {object} [user=null] Optional user object associated with the log.
 * @param {string} [user.id] The user's ID.
 * @param {string} [user.tag] The user's Discord tag.
 */
async function logActivity(client, guildId, level, message, user = null) {
    if (!client.db) {
        // Silently fail if the database is not connected.
        return;
    }

    try {
        const settingsCollection = client.getDbCollection('server-settings');
        const serverSettings = await settingsCollection.findOne({ guildId });

        // Default to logging everything if no settings are found
        const logLevels = serverSettings?.logLevels || ['INFO', 'WARN', 'ERROR'];

        if (!logLevels.includes(level)) {
            return; // Don't log if this level is disabled
        }

        const Log = mongoose.model('Log');
        const newLog = new Log({
            guildId,
            level,
            message,
            user,
        });
        await newLog.save();

        // Emit a WebSocket event if the server is set up
        if (client.io) {
            client.io.emit('new_log', newLog.toObject());
        }
    } catch (error) {
        console.error(`Failed to save activity log for guild ${guildId}:`, error);
    }
}

module.exports = (client) => {
    client.logActivity = logActivity.bind(null, client);
};
