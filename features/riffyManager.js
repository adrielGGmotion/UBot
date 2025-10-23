const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Vibrant = require('node-vibrant/node');
const InDiscordLyrics = require('./inDiscordLyrics.js');
const crypto = require('crypto');

class RiffyManager {
    constructor(client) {
        this.client = client;
        this.inDiscordLyrics = new InDiscordLyrics(this.client);
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
        this.client.emit('playerUpdate', player.guildId);
        const channel = this.client.channels.cache.get(player.textChannel);
        if (!channel) return;

        const sessionToken = crypto.randomBytes(16).toString('hex');
        player.set('sessionToken', sessionToken);

        const thumbnailUrl = await track.info.thumbnail;
        let settings = null;
        if (this.client.db) {
            const settingsCollection = this.client.db.collection('server-settings');
            settings = await settingsCollection.findOne({ guildId: player.guildId });
        }

        let embedColor = this.client.config.colors.primary;
        if (settings?.musicConfig?.embedColor && thumbnailUrl) {
            try {
                const palette = await Vibrant.from(thumbnailUrl).getPalette();
                if (palette.Vibrant) embedColor = palette.Vibrant.hex;
            } catch (err) {
                console.error(`[Vibrant] Failed to extract color from ${thumbnailUrl}:`, err);
            }
        }

        const requester = track.info.requester?.id === this.client.user.id
            ? `Autoplay via ${this.client.user.username}`
            : `<@${track.info.requester.id}>`;

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setAuthor({ name: "Now Playing" })
            .setDescription(`[${track.info.title}](${track.info.uri})`)
            .addFields(
                { name: "Duration", value: this.formatDuration(track.info.length), inline: true },
                { name: "Author", value: track.info.author, inline: true },
                { name: "Requested by", value: requester, inline: true }
            )
            .setThumbnail(thumbnailUrl);

        const dashboardURL = this.client.config.dashboardURL || `http://localhost:${process.env.DASHBOARD_PORT || 3000}`;
        const visualizerUrl = `${dashboardURL}/visualizer.html?guildId=${player.guildId}&token=${sessionToken}`;

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('music_pause_resume').setLabel('⏯️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('music_skip').setLabel('⏭️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_stop').setLabel('⏹️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('music_loop').setLabel('🔁').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setLabel('Live Player').setStyle(ButtonStyle.Link).setURL(visualizerUrl)
            );

        try {
            const message = await channel.send({ embeds: [embed], components: [row] });
            player.set("nowPlayingMessage", message);
            this.inDiscordLyrics.start(player, message);
        } catch (error) {
            console.error(`[RiffyManager] Could not send 'Now Playing' message in guild ${player.guildId}:`, error);
        }
    }

    async onQueueEnd(player) {
        this.client.emit('playerUpdate', player.guildId);
        this.inDiscordLyrics.stop(player.guildId);
        const timeout = player.get("destroyTimeout");
        if (timeout) clearTimeout(timeout);

        if (!this.client.db) {
            this.startDestroyTimer(player);
            return;
        }

        const settingsCollection = this.client.db.collection('server-settings');
        const settings = await settingsCollection.findOne({ guildId: player.guildId });

        if (settings?.musicConfig?.autoplay) {
            this.handleAutoplay(player);
        } else {
            this.startDestroyTimer(player);
        }
    }

    async onTrackEnd(player, track, payload) {
        // Store the last track for autoplay purposes
        player.set("previousTrack", track);

        // If the track ended because it was stopped, don't play the next one
        if (payload && payload.reason === 'stopped') {
            return;
        }

        // Play the next track if there is one
        if (player.queue.length > 0) {
            player.play();
        }
    }

    // --- Autoplay and Player Management ---

    async handleAutoplay(player) {
        const previousTrack = player.get("previousTrack");
        if (!previousTrack) {
            this.startDestroyTimer(player);
            return;
        }

        const query = previousTrack.info.author; // Search for a new song by the same artist
        const resolve = await this.client.riffy.resolve({ query: `ytsearch:${query}`, requester: this.client.user });

        if (!resolve || !['search', 'track'].includes(resolve.loadType) || resolve.tracks.length === 0) {
            this.startDestroyTimer(player);
            return;
        }

        const nextTrack = resolve.tracks.find(t => t.info.identifier !== previousTrack.info.identifier) || resolve.tracks[0];

        if (nextTrack) {
            player.queue.add(nextTrack);
            player.play();
        } else {
            this.startDestroyTimer(player);
        }
    }

    startDestroyTimer(player) {
        const channel = this.client.channels.cache.get(player.textChannel);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(this.client.config.colors.primary)
                .setDescription("✅ Queue has ended. Leaving voice channel in 2 minutes if nothing is added.");
            channel.send({ embeds: [embed] }).catch(e => console.error(`[RiffyManager] Could not send queue end message: ${e.message}`));
        }

        player.set("destroyTimeout", setTimeout(() => {
            player.destroy();
        }, 120000));
    }

    onPlayerDestroy(player) {
        this.client.emit('playerUpdate', player.guildId);
        this.inDiscordLyrics.stop(player.guildId);
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
