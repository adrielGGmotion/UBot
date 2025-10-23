require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials, REST, Routes, EmbedBuilder, ActivityType } = require('discord.js');
const { Riffy } = require("riffy");
const RiffyManager = require('./features/riffyManager.js');
const githubNotifier = require('./features/githubNotifier.js');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const http = require('http');
const { Server } = require("socket.io");
const axios = require('axios');

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'config.json');

let config = {};
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (err) {
  console.error('err_config_read');
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
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences
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
                console.log(client.getLocale('log_feature_loaded', { featureName: featureName }));
            }
        } catch (err) {
            console.error(client.getLocale('err_feature_load', { file: file, message: err.message }));
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
  if (exp.name && exp.execute) return { data: { name: exp.name, description: exp.description || client.getLocale('no_description_provided') }, execute: exp.execute };
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

const defaultGithubRepoConfig = {
    enabled: true,
    secret: '',
    commits: {
        enabled: false, channelId: null,
        branchFilter: { mode: 'blacklist', list: [] },
        messageFilter: { mode: 'blacklist', list: [] },
        authorFilter: { mode: 'blacklist', list: [] },
    },
    pullRequests: {
        enabled: false, channelId: null,
        eventFilter: ['opened', 'merged', 'closed', 'reopened'],
        branchFilter: { base: [], head: [] },
        labelFilter: { mode: 'blacklist', list: [] },
        ignoreDrafts: true,
    },
    issues: {
        enabled: false, channelId: null,
        eventFilter: ['opened', 'closed', 'reopened'],
        labelFilter: { mode: 'blacklist', list: [] },
    },
    releases: {
        enabled: false, channelId: null,
        typeFilter: ['published', 'prerelease'],
    },
    stars: { enabled: false, channelId: null },
    forks: { enabled: false, channelId: null },
    issueComments: { enabled: false, channelId: null },
    pullRequestReviews: { enabled: false, channelId: null },
};

function mergeGithubConfig(config) {
    if (!config) return JSON.parse(JSON.stringify(defaultGithubRepoConfig));
    const merged = { ...defaultGithubRepoConfig, ...config };
    for (const key of Object.keys(defaultGithubRepoConfig)) {
        const defaultValue = defaultGithubRepoConfig[key];
        if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)) {
            merged[key] = { ...defaultValue, ...(config[key] || {}) };
        }
    }
    return merged;
}

async function startDashboard() {
  if (!client.config.activateDashboard) return;
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  client.io = io;

  const port = process.env.DASHBOARD_PORT || 3000;
  app.use(express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(cookieParser());

  const sessionTokens = new Set();
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    console.warn(client.getLocale('warn_dashboard_unprotected'));
  }

  const authMiddleware = (req, res, next) => {
    if (!password) return next();

    // Check for token in cookie first, then fallback to Authorization header
    const cookieToken = req.cookies['dashboard-token'];
    if (cookieToken && sessionTokens.has(cookieToken)) {
        return next();
    }

    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
    if (headerToken && sessionTokens.has(headerToken)) {
        return next();
    }

    return res.status(401);
  };

  const pageAuthMiddleware = (req, res, next) => {
    if (!password) return next();

    const token = req.cookies['dashboard-token'];
    if (token && sessionTokens.has(token)) {
        return next();
    }
    res.redirect('/login.html');
  };

  app.post('/api/login', (req, res) => {
    if (!password) {
        // In dev mode without a password, we can grant a session token.
        const devToken = client.getLocale('dev_mode_token');
        sessionTokens.add(devToken);
        res.cookie('dashboard-token', devToken, { httpOnly: true, maxAge: 86400000 }); // 24 hours
        return res.sendStatus(200);
    }

    if (req.body.password === password) {
        const token = crypto.randomBytes(32).toString('hex');
        sessionTokens.add(token);
        res.cookie('dashboard-token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 86400000 }); // 24 hours
        res.sendStatus(200);
    } else {
        res.status(401).json({ error: client.getLocale('err_incorrect_password') });
    }
  });

  app.post('/api/logout', (req, res) => {
    const token = req.cookies['dashboard-token'];
    if (token) {
        sessionTokens.delete(token);
    }
    res.clearCookie('dashboard-token');
    res.sendStatus(200);
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
      bot: { tag: client.user?.tag, id: client.user?.id, avatar: client.user?.displayAvatarURL(), online, uptime, latency },
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

  app.get('/api/bot-info', authMiddleware, (req, res) => {
    if (!client.user) {
        return res.status(503).json({ error: 'Bot not logged in' });
    }
    res.json({
        name: client.user.username,
        avatar: client.user.displayAvatarURL(),
        id: client.user.id
    });
  });

  app.post('/api/guilds/:guildId/leave', authMiddleware, async (req, res) => {
    const { guildId } = req.params;
    try {
        const guild = await client.guilds.fetch(guildId);
        if (guild) {
            await guild.leave();
            res.status(200).json({ success: `Successfully left guild: ${guild.name}` });
        } else {
            res.status(404).json({ error: 'Guild not found.' });
        }
    } catch (error) {
        console.error(`Failed to leave guild ${guildId}:`, error);
        res.status(500).json({ error: 'Failed to leave guild.' });
    }
  });

  app.get('/api/guilds/:guildId/logs', authMiddleware, async (req, res) => {
    if (!client.db) return res.status(503).json({ error: client.getLocale('err_db_not_connected') });

    const { guildId } = req.params;
    const { level, period, page = 1, limit = 20 } = req.query;

    try {
        const Log = client.getDbCollection('logs');
        const query = { guildId };

        if (level && ['INFO', 'WARN', 'ERROR'].includes(level.toUpperCase())) {
            query.level = level.toUpperCase();
        }

        if (period) {
            const startDate = new Date();
            if (period === 'day') startDate.setDate(startDate.getDate() - 1);
            else if (period === 'week') startDate.setDate(startDate.getDate() - 7);
            else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
            else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
            query.timestamp = { $gte: startDate };
        }

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        const logs = await Log.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();

        const totalLogs = await Log.countDocuments(query);

        res.json({
            logs,
            totalPages: Math.ceil(totalLogs / limitNum),
            currentPage: pageNum,
        });

    } catch (error) {
        console.error(`Failed to fetch logs for guild ${guildId}:`, error);
        res.status(500).json({ error: 'Failed to fetch logs.' });
    }
  });

  app.get('/api/stats', authMiddleware, async (req, res) => {
    if (!client.db) return res.status(503).json({ error: client.getLocale('err_db_not_connected') });
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
      console.error(client.getLocale('err_api_stats_fatal'), error);
      res.status(500).json({ error: client.getLocale('err_fetch_stats') });
    }
  });

  app.get('/api/locales/:lang', (req, res) => {
    const lang = req.params.lang;
    const langFilePath = path.join(ROOT, 'languages', `${lang}.json`);
    if (fs.existsSync(langFilePath)) {
      res.sendFile(langFilePath);
    } else {
      res.status(404).json({ error: client.getLocale('err_lang_file_not_found') });
    }
  });

  app.get('/api/dashboard/locales/:lang', (req, res) => {
    const lang = req.params.lang;
    const langFilePath = path.join(ROOT, 'dashboard', 'languages', `${lang}.json`);
    if (fs.existsSync(langFilePath)) {
      res.sendFile(langFilePath);
    } else {
      res.status(404).json({ error: client.getLocale('err_lang_file_not_found') });
    }
  });

  app.get('/api/guilds/:guildId/settings', authMiddleware, async (req, res) => {
    if (!client.db) return res.status(503).json({ error: client.getLocale('err_db_not_connected') });
    const { guildId } = req.params;
    try {
      const guild = await client.guilds.fetch(guildId);
      if (!guild) return res.status(404).json({ error: client.getLocale('err_guild_not_found') });
      const settingsCollection = client.db.collection('server-settings');
      let settings = await settingsCollection.findOne({ guildId });

      // Default settings structure
      const defaultSettings = {
        guildId,
        aiChannelIds: [],
        aiConfig: {},
        faq: [],
        knowledge: [],
        githubRepos: [],
        musicConfig: {
          managerRoles: [],
          blacklistedRoles: [],
          autoplay: false,
          embedColor: false,
        },
      };

      if (settings) {
        // Merge defaults into existing settings to ensure new fields are present
        settings.musicConfig = { ...defaultSettings.musicConfig, ...settings.musicConfig };
        settings = { ...defaultSettings, ...settings };

        // Deep merge for each GitHub repo config
        if (settings.githubRepos && Array.isArray(settings.githubRepos)) {
          settings.githubRepos = settings.githubRepos.map(repo => mergeGithubConfig(repo));
        }

      } else {
        settings = defaultSettings;
      }

      const channels = guild.channels.cache.filter(c => c.isTextBased()).map(c => ({ id: c.id, name: c.name }));
      res.json({ settings, availableChannels: channels });
    } catch (error) {
      console.error(client.getLocale('err_fetch_guild_data_api', { guildId: guildId }), error);
      res.status(500).json({ error: client.getLocale('err_fetch_guild_data') });
    }
  });

  app.post('/api/guilds/:guildId/settings', authMiddleware, async (req, res) => {
    if (!client.db) return res.status(503).json({ error: client.getLocale('err_db_not_connected') });
    const { guildId } = req.params;
    const { aiChannelIds, aiConfig, faq, knowledge, githubRepos, musicConfig } = req.body;
    const settingsCollection = client.db.collection('server-settings');
    await settingsCollection.updateOne(
      { guildId },
      { $set: { aiChannelIds, aiConfig, faq, knowledge, githubRepos, musicConfig } },
      { upsert: true }
    );
    res.status(200).json({ success: client.getLocale('settings_updated') });
  });

  app.get('/api/guilds/:guildId/roles', authMiddleware, async (req, res) => {
    const { guildId } = req.params;
    try {
      const guild = await client.guilds.fetch(guildId);
      if (!guild) {
        return res.status(404).json({ error: client.getLocale('err_guild_not_found') });
      }
      // Filter out @everyone role and select only relevant properties
      const roles = guild.roles.cache
        .filter(role => role.id !== guild.id)
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.hexColor,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
      res.json(roles);
    } catch (error) {
      console.error(`Failed to fetch roles for guild ${guildId}:`, error);
      res.status(500).json({ error: 'Failed to fetch roles.' });
    }
  });

  // --- AI FEATURES ENDPOINTS ---

  app.get('/api/guilds/:guildId/ai-settings', authMiddleware, async (req, res) => {
    if (!client.db) return res.status(503).json({ error: client.getLocale('err_db_not_connected') });
    const { guildId } = req.params;
    try {
        const settingsCollection = client.db.collection('server-settings');
        let settings = await settingsCollection.findOne({ guildId });

        const defaultAiSettings = {
            enabled: false,
            allowedChannels: [],
            restrictedChannels: [],
            personality: '',
            extraInstructions: '',
            knowledge: [],
            faq: [],
        };

        const aiSettings = settings?.aiConfig ? { ...defaultAiSettings, ...settings.aiConfig } : defaultAiSettings;

        res.json(aiSettings);
    } catch (error) {
        console.error(`Failed to fetch AI settings for guild ${guildId}:`, error);
        res.status(500).json({ error: 'Failed to fetch AI settings.' });
    }
  });

  app.post('/api/guilds/:guildId/ai-settings', authMiddleware, async (req, res) => {
      if (!client.db) return res.status(503).json({ error: client.getLocale('err_db_not_connected') });
      const { guildId } = req.params;
      const { logLevels, ...aiConfig } = req.body;

      try {
          const settingsCollection = client.db.collection('server-settings');
          await settingsCollection.updateOne(
              { guildId },
              { $set: { aiConfig: aiConfig, logLevels: logLevels } },
              { upsert: true }
          );
          res.status(200).json({ success: 'AI settings updated successfully.' });
      } catch (error) {
          console.error(`Failed to save AI settings for guild ${guildId}:`, error);
          res.status(500).json({ error: 'Failed to save AI settings.' });
      }
  });

  app.post('/api/guilds/:guildId/ai-test', authMiddleware, async (req, res) => {
      const { history, aiConfig } = req.body;
      const { generateStandaloneResponse } = client.features.get('aiHandler');

      if (!history || !aiConfig || !generateStandaloneResponse) {
          return res.status(400).json({ error: 'Invalid payload: missing history, config, or AI handler.' });
      }

      try {
          const response = await generateStandaloneResponse(history, aiConfig);
          res.status(200).json({ reply: response });
      } catch (error) {
          console.error('Error during AI test response generation:', error);
          res.status(500).json({ error: 'Failed to generate AI response.' });
      }
  });


  app.get('/api/guilds/:guildId/stats', authMiddleware, async (req, res) => {
    if (!client.db) return res.status(503).json({ error: client.getLocale('err_db_not_connected') });
    const { guildId } = req.params;

    try {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
            return res.status(404).json({ error: client.getLocale('err_guild_not_found') });
        }

        // Fetch members to attempt to get presence data. This is dependent on the GUILD_PRESENCES intent.
        const members = await guild.members.fetch();
        const onlineMembers = members.filter(m => m.presence && m.presence.status !== 'offline').size;

        const commandLogs = client.db.collection('command-logs');
        const commandUsageData = await commandLogs.aggregate([
            { $match: { guildId: guildId } },
            { $group: { _id: '$commandName', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();

        const commandUsage = commandUsageData.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        res.json({ onlineMembers, commandUsage });

    } catch (error) {
        console.error(`Failed to fetch stats for guild ${guildId}:`, error);
        if (error.code === 10007) { // Unknown Member, implies bot is not in guild
             return res.status(404).json({ error: client.getLocale('err_guild_not_found') });
        }
        res.status(500).json({ error: client.getLocale('err_fetch_stats') });
    }
  });

  // --- PLAYER STATUS ENDPOINT ---
  app.get('/api/guilds/:guildId/player-status', authMiddleware, (req, res) => {
    const { guildId } = req.params;
    const player = client.riffy.players.get(guildId);

    if (!player || !player.queue.current) {
        return res.json({ isPlaying: false });
    }

    const { queue, state, volume, loop, position } = player;
    const track = queue.current;

    res.json({
        isPlaying: state === 'CONNECTED',
        isPaused: player.paused,
        track: {
            title: track.info.title,
            author: track.info.author,
            uri: track.info.uri,
            artworkUrl: track.info.artworkUrl,
            duration: track.info.length,
            position: position,
        },
        queue: queue.map(t => ({ title: t.info.title, author: t.info.author })),
        volume,
        loop,
    });
  });

  app.post('/api/guilds/:guildId/music/control', authMiddleware, (req, res) => {
    const { guildId } = req.params;
    const { action } = req.body;
    const player = client.riffy.players.get(guildId);

    if (!player) {
        return res.status(404).json({ error: client.getLocale('err_player_not_found') });
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
                return res.status(400).json({ error: client.getLocale('err_invalid_action') });
        }
        res.status(200).json({ success: client.getLocale('log_action_executed', { action: action }) });
    } catch (error) {
        res.status(500).json({ error: client.getLocale('err_player_control_failed') });
    }
  });


  app.post('/api/bot/profile', authMiddleware, async (req, res) => {
    const { username, avatar } = req.body;
    if (!username && !avatar) return res.status(400).json({ error: client.getLocale('err_no_username_or_avatar') });
    try {
      if (username) await client.user.setUsername(username);
      if (avatar) await client.user.setAvatar(avatar);
      res.status(200).json({ success: client.getLocale('log_profile_updated') });
    } catch (error) {
      console.error(client.getLocale('err_profile_update_failed'), error);
      res.status(500).json({ error: client.getLocale('err_profile_update_discord_api', { message: error.message }) });
    }
  });

  app.post('/api/test-ai', authMiddleware, async (req, res) => {
      const { history, config } = req.body;
      const { generateStandaloneResponse } = client.features.get('aiHandler');
      if (!history || !config || !generateStandaloneResponse) return res.status(400).json({ error: client.getLocale('err_invalid_payload') });
      try {
          const response = await generateStandaloneResponse(history, config);
          res.status(200).json({ reply: response });
      } catch (error) {
          console.error(client.getLocale('err_api_test_ai'), error);
          res.status(500).json({ error: client.getLocale('err_ai_response_generation_failed') });
      }
  });

  app.get('/api/ai-tools', authMiddleware, (req, res) => {
    try {
        // Usa require para obter uma cópia fresca toda vez, ou pode ser cacheado.
        const { tools } = require('./features/toolbelt.js');
        const toolNames = tools.map(t => t.function.name);
        res.json({ tools: toolNames });
    } catch (error) {
        console.error(client.getLocale('err_api_ai_tools'), error);
        res.status(500).json({ error: client.getLocale('err_ai_tools_load_failed') });
    }
  });

  // --- Page Serving ---
  // Serve login page unprotected
  app.get('/login.html', (req, res) => {
    res.sendFile(path.join(ROOT, 'dashboard', 'public', 'login.html'));
  });

  // Serve visualizer page publicly
  app.get('/visualizer.html', (req, res) => {
    res.sendFile(path.join(ROOT, 'dashboard', 'public', 'visualizer.html'));
  });

  // Serve all other HTML files with the page authentication middleware
  const protectedPages = [
      'index.html', 'ai_features.html', 'github.html', 'management.html',
      'music_system.html', 'profile.html', 'server.html', 'server_stats.html',
      'stats.html', 'sidebar.html'
  ];

  app.get('/', pageAuthMiddleware, (req, res) => {
    res.sendFile(path.join(ROOT, 'dashboard', 'public', 'index.html'));
  });

  protectedPages.forEach(page => {
      app.get(`/${page}`, pageAuthMiddleware, (req, res) => {
          res.sendFile(path.join(ROOT, 'dashboard', 'public', page));
      });
  });

  // Serve static assets (JS, CSS, images) after protected routes
  app.use(express.static(path.join(ROOT, 'dashboard', 'public')));


  app.post('/api/webhooks/github', async (req, res) => {
    if (!client.db) return res.status(503).json({ error: client.getLocale('err_db_not_connected') });

    const githubEvent = req.headers['x-github-event'];
    const signature = req.headers['x-hub-signature-256'];
    const payload = req.body;
    const repoFullName = payload.repository.full_name;

    if (!githubEvent || !signature || !payload || !repoFullName) {
        return res.status(400).send(client.getLocale('err_bad_request_missing_headers'));
    }

    try {
        const settingsCollection = client.db.collection('server-settings');
        // Encontra todas as guilds que monitoram este repositório específico
        const relevantSettings = await settingsCollection.find({
            'githubRepos.name': repoFullName
        }).toArray();

        if (relevantSettings.length === 0) {
            return res.status(200).send(client.getLocale('log_no_configs_for_repo'));
        }

        let processed = false;
        for (const settings of relevantSettings) {
            const rawRepoConfig = settings.githubRepos.find(r => r.name === repoFullName);
            if (!rawRepoConfig) continue;

            const repoConfig = mergeGithubConfig(rawRepoConfig);

            // Verifica a assinatura para cada configuração
            const hmac = crypto.createHmac('sha256', repoConfig.secret);
            const digest = `sha256=${hmac.update(req.rawBody).digest('hex')}`;

            if (crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
                // Assinatura válida, processa o evento
                switch (githubEvent) {
                    case 'push':
                        githubNotifier.handlePushEvent(client, repoConfig, payload);
                        break;
                    case 'pull_request':
                        githubNotifier.handlePullRequestEvent(client, repoConfig, payload);
                        break;
                    case 'issues':
                        githubNotifier.handleIssuesEvent(client, repoConfig, payload);
                        break;
                    case 'release':
                        githubNotifier.handleReleaseEvent(client, repoConfig, payload);
                        break;
                    case 'watch':
                        githubNotifier.handleStarEvent(client, repoConfig, payload);
                        break;
                    case 'fork':
                        githubNotifier.handleForkEvent(client, repoConfig, payload);
                        break;
                    case 'issue_comment':
                        githubNotifier.handleIssueCommentEvent(client, repoConfig, payload);
                        break;
                    case 'pull_request_review':
                        githubNotifier.handlePullRequestReviewEvent(client, repoConfig, payload);
                        break;
                }
                processed = true;
            } else {
                console.warn(client.getLocale('warn_github_webhook_invalid_signature', { repoFullName: repoFullName, guildId: settings.guildId }));
            }
        }

        if (processed) {
            res.status(200).send(client.getLocale('log_event_processed'));
        } else {
            res.status(401).send(client.getLocale('err_unauthorized_invalid_signature'));
        }

    } catch (error) {
        console.error(client.getLocale('err_github_webhook_process'), error);
        res.status(500).send(client.getLocale('err_internal_server'));
    }
  });

  io.on('connection', (socket) => {
    console.log('A user connected to the dashboard via WebSocket.');

    let currentGuildId = null;

    socket.on('joinVisualizer', (guildId) => {
        socket.join(guildId);
        currentGuildId = guildId;
        console.log(`Socket joined room for guild: ${guildId}`);
        // Send initial player state when a client joins
        sendPlayerUpdate(guildId);
    });

    socket.on('musicControl', async (data) => {
        const { guildId, sessionToken, action, value } = data;
        const player = client.riffy.players.get(guildId);
        if (!player) return;

        const expectedToken = player.get('sessionToken');
        if (expectedToken !== sessionToken) {
            socket.emit('unauthorized');
            return;
        }

        switch(action) {
            case 'play_pause':
                player.pause(!player.paused);
                break;
            case 'skip':
                player.stop();
                break;
            case 'seek':
                player.seek(value.position);
                break;
            case 'volume':
                player.setVolume(value.level);
                break;
            case 'repeat':
                const currentLoop = player.loop;
                const nextLoop = currentLoop === 'queue' ? 'track' : currentLoop === 'track' ? 'none' : 'queue';
                player.setLoop(nextLoop);
                break;
        }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected from WebSocket.');
      if(currentGuildId) {
        socket.leave(currentGuildId);
      }
    });
  });

    async function fetchLyrics(artist, title) {
        try {
            const response = await axios.get(`https://lrclib.net/api/get`, { params: { artist_name: artist, track_name: title } });
            if (response.data && response.data.syncedLyrics) {
                return response.data.syncedLyrics;
            }
            return response.data.plainLyrics || "Lyrics not found.";
        } catch (error) {
            console.error('Error fetching lyrics from LRCLib:', error.message);
            return "Could not retrieve lyrics.";
        }
    }

  async function sendPlayerUpdate(guildId) {
    const player = client.riffy.players.get(guildId);
    let data;

    if (!player || !player.queue.current) {
        data = { isPlaying: false };
    } else {
        const track = player.queue.current;
        const lyrics = await fetchLyrics(track.info.author, track.info.title);
        data = {
            isPlaying: player.state === 'CONNECTED',
            isPaused: player.paused,
            track: {
                title: track.info.title,
                author: track.info.author,
                uri: track.info.uri,
                artworkUrl: await track.info.thumbnail,
                duration: track.info.length,
                position: player.position,
            },
            volume: player.volume,
            loop: player.loop,
            lyrics: lyrics
        };
    }
    io.to(guildId).emit('playerUpdate', data);
  }

  client.on('playerUpdate', (guildId) => {
      sendPlayerUpdate(guildId);
  });

  server.listen(port, () => console.log(client.getLocale('log_dashboard_running', { port: port })));
}

async function initializeRiffy() {
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

    client.on("raw", (d) => {
        if (client.riffy) {
            client.riffy.updateVoiceState(d);
        }
    });

    client.riffyManager = new RiffyManager(client);
    client.riffyManager.connect();
    console.log(client.getLocale('log_riffy_manager_connected'));
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
    await initializeRiffy();

    client.once('clientReady', async (readyClient) => {
        if (client.riffy) {
            await client.riffy.init(readyClient.user.id);
            console.log(client.getLocale('log_riffy_initialized'));
        }

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
      if (process.env.DEV_MODE !== 'true') process.exit(1);
    }

    if (process.env.DEV_MODE !== 'true') {
        await client.login(token);
    } else {
        console.log("DEV_MODE is true, skipping Discord login.");
    }
  } catch (err) {
    console.error(client.getLocale('err_fatal_init', { error: err }));
    process.exit(1);
  }
})();
