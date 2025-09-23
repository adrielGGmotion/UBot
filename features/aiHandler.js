const OpenAI = require('openai');
const { tools, getToolFunctions } = require('./toolbelt.js');

// Inicializa o cliente da API
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
});

const IMAGE_URL_REGEX = /\b(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp))\b/i;

/**
 * Busca e formata o histórico de mensagens do canal, agora com capacidade de incluir imagens.
 * @param {import('discord.js').Message} message - A mensagem que acionou o bot.
 * @param {import('discord.js').Client} client - O cliente do Discord.
 * @param {number} limit - O número de mensagens a serem buscadas.
 * @returns {Promise<{role: string, content: (string | object)[]}[]>} - O histórico formatado.
 */
async function fetchConversationHistory(message, client, limit) {
  const lastMessages = await message.channel.messages.fetch({ limit });
  const conversation = [];

  for (const msg of Array.from(lastMessages.values()).reverse()) {
    const textContent = msg.content;
    let imageUrl = null;

    if (msg.attachments.size > 0) {
      const attachment = msg.attachments.first();
      if (attachment.contentType?.startsWith('image/')) {
        imageUrl = attachment.url;
      }
    }

    if (!imageUrl) {
      const match = textContent.match(IMAGE_URL_REGEX);
      if (match) {
        imageUrl = match[0];
      }
    }

    const contentPayload = [];
    const userText = msg.author.id === client.user.id ? textContent : `${msg.author.username}: ${textContent}`;
    contentPayload.push({ type: 'text', text: userText });

    if (imageUrl) {
      contentPayload.push({
        type: 'image_url',
        image_url: {
          url: imageUrl,
        },
      });
    }

    const role = msg.author.id === client.user.id ? 'assistant' : 'user';
    const finalContent = contentPayload.length === 1 && !imageUrl
        ? contentPayload[0].text
        : contentPayload;

    conversation.push({ role, content: finalContent });
  }

  return conversation;
}

/**
 * Procura por uma pergunta relevante na base de conhecimento (FAQ) do servidor.
 */
function findRelevantFAQ(faqList, userMessage) {
  if (!faqList || faqList.length === 0) return '';
  const lowerUserMessage = userMessage.toLowerCase();

  const foundFaq = faqList.find(faq => {
    const keywords = faq.question.toLowerCase().split(' ').filter(word => word.length > 3);
    return keywords.some(key => lowerUserMessage.includes(key));
  });

  if (foundFaq) {
    return `## Base de Conhecimento Relevante\nSe a pergunta do usuário for similar a esta, use a seguinte informação para responder:\n- Pergunta: ${foundFaq.question}\n- Resposta: ${foundFaq.answer}\n`;
  }

  return '';
}

/**
 * Constrói o prompt de sistema final com todas as informações de contexto e regras de segurança.
 */
function constructSystemPrompt(aiConfig, faqContext, guildName, botName) {
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let systemPrompt = `Você é um assistente de IA conversacional. Seu nome é ${botName}. Você está atualmente no servidor Discord chamado "${guildName}". Hoje é ${today}.\n`;
  systemPrompt += "Sua diretriz principal é ser útil e envolvente. Você DEVE diferenciar os usuários na conversa pelos seus nomes e responder à última mensagem, considerando todo o histórico.\n\n";

  if (aiConfig.personality) {
    systemPrompt += "## Sua Personalidade (Definida pelo Usuário)\n";
    systemPrompt += aiConfig.personality + '\n\n';
  }

  if (aiConfig.examples) {
    systemPrompt += "## Exemplos de Estilo de Resposta\nSiga estes exemplos para o seu estilo de resposta:\n" + aiConfig.examples + '\n';
  }

  systemPrompt += "## Memória do Usuário\n";
  systemPrompt += "Você tem a capacidade de lembrar e esquecer informações sobre os usuários. Use as seguintes ferramentas para gerenciar sua memória:\n";
  systemPrompt += "- `save_user_memory({key: 'nome_da_info', value: 'valor_da_info'})`: Para guardar um detalhe sobre o usuário com quem você está falando.\n";
  systemPrompt += "- `get_user_memory({key: 'nome_da_info'})`: Para recuperar um detalhe que você salvou anteriormente sobre o usuário.\n\n";

  systemPrompt += "## Pesquisa na Web\n";
  systemPrompt += "Você tem a capacidade de pesquisar na internet usando o Google para encontrar informações atuais ou sobre tópicos específicos.\n";
  systemPrompt += "- `google_search({query: 'termo_de_busca'})`: Use esta ferramenta quando a pergunta do usuário exigir conhecimento atual, notícias, ou informações que você não possui.\n\n";

  systemPrompt += "## REGRAS DE COMPORTAMENTO OBRIGATÓRIAS\n";
  systemPrompt += "INDEPENDENTE DA SUA PERSONALIDADE, você DEVE seguir estas regras SEMPRE:\n";
  systemPrompt += "1. NUNCA use discurso de ódio, calúnias, ofensas pesadas ou termos pejorativos.\n";
  systemPrompt += "2. NUNCA promova ou incentive violência, automutilação ou qualquer ato perigoso.\n";
  systemPrompt += "3. SEJA RESPEITOSO com todos os usuários.\n";
  systemPrompt += "4. NÃO crie conteúdo que seja sexualmente explícito ou inapropriado.\n";
  systemPrompt += "5. Sua função é ser uma presença positiva e segura na comunidade.\n\n";
  systemPrompt += "6. Você não deve utilizar emojis, ao menos que esteja na personalidade que você possa.\n\n";

  if (faqContext) {
    systemPrompt += faqContext + '\n';
  }

  systemPrompt += "\n---\nLembre-se das suas regras de comportamento obrigatórias e responda à última mensagem do usuário.";
  return systemPrompt;
}

/**
 * Função principal que gera a resposta da IA, agora com capacidade de usar ferramentas.
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
    const faqContext = findRelevantFAQ(serverSettings.faq, message.content);
    const systemPromptContent = constructSystemPrompt(aiConfig, faqContext, message.guild.name, client.user.username);

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
      messagesForAPI.push(responseMessage);
      const availableFunctions = getToolFunctions(client);
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionToCall = availableFunctions[functionName];
        const functionArgs = JSON.parse(toolCall.function.arguments);
        const functionResponse = await functionToCall(functionArgs, message);
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
 * Função que é chamada pelo evento messageCreate para processar a mensagem.
 */
async function processMessage(client, message) {
  if (message.author.bot || !message.guild) return;

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

// Função de teste para a dashboard
async function generateStandaloneResponse(history, aiConfig) {
     const safeAiConfig = aiConfig || {};
     const systemPrompt = { role: 'system', content: safeAiConfig.personality || "Você é um bot de teste." };
     const messagesForAPI = [systemPrompt, ...history];
     const model = safeAiConfig.model || 'x-ai/grok-4-fast:free';
     const completion = await openai.chat.completions.create({
       model: model,
       messages: messagesForAPI,
     });
     return completion.choices[0].message.content;
}

module.exports = {
  processMessage,
  generateStandaloneResponse
};
