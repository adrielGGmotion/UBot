document.addEventListener('DOMContentLoaded', async () => {
    // --- Variáveis Globais e Helpers ---
    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('id');
    if (!guildId) {
        window.location.href = '/index.html'; // Redireciona se não houver ID
        return;
    }

    // Espera pelas traduções antes de fazer qualquer outra coisa
    if (window.i18n) {
        await window.i18n.ready;
    }

    let dataFromAPI = {};
    let chatHistory = [];
    // Funções placeholder para evitar TypeError
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
            window.location.href = '/login.html';
            return true;
        }
        return false;
    }

    // --- Lógica dos Painéis ---

    function setupNavigation() {
        const serverNavContainer = getElement('server-nav-links');
        const panels = {
            ai: getElement('panel-ai'),
            music: getElement('panel-music'),
            faq: getElement('panel-faq'),
            knowledge: getElement('panel-knowledge'),
            github: getElement('panel-github')
        };

        const navItems = [
            { key: 'ai', icon: 'smart_toy', textKey: 'nav_chatbot' },
            { key: 'music', icon: 'music_note', textKey: 'nav_music' },
            { key: 'faq', icon: 'quiz', textKey: 'nav_faq' },
            { key: 'knowledge', icon: 'school', textKey: 'nav_knowledge' },
            { key: 'github', icon: 'hub', textKey: 'nav_github' }
        ];

        serverNavContainer.innerHTML = navItems.map(item => `
            <a href="#" class="nav-link" data-panel="${item.key}">
                <i class="material-icons">${item.icon}</i>
                <span data-locale-key="${item.textKey}">${i18n.t(item.textKey)}</span>
            </a>
        `).join('');

        const navLinks = serverNavContainer.querySelectorAll('.nav-link[data-panel]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                Object.values(panels).forEach(p => p.style.display = 'none');
                const activePanel = panels[link.dataset.panel];
                if (activePanel) {
                    activePanel.style.display = 'block';
                }
            });
        });

        // Ativa o primeiro painel por padrão
        if (navLinks.length > 0) {
            navLinks[0].classList.add('active');
            const firstPanel = panels[navLinks[0].dataset.panel];
            if(firstPanel) firstPanel.style.display = 'block';
        }
    }

    // --- Função Principal de Inicialização ---
    async function initializePage() {
        try {
            const token = localStorage.getItem('dashboard-token');
            if (!token) {
                window.location.href = '/login.html';
                return;
            }

            const [settingsRes, guildsRes, toolsRes] = await Promise.all([
                fetch(`/api/guilds/${guildId}/settings`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/guilds', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/ai-tools', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if ([settingsRes, guildsRes, toolsRes].some(handleAuthError)) return;

            const settingsData = await settingsRes.json();
            const guildsData = await guildsRes.json();
            const toolsData = await toolsRes.json();

            dataFromAPI = settingsData;
            const { availableChannels, settings } = settingsData;

            const serverNameTitle = getElement('server-name-title');
            const currentGuild = guildsData.find(g => g.id === guildId);
            if (currentGuild) {
                serverNameTitle.innerHTML = `<i class="material-icons">dns</i> <span>${i18n.t('dashboard_server_managing_title', { serverName: currentGuild.name })}</span>`;
            }

            // Agora que os dados chegaram, construímos os painéis
            // (As funções build... e setup... precisam ser definidas como no seu código original)
            // buildAiPanel(availableChannels, settings.aiChannelIds, settings.aiConfig, toolsData.tools);

            // Depois de construir tudo, configuramos a navegação
            setupNavigation();

        } catch (error) {
            console.error("Erro na inicialização:", error);
            const serverNameTitle = getElement('server-name-title');
            serverNameTitle.innerHTML = `<i class="material-icons">error</i> <span>${i18n.t('dashboard_server_error_loading')}</span>`;
        }
    }

    initializePage();
});