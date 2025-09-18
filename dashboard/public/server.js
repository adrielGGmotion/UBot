document.addEventListener('DOMContentLoaded', () => {
    // --- Variáveis Globais e Helpers ---
    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('id');
    let dataFromAPI = {};
    let chatHistory = [];

    function getElement(id, critical = true) {
        const element = document.getElementById(id);
        if (!element && critical) throw new Error(`Elemento crítico não encontrado: #${id}`);
        return element;
    }

    function hexToRgb(hex) {
        if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) return '153, 0, 255';
        let c = hex.substring(1).split('');
        if (c.length === 3) { c = [c[0], c[0], c[1], c[1], c[2], c[2]]; }
        c = '0x' + c.join('');
        return `${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}`;
    }

    function handleAuthError(response) {
        if (response.status === 401) {
            localStorage.removeItem('dashboard-token');
            window.location.href = '/login.html';
            return true;
        }
        return false;
    }
    
    // --- Elementos do DOM ---
    const botNameElement = getElement('bot-name');
    const serverNameTitle = getElement('server-name-title');
    const saveButton = getElement('save-settings-btn');
    const saveStatus = getElement('save-status');
    const serverNavContainer = getElement('server-nav-links');
    const panels = {
        ai: getElement('panel-ai'),
        faq: getElement('panel-faq'),
        notifications: getElement('panel-notifications')
    };

    // --- Lógica do Testador de Chat ---
    const chatDisplay = getElement('chat-display');
    const chatInput = getElement('chat-input');
    const sendChatBtn = getElement('send-chat-btn');
    const clearChatBtn = getElement('clear-chat-btn');

    function addMessageToChat(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}-message`;
        messageDiv.textContent = content;
        chatDisplay.appendChild(messageDiv);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }

    async function sendChatMessage() {
        const messageText = chatInput.value.trim();
        if (!messageText) return;

        addMessageToChat('user', messageText);
        chatHistory.push({ role: 'user', content: messageText });
        chatInput.value = '';
        chatInput.disabled = true;
        sendChatBtn.disabled = true;

        // Pega os valores atuais dos campos
        const currentConfig = {
            personality: getElement('ai-personality').value,
            examples: getElement('ai-examples').value,
            contextLimit: parseInt(getElement('ai-context-limit').value, 10) || 15
        };

        // Respeita o limite de contexto no teste
        const historyForAPI = chatHistory.slice(-currentConfig.contextLimit);
        
        try {
            const token = localStorage.getItem('dashboard-token');
            const response = await fetch('/api/test-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ history: historyForAPI, config: currentConfig })
            });
            if (handleAuthError(response)) return;
            if (!response.ok) throw new Error('Falha na API de teste');

            const data = await response.json();
            addMessageToChat('bot', data.reply);
            chatHistory.push({ role: 'assistant', content: data.reply });

        } catch (error) {
            addMessageToChat('bot', i18n.t('dashboard_server_ai_tester_error'));
            console.error('Chat test error:', error);
        } finally {
            chatInput.disabled = false;
            sendChatBtn.disabled = false;
            chatInput.focus();
        }
    }

    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    clearChatBtn.addEventListener('click', () => {
        chatDisplay.innerHTML = '';
        chatHistory = [];
    });

    // --- Construção da Página e Painéis ---
    function buildPageContent(data) {
        dataFromAPI = data;
        const { availableChannels, settings } = data;
        buildAiPanel(availableChannels, settings.aiChannelIds, settings.aiConfig);
        buildFaqPanel(settings.faq);
        buildNotificationsPanel(availableChannels, settings.githubRepos);
        setupNavigation();
    }

    function buildAiPanel(channels = [], selectedIds = [], config = {}) {
        const listDiv = getElement('channels-list');
        listDiv.innerHTML = '';
        channels.forEach(ch => {
            const isChecked = (selectedIds || []).includes(ch.id);
            listDiv.innerHTML += `<div class="checkbox-group"><input type="checkbox" id="${ch.id}" value="${ch.id}" ${isChecked ? 'checked' : ''}><label for="${ch.id}">#${ch.name}</label></div>`;
        });
        
        // Carrega as configurações nos campos
        getElement('ai-personality').value = config.personality || '';
        getElement('ai-examples').value = config.examples || '';
        getElement('ai-context-limit').value = config.contextLimit || 15;
    }
    
    function buildFaqPanel(faqData = []) {
        const faqListDiv = getElement('faq-list');
        const faqAddBtn = getElement('faq-add-btn');
        faqData = faqData || [];
        function render() {
            faqListDiv.innerHTML = '';
            faqData.forEach((item, index) => {
                const faqItem = document.createElement('div');
                faqItem.className = 'faq-item';
                const removeButtonText = i18n.t('dashboard_server_remove_button');
                faqItem.innerHTML = `<button data-index="${index}">${removeButtonText}</button><strong>Q: ${item.question}</strong><p>A: ${item.answer}</p>`;
                faqListDiv.appendChild(faqItem);
            });
            faqListDiv.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', () => {
                    faqData.splice(button.dataset.index, 1);
                    render();
                });
            });
        }
        render();
        faqAddBtn.addEventListener('click', () => {
            const newQuestionInput = getElement('faq-new-question');
            const newAnswerInput = getElement('faq-new-answer');
            const question = newQuestionInput.value.trim();
            const answer = newAnswerInput.value.trim();
            if (question && answer) {
                faqData.push({ question, answer });
                render();
                newQuestionInput.value = '';
                newAnswerInput.value = '';
            }
        });
    }

    function buildNotificationsPanel(availableChannels = [], repos = []) {
        const reposListDiv = getElement('repos-list');
        const repoAddBtn = getElement('repo-add-btn');
        const newRepoChannelSelect = getElement('repo-new-channel');
        repos = repos || [];
        newRepoChannelSelect.innerHTML = availableChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        function render() {
            reposListDiv.innerHTML = '';
            repos.forEach((repo, index) => {
                const channelName = availableChannels.find(c => c.id === repo.channelId)?.name || i18n.t('dashboard_server_notifications_channel_not_found');
                const repoItem = document.createElement('div');
                repoItem.className = 'faq-item';
                const removeButtonText = i18n.t('dashboard_server_remove_button');
                const sendingToText = i18n.t('dashboard_server_notifications_sending_to', { channelName });
                repoItem.innerHTML = `<button data-index="${index}">${removeButtonText}</button><strong>${repo.repo}</strong><p>${sendingToText}</p>`;
                reposListDiv.appendChild(repoItem);
            });
            reposListDiv.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', () => {
                    repos.splice(button.dataset.index, 1);
                    render();
                });
            });
        }
        render();
        repoAddBtn.addEventListener('click', () => {
            const newRepoNameInput = getElement('repo-new-name');
            const repo = newRepoNameInput.value.trim().toLowerCase();
            if (repo.match(/^[a-z0-9-]+\/[a-z0-9-._]+$/)) {
                repos.push({ repo, channelId: newRepoChannelSelect.value });
                render();
                newRepoNameInput.value = '';
            } else {
                alert(i18n.t('dashboard_server_notifications_invalid_repo_format_alert'));
            }
        });
    }

    function setupNavigation() {
        serverNavContainer.innerHTML = `
            <a href="/" class="nav-link" data-locale-key="nav_overview"></a>
            <a href="#" class="nav-link active" data-panel="ai" data-locale-key="nav_chatbot"></a>
            <a href="#" class="nav-link" data-panel="faq" data-locale-key="nav_faq"></a>
            <a href="#" class="nav-link" data-panel="notifications" data-locale-key="nav_notifications"></a>
            <a href="/connect-tree.html?id=${guildId}" class="nav-link" data-locale-key="nav_connect_tree"></a>`;
     
        // Aplica a tradução aos links recém-criados
        serverNavContainer.querySelectorAll('[data-locale-key]').forEach(el => el.textContent = i18n.t(el.dataset.localeKey));

        const navLinks = serverNavContainer.querySelectorAll('.nav-link[data-panel]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                Object.values(panels).forEach(p => p.style.display = 'none');
                panels[link.dataset.panel].style.display = 'block';
            });
        });
        panels.faq.style.display = 'none';
        panels.notifications.style.display = 'none';
    }

    async function initializePage() {
        // Espera as traduções carregarem antes de continuar
        await applyTranslations();
        try {
            const token = localStorage.getItem('dashboard-token');
            const infoRes = await fetch('/api/info', { headers: { 'Authorization': `Bearer ${token}` } });
            if (handleAuthError(infoRes)) return;
            if (!infoRes.ok) throw new Error('Info API response not OK');
            const infoData = await infoRes.json();
            
            botNameElement.textContent = infoData.bot.tag || 'Bot Offline';
            const primaryColor = infoData.colors.primary || '#0d1117';
            const accentColor = infoData.colors.accent1 || '#9900FF';
            document.documentElement.style.setProperty('--bg', primaryColor);
            document.documentElement.style.setProperty('--panel', `rgba(${hexToRgb(accentColor)}, 0.1)`);
            document.documentElement.style.setProperty('--accent', accentColor);
            document.documentElement.style.setProperty('--accent-rgb', hexToRgb(accentColor));

            if (!guildId) throw new Error('ID do Servidor não fornecido na URL.');

            const [settingsRes, guildsRes] = await Promise.all([
                fetch(`/api/guilds/${guildId}/settings`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/guilds', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            if (handleAuthError(settingsRes) || handleAuthError(guildsRes)) return;
            if (!settingsRes.ok) throw new Error(`Server settings API returned ${settingsRes.status}`);
            if (!guildsRes.ok) throw new Error(`Guilds API returned ${guildsRes.status}`);

            const data = await settingsRes.json();
            const guilds = await guildsRes.json();
            const currentGuild = guilds.find(g => g.id === guildId);

            if (!currentGuild) throw new Error('Servidor não encontrado.');
            
            serverNameTitle.textContent = i18n.t('dashboard_server_managing_title', { serverName: currentGuild.name });
            buildPageContent(data);

        } catch (error) {
            serverNameTitle.textContent = i18n.t('dashboard_server_error_loading');
            console.error("Erro na inicialização:", error);
        }
    }
    
    saveButton.addEventListener('click', async () => {
        const aiChannelIds = Array.from(document.querySelectorAll('#channels-list input:checked')).map(cb => cb.value);
        
        // Pega todos os valores do form de IA
        const aiConfig = {
            personality: getElement('ai-personality').value,
            examples: getElement('ai-examples').value,
            contextLimit: parseInt(getElement('ai-context-limit').value, 10) || 15
        };

        const faq = dataFromAPI.settings.faq || [];
        const githubRepos = dataFromAPI.settings.githubRepos || [];

        saveStatus.textContent = i18n.t('dashboard_server_saving_status');
        try {
            const token = localStorage.getItem('dashboard-token');
            const response = await fetch(`/api/guilds/${guildId}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ aiChannelIds, aiConfig, faq, githubRepos })
            });
            if (handleAuthError(response)) return;
            if (!response.ok) throw new Error('Response not OK');
            saveStatus.textContent = i18n.t('dashboard_server_saved_success_status');
            saveStatus.style.color = '#4ade80';
        } catch (error) {
            saveStatus.textContent = i18n.t('dashboard_server_saved_fail_status');
            saveStatus.style.color = '#f87171';
        }
        setTimeout(() => { saveStatus.textContent = ''; }, 3000);
    });

    // Placeholders traduzidos
    getElement('ai-personality').placeholder = i18n.t('dashboard_server_ai_personality_placeholder');
    getElement('ai-examples').placeholder = i18n.t('dashboard_server_ai_examples_placeholder');
    chatInput.placeholder = i18n.t('dashboard_server_ai_tester_input_placeholder');
    getElement('faq-new-question').placeholder = i18n.t('dashboard_server_faq_new_question_placeholder');
    getElement('faq-new-answer').placeholder = i18n.t('dashboard_server_faq_new_answer_placeholder');
    getElement('repo-new-name').placeholder = i18n.t('dashboard_server_notifications_repo_placeholder');

    initializePage();
});