# Discord Bot Prototype

This is a prototype of a feature-rich Discord bot. This document provides an overview of its features, commands, and setup instructions.

## Core Features

This bot is packed with powerful features, all manageable through a comprehensive web dashboard.

*   **Web Dashboard:** A full-featured web interface for managing the bot and your server.
    *   **Server Management:** Configure server-specific settings.
    *   **Statistics:** View detailed statistics about your server and the bot's usage.
    *   **AI Configuration:** Customize the AI's personality, allowed channels, and more.
    *   **Music Player:** Control the music player directly from the web dashboard.
    *   **Profile Management:** Change the bot's username and avatar.
*   **Music System:** A high-quality music system powered by Lavalink.
    *   **YouTube Playback:** Play music directly from YouTube.
    *   **Queue Management:** Full control over the music queue.
    *   **Web & Command Control:** Manage music via slash commands or the web dashboard.
*   **AI Chatbot & Tools:** A highly configurable AI chatbot with a powerful toolbelt.
    *   **Customizable Personality:** Tailor the AI's personality to fit your server.
    *   **Toolbelt:** The AI can use tools like Google Search, a FAQ reader, and more.
    *   **Channel Management:** Restrict the AI to specific channels.
*   **GitHub Notifications:** A comprehensive GitHub webhook integration to keep your server updated.
    *   **Extensive Event Support:** Get notifications for pushes, pull requests, issues, releases, and more.
    *   **Fine-Grained Control:** Configure notifications per repository, including branch, label, and event filters.

## Available Commands

The bot uses slash commands, organized into the following categories:

### Debug

*   `/checkcluster`: Checks the status of the Lavalink cluster.

### Management

*   `/ai-channel`: Configure the channel for AI-powered conversations.
*   `/ai-settings`: Adjust the settings for the AI.
*   `/github`: Manage GitHub repository integrations.

### Music

*   `/play <song>`: Plays a song from YouTube.
*   `/pause`: Pauses the current song.
*   `/resume`: Resumes the current song.
*   `/skip`: Skips the current song.
*   `/stop`: Stops the music and clears the queue.
*   `/queue`: Displays the current music queue.
*   `/nowplaying`: Shows the currently playing song.
*   `/clear`: Clears the music queue.
*   `/loop`: Loops the current song or queue.
*   `/remove <track_number>`: Removes a specific track from the queue.
*   `/volume <level>`: Adjusts the volume of the music player.
*   `/autoplay`: Toggles autoplay for the music player.

### Utils

*   `/ping`: Checks the bot's latency.

## Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create a `.env` file:**
    Create a `.env` file in the root of the project and fill it with the necessary credentials. You can use the `.env.example` file as a template.

4.  **Create a `config.json` file:**
    Create a `config.json` file in the root of the project. You can use the `config.json.example` file as a template.

5.  **Start the bot:**
    ```bash
    node index.js
    ```

## Configuration

### `.env` File

The `.env` file is used for storing sensitive credentials.

```
# Discord Bot Token
TOKEN=your_discord_bot_token

# Discord Client ID (for registering slash commands)
CLIENT_ID=your_discord_client_id

# MongoDB Connection URI
MONGO_URI=your_mongodb_connection_uri

# Set to 'true' to register slash commands on startup
REGISTER_COMMANDS=true

# Dashboard Configuration
DASHBOARD_PORT=3000
DASHBOARD_PASSWORD=your_dashboard_password

# API Keys
OPENROUTER_API_KEY=your_openrouter_api_key

# Lavalink Node Configuration
LAVALINK_HOST=your_lavalink_host
LAVALINK_PORT=2333
LAVALINK_PASSWORD=your_lavalink_password
LAVALINK_SECURE=false # Set to 'true' if using SSL
```

### `config.json` File

The `config.json` file is used for general bot configuration.

```json
{
  "colors": {
    "primary": "#000000",
    "accent1": "#00ff00",
    "error": "#FF0000"
  },
  "statuses": [
    { "name": "</> In development", "type": "PLAYING" }
  ],
  "statusrouter": 15000,
  "language": "en",
  "activateDashboard": true,
  "useExternalSettings": true,
  "enabledCommands": {},
  "music": {
    "nodes": [
      {
        "host": "your_lavalink_host",
        "port": 2333,
        "password": "your_lavalink_password",
        "secure": false,
        "name": "Main Node"
      }
    ],
    "defaultVolume": 80,
    "djRole": "DJ"
  }
}
```