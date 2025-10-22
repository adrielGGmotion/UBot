const { EmbedBuilder } = require('discord.js');

let fetch;
import('node-fetch').then(module => {
  fetch = module.default;
});

class InDiscordLyrics {
    constructor(client) {
        this.client = client;
        this.activeGuilds = new Map();
    }

    async start(player, messageToEdit) {
        if (this.activeGuilds.has(player.guildId)) {
            this.stop(player.guildId);
        }

        const track = player.queue.current;
        if (!track) return;

        try {
            const lyrics = await this.fetchLyrics(track);
            if (!lyrics || lyrics.length === 0) return;

            const interval = setInterval(() => this.updateLyrics(player.guildId), 2500);

            this.activeGuilds.set(player.guildId, {
                player,
                messageToEdit,
                lyrics,
                interval,
                lastLine: null,
            });
        } catch (error) {
            console.error(`Error starting lyrics for guild ${player.guildId}:`, error);
        }
    }

    stop(guildId) {
        const guildData = this.activeGuilds.get(guildId);
        if (guildData) {
            clearInterval(guildData.interval);
            this.activeGuilds.delete(guildId);
        }
    }

    async fetchLyrics(track) {
        try {
            const trackName = encodeURIComponent(track.info.title);
            const artistName = encodeURIComponent(track.info.author);
            const res = await fetch(`https://lrclib.net/api/get?track_name=${trackName}&artist_name=${artistName}`);

            if (!res.ok) return null;

            const data = await res.json();
            if (data && data.syncedLyrics) {
                return data.syncedLyrics.map(line => ({
                    time: parseInt(line.timestamp, 10),
                    text: line.line,
                }));
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch lyrics from LRCLib:', error);
            return null;
        }
    }

    async updateLyrics(guildId) {
        const guildData = this.activeGuilds.get(guildId);
        if (!guildData || !guildData.player.queue.current) {
            this.stop(guildId);
            return;
        }

        const { player, messageToEdit, lyrics } = guildData;
        const position = player.position;

        let currentLineText = null;
        for (const line of lyrics) {
            if (position >= line.time) {
                currentLineText = line.text;
            } else {
                break;
            }
        }

        if (currentLineText && currentLineText !== guildData.lastLine) {
            guildData.lastLine = currentLineText;
            try {
                const originalEmbed = messageToEdit.embeds[0];
                if (!originalEmbed) {
                    this.stop(guildId);
                    return;
                }

                const newEmbed = new EmbedBuilder(originalEmbed.toJSON())
                    .setFields([
                        ...originalEmbed.fields,
                        { name: '🎤 Lyrics', value: currentLineText, inline: false }
                    ]);

                await messageToEdit.edit({ embeds: [newEmbed] });
            } catch (error) {
                if (error.code === 10008) { // Unknown Message
                    this.stop(guildId);
                } else {
                    console.error(`Failed to edit message in guild ${guildId}:`, error);
                }
            }
        }
    }
}

module.exports = InDiscordLyrics;
