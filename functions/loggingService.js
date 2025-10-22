const mongoose = require('mongoose');

/**
 * A centralized logging service to record bot activities in the database.
 * @param {import('discord.js').Client} client - The Discord client instance.
 */
function initializeLoggingService(client) {
    const Log = mongoose.models.Log; // Use the already registered Log model

    if (!Log) {
        console.error('Log model is not registered with Mongoose. Make sure it is defined and registered in mongoDb.js.');
        return;
    }

    /**
     * Logs an event to the database.
     * @param {string} guildId - The ID of the guild where the event occurred.
     * @param {'INFO' | 'WARN' | 'ERROR'} level - The severity level of the log.
     * @param {string} message - The log message.
     * @param {object} [user=null] - Optional user context.
     * @param {string} [user.id] - The user's ID.
     * @param {string} [user.tag] - The user's Discord tag.
     */
    const log = async (guildId, level, message, user = null) => {
        try {
            const logEntry = new Log({
                guildId,
                level,
                message,
                user: user ? { id: user.id, tag: user.tag } : null,
            });
            await logEntry.save();
        } catch (error) {
            console.error(`Failed to save log entry: ${error.message}`);
        }
    };

    // Attach the log function to the client object for global access
    client.log = log;
    console.log('Logging service initialized and attached to client.');
}

module.exports = initializeLoggingService;
