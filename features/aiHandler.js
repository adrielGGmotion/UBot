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
function getChannelTypeName(type) {
  switch (type) {
    case ChannelType.GuildText: return 'Canal de Texto';
    case ChannelType.GuildVoice: return 'Canal de Voz';
    case ChannelType.GuildAnnouncement: return 'Canal de Anúncios';
    case ChannelType.GuildForum: return 'Fórum';
    case ChannelType.PublicThread: return 'Thread Pública';
    case ChannelType.PrivateThread: return 'Thread Privada';
    case ChannelType.GuildStageVoice: return 'Canal de Palco';
    case ChannelType.GuildCategory: return 'Categoria';
    case ChannelType.DM: return 'Mensagem Direta';
    case ChannelType.GroupDM: return 'Mensagem Direta em Grupo';
    default: return `Tipo de Canal (${type})`;
  }
}

/**
 * Busca e formata o histórico de mensagens do canal, com capacidades avançadas de contexto.
 * @param {import('discord.js').Message} message - A mensagem que acionou o bot.
 * @param {import('discord.js').Client} client - O cliente do Discord.
 * @param {number} limit - O número de mensagens a serem buscadas.
 * @returns {Promise<{role: string, content: (string | object)[]}[]>} - O histórico formatado.
 */
async function fetchConversationHistory(message, client, limit) {
  const lastMessages = await message.channel.messages.fetch({ limit });
  const conversation = [];

  for (const msg of Array.from(lastMessages.values()).reverse()) {
    let textContent = msg.content;

    // 2. Capacidade: Ler conteúdo de embeds
    if (msg.embeds.length > 0) {
      const embedContent = msg.embeds.map(embed => {
        let content = `[Embed`;
        if (embed.author?.name) content += ` de ${embed.author.name}`;
        content += `]`;
        if (embed.title) content += `\nTítulo: ${embed.title}`;
        if (embed.description) content += `\nDescrição: ${embed.description}`;
        if (embed.fields.length > 0) {
          content += `\nCampos:\n${embed.fields.map(field => `- ${field.name}: ${field.value}`).join('\n')}`;
        }
        if (embed.footer?.text) content += `\nRodapé: ${embed.footer.text}`;
        return content;
      }).join('\n\n');
      textContent += `\n${embedContent}`;
    }

    // **CRITICAL FAILURE FIX: Removed automatic image processing**
    // This was causing crashes and is being replaced by an on-demand tool.

    // 3. Capacidade: Saber se está lidando com um usuário ou bot
    let authorName = msg.author.username;
    if (msg.author.bot && msg.author.id !== client.user.id) {
        authorName = `[BOT] ${authorName}`;
    }

    const userText = msg.author.id === client.user.id ? textContent : `${authorName}: ${textContent}`;
    const role = msg.author.id === client.user.id ? 'assistant' : 'user';

    // Apenas conteúdo de texto é adicionado.
    conversation.push({ role, content: userText });
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
function constructSystemPrompt(aiConfig, faqContext, guildName, botName, channel) {
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const channelTypeName = getChannelTypeName(channel.type);

  let systemPrompt = `Você é um assistente de IA conversacional. Seu nome é ${botName}. Você está atualmente no servidor Discord "${guildName}", no canal #${channel.name} (um ${channelTypeName}). Hoje é ${today}.\n`;
  systemPrompt += "Sua diretriz principal é ser útil e envolvente. Você DEVE diferenciar os usuários na conversa pelos seus nomes e responder à última mensagem, considerando todo o histórico.\n\n";

  if (aiConfig.personality) {
    systemPrompt += "## Sua Personalidade (Definida pelo Usuário)\n";
    systemPrompt += aiConfig.personality + '\n\n';
  }

  if (aiConfig.examples) {
    systemPrompt += "## Exemplos de Estilo de Resposta\nSiga estes exemplos para o seu estilo de resposta:\n" + aiConfig.examples + '\n';
  }

  systemPrompt += "## Consciência do Servidor e Ferramentas\n";
  systemPrompt += "Para entender o ambiente e executar ações, você tem as seguintes capacidades:\n";
  systemPrompt += "- **Listar Canais:** Use `list_channels()` para ver todos os canais disponíveis, seus nomes, IDs e tipos (texto, voz, etc.). Isso é essencial para saber onde as coisas estão e onde você pode agir.\n";
  systemPrompt += "- **Obter IDs:** Muitas ferramentas exigem um ID (de usuário, canal, mensagem). Se o usuário fornecer um nome (ex: \"o canal #geral\" ou \"o usuário @Fulano\"), use a ferramenta `get_id({type: '...', query: '...'})` PRIMEIRO para encontrar o ID correto antes de tentar a ação principal.\n";
  systemPrompt += "- **Analisar Imagens:** Se um usuário postar uma URL de imagem e perguntar sobre ela, use `analyze_image_from_url({url: '...'})` para descrevê-la.\n\n";

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
  systemPrompt += "5. Sua função é ser uma presença positiva e segura na comunidade.\n";
  systemPrompt += "6. Você não deve utilizar emojis, ao menos que esteja na personalidade que você possa.\n";
  systemPrompt += "7. **TRANSPARÊNCIA DE FERRAMENTAS:** Ao usar uma ferramenta com sucesso, sua resposta final DEVE mencionar a ação que você tomou. Exemplo: \"Eu verifiquei as últimas mensagens no canal #geral e...\" ou \"Eu procurei por 'próximo lançamento da NASA' e descobri que...\".\n";
  systemPrompt += "8. **MANUSEIO DE ERROS DE FERRAMENTAS:** Se você usar uma ferramenta e o resultado indicar uma falha (ex: `{\"success\": false, \"content\": \"mensagem de erro\"}`), sua resposta DEVE ser apenas a mensagem de erro do campo `content`. NÃO tente usar a ferramenta novamente. Apenas informe o erro ao usuário.\n\n";

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
    const systemPromptContent = constructSystemPrompt(aiConfig, faqContext, message.guild.name, client.user.username, message.channel);

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
        messagesForAPI.push(responseMessage); // Adiciona a chamada da ferramenta ao histórico

        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            const functionToCall = availableFunctions[functionName];
            const functionArgs = JSON.parse(toolCall.function.arguments);

            // Executa a função da ferramenta
            const functionResponse = await functionToCall(functionArgs, message);

            // **CRITICAL FAILURE FIX: Check for tool failure**
            if (functionResponse.success === false) {
                console.error(`Tool call failed for '${functionName}'. Reason: ${functionResponse.content}`);
                // Retorna a mensagem de erro diretamente ao usuário, parando o loop.
                return functionResponse.content;
            }

            // Adiciona o resultado da ferramenta ao histórico
            messagesForAPI.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: functionName,
                content: JSON.stringify(functionResponse),
            });
        }

        // Continua para a segunda chamada da API apenas se todas as ferramentas tiverem sucesso
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
  // Impede o bot de responder a si mesmo, mas permite responder a outros bots.
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
