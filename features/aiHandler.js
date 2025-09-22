const OpenAI = require('openai');
const axios = require('axios');
const { tools, getToolFunctions } = require('./toolbelt.js');

// Inicializa o cliente da API
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
});

const IMAGE_URL_REGEX = /\b(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp))\b/i;

/**
 * Baixa uma imagem de uma URL e a converte para base64.
 * @param {string} url - A URL da imagem.
 * @param {string} [contentType='image/jpeg'] - O tipo MIME da imagem.
 * @returns {Promise<string|null>} - A string base64 da imagem ou null se falhar.
 */
async function imageToBase64(url, contentType = 'image/jpeg') {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(`Falha ao baixar ou converter imagem da URL: ${url}`, error);
    return null;
  }
}

/**
 * Busca e formata o histórico de mensagens do canal, incluindo imagens como dados base64.
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
    const contentPayload = [];
    const role = msg.author.id === client.user.id ? 'assistant' : 'user';

    // Adiciona o texto do usuário, com o nome dele
    const userText = role === 'user' ? `${msg.author.username}: ${textContent}` : textContent;
    contentPayload.push({ type: 'text', text: userText });

    let imageDataSource = null;

    // Prioriza anexos
    if (msg.attachments.size > 0) {
      const attachment = msg.attachments.first();
      if (attachment.contentType?.startsWith('image/')) {
        imageDataSource = { url: attachment.url, contentType: attachment.contentType };
      }
    }

    // Se não houver anexo, procura por um link de imagem no texto
    if (!imageDataSource) {
      const match = textContent.match(IMAGE_URL_REGEX);
      if (match) {
        // Para links, não temos o contentType exato, então usamos um padrão.
        imageDataSource = { url: match[0], contentType: 'image/jpeg' };
      }
    }

    // Se uma fonte de imagem foi encontrada, baixa e converte para base64
    if (imageDataSource) {
      const base64Image = await imageToBase64(imageDataSource.url, imageDataSource.contentType);
      if (base64Image) {
        contentPayload.push({
          type: 'image_url',
          image_url: {
            url: base64Image,
          },
        });
      }
    }

    // Para mensagens sem imagem, o content pode ser uma string simples para compatibilidade.
    // Para mensagens com imagem, DEVE ser um array.
    const finalContent = contentPayload.length > 1 ? contentPayload : userText;

    conversation.push({ role, content: finalContent });
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

    const conversation = await fetchConversationHistory(message, client, contextLimit);
    const faqContext = findRelevantFAQ(serverSettings.faq, message.content);
    const systemPromptContent = constructSystemPrompt(aiConfig, faqContext, message.guild.name, client.user.username);

    const messagesForAPI = [{ role: 'system', content: systemPromptContent }, ...conversation];

    // Filtra as ferramentas com base nas configurações do servidor
    const allToolNames = tools.map(t => t.function.name);
    const enabledTools = aiConfig.enabledTools || allToolNames;
    const filteredTools = tools.filter(t => enabledTools.includes(t.function.name));


    // Primeira chamada à API, agora com ferramentas
    const completion = await openai.chat.completions.create({
      model: "x-ai/grok-4-fast:free",
      messages: messagesForAPI,
      tools: filteredTools.length > 0 ? filteredTools : undefined,
      tool_choice: filteredTools.length > 0 ? "auto" : "none",
    });

    const responseMessage = completion.choices[0].message;

    // Verifica se a IA quer usar uma ferramenta
    const toolCalls = responseMessage.tool_calls;
    if (toolCalls) {
      // Adiciona a resposta da IA (com os tool_calls) ao histórico
      messagesForAPI.push(responseMessage);

      const availableFunctions = getToolFunctions(client);

      // Executa cada ferramenta que a IA solicitou
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionToCall = availableFunctions[functionName];
        const functionArgs = JSON.parse(toolCall.function.arguments);

        // Passa a mensagem original para a função da ferramenta ter contexto
        const functionResponse = await functionToCall(functionArgs, message);

        // Adiciona o resultado da execução da ferramenta ao histórico
        messagesForAPI.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: JSON.stringify(functionResponse),
        });
      }

      // Segunda chamada à API com os resultados das ferramentas
      const secondCompletion = await openai.chat.completions.create({
        model: "x-ai/grok-4-fast:free",
        messages: messagesForAPI,
      });

      // A resposta final da IA, agora ciente do resultado das ferramentas
      const finalResponse = secondCompletion.choices[0].message.content;

      if (finalResponse && client.db) {
        const aiUsageLogs = client.getDbCollection('ai-usage-logs');
        await aiUsageLogs.insertOne({ guildId: message.guild.id, userId: message.author.id, timestamp: new Date() });
      }
      return finalResponse;
    }

    // Se não houver tool calls, retorna a resposta de texto normal
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
     const systemPrompt = { role: 'system', content: aiConfig.personality || "Você é um bot de teste." };
     const messagesForAPI = [systemPrompt, ...history];
     const completion = await openai.chat.completions.create({
       model: "x-ai/grok-4-fast:free",
       messages: messagesForAPI,
     });
     return completion.choices[0].message.content;
}

module.exports = {
  processMessage,
  generateStandaloneResponse
};
