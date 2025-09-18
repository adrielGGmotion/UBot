require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials, REST, Routes, EmbedBuilder, ActivityType } = require('discord.js');
const { Riffy } = require("riffy");
const RiffyManager = require('./features/riffyManager.js');
const express = require('express');
const crypto = require('crypto');

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'config.json');

let config = {};
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (err) {
  console.error('Failed to read config.json, using defaults.');
  config = {
    colors: { primary: '#000000', accent1: '#9900FF', error: '#FF0000' },
    statuses: [{ name: 'Idle', type: 'WATCHING' }],
    statusrouter: 15000,
    language: 'en',
    activateDashboard: false,
    useExternalSettings: false,
    enabledCommands: {},
    music: {
      nodes: [
        {
          host: process.env.LAVALINK_HOST || "localhost",
          port: parseInt(process.env.LAVALINK_PORT, 10) || 2333,
          password: process.env.LAVALINK_PASSWORD || "youshallnotpass",
          secure: process.env.LAVALINK_SECURE === 'true',
          name: "Default Node"
        }
      ],
      defaultVolume: 80,
      djRole: "DJ"
    }
  };
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

client.commands = new Collection();
client.slashCommands = new Collection();
client.features = new Collection();
client.config = config;

require('./functions/languageManager.js')(client);

async function walk(dir) {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) files.push(...await walk(res));
    else files.push(res);
  }
  return files;
}

async function loadFeatures() {
    const featuresDir = path.join(ROOT, 'features');
    if (!fs.existsSync(featuresDir)) return;
    const files = fs.readdirSync(featuresDir).filter(file => file.endsWith('.js'));
    for (const file of files) {
        try {
            const feature = require(path.join(featuresDir, file));
            const featureName = path.parse(file).name;
            if (featureName !== 'riffyManager') { // Don't load RiffyManager as a generic feature
                client.features.set(featureName, feature);
                console.log(`Loaded feature: ${featureName}`);
            }
        } catch (err) {
            console.error(`Failed to load feature from ${file}: ${err.message}`);
        }
    }
}

async function loadFunctions() {
  const functionsDir = path.join(ROOT, 'functions');
  if (!fs.existsSync(functionsDir)) return;
  const files = await walk(functionsDir);
  for (const file of files) {
    if (!file.endsWith('.js') || path.basename(file) === 'languageManager.js') continue;
    try {
      const exported = require(file);
      const relativePath = path.relative(ROOT, file);
      if (typeof exported === 'function') {
        await exported(client);
        console.log(client.getLocale('log_function_loaded_default', { path: relativePath }));
      } else if (exported && typeof exported.init === 'function') {
        await exported.init(client);
        console.log(client.getLocale('log_function_loaded_init', { path: relativePath }));
      }
    } catch (err) {
      console.error(client.getLocale('err_function_load', { path: path.relative(ROOT, file), message: err.message }));
    }
  }
}

async function loadEvents() {
  const eventsDir = path.join(ROOT, 'events');
  if (!fs.existsSync(eventsDir)) return;
  const files = await walk(eventsDir);
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    try {
      const exported = require(file);
      const relativePath = path.relative(ROOT, file);
      if (exported && exported.name && typeof exported.execute === 'function') {
        if (exported.once) client.once(exported.name, (...args) => exported.execute(client, ...args));
        else client.on(exported.name, (...args) => exported.execute(client, ...args));
        console.log(client.getLocale('log_event_loaded', { eventName: exported.name, path: relativePath }));
      }
    } catch (err) {
      console.error(client.getLocale('err_event_load', { path: path.relative(ROOT, file), message: err.message }));
    }
  }
}

function normalizeCommandExport(exp) {
  if (!exp) return null;
  if (exp.data && exp.execute) return { data: exp.data, execute: exp.execute };
  if (exp.name && exp.execute) return { data: { name: exp.name, description: exp.description || 'No description' }, execute: exp.execute };
  return null;
}

async function loadSlashCommands() {
  const cmdsDir = path.join(ROOT, 'slashcommands');
  if (!fs.existsSync(cmdsDir)) return [];
  const toRegister = [];
  const files = await walk(cmdsDir);
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    try {
      const exp = require(file);
      const normalized = normalizeCommandExport(exp);
      const relativePath = path.relative(ROOT, file);
      if (normalized) {
        const name = normalized.data.name || (normalized.data.toJSON && normalized.data.toJSON().name) || path.basename(file, '.js');
        client.slashCommands.set(name, normalized);
        if (client.config.enabledCommands[name] !== false) {
          const payload = normalized.data.toJSON ? normalized.data.toJSON() : normalized.data;
          toRegister.push(payload);
          console.log(client.getLocale('log_slash_loaded', { commandName: name, path: relativePath }));
        } else {
          console.log(client.getLocale('log_slash_disabled', { commandName: name }));
        }
      }
    } catch (err) {
      console.error(client.getLocale('err_slash_load', { path: path.relative(ROOT, file), message: err.message }));
    }
  }
  return toRegister;
}

async function registerCommandsGlobally(commands) {
  const { TOKEN, CLIENT_ID } = process.env;
  if (!TOKEN || !CLIENT_ID) {
    console.warn(client.getLocale('warn_missing_env_for_registration'));
    return;
  }
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log(client.getLocale('log_slash_registered', { count: commands.length }));
  } catch (err) {
    console.error(client.getLocale('err_slash_register', { error: err }));
  }
}

async function tryInitMongo() {
  const mongoPath = path.join(ROOT, 'mongoDb.js');
  if (!fs.existsSync(mongoPath)) return;
  try {
    const mongoModule = require(mongoPath);
    if (mongoModule && typeof mongoModule.init === 'function') {
      await mongoModule.init({ client });
      console.log(client.getLocale('log_mongo_init_method'));
    }
  } catch (err) {
    console.error(client.getLocale('err_mongo_init', { message: err.message }));
  }
}

async function startDashboard() {
  if (!client.config.activateDashboard) return;
  const app = express();
  const port = process.env.DASHBOARD_PORT || 3000;
  app.use(express.json());

  const sessionTokens = new Set();
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    console.warn("AVISO: DASHBOARD_PASSWORD não definida no .env! A dashboard está desprotegida.");
  }

  const authMiddleware = (req, res, next) => {
    if (!password) return next();
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null || !sessionTokens.has(token)) {
      return res.sendStatus(401);
    }
    next();
  };

  app.post('/api/login', (req, res) => {
    if (!password) return res.status(200).json({ token: 'dev-mode' });
    if (req.body.password === password) {
      const token = crypto.randomBytes(32).toString('hex');
      sessionTokens.add(token);
      res.status(200).json({ token: token });
    } else {
      res.status(401).json({ error: 'Senha incorreta.' });
    }
  });

  app.get('/config.json', (req, res) => {
      res.sendFile(path.join(__dirname, 'config.json'));
  });

  app.get('/api/info', (req, res) => {
    let uptime = '-';
    let latency = '-';
    let online = false;
    if (client.user) {
      online = true;
      const ms = Math.floor(process.uptime() * 1000);
      const sec = Math.floor(ms / 1000) % 60;
      const min = Math.floor(ms / (1000 * 60)) % 60;
      const hr = Math.floor(ms / (1000 * 60 * 60));
      uptime = `${hr}h ${min}m ${sec}s`;
      latency = client.ws.ping;
    }
    res.json({
      bot: { tag: client.user?.tag, id: client.user?.id, online, uptime, latency },
      guilds: client.guilds.cache.size,
      colors: client.config.colors || {}
    });
  });

  app.get('/api/guilds', authMiddleware, (req, res) => {
    const guilds = client.guilds.cache.map(guild => ({
      id: guild.id, name: guild.name, icon: guild.iconURL(), memberCount: guild.memberCount
    }));
    res.json(guilds);
  });

  app.get('/api/stats', authMiddleware, async (req, res) => {
    if (!client.db) return res.status(503).json({ error: 'Database not connected.' });
    try {
      const commandLogs = client.db.collection('command-logs');
      const totalCommands = await commandLogs.countDocuments();
      const commandUsage = await commandLogs.aggregate([
        { $group: { _id: '$commandName', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      const simplifiedUsage = commandUsage.map(item => ({ commandName: item._id, count: item.count }));
      res.json({ totalCommands, commandUsage: simplifiedUsage });
    } catch (error) {
      console.error('[API] /api/stats FATAL ERROR:', error);
      res.status(500).json({ error: 'Failed to fetch stats.' });
    }
  });

  app.get('/api/locales/:lang', (req, res) => {
    const lang = req.params.lang;
    const langFilePath = path.join(ROOT, 'languages', `${lang}.json`);
    if (fs.existsSync(langFilePath)) {
      res.sendFile(langFilePath);
    } else {
      res.status(404).json({ error: 'Language file not found.' });
    }
  });

  app.get('/api/guilds/:guildId/settings', authMiddleware, async (req, res) => {
    if (!client.db) return res.status(503).json({ error: 'Database not connected.' });
    const { guildId } = req.params;
    try {
      const guild = await client.guilds.fetch(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found.' });
      const settingsCollection = client.db.collection('server-settings');
      let settings = await settingsCollection.findOne({ guildId });
      if (!settings) {
        settings = { guildId, aiChannelIds: [], aiConfig: {}, faq: [], githubRepos: [], musicConfig: { djRole: 'DJ' } };
      }
      const channels = guild.channels.cache.filter(c => c.isTextBased()).map(c => ({ id: c.id, name: c.name }));
      res.json({ settings, availableChannels: channels });
    } catch (error) {
      console.error(`[API] Error fetching settings for guild ${guildId}:`, error);
      res.status(500).json({ error: 'Could not fetch guild data.' });
    }
  });

  app.post('/api/guilds/:guildId/settings', authMiddleware, async (req, res) => {
    if (!client.db) return res.status(503).json({ error: 'Database not connected.' });
    const { guildId } = req.params;
    const { aiChannelIds, aiConfig, faq, githubRepos, musicConfig } = req.body;
    const settingsCollection = client.db.collection('server-settings');
    await settingsCollection.updateOne(
      { guildId },
      { $set: { aiChannelIds, aiConfig, faq, githubRepos, musicConfig } },
      { upsert: true }
    );
    res.status(200).json({ success: 'Settings updated.' });
  });

  // --- NOVOS ENDPOINTS DE MÚSICA ---
  app.get('/api/guilds/:guildId/music', authMiddleware, (req, res) => {
    const { guildId } = req.params;
    const player = client.riffy.players.get(guildId);

    if (!player) {
      return res.json({ playing: false });
    }

    const { queue, state, volume, loop } = player;
    const nowPlaying = queue.current;

    res.json({
        playing: state === 'CONNECTED',
        paused: player.paused,
        nowPlaying: nowPlaying ? { title: nowPlaying.info.title, author: nowPlaying.info.author, uri: nowPlaying.info.uri } : null,
        queue: queue.map(track => ({ title: track.info.title, author: track.info.author, uri: track.info.uri })),
        volume,
        loop
    });
  });

  app.post('/api/guilds/:guildId/music/control', authMiddleware, (req, res) => {
    const { guildId } = req.params;
    const { action } = req.body;
    const player = client.riffy.players.get(guildId);

    if (!player) {
        return res.status(404).json({ error: 'Player não encontrado.' });
    }

    try {
        switch(action) {
            case 'pause':
                player.pause(true);
                break;
            case 'resume':
                player.pause(false);
                break;
            case 'skip':
                player.stop();
                break;
            default:
                return res.status(400).json({ error: 'Ação inválida.' });
        }
        res.status(200).json({ success: `Ação '${action}' executada.` });
    } catch (error) {
        res.status(500).json({ error: 'Falha ao controlar o player.' });
    }
  });


  app.post('/api/bot/profile', authMiddleware, async (req, res) => {
    const { username, avatar } = req.body;
    if (!username && !avatar) return res.status(400).json({ error: 'No username or avatar provided.' });
    try {
      if (username) await client.user.setUsername(username);
      if (avatar) await client.user.setAvatar(avatar);
      res.status(200).json({ success: 'Profile updated successfully.' });
    } catch (error) {
      console.error('Failed to update bot profile:', error);
      res.status(500).json({ error: `Failed to update profile. Discord API: ${error.message}` });
    }
  });

  app.post('/api/test-ai', authMiddleware, async (req, res) => {
      const { history, config } = req.body;
      const { generateStandaloneResponse } = client.features.get('aiHandler');
      if (!history || !config || !generateStandaloneResponse) return res.status(400).json({ error: 'Payload inválido.' });
      try {
          const response = await generateStandaloneResponse(history, config);
          res.status(200).json({ reply: response });
      } catch (error) {
          console.error('[API] /api/test-ai error:', error);
          res.status(500).json({ error: 'Falha ao gerar resposta da IA.' });
      }
  });

  app.use('/', express.static(path.join(ROOT, 'dashboard', 'public')));

  app.listen(port, () => console.log(client.getLocale('log_dashboard_running', { port: port })));
}

(async () => {
  try {
    await loadFeatures();
    const commandsToRegister = await loadSlashCommands();
    await loadFunctions();
    await loadEvents();
    if (process.env.REGISTER_COMMANDS === 'true') {
      await registerCommandsGlobally(commandsToRegister);
    }
    await tryInitMongo();
    await startDashboard();

    client.once('clientReady', async (readyClient) => {
        const nodes = client.config.music.nodes.map(node => ({
            host: node.host,
            port: node.port,
            password: node.password,
            secure: node.secure,
            name: node.name
        }));

        client.riffy = new Riffy(
            client,
            nodes,
            {
                send: (payload) => {
                    const guild = client.guilds.cache.get(payload.d.guild_id);
                    if (guild) guild.shard.send(payload);
                },
                defaultSearchPlatform: "ytmsearch",
                restVersion: "v4"
            }
        );

        await client.riffy.init(readyClient.user.id);
        console.log("[RIFFY] ✅ Riffy inicializado com o ID do cliente.");

        client.riffyManager = new RiffyManager(client);
        client.riffyManager.connect();
        console.log("[RiffyManager] ✅ Gerenciador de eventos do Riffy conectado.");

        // Moved the raw event listener here to prevent a race condition
        client.on("raw", (d) => {
            // Riffy is initialized in the clientReady event, so this should be safe
            if (client.riffy) {
                client.riffy.updateVoiceState(d);
            }
        });

        console.log(client.getLocale('bot_ready', { user: readyClient.user.tag }));
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
                    await readyClient.user.setPresence({
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
    });

    const token = process.env.TOKEN;
    if (!token) {
      console.error(client.getLocale('err_missing_token'));
      process.exit(1);
    }
    await client.login(token);
  } catch (err) {
    console.error(client.getLocale('err_fatal_init', { error: err }));
    process.exit(1);
  }
})();
