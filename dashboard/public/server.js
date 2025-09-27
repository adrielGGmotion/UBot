document.addEventListener('DOMContentLoaded', () => {
    // --- Variáveis Globais e Helpers ---
    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('id');
    let dataFromAPI = {};
    let chatHistory = [];
    let musicDataInterval;

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
            if (musicDataInterval) clearInterval(musicDataInterval);
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
        music: getElement('panel-music'),
        faq: getElement('panel-faq'),
        github: getElement('panel-github')
    };

    // --- Lógica de Música ---
    async function fetchMusicData() {
        try {
            const token = localStorage.getItem('dashboard-token');
            const response = await fetch(`/api/guilds/${guildId}/music`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (handleAuthError(response)) return;
            const data = await response.json();
            updateMusicPanel(data);
        } catch (error) {
            console.error("Failed to fetch music data:", error);
        }
    }

    function updateMusicPanel(data) {
        const npTitle = getElement('np-song-title');
        const queueList = getElement('queue-list');

        if (data.playing && data.nowPlaying) {
            npTitle.textContent = data.nowPlaying.title;
        } else {
            npTitle.textContent = i18n.t('dashboard_server_music_nothing_playing');
        }

        if (data.queue && data.queue.length > 0) {
            queueList.innerHTML = data.queue.map((track, i) => `<p>${i + 1}. ${track.title}</p>`).join('');
        } else {
            queueList.innerHTML = `<p>${i18n.t('dashboard_server_music_queue_empty')}</p>`;
        }
    }

    async function controlMusicPlayer(action) {
        try {
            const token = localStorage.getItem('dashboard-token');
            await fetch(`/api/guilds/${guildId}/music/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action })
            });
            fetchMusicData(); // Refresh data after action
        } catch (error) {
            console.error(`Failed to execute music action '${action}':`, error);
        }
    }

    // --- Lógica do Testador de Chat ---
    // ... (código do chat inalterado)

    // --- Construção da Página e Painéis ---
    function buildPageContent(data) {
        dataFromAPI = data;
        const { availableChannels, settings } = data;
        buildAiPanel(availableChannels, settings.aiChannelIds, settings.aiConfig);
        buildFaqPanel(settings.faq);
        buildGithubPanel();
        buildMusicPanel(settings.musicConfig);
        setupNavigation();
    }

    function buildMusicPanel(musicConfig = {}) {
        getElement('music-dj-role').value = (musicConfig && musicConfig.djRole) || 'DJ';
        getElement('music-pause-btn').addEventListener('click', () => controlMusicPlayer('pause'));
        getElement('music-resume-btn').addEventListener('click', () => controlMusicPlayer('resume'));
        getElement('music-skip-btn').addEventListener('click', () => controlMusicPlayer('skip'));
    }

    function buildAiPanel(channels = [], selectedIds = [], config = {}, allTools = []) {
        const listDiv = getElement('channels-list');
        listDiv.innerHTML = '';
        channels.forEach(ch => {
            const isChecked = (selectedIds || []).includes(ch.id);
            listDiv.innerHTML += `<div class="checkbox-group"><input type="checkbox" id="${ch.id}" value="${ch.id}" ${isChecked ? 'checked' : ''}><label for="${ch.id}">#${ch.name}</label></div>`;
        });

        getElement('ai-personality').value = config.personality || '';
        getElement('ai-examples').value = config.examples || '';
        getElement('ai-context-limit').value = config.contextLimit || 15;

        const toolsListDiv = getElement('ai-tools-list');
        toolsListDiv.innerHTML = '';
        const enabledTools = config.enabledTools || allTools; // Se não definido, todos são permitidos

        allTools.forEach(toolName => {
            const isChecked = enabledTools.includes(toolName);
            toolsListDiv.innerHTML += `
                <div class="checkbox-group">
                    <input type="checkbox" id="tool-${toolName}" value="${toolName}" ${isChecked ? 'checked' : ''}>
                    <label for="tool-${toolName}">${toolName}</label>
                </div>`;
        });
    }

    function buildFaqPanel(faqData = []) {
        // ... (código do painel de FAQ inalterado)
    }

    function setupNavigation() {
        serverNavContainer.innerHTML = `
            <a href="/" class="nav-link" data-locale-key="nav_overview"></a>
            <a href="#" class="nav-link active" data-panel="ai" data-locale-key="nav_chatbot"></a>
            <a href="#" class="nav-link" data-panel="music" data-locale-key="nav_music"></a>
            <a href="#" class="nav-link" data-panel="faq" data-locale-key="nav_faq"></a>
            <a href="#" class="nav-link" data-panel="github" data-locale-key="nav_github"></a>
            <a href="/connect-tree.html?id=${guildId}" class="nav-link" data-locale-key="nav_connect_tree"></a>`;

        serverNavContainer.querySelectorAll('[data-locale-key]').forEach(el => el.textContent = i18n.t(el.dataset.localeKey));

        const navLinks = serverNavContainer.querySelectorAll('.nav-link[data-panel]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                Object.values(panels).forEach(p => p.style.display = 'none');
                panels[link.dataset.panel].style.display = 'block';

                if (link.dataset.panel === 'music') {
                    fetchMusicData();
                    if (!musicDataInterval) {
                        musicDataInterval = setInterval(fetchMusicData, 5000); // Poll every 5 seconds
                    }
                } else {
                    if (musicDataInterval) {
                        clearInterval(musicDataInterval);
                        musicDataInterval = null;
                    }
                }
            });
        });
        panels.music.style.display = 'none';
        panels.faq.style.display = 'none';
        panels.github.style.display = 'none';
    }

    function buildGithubPanel() {
        const goToGithubBtn = getElement('go-to-github-btn');
        goToGithubBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = `/github.html?guildId=${guildId}`;
        });
    }

    async function initializePage() {
        await applyTranslations();
        try {
            const token = localStorage.getItem('dashboard-token');
            if (!token) {
                window.location.href = '/login.html';
                return;
            }

            const [infoRes, settingsRes, guildsRes, toolsRes] = await Promise.all([
                fetch('/api/info', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`/api/guilds/${guildId}/settings`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/guilds', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/ai-tools', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if ([infoRes, settingsRes, guildsRes, toolsRes].some(res => handleAuthError(res))) return;

            const infoData = await infoRes.json();
            const data = await settingsRes.json();
            const guilds = await guildsRes.json();
            const allTools = await toolsRes.json();

            botNameElement.textContent = infoData.bot.tag || 'Bot Offline';
            const primaryColor = infoData.colors.primary || '#0d1117';
            const accentColor = infoData.colors.accent1 || '#9900FF';
            document.documentElement.style.setProperty('--bg', primaryColor);
            document.documentElement.style.setProperty('--panel', `rgba(${hexToRgb(accentColor)}, 0.1)`);
            document.documentElement.style.setProperty('--accent', accentColor);
            document.documentElement.style.setProperty('--accent-rgb', hexToRgb(accentColor));

            const currentGuild = guilds.find(g => g.id === guildId);
            if (!currentGuild) throw new Error('Servidor não encontrado.');

            serverNameTitle.textContent = i18n.t('dashboard_server_managing_title', { serverName: currentGuild.name });

            dataFromAPI = data;
            const { availableChannels, settings } = data;
            buildAiPanel(availableChannels, settings.aiChannelIds, settings.aiConfig, allTools.tools);
            buildFaqPanel(settings.faq);
            buildGithubPanel();
            buildMusicPanel(settings.musicConfig);
            setupNavigation();

        } catch (error) {
            serverNameTitle.textContent = i18n.t('dashboard_server_error_loading');
            console.error("Erro na inicialização:", error);
        }
    }

    saveButton.addEventListener('click', async () => {
        const aiChannelIds = Array.from(document.querySelectorAll('#channels-list input:checked')).map(cb => cb.value);
        const enabledTools = Array.from(document.querySelectorAll('#ai-tools-list input:checked')).map(cb => cb.value);

        const aiConfig = {
            personality: getElement('ai-personality').value,
            examples: getElement('ai-examples').value,
            contextLimit: parseInt(getElement('ai-context-limit').value, 10) || 15,
            enabledTools: enabledTools
        };

        const musicConfig = {
            djRole: getElement('music-dj-role').value.trim()
        };

        const faq = (dataFromAPI.settings && dataFromAPI.settings.faq) ? dataFromAPI.settings.faq : [];

        // githubRepos is no longer managed here. It's handled by github.html

        saveStatus.textContent = i18n.t('dashboard_server_saving_status');
        try {
            const token = localStorage.getItem('dashboard-token');
            // We need to preserve the existing githubRepos settings
            const existingGithubRepos = (dataFromAPI.settings && dataFromAPI.settings.githubRepos) ? dataFromAPI.settings.githubRepos : [];

            const response = await fetch(`/api/guilds/${guildId}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ aiChannelIds, aiConfig, faq, musicConfig, githubRepos: existingGithubRepos })
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

    // Re-colocando as funções de chat que foram omitidas para abreviar
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

        const currentConfig = {
            personality: getElement('ai-personality').value,
            examples: getElement('ai-examples').value,
            contextLimit: parseInt(getElement('ai-context-limit').value, 10) || 15
        };
        const historyForAPI = chatHistory.slice(-currentConfig.contextLimit);

        try {
            const token = localStorage.getItem('dashboard-token');
            const response = await fetch('/api/test-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ history: historyForAPI, config: currentConfig })
            });
            if (handleAuthError(response)) return;
            const data = await response.json();
            addMessageToChat('bot', data.reply);
            chatHistory.push({ role: 'assistant', content: data.reply });
        } catch (error) {
            addMessageToChat('bot', i18n.t('dashboard_server_ai_tester_error'));
        } finally {
            chatInput.disabled = false;
            sendChatBtn.disabled = false;
            chatInput.focus();
        }
    }
    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChatMessage(); });
    clearChatBtn.addEventListener('click', () => { chatDisplay.innerHTML = ''; chatHistory = []; });

    // Re-colocando o build dos painéis que foram omitidos
    function buildAiPanel(channels = [], selectedIds = [], config = {}) {
        const listDiv = getElement('channels-list');
        listDiv.innerHTML = '';
        channels.forEach(ch => {
            const isChecked = (selectedIds || []).includes(ch.id);
            listDiv.innerHTML += `<div class="checkbox-group"><input type="checkbox" id="${ch.id}" value="${ch.id}" ${isChecked ? 'checked' : ''}><label for="${ch.id}">#${ch.name}</label></div>`;
        });
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
            const q = getElement('faq-new-question').value.trim();
            const a = getElement('faq-new-answer').value.trim();
            if (q && a) {
                faqData.push({ question: q, answer: a });
                render();
                getElement('faq-new-question').value = '';
                getElement('faq-new-answer').value = '';
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
            const repoName = getElement('repo-new-name').value.trim().toLowerCase();
            if (repoName.match(/^[a-z0-9-]+\/[a-z0-9-._]+$/)) {
                repos.push({ repo: repoName, channelId: newRepoChannelSelect.value });
                render();
                getElement('repo-new-name').value = '';
            } else {
                alert(i18n.t('dashboard_server_notifications_invalid_repo_format_alert'));
            }
        });
    }


    // Placeholders traduzidos
    getElement('ai-personality').placeholder = i18n.t('dashboard_server_ai_personality_placeholder');
    getElement('ai-examples').placeholder = i18n.t('dashboard_server_ai_examples_placeholder');
    chatInput.placeholder = i18n.t('dashboard_server_ai_tester_input_placeholder');
    getElement('faq-new-question').placeholder = i18n.t('dashboard_server_faq_new_question_placeholder');
    getElement('faq-new-answer').placeholder = i18n.t('dashboard_server_faq_new_answer_placeholder');

    initializePage();
});
