const OpenAI = require('openai');
const { tools, getToolFunctions } = require('./toolbelt.js');
const { ChannelType } = require('discord.js');

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Fetches and formats the message history of a channel.
 * @param {import('discord.js').Message} message - The message that triggered the bot.
 * @param {import('discord.js').Client} client - The Discord client.
 * @param {number} limit - The number of messages to fetch.
 * @returns {Promise<{role: string, content: string}[]>} - The formatted history.
 */
async function fetchConversationHistory(message, client, limit) {
  const lastMessages = await message.channel.messages.fetch({ limit });
  const conversation = [];

  for (const msg of Array.from(lastMessages.values()).reverse()) {
    let textContent = msg.content;

    // Capability: Know when a command was used
    // The user stated this would be marked in the message content.
    if (textContent.includes('(used command)')) {
      textContent = `(The user executed one of my commands) ${textContent.replace('(used command)', '').trim()}`;
    }

    // Capability: Read simplified embed content
    if (msg.embeds.length > 0) {
      const embedContent = msg.embeds.map(embed => {
        let content = `[Embed`;
        if (embed.author?.name) content += ` by ${embed.author.name}`;
        if (embed.title) content += `: ${embed.title}`;
        content += `]`;
        if (embed.footer?.text) content += ` (Footer: ${embed.footer.text})`;
        return content;
      }).join(' ');
      // Add a space if there's existing text content
      textContent += (textContent ? ' ' : '') + embedContent;
    }

    // Differentiate between user, bot, and self
    let authorName = msg.author.username;
    let role = 'user';

    if (msg.author.id === client.user.id) {
      role = 'assistant';
    } else if (msg.author.bot) {
      authorName = `[BOT] ${authorName}`;
    }

    const userText = role === 'assistant' ? textContent : `${authorName}: ${textContent}`;
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

    let systemPrompt = `You are a conversational AI assistant named ${botName}. You are in the Discord server "${guildName}", in the #${channel.name} (${channelTypeName}) channel. Today is ${today}.\n`;
    systemPrompt += `Your primary directive is to be helpful and engaging. Differentiate users by their names. Respond to the last message, considering the entire history. You MUST respond in ${userLocale}.\n\n`;

    // --- User-Defined Configuration ---
    if (aiConfig.personality) {
        systemPrompt += "## Your Personality (User-defined)\n";
        systemPrompt += "Adopt these personality traits:\n";
        systemPrompt += aiConfig.personality.split('\n').map(p => `- ${p.trim()}`).filter(p => p.length > 2).join('\n') + '\n\n';
    }

    if (aiConfig.extraInstructions) {
        systemPrompt += "## Extra Instructions (User-defined)\n";
        systemPrompt += "Follow these instructions precisely:\n";
        systemPrompt += aiConfig.extraInstructions + '\n\n';
    }

    if (aiConfig.faq && Array.isArray(aiConfig.faq) && aiConfig.faq.length > 0) {
        systemPrompt += "## FAQ (Provided by Server Admins)\n";
        systemPrompt += "These are frequently asked questions and their official answers. If a user's question matches one of these, provide the corresponding answer.\n";
        systemPrompt += aiConfig.faq.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') + '\n\n';
    }

    // --- Tools ---
    systemPrompt += "## Tools\n";
    systemPrompt += "You have access to tools to perform actions. Only use a tool if the user's request explicitly requires it.\n";
    systemPrompt += "- `google_search({query: '...'})`: Search the web for current information.\n";
    systemPrompt += "- `search_knowledge_base({query: '...'})`: Search the server's knowledge base for specific information.\n";
    systemPrompt += "- `read_faq({query: '...'})`: Search the server's FAQ when a user asks a question that might be listed there. Use this if the answer isn't in your immediate knowledge.\n";
    systemPrompt += "- `play_music({query: '...'})`: Play a song. The user who is talking to you must be in a voice channel.\n";
    systemPrompt += "- `pause_music()`, `resume_music()`, `skip_music()`, `stop_music()`: Control the music player.\n\n";

    // --- Behavioral Rules ---
    systemPrompt += "## MANDATORY BEHAVIORAL RULES\n";
    systemPrompt += "1. NEVER use hate speech, slurs, or heavy insults.\n";
    systemPrompt += "2. BE RESPECTFUL and do not promote violence or dangerous acts.\n";
    systemPrompt += "3. When you use a tool, your final response MUST mention the action. Example: \"I searched for 'dinosaurs' and found...\" or \"I checked the FAQ and the answer is...\".\n";
    systemPrompt += "4. If a tool fails, your response MUST be only the error message provided. Do not try again. Report the error.\n\n";

    systemPrompt += "---\nRemember your rules and respond to the user's last message.";
    return systemPrompt;
}

/**
 * Main function to generate the AI response.
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

    // Filter tools based on whether FAQ is enabled
    let availableTools = [...tools];
    if (aiConfig.faqEnabled === false) {
        availableTools = availableTools.filter(t => t.function.name !== 'read_faq');
    }

    const completion = await openai.chat.completions.create({
      model: model,
      messages: messagesForAPI,
      tools: availableTools.length > 0 ? availableTools : undefined,
      tool_choice: availableTools.length > 0 ? "auto" : "none",
    });

    const responseMessage = completion.choices[0].message;

    if (responseMessage.tool_calls) {
        const availableFunctions = getToolFunctions(client);
        messagesForAPI.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionToCall = availableFunctions[functionName];
            const functionArgs = JSON.parse(toolCall.function.arguments);

            const functionResponse = await functionToCall(functionArgs, message);

            if (functionResponse.success === false) {
                console.error(`Tool call failed for '${functionName}'. Reason: ${functionResponse.content}`);
                return functionResponse.content; // Return error message directly
            }

            messagesForAPI.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: functionName,
                content: JSON.stringify(functionResponse),
            });
        }

        const secondCompletion = await openai.chat.completions.create({
            model: model,
            messages: messagesForAPI,
        });

        return secondCompletion.choices[0].message.content;
    }

    return responseMessage.content;
  } catch (error) {
    console.error(`[aiHandler] Failed to generate AI response for guild ${message.guild.id}. Error: ${error.message}`);
    if (error.response) { // log more detailed API error if available
        console.error(`[aiHandler] API Error Status: ${error.response.status}`);
        console.error(`[aiHandler] API Error Data:`, error.response.data);
    }
    return client.getLocale('err_ai_response');
  }
}

/**
 * Entry point function called by the messageCreate event.
 */
async function processMessage(client, message) {
  if (message.author.id === client.user.id || !message.guild) return;

  const settingsCollection = client.getDbCollection('server-settings');
  if (!settingsCollection) return;

  const serverSettings = await settingsCollection.findOne({ guildId: message.guild.id }) || {};
  const aiConfig = serverSettings.aiConfig || {};

  // 1. Check if the AI is enabled at all for this server.
  if (!aiConfig.enabled) {
    return;
  }

  // 2. Check if the channel is explicitly restricted.
  if (aiConfig.restrictedChannels && aiConfig.restrictedChannels.includes(message.channel.id)) {
    return;
  }

  const isMentioned = message.mentions.users.has(client.user.id);
  const isAllowedChannel = aiConfig.allowedChannels && aiConfig.allowedChannels.includes(message.channel.id);

  let isReplyingToBot = false;
  if (message.reference) {
    const repliedTo = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
    if (repliedTo && repliedTo.author.id === client.user.id) {
      isReplyingToBot = true;
    }
  }

  // Determine if the bot should respond:
  // - If it's mentioned or replied to.
  // - Or if it's in a designated "speak freely" channel.
  if (isMentioned || isReplyingToBot || isAllowedChannel) {
    const response = await generateResponse(client, message);
    if (response) {
      await message.reply({ content: response, allowedMentions: { repliedUser: false } });
    }
  }
}

/**
 * Standalone test function for the dashboard.
 */
async function generateStandaloneResponse(history, aiConfig) {
    const safeAiConfig = aiConfig || {};
    const model = safeAiConfig.model || 'x-ai/grok-4-fast:free';

    const mockChannel = { name: 'Dashboard Test', type: ChannelType.GuildText };
    const mockGuild = { name: 'Test Server' };
    const mockBot = { username: 'Test Bot' };

    const systemPromptContent = constructSystemPrompt(safeAiConfig, mockGuild.name, mockBot.username, mockChannel, 'en');
    const messagesForAPI = [{ role: 'system', content: systemPromptContent }, ...history];

    // Tools are disabled in the standalone test to avoid the complexity of mocking
    // the Discord `message` object context required by many tools.
    // The user can test the prompt, personality, and knowledge/FAQ injection.
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