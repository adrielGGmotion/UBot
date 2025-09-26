# Discord Bot Prototype

This is a prototype of a feature-rich Discord bot. This document provides an overview of its features, commands, and setup instructions.

## Features

*   **Music Player:** Play music from YouTube.
*   **AI Integration:** AI-powered features.
*   **GitHub Integration:** Link and manage GitHub repositories.
*   **Moderation:** Basic moderation commands.
*   **Utilities:** Utility commands like ping.

## Commands

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

### Utils

*   `/ping`: Checks the bot's latency.

## Setup

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
    Create a `.env` file in the root of the project and fill it with the necessary credentials. You can use the `README.md` file as a template.

4.  **Start the bot:**
    ```bash
    node index.js
    ```

## Configuration (`.env`)

```
# DISCORD STUFF
TOKEN=token_here
CLIENT_ID=client_id
MONGO_URI=mongo_db_uri_here
REGISTER_COMMANDS=true

# SERVER
DASHBOARD_PORT=3000
DASHBOARD_PASSWORD=do_not_share_your_password

# API KEYS
GITHUB_TOKEN=same_doesnt_work
YOUTUBE_API_KEY=also_doesnt_work
NEWSAPI_KEY=this_doesn't_work_no_need_to_add

# AI API KEY
OPENROUTER_API_KEY=openrouter_api_key

# LAVALINK NODES
LAVALINK_HOST=lavalink_host_here
LAVALINK_PORT=3000
LAVALINK_PASSWORD=lavalink_password
LAVALINK_SECURE=false
```