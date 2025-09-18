const { Riffy } = require("riffy");

module.exports = {
  async init(client) {
    const nodes = [
      {
        host: process.env.LAVALINK_HOST || "localhost",
        port: parseInt(process.env.LAVALINK_PORT, 10) || 2333,
        password: process.env.LAVALINK_PASSWORD || "youshallnotpass",
        secure: process.env.LAVALINK_SECURE === 'true',
      },
    ];

    client.riffy = new Riffy(
      client,
      nodes,
      {
        send: (payload) => {
          const guild = client.guilds.cache.get(payload.d.guild_id);
          if (guild) guild.shard.send(payload);
        },
      }
    );

    client.riffy.on("nodeConnect", node => {
      console.log(`[RIFFY] ✅ Node "${node.name}" conectado com sucesso.`);
    });

    client.riffy.on("nodeError", (node, error) => {
      console.error(`[RIFFY] ❌ Node "${node.name}" encontrou um erro: ${error.message}`);
    });

    // ADICIONE ESTE NOVO EVENTO
    client.riffy.on("nodeDisconnect", (node, reason) => {
      console.warn(`[RIFFY] ⚠️ Node "${node.name}" desconectado: ${reason || "Motivo desconhecido"}`);
    });
    
    client.riffy.on("trackStart", (player, track) => {
        const channel = client.channels.cache.get(player.textChannel);
        if (channel) {
            channel.send(`Tocando agora: **${track.info.title}**`);
        }
    });

    client.riffy.on("queueEnd", (player) => {
        const channel = client.channels.cache.get(player.textChannel);
        if (channel) {
            channel.send("A fila de músicas acabou.");
        }
        player.destroy();
    });
  },
};