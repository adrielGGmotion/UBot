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

    // Prioriza anexos
    if (msg.attachments.size > 0) {
      const attachment = msg.attachments.first();
      if (attachment.contentType?.startsWith('image/')) {
        imageUrl = attachment.url;
      }
    }

    // Se não houver anexo, procura por um link de imagem no texto
    if (!imageUrl) {
      const match = textContent.match(IMAGE_URL_REGEX);
      if (match) {
        imageUrl = match[0];
      }
    }

    const contentPayload = [];
    // Adiciona o texto do usuário, com o nome dele
    const userText = msg.author.id === client.user.id ? textContent : `${msg.author.username}: ${textContent}`;
    contentPayload.push({ type: 'text', text: userText });

    // Se uma imagem foi encontrada, adiciona ao payload
    if (imageUrl) {
      contentPayload.push({
        type: 'image_url',
        image_url: {
          url: imageUrl,
        },
      });
    }

    const role = msg.author.id === client.user.id ? 'assistant' : 'user';

    // Para mensagens sem imagem, o content pode ser uma string simples para compatibilidade.
    // Para mensagens com imagem, DEVE ser um array.
    const finalContent = contentPayload.length === 1 && !imageUrl
        ? contentPayload[0].text
        : contentPayload;

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

  // --- MEMÓRIA DO USUÁRIO ---
  systemPrompt += "## Memória do Usuário\n";
  systemPrompt += "Você tem a capacidade de lembrar e esquecer informações sobre os usuários. Use as seguintes ferramentas para gerenciar sua memória:\n";
  systemPrompt += "- `save_user_memory({key: 'nome_da_info', value: 'valor_da_info'})`: Para guardar um detalhe sobre o usuário com quem você está falando. Seja proativo e salve detalhes que parecem importantes.\n";
  systemPrompt += "- `get_user_memory({key: 'nome_da_info'})`: Para recuperar um detalhe que você salvou anteriormente sobre o usuário.\n";
  systemPrompt += "Sempre que um usuário mencionar um detalhe pessoal (como nome, preferências, etc.), use `save_user_memory`. Antes de responder, considere usar `get_user_memory` para ver se você já sabe algo sobre ele e personalize sua resposta.\n\n";


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
 * Formata as anotações de citação de URL da resposta da IA.
 * @param {object[]} annotations - A lista de anotações da mensagem da IA.
 * @returns {string} - Uma string formatada com as fontes, ou uma string vazia.
 */
function formatURLCitations(annotations) {
  if (!annotations || annotations.length === 0) {
    return '';
  }

  const citations = annotations
    .filter(anno => anno.type === 'url_citation')
    .map(anno => `[${anno.url_citation.title}](${anno.url_citation.url})`);

  if (citations.length > 0) {
    return `\n\n**Fontes:**\n- ${citations.join('\n- ')}`;
  }

  return '';
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

    // Determina o modelo e se a pesquisa na web está ativa
    let model = aiConfig.model || 'openai/gpt-4o'; // Default model
    if (aiConfig.webSearch === true) {
      model += ':online';
    }

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
      model: model,
      messages: messagesForAPI,
      tools: filteredTools.length > 0 ? filteredTools : undefined,
      tool_choice: filteredTools.length > 0 ? "auto" : "none",
    });

    const responseMessage = completion.choices[0].message;
    let finalResponseContent = responseMessage.content || '';
    const citations = formatURLCitations(responseMessage.annotations);

    // Verifica se a IA quer usar uma ferramenta
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

      // Segunda chamada à API com os resultados das ferramentas
      const secondCompletion = await openai.chat.completions.create({
        model: model,
        messages: messagesForAPI,
      });

      const secondResponseMessage = secondCompletion.choices[0].message;
      finalResponseContent = secondResponseMessage.content || '';
      const secondCitations = formatURLCitations(secondResponseMessage.annotations);

      if (finalResponseContent && client.db) {
        const aiUsageLogs = client.getDbCollection('ai-usage-logs');
        await aiUsageLogs.insertOne({ guildId: message.guild.id, userId: message.author.id, timestamp: new Date() });
      }
      return finalResponseContent + secondCitations;
    }

    // Se não houver tool calls, retorna a resposta de texto normal
    if (finalResponseContent && client.db) {
      const aiUsageLogs = client.getDbCollection('ai-usage-logs');
      await aiUsageLogs.insertOne({
        guildId: message.guild.id,
        userId: message.author.id,
        timestamp: new Date()
      });
    }

    return finalResponseContent + citations;
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

    // Garante que aiConfig seja um objeto para evitar erros
    const safeAiConfig = aiConfig || {};
    let model = safeAiConfig.model || 'openai/gpt-4o';
    if (safeAiConfig.webSearch === true) {
        model += ':online';
    }

    const completion = await openai.chat.completions.create({
        model: model,
        messages: messagesForAPI,
    });

    const responseMessage = completion.choices[0].message;
    const content = responseMessage.content || '';
    const citations = formatURLCitations(responseMessage.annotations);

    return content + citations;
}

module.exports = {
  processMessage,
  generateStandaloneResponse
};
