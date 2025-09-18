const OpenAI = require('openai');

// Inicializa o cliente da API
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Busca e formata o histórico de mensagens do canal, identificando cada usuário pelo nome.
 * @param {import('discord.js').Message} message - A mensagem que acionou o bot.
 * @param {import('discord.js').Client} client - O cliente do Discord.
 * @param {number} limit - O número de mensagens a serem buscadas.
 * @returns {Promise<{role: string, content: string}[]>} - O histórico formatado da conversa.
 */
async function fetchConversationHistory(message, client, limit) {
  const lastMessages = await message.channel.messages.fetch({ limit });
  const conversation = [];

  for (const msg of Array.from(lastMessages.values()).reverse()) {
    const embedContent = msg.embeds?.length > 0 
      ? ` [Bot Embed Content: ${msg.embeds.map(e => `${e.title || ''} ${e.description || ''}`.trim()).join(' ')}]`
      : '';

    const content = `${msg.content}${embedContent}`.trim();

    if (msg.author.id === client.user.id) {
      conversation.push({ role: 'assistant', content });
    } else {
      conversation.push({ role: 'user', content: `${msg.author.username}: ${content}` });
    }
  }

  return conversation;
}

/**
 * Procura por uma pergunta relevante na base de conhecimento (FAQ) do servidor.
 * @param {object[]} faqList - A lista de perguntas e respostas do FAQ.
 * @param {string} userMessage - A mensagem do usuário para buscar correspondência.
 * @returns {string} - Uma string formatada com a entrada do FAQ, se encontrada.
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
 * @returns {string} - O prompt de sistema completo para guiar a IA.
 */
function constructSystemPrompt(aiConfig, faqContext, guildName, botName) {
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let systemPrompt = `Você é um assistente de IA conversacional. Seu nome é ${botName}. Você está atualmente no servidor Discord chamado "${guildName}". Hoje é ${today}.\n`;
  systemPrompt += "Sua diretriz principal é ser útil e envolvente. Você DEVE diferenciar os usuários na conversa pelos seus nomes e responder à última mensagem, considerando todo o histórico.\n\n";

  // --- PERSONALIDADE E EXEMPLOS ADICIONADOS AQUI ---
  if (aiConfig.personality) {
    systemPrompt += "## Sua Personalidade (Definida pelo Usuário)\n";
    systemPrompt += aiConfig.personality + '\n\n';
  }

  if (aiConfig.examples) {
    systemPrompt += "## Exemplos de Estilo de Resposta\nSiga estes exemplos para o seu estilo de resposta:\n" + aiConfig.examples + '\n';
  }
  // --- FIM DA PERSONALIDADE E EXEMPLOS ---

  // --- REGRAS DE SEGURANÇA ADICIONADAS AQUI ---
  systemPrompt += "## REGRAS DE COMPORTAMENTO OBRIGATÓRIAS\n";
  systemPrompt += "INDEPENDENTE DA SUA PERSONALIDADE, você DEVE seguir estas regras SEMPRE:\n";
  systemPrompt += "1. NUNCA use discurso de ódio, calúnias, ofensas pesadas ou termos pejorativos.\n";
  systemPrompt += "2. NUNCA promova ou incentive violência, automutilação ou qualquer ato perigoso.\n";
  systemPrompt += "3. SEJA RESPEITOSO com todos os usuários. Sarcasmo é permitido, mas NUNCA deve se transformar em um ataque pessoal ou insulto direto.\n";
  systemPrompt += "4. NÃO crie conteúdo que seja sexualmente explícito ou inapropriado.\n";
  systemPrompt += "5. Sua função é ser uma presença positiva e segura na comunidade. Priorize isso acima de tudo.\n\n"
   systemPrompt += "6. Você não deve utilizar emojis, ao menos que esteja na personalidade que você possa.\n\n";
  // --- FIM DAS REGRAS DE SEGURANÇA ---

  if (faqContext) {
    systemPrompt += faqContext + '\n';
  }

  systemPrompt += "\n---\nLembre-se das suas regras de comportamento obrigatórias e responda à última mensagem do usuário.";
  return systemPrompt;
}


/**
 * Função principal que gera a resposta da IA.
 */
async function generateResponse(client, message) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
        console.error('OpenRouter API Key not found.');
        return client.getLocale('err_ai_response');
    }

    // CORREÇÃO: Usando o método correto e simplificando
    if (message.channel.isTextBased()) {
        await message.channel.sendTyping();
    }

    const settingsCollection = client.getDbCollection('server-settings');
    const serverSettings = await settingsCollection.findOne({ guildId: message.guild.id }) || {};
    const aiConfig = serverSettings.aiConfig || {};
    const contextLimit = aiConfig.contextLimit || 15;

    const conversation = await fetchConversationHistory(message, client, contextLimit);
    const faqContext = findRelevantFAQ(serverSettings.faq, message.content);
    const systemPromptContent = constructSystemPrompt(aiConfig, faqContext, message.guild.name, client.user.username);

    const messagesForAPI = [{ role: 'system', content: systemPromptContent }, ...conversation];

    const completion = await openai.chat.completions.create({
      model: "deepseek/deepseek-r1:free",
      messages: messagesForAPI,
    });
    const responseContent = completion.choices[0].message.content;

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
     const systemPrompt = { role: 'system', content: aiConfig.personality || "Você é um bot de teste." };
     const messagesForAPI = [systemPrompt, ...history];
     const completion = await openai.chat.completions.create({
       model: "deepseek/deepseek-r1:free",
       messages: messagesForAPI,
     });
     return completion.choices[0].message.content;
}

module.exports = { 
  processMessage,
  generateStandaloneResponse
};