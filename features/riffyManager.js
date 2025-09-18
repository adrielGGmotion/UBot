const { EmbedBuilder } = require('discord.js');

class RiffyManager {
    constructor(client) {
        this.client = client;
    }

    /**
     * Connects the Riffy client to the Lavalink nodes and attaches event listeners.
     */
    connect() {
        // Riffy is now initialized in index.js where the client is available.
        // This class is only for managing events after client.riffy is created.
        if (!this.client.riffy) {
            console.error("[RiffyManager] client.riffy was not initialized before calling RiffyManager.connect().");
            return;
        }

        // Attach event listeners
        this.client.riffy.on("nodeConnect", node => this.onNodeConnect(node));
        this.client.riffy.on("nodeError", (node, error) => this.onNodeError(node, error));
        this.client.riffy.on("nodeDisconnect", (node, reason) => this.onNodeDisconnect(node, reason));
        this.client.riffy.on("trackStart", (player, track) => this.onTrackStart(player, track));
        this.client.riffy.on("trackEnd", (player, track, payload) => this.onTrackEnd(player, track, payload));
        this.client.riffy.on("queueEnd", player => this.onQueueEnd(player));
        this.client.riffy.on("playerDestroy", player => this.onPlayerDestroy(player));
    }

    // --- Riffy Event Handlers ---

    onNodeConnect(node) {
        console.log(`[RIFFY] ✅ Node "${node.name}" connected.`);
    }

    onNodeError(node, error) {
        console.error(`[RIFFY] ❌ Error on Node "${node.name}": ${error.message}`);
    }

    onNodeDisconnect(node, reason) {
        console.warn(`[RIFFY] ⚠️ Node "${node.name}" disconnected: ${reason || "Unknown reason"}`);
    }

    async onTrackStart(player, track) {
        const channel = this.client.channels.cache.get(player.textChannel);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(this.client.config.colors.primary)
                .setAuthor({ name: "Now Playing" })
                .setDescription(`[${track.info.title}](${track.info.uri})`)
                .addFields(
                    { name: "Duration", value: this.formatDuration(track.info.length), inline: true },
                    { name: "Author", value: track.info.author, inline: true },
                    { name: "Requested by", value: `<@${track.info.requester.id}>`, inline: true }
                )
                .setThumbnail(track.info.thumbnail);

            const message = await channel.send({ embeds: [embed] });
            player.set("nowPlayingMessage", message);
        }
    }

    async onQueueEnd(player) {
        const channel = this.client.channels.cache.get(player.textChannel);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(this.client.config.colors.primary)
                .setDescription("✅ Queue has ended. Leaving voice channel in 2 minutes if nothing is added.");
            channel.send({ embeds: [embed] });
        }

        // Start a timer to destroy the player if it remains idle
        player.set("destroyTimeout", setTimeout(() => {
            player.destroy();
        }, 120000)); // 2 minutes
    }

    async onTrackEnd(player, track, payload) {
        // If the track ended because it was stopped, don't play the next one
        if (payload && payload.reason === 'stopped') {
            return;
        }

        // Play the next track if there is one
        if (player.queue.length > 0) {
            player.play();
        }
    }

    onPlayerDestroy(player) {
        // Clear the destroy timeout if the player is destroyed manually
        const timeout = player.get("destroyTimeout");
        if (timeout) clearTimeout(timeout);

        // Try to delete the "Now Playing" message if it exists
        const nowPlayingMessage = player.get("nowPlayingMessage");
        if (nowPlayingMessage && !nowPlayingMessage.deleted) {
            nowPlayingMessage.delete().catch(() => {});
        }
    }

    // --- Utility Functions ---

    formatDuration(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

        const parts = [];
        if (hours > 0) parts.push(hours.toString().padStart(2, '0'));
        parts.push(minutes.toString().padStart(2, '0'));
        parts.push(seconds.toString().padStart(2, '0'));

        return parts.join(':');
    }
}

module.exports = RiffyManager;
