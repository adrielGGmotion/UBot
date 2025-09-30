document.addEventListener('DOMContentLoaded', () => {
    // --- Variáveis Globais e Helpers ---
    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('id');
    if (!guildId) {
        window.location.href = '/index.html'; // Redireciona se não houver ID do servidor
        return;
    }

    let dataFromAPI = {};
    let chatHistory = [];
    let musicDataInterval;
    // Inicializa as funções para evitar erros de "não é uma função"
    let getPersonality = () => [];
    let getExamples = () => [];

    function getElement(id, critical = true) {
        const element = document.getElementById(id);
        if (!element && critical) {
            console.error(`Elemento crítico não encontrado: #${id}`);
            throw new Error(`Elemento crítico não encontrado: #${id}`);
        }
        return element;
    }

    function handleAuthError(response) {
        if (response.status === 401) {
            localStorage.removeItem('dashboard-token');
            if (musicDataInterval) clearInterval(musicDataInterval);
            window.location.href = '/login.html';
            return true;
        }
        return false;
    }

    // --- Lógica de Música ---
    async function fetchMusicData() {
        // ... (código existente, sem alterações)
    }

    function updateMusicPanel(data) {
        // ... (código existente, sem alterações)
    }

    async function controlMusicPlayer(action) {
        // ... (código existente, sem alterações)
    }

    // --- Lógica do Testador de Chat ---
    function setupChatTester() {
        const chatInput = getElement('chat-input', false);
        const sendChatBtn = getElement('send-chat-btn', false);
        const clearChatBtn = getElement('clear-chat-btn', false);

        if (!chatInput || !sendChatBtn || !clearChatBtn) return; // Se os elementos não existem, não faz nada

        sendChatBtn.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChatMessage(); });
        clearChatBtn.addEventListener('click', () => {
            const chatDisplay = getElement('chat-display');
            chatDisplay.innerHTML = '';
            chatHistory = [];
        });
    }

    async function sendChatMessage() {
        const chatInput = getElement('chat-input');
        const sendChatBtn = getElement('send-chat-btn');
        const messageText = chatInput.value.trim();
        if (!messageText) return;

        addMessageToChat('user', messageText);
        chatHistory.push({ role: 'user', content: messageText });
        chatInput.value = '';
        chatInput.disabled = true;
        sendChatBtn.disabled = true;

        const currentConfig = {
            personality: getPersonality(), // Agora está garantido que existe
            examples: getExamples(),       // Agora está garantido que existe
            contextLimit: parseInt(getElement('ai-context-limit').value, 10) || 15
        };
        // ... resto da função sendChatMessage
    }

    function addMessageToChat(role, content) {
        const chatDisplay = getElement('chat-display');
        // ... (código existente, sem alterações)
    }


    // --- Construção da Página e Painéis ---
    function buildAiPanel(channels = [], selectedIds = [], config = {}, allTools = []) {
        // ... (código existente, sem alterações)
        // A atribuição das funções acontece aqui, de forma segura
        getPersonality = setupDynamicTextAreas('ai-personality-container', 'add-personality-btn', config.personality, 'dashboard_server_ai_personality_placeholder');
        getExamples = setupDynamicTextAreas('ai-examples-container', 'add-example-btn', config.examples, 'dashboard_server_ai_examples_placeholder');

        setupChatTester(); // Configura os listeners do chat DEPOIS que o painel de IA é construído
    }

    function buildFaqPanel(faqData = []) {
        const listDiv = getElement('faq-list', false);
        const addBtn = getElement('faq-add-btn', false);
        if(!listDiv || !addBtn) return; // Não executa se os elementos não existirem

        // ... (resto do código do painel de FAQ)
    }

    function buildKnowledgePanel(knowledgeData = []) {
        const listDiv = getElement('knowledge-list', false);
        const addBtn = getElement('knowledge-add-btn', false);
        if(!listDiv || !addBtn) return; // Não executa se os elementos não existirem

        // ... (resto do código do painel de Knowledge)
    }

    // ... (outras funções de construção de painel seguem o mesmo padrão)

    function setupNavigation() {
        const serverNavContainer = getElement('server-nav-links');
        const panels = {
            ai: getElement('panel-ai'),
            music: getElement('panel-music'),
            faq: getElement('panel-faq'),
            knowledge: getElement('panel-knowledge'),
            github: getElement('panel-github')
        };

        // ... (código de navegação existente, sem alterações)
    }

    async function initializePage() {
        const botNameElement = getElement('bot-name');
        const serverNameTitle = getElement('server-name-title');

        try {
            // ... (código de fetch e autenticação existente)

            // As chamadas para construir os painéis permanecem aqui
            buildAiPanel(availableChannels, settings.aiChannelIds, settings.aiConfig, allTools.tools);
            buildFaqPanel(settings.faq);
            buildKnowledgePanel(settings.knowledge);
            // ... etc

            setupNavigation();

        } catch (error) {
            serverNameTitle.textContent = 'Erro ao carregar dados do servidor.';
            console.error("Erro na inicialização:", error);
        }
    }

    const saveButton = getElement('save-settings-btn');
    saveButton.addEventListener('click', async () => {
        // ... (código de salvamento existente, sem alterações)
    });

    initializePage();
});