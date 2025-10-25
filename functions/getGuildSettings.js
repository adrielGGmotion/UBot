const mongoose = require('mongoose');

/**
 * Fetches the settings for a specific guild, merging them with the default configuration.
 * @param {import('discord.js').Client} client - The Discord client instance.
 * @param {string} guildId - The ID of the guild to fetch settings for.
 * @returns {Promise<object>} - A promise that resolves to the merged settings object.
 */
async function getGuildSettings(client, guildId) {
    // Start with the base config as the default
    const defaults = JSON.parse(JSON.stringify(client.config));

    if (!client.db) {
        return defaults;
    }

    try {
        const GuildSettings = client.getDbCollection('guild-settings');
        if (!GuildSettings) {
            return defaults;
        }

        const storedSettings = await GuildSettings.findOne({ guildId }).lean();

        if (storedSettings) {
            // Deep merge stored settings over the defaults
            // A simple merge is not enough for nested objects like 'colors' or 'music'
            return deepMerge(defaults, storedSettings);
        } else {
            return defaults;
        }
    } catch (error) {
        console.error(`Failed to fetch guild settings for ${guildId}:`, error);
        return defaults; // Return defaults on error
    }
}

/**
 * Deeply merges two objects.
 * @param {object} target - The target object.
 * @param {object} source - The source object.
 * @returns {object} - The merged object.
 */
function deepMerge(target, source) {
    const output = { ...target };

    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }

    return output;
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}


module.exports = {
    getGuildSettings,
    install(client) {
        client.getGuildSettings = (guildId) => getGuildSettings(client, guildId);
    }
};
