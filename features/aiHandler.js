const OpenAI = require('openai');
const { tools, getToolFunctions } = require('./toolbelt.js');
const { ChannelType } = require('discord.js');

// Inicializa o cliente da API
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
});

const IMAGE_URL_REGEX = /\b(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp))\b/i;

/**
 * Mapeia o enum ChannelType para um nome legível.
 * @param {import('discord.js').ChannelType} type - O tipo do canal.
 * @returns {string} - O nome do tipo de canal.
 */
/**
 * Fetches and formats the message history of a channel, with advanced context capabilities.
 * @param {import('discord.js').Message} message - The message that triggered the bot.
 * @param {import('discord.js').Client} client - The Discord client.
 * @param {number} limit - The number of messages to fetch.
 * @returns {Promise<{role: string, content: (string | object)[]}[]>} - The formatted history.
 */
async function fetchConversationHistory(message, client, limit) {
  const lastMessages = await message.channel.messages.fetch({ limit });
  const conversation = [];

  for (const msg of Array.from(lastMessages.values()).reverse()) {
    let textContent = msg.content;

    // Capability: Read embed content
    if (msg.embeds.length > 0) {
      const embedContent = msg.embeds.map(embed => {
        let content = `[Embed`;
        if (embed.author?.name) content += ` by ${embed.author.name}`;
        content += `]`;
        if (embed.title) content += `\nTitle: ${embed.title}`;
        if (embed.description) content += `\nDescription: ${embed.description}`;
        if (embed.fields.length > 0) {
          content += `\nFields:\n${embed.fields.map(field => `- ${field.name}: ${field.value}`).join('\n')}`;
        }
        if (embed.footer?.text) content += `\nFooter: ${embed.footer.text}`;
        return content;
      }).join('\n\n');
      textContent += `\n${embedContent}`;
    }

    // Capability: Know if dealing with a user or bot
    let authorName = msg.author.username;
    if (msg.author.bot && msg.author.id !== client.user.id) {
        authorName = `[BOT] ${authorName}`;
    }

    const userText = msg.author.id === client.user.id ? textContent : `${authorName}: ${textContent}`;
    const role = msg.author.id === client.user.id ? 'assistant' : 'user';

    conversation.push({ role, content: userText });
  }

  return conversation;
}

/**
 * Constructs the final system prompt with all context and security rules.
 * @param {object} aiConfig - The AI configuration from settings.
 * @param {string} guildName - The name of the server.
 * @param {string} botName - The name of the bot.
 * @param {import('discord.js').TextChannel} channel - The channel where the interaction is happening.
 * @param {string} userLocale - The locale of the user for language-specific responses.
 * @returns {string} The constructed system prompt.
 */
function constructSystemPrompt(aiConfig, guildName, botName, channel, userLocale = 'en') {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const channelTypeName = Object.keys(ChannelType).find(key => ChannelType[key] === channel.type) || 'Unknown';

    let systemPrompt = `You are a conversational AI assistant. Your name is ${botName}. You are currently in the Discord server "${guildName}", in the channel #${channel.name} (a ${channelTypeName} channel). Today is ${today}.\n`;
    systemPrompt += `Your primary directive is to be helpful and engaging. You MUST differentiate users in the conversation by their names and respond to the last message, considering the entire history. IMPORTANT: The user is speaking ${userLocale}. You MUST respond in ${userLocale}.\n\n`;

    if (aiConfig.personality && Array.isArray(aiConfig.personality) && aiConfig.personality.length > 0) {
        systemPrompt += "## Your Personality (User-defined)\n";
        systemPrompt += "This is a list of personality traits you should adopt. Each line is a separate instruction:\n";
        systemPrompt += aiConfig.personality.map(p => `- ${p.trim()}`).filter(p => p.length > 1).join('\n') + '\n\n';
    }

    if (aiConfig.examples && Array.isArray(aiConfig.examples) && aiConfig.examples.length > 0) {
        systemPrompt += "## Response Style Examples\nFollow these examples for your response style. Each line is a separate instruction:\n";
        systemPrompt += aiConfig.examples.map(e => `- ${e.trim()}`).filter(e => e.length > 1).join('\n') + '\n\n';
    }

    systemPrompt += "## Server Awareness & Tools\n";
    systemPrompt += "To understand the environment and perform actions, you have the following capabilities:\n";
    systemPrompt += "- **List Channels:** Use `list_channels()` to see all available channels, their names, IDs, and types (text, voice, etc.). This is essential to know where things are and where you can act.\n";
    systemPrompt += "- **Get IDs:** Many tools require an ID (of a user, channel, message). If the user provides a name (e.g., \"the #general channel\" or \"user @JohnDoe\"), use the `get_id({type: '...', query: '...'})` tool FIRST to find the correct ID before attempting the main action.\n";
    systemPrompt += "- **Analyze Images:** If a user posts an image URL and asks about it, use `analyze_image_from_url({url: '...'})` to describe it.\n";
    systemPrompt += "- **Read Knowledge Base:** If the user's question seems like it could be answered by a FAQ or a knowledge base, use `read_knowledge_base({query: '...'})` to search for relevant information.\n\n";

    systemPrompt += "## Music Control\n";
    systemPrompt += "You can control the music player. Use the following tools:\n";
    systemPrompt += "- `play_music({query: 'song name or URL'})`: To start playing a song. The user must be in a voice channel.\n";
    systemPrompt += "- `pause_music()`: To pause the currently playing song.\n";
    systemPrompt += "- `resume_music()`: To resume a paused song.\n";
    systemPrompt += "- `skip_music()`: To skip the current song and play the next one in the queue.\n";
    systemPrompt += "- `stop_music()`: To stop the music and clear the queue.\n";
    systemPrompt += "- `view_queue()`: To see the list of songs currently in the queue.\n\n";

    systemPrompt += "## User Memory\n";
    systemPrompt += "You can remember and forget information about users. Use the following tools to manage your memory:\n";
    systemPrompt += "- `save_user_memory({key: 'info_name', value: 'info_value'})`: To save a detail about the user you are talking to.\n";
    systemPrompt += "- `get_user_memory({key: 'info_name'})`: To retrieve a detail you previously saved about the user.\n\n";

    systemPrompt += "## Web Search\n";
    systemPrompt += "You can search the internet using Google to find current information or specific topics.\n";
    systemPrompt += "- `google_search({query: 'search_term'})`: Use this tool when the user's question requires current knowledge, news, or information you don't have.\n\n";

    systemPrompt += "## MANDATORY BEHAVIORAL RULES\n";
    systemPrompt += "REGARDLESS OF YOUR PERSONALITY, you MUST follow these rules ALWAYS:\n";
    systemPrompt += "1. NEVER use hate speech, slurs, heavy insults, or derogatory terms.\n";
    systemPrompt += "2. NEVER promote or encourage violence, self-harm, or any dangerous acts.\n";
    systemPrompt += "3. BE RESPECTFUL to all users.\n";
    systemPrompt += "4. DO NOT create sexually explicit or inappropriate content.\n";
    systemPrompt += "5. Your function is to be a positive and safe presence in the community.\n";
    systemPrompt += "6. Do not use emojis unless your personality explicitly allows it.\n";
    systemPrompt += "7. **TOOL TRANSPARENCY:** When you use a tool successfully, your final response MUST mention the action you took. Example: \"I checked the latest messages in #general and...\" or \"I searched for 'next NASA launch' and found out that...\".\n";
    systemPrompt += "8. **TOOL ERROR HANDLING:** If you use a tool and the result indicates a failure (e.g., `{\"success\": false, \"content\": \"error message\"}`), your response MUST be only the error message from the `content` field. DO NOT try the tool again. Just report the error to the user.\n\n";

    systemPrompt += "\n---\nRemember your mandatory behavioral rules and respond to the user's last message.";
    return systemPrompt;
}


/**
 * Main function to generate the AI response, with tool-using capability.
 */
async function generateResponse(client, message) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
        console.error('OpenRouter API Key not found.');
        return client.getLocale('err_ai_response');
    }

    if (message.channel.isTextBased()) {
        await message.channel.sendTyping();
    }

    const settingsCollection = client.getDbCollection('server-settings');
    const serverSettings = await settingsCollection.findOne({ guildId: message.guild.id }) || {};
    const aiConfig = serverSettings.aiConfig || {};
    const contextLimit = aiConfig.contextLimit || 15;
    const model = aiConfig.model || 'x-ai/grok-4-fast:free';

    const conversation = await fetchConversationHistory(message, client, contextLimit);
    const userLocale = client.config.language || 'en';
    const systemPromptContent = constructSystemPrompt(aiConfig, message.guild.name, client.user.username, message.channel, userLocale);

    const messagesForAPI = [{ role: 'system', content: systemPromptContent }, ...conversation];

    const allToolNames = tools.map(t => t.function.name);
    const enabledTools = aiConfig.enabledTools || allToolNames;
    const filteredTools = tools.filter(t => enabledTools.includes(t.function.name));

    const completion = await openai.chat.completions.create({
      model: model,
      messages: messagesForAPI,
      tools: filteredTools.length > 0 ? filteredTools : undefined,
      tool_choice: filteredTools.length > 0 ? "auto" : "none",
    });

    const responseMessage = completion.choices[0].message;

    const toolCalls = responseMessage.tool_calls;
    if (toolCalls) {
        const availableFunctions = getToolFunctions(client);
        messagesForAPI.push(responseMessage); // Add the tool call to history

        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            const functionToCall = availableFunctions[functionName];
            const functionArgs = JSON.parse(toolCall.function.arguments);

            // Execute the tool function
            const functionResponse = await functionToCall(functionArgs, message);

            // **CRITICAL FAILURE FIX: Check for tool failure**
            if (functionResponse.success === false) {
                console.error(`Tool call failed for '${functionName}'. Reason: ${functionResponse.content}`);
                // Return the error message directly to the user, stopping the loop.
                return functionResponse.content;
            }

            // Add the tool result to history
            messagesForAPI.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: functionName,
                content: JSON.stringify(functionResponse),
            });
        }

        // Continue to the second API call only if all tools succeeded
        const secondCompletion = await openai.chat.completions.create({
            model: model,
            messages: messagesForAPI,
        });

        const finalResponse = secondCompletion.choices[0].message.content;

        if (finalResponse && client.db) {
            const aiUsageLogs = client.getDbCollection('ai-usage-logs');
            await aiUsageLogs.insertOne({ guildId: message.guild.id, userId: message.author.id, timestamp: new Date() });
        }
        return finalResponse;
    }

    const responseContent = responseMessage.content;

    if (responseContent && client.db) {
      const aiUsageLogs = client.getDbCollection('ai-usage-logs');
      await aiUsageLogs.insertOne({
        guildId: message.guild.id,
        userId: message.author.id,
        timestamp: new Date()
      });
    }

    return responseContent;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return client.getLocale('err_ai_response');
  }
}

/**
 * Function called by the messageCreate event to process the message.
 */
async function processMessage(client, message) {
  // Prevents the bot from replying to itself, but allows replying to other bots.
  if (message.author.id === client.user.id || !message.guild) return;

  const settingsCollection = client.getDbCollection('server-settings');
  if (!settingsCollection) return;
  const serverSettings = await settingsCollection.findOne({ guildId: message.guild.id }) || {};
  const aiChannels = serverSettings.aiChannelIds || [];

  const isAiChannel = aiChannels.includes(message.channel.id);
  const isMentioned = message.mentions.users.has(client.user.id);
  let isReplyingToBot = false;
  if (message.reference) {
    const repliedTo = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
    if (repliedTo && repliedTo.author.id === client.user.id) {
      isReplyingToBot = true;
    }
  }

  if (isAiChannel || isMentioned || isReplyingToBot) {
    const response = await generateResponse(client, message);
    if (response) {
      await message.reply({ content: response, allowedMentions: { repliedUser: false } });
    }
  }
}

// Standalone test function for the dashboard
async function generateStandaloneResponse(history, aiConfig) {
    const safeAiConfig = aiConfig || {};
    const model = safeAiConfig.model || 'x-ai/grok-4-fast:free';

    // Mocked Discord-like objects for context
    const mockChannel = { name: 'Dashboard Test', type: ChannelType.GuildText };
    const mockGuild = { name: 'Test Server' };
    const mockBot = { username: 'Test Bot' };

    // Use the main system prompt builder for consistency, but without tools for now.
    // The user's language is assumed to be the bot's default for testing.
    const systemPromptContent = constructSystemPrompt(safeAiConfig, mockGuild.name, mockBot.username, mockChannel, 'en');
    const messagesForAPI = [{ role: 'system', content: systemPromptContent }, ...history];

    // Tools are disabled in the standalone test for now to avoid complexity
    // with message/client context.
    const completion = await openai.chat.completions.create({
      model: model,
      messages: messagesForAPI,
      tool_choice: "none",
    });

    return completion.choices[0].message.content;
}

module.exports = {
  processMessage,
  generateStandaloneResponse
};
