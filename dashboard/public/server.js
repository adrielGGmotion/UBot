document.addEventListener('DOMContentLoaded', () => {
    // --- Variáveis Globais e Helpers ---
    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('id');
    let dataFromAPI = {};
    let chatHistory = [];
    let musicDataInterval;
    let getPersonality, getExamples;

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
        knowledge: getElement('panel-knowledge'),
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
        buildKnowledgePanel(settings.knowledge);
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

        getElement('ai-context-limit').value = config.contextLimit || 15;

        // Helper function for dynamic text areas
        const setupDynamicTextAreas = (containerId, addButtonId, dataArray, placeholderKey) => {
            const container = getElement(containerId);
            const addButton = getElement(addButtonId);
            let internalData = Array.isArray(dataArray) ? [...dataArray] : (dataArray ? [dataArray] : []);

            const render = () => {
                container.innerHTML = '';
                if (internalData.length === 0) {
                    // Add a default empty box if the array is empty
                    internalData.push('');
                }
                internalData.forEach((item, index) => {
                    const inputGroup = document.createElement('div');
                    inputGroup.className = 'dynamic-input-group';
                    const textArea = document.createElement('textarea');
                    textArea.className = 'form-textarea';
                    textArea.placeholder = i18n.t(placeholderKey);
                    textArea.value = item;
                    textArea.addEventListener('change', (e) => {
                        internalData[index] = e.target.value;
                    });

                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.textContent = '-';
                    removeBtn.className = 'form-button-sm remove-btn';
                    removeBtn.addEventListener('click', () => {
                        internalData.splice(index, 1);
                        render();
                    });

                    inputGroup.appendChild(textArea);
                    inputGroup.appendChild(removeBtn);
                    container.appendChild(inputGroup);
                });
            };

            addButton.addEventListener('click', () => {
                internalData.push('');
                render();
            });

            render();
            // Return a function to retrieve the latest data
            return () => internalData.filter(item => item.trim() !== '');
        };

        // Setup for personality and examples
        getPersonality = setupDynamicTextAreas('ai-personality-container', 'add-personality-btn', config.personality, 'dashboard_server_ai_personality_placeholder');
        getExamples = setupDynamicTextAreas('ai-examples-container', 'add-example-btn', config.examples, 'dashboard_server_ai_examples_placeholder');

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

    function buildKnowledgePanel(knowledgeData = []) {
        const listDiv = getElement('knowledge-list');
        const addBtn = getElement('knowledge-add-btn');
        knowledgeData = knowledgeData || [];

        function render() {
            listDiv.innerHTML = '';
            knowledgeData.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'faq-item';
                const removeButtonText = i18n.t('dashboard_server_remove_button');
                itemDiv.innerHTML = `<button data-index="${index}">${removeButtonText}</button><strong>Q: ${item.question}</strong><p>A: ${item.answer}</p>`;
                listDiv.appendChild(itemDiv);
            });

            listDiv.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', () => {
                    knowledgeData.splice(button.dataset.index, 1);
                    dataFromAPI.settings.knowledge = knowledgeData; // Update the main data object
                    render();
                });
            });
        }

        render();

        addBtn.addEventListener('click', () => {
            const q = getElement('knowledge-new-question').value.trim();
            const a = getElement('knowledge-new-answer').value.trim();
            if (q && a) {
                knowledgeData.push({ question: q, answer: a });
                dataFromAPI.settings.knowledge = knowledgeData; // Update the main data object
                render();
                getElement('knowledge-new-question').value = '';
                getElement('knowledge-new-answer').value = '';
            }
        });
    }

    function setupNavigation() {
        serverNavContainer.innerHTML = `
            <a href="/" class="nav-link" data-locale-key="nav_overview"></a>
            <a href="#" class="nav-link active" data-panel="ai" data-locale-key="nav_chatbot"></a>
            <a href="#" class="nav-link" data-panel="music" data-locale-key="nav_music"></a>
            <a href="#" class="nav-link" data-panel="faq" data-locale-key="nav_faq"></a>
            <a href="#" class="nav-link" data-panel="knowledge" data-locale-key="nav_knowledge"></a>
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
        panels.knowledge.style.display = 'none';
        panels.github.style.display = 'none';
    }

    function buildGithubPanel() {
        const addRepoBtn = getElement('add-repo-btn');
        const modal = getElement('repo-modal');
        const repoForm = getElement('repo-form');
        const cancelModalBtn = getElement('cancel-modal-btn');
        const deleteRepoBtn = getElement('delete-repo-btn');

        const openModal = (repoId = null) => {
            repoForm.reset();
            getElement('modal-config-sections').innerHTML = '';
            let repoData;

            if (repoId) {
                const originalRepoData = dataFromAPI.settings.githubRepos.find(r => r.id === repoId);
                if (!originalRepoData) return alert('Repository not found!');
                repoData = JSON.parse(JSON.stringify(originalRepoData));
                repoData = { ...createDefaultRepoConfig(), ...repoData };

                getElement('modal-title').textContent = i18n.t('dashboard_server_github_modal_edit_title');
                getElement('repo-id').value = repoData.id;
                getElement('repo-url').value = repoData.url;
                getElement('repo-url').disabled = true;
                getElement('repo-secret').value = repoData.secret || '';
                deleteRepoBtn.style.display = 'inline-block';
            } else {
                repoData = createDefaultRepoConfig();
                getElement('modal-title').textContent = i18n.t('dashboard_server_github_modal_add_title');
                getElement('repo-id').value = '';
                getElement('repo-url').disabled = false;
                deleteRepoBtn.style.display = 'none';
            }

            buildModalConfigUI(repoData);
            modal.style.display = 'flex';
        };

        const closeModal = () => {
            modal.style.display = 'none';
        };

        const renderRepoList = () => {
            const repoListContainer = getElement('repo-list');
            repoListContainer.innerHTML = '';
            const repos = (dataFromAPI.settings && dataFromAPI.settings.githubRepos) ? dataFromAPI.settings.githubRepos : [];

            if (repos.length === 0) {
                repoListContainer.innerHTML = `<p style="color: var(--muted);">${i18n.t('dashboard_server_github_no_repos')}</p>`;
                return;
            }

            repos.forEach(repo => {
                const repoCard = document.createElement('div');
                repoCard.className = 'repo-card';
                const repoName = repo.name || (repo.url ? new URL(repo.url).pathname.substring(1) : 'Unnamed Repo');
                repoCard.innerHTML = `
                    <div class="repo-info">
                        <h4>${repoName}</h4>
                        <span>${repo.enabled ? `🟢 ${i18n.t('dashboard_server_github_repo_enabled')}` : `🔴 ${i18n.t('dashboard_server_github_repo_disabled')}`}</span>
                    </div>
                    <button class="edit-repo-btn" data-repo-id="${repo.id}">${i18n.t('dashboard_server_github_repo_edit_button')}</button>
                `;
                repoListContainer.appendChild(repoCard);
            });

            repoListContainer.querySelectorAll('.edit-repo-btn').forEach(btn => {
                btn.addEventListener('click', (e) => openModal(e.currentTarget.dataset.repoId));
            });
        };

        const buildModalConfigUI = (repoData) => {
            const modalConfigSections = getElement('modal-config-sections');
            const createChannelSelect = (selectedId) => {
                const options = dataFromAPI.availableChannels.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>#${c.name}</option>`).join('');
                return `<option value="">-- ${i18n.t('dashboard_server_github_modal_select_channel')} --</option>${options}`;
            };

            const sections = [
                { key: 'commits', title: i18n.t('dashboard_server_github_modal_commits_title') },
                { key: 'pullRequests', title: i18n.t('dashboard_server_github_modal_prs_title') },
                { key: 'issues', title: i18n.t('dashboard_server_github_modal_issues_title') },
                { key: 'releases', title: i18n.t('dashboard_server_github_modal_releases_title') },
            ];

            let html = `<div class="form-group" style="flex-direction: row; align-items: center; justify-content: space-between;"><label>${i18n.t('dashboard_server_github_modal_repo_status_label')}</label><label class="switch"><input type="checkbox" id="repo-enabled" ${repoData.enabled ? 'checked' : ''}><span class="slider"></span></label></div>`;

            sections.forEach(({ key, title }) => {
                const config = repoData[key];
                html += `
                    <div class="config-section">
                        <div class="section-header">
                            <h4>${title}</h4>
                            <label class="switch"><input type="checkbox" class="section-toggle" id="${key}-enabled" data-section="${key}" ${config.enabled ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                        <div class="section-content" id="${key}-content" style="display: ${config.enabled ? 'block' : 'none'};">
                            <div class="form-group"><label for="${key}-channelId">${i18n.t('dashboard_server_github_modal_channel_label')}</label><select id="${key}-channelId" class="form-select">${createChannelSelect(config.channelId)}</select></div>
                            ${generateExtraFields(key, config)}
                        </div>
                    </div>`;
            });

            modalConfigSections.innerHTML = html;

            modalConfigSections.querySelectorAll('.section-toggle').forEach(toggle => {
                toggle.addEventListener('change', (e) => {
                    const content = document.getElementById(`${e.target.dataset.section}-content`);
                    if (content) content.style.display = e.target.checked ? 'block' : 'none';
                });
            });
        };

        const generateExtraFields = (key, config) => {
            const createFilterInput = (list) => (list || []).join(', ');
            let fields = '';
            switch (key) {
                case 'commits':
                    fields += `<div class="form-group small-group"><label>${i18n.t('dashboard_server_github_modal_branch_filter_label')}</label><select class="form-select" id="commits-branchFilter-mode"><option value="blacklist" ${config.branchFilter.mode === 'blacklist' ? 'selected' : ''}>${i18n.t('dashboard_server_github_modal_filter_blacklist')}</option><option value="whitelist" ${config.branchFilter.mode === 'whitelist' ? 'selected' : ''}>${i18n.t('dashboard_server_github_modal_filter_whitelist')}</option></select><input type="text" class="form-input" id="commits-branchFilter-list" placeholder="main, develop" value="${createFilterInput(config.branchFilter.list)}"></div>`;
                    fields += `<div class="form-group small-group"><label>${i18n.t('dashboard_server_github_modal_message_filter_label')}</label><select class="form-select" id="commits-messageFilter-mode"><option value="blacklist" ${config.messageFilter.mode === 'blacklist' ? 'selected' : ''}>${i18n.t('dashboard_server_github_modal_filter_blacklist')}</option><option value="whitelist" ${config.messageFilter.mode === 'whitelist' ? 'selected' : ''}>${i18n.t('dashboard_server_github_modal_filter_whitelist')}</option></select><input type="text" class="form-input" id="commits-messageFilter-list" placeholder="WIP, chore" value="${createFilterInput(config.messageFilter.list)}"></div>`;
                    fields += `<div class="form-group small-group"><label>${i18n.t('dashboard_server_github_modal_author_filter_label')}</label><select class="form-select" id="commits-authorFilter-mode"><option value="blacklist" ${config.authorFilter.mode === 'blacklist' ? 'selected' : ''}>${i18n.t('dashboard_server_github_modal_filter_blacklist')}</option><option value="whitelist" ${config.authorFilter.mode === 'whitelist' ? 'selected' : ''}>${i18n.t('dashboard_server_github_modal_filter_whitelist')}</option></select><input type="text" class="form-input" id="commits-authorFilter-list" placeholder="bot-name" value="${createFilterInput(config.authorFilter.list)}"></div>`;
                    break;
                case 'pullRequests':
                    fields += `<div class="form-group" style="flex-direction: row; align-items: center; gap: 10px;"><label>${i18n.t('dashboard_server_github_modal_ignore_drafts_label')}</label><input type="checkbox" id="pullRequests-ignoreDrafts" ${config.ignoreDrafts ? 'checked' : ''}></div>`;
                    fields += `<div class="form-group"><label>${i18n.t('dashboard_server_github_modal_base_branch_filter_label')}</label><input type="text" class="form-input" id="pullRequests-branchFilter-base" value="${createFilterInput(config.branchFilter.base)}"></div>`;
                    fields += `<div class="form-group small-group"><label>${i18n.t('dashboard_server_github_modal_label_filter_label')}</label><select class="form-select" id="pullRequests-labelFilter-mode"><option value="blacklist" ${config.labelFilter.mode === 'blacklist' ? 'selected' : ''}>${i18n.t('dashboard_server_github_modal_filter_blacklist')}</option><option value="whitelist" ${config.labelFilter.mode === 'whitelist' ? 'selected' : ''}>${i18n.t('dashboard_server_github_modal_filter_whitelist')}</option></select><input type="text" class="form-input" id="pullRequests-labelFilter-list" placeholder="do-not-merge" value="${createFilterInput(config.labelFilter.list)}"></div>`;
                    break;
                case 'issues':
                    fields += `<div class="form-group small-group"><label>${i18n.t('dashboard_server_github_modal_label_filter_label')}</label><select class="form-select" id="issues-labelFilter-mode"><option value="blacklist" ${config.labelFilter.mode === 'blacklist' ? 'selected' : ''}>${i18n.t('dashboard_server_github_modal_filter_blacklist')}</option><option value="whitelist" ${config.labelFilter.mode === 'whitelist' ? 'selected' : ''}>${i18n.t('dashboard_server_github_modal_filter_whitelist')}</option></select><input type="text" class="form-input" id="issues-labelFilter-list" placeholder="wontfix" value="${createFilterInput(config.labelFilter.list)}"></div>`;
                    break;
            }
            return fields;
        };

        const handleFormSubmit = async (e) => {
            e.preventDefault();
            const id = getElement('repo-id').value;
            const url = getElement('repo-url').value.trim();

            if (!url.match(/^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-._]+$/)) {
                return alert(i18n.t('dashboard_server_github_modal_invalid_url_alert'));
            }
            const repoName = new URL(url).pathname.substring(1);
            const parseList = (str) => str.split(',').map(item => item.trim()).filter(Boolean);

            const newRepoData = {
                id: id || `repo_${Date.now()}`,
                name: repoName,
                url: url,
                secret: getElement('repo-secret').value.trim(),
                enabled: getElement('repo-enabled').checked,
                commits: {
                    enabled: getElement('commits-enabled').checked,
                    channelId: getElement('commits-channelId').value,
                    branchFilter: { mode: getElement('commits-branchFilter-mode').value, list: parseList(getElement('commits-branchFilter-list').value) },
                    messageFilter: { mode: getElement('commits-messageFilter-mode').value, list: parseList(getElement('commits-messageFilter-list').value) },
                    authorFilter: { mode: getElement('commits-authorFilter-mode').value, list: parseList(getElement('commits-authorFilter-list').value) },
                },
                pullRequests: {
                    enabled: getElement('pullRequests-enabled').checked,
                    channelId: getElement('pullRequests-channelId').value,
                    ignoreDrafts: getElement('pullRequests-ignoreDrafts').checked,
                    branchFilter: { base: parseList(getElement('pullRequests-branchFilter-base').value), head: [] }, // head is not configured in UI
                    labelFilter: { mode: getElement('pullRequests-labelFilter-mode').value, list: parseList(getElement('pullRequests-labelFilter-list').value) },
                },
                issues: {
                    enabled: getElement('issues-enabled').checked,
                    channelId: getElement('issues-channelId').value,
                    labelFilter: { mode: getElement('issues-labelFilter-mode').value, list: parseList(getElement('issues-labelFilter-list').value) },
                },
                releases: {
                    enabled: getElement('releases-enabled').checked,
                    channelId: getElement('releases-channelId').value,
                },
            };

            if (!dataFromAPI.settings.githubRepos) {
                dataFromAPI.settings.githubRepos = [];
            }

            if (id) {
                const index = dataFromAPI.settings.githubRepos.findIndex(r => r.id === id);
                dataFromAPI.settings.githubRepos[index] = newRepoData;
            } else {
                if (dataFromAPI.settings.githubRepos.some(r => r.name === repoName)) {
                    return alert(i18n.t('dashboard_server_github_modal_repo_exists_alert', { repoName }));
                }
                dataFromAPI.settings.githubRepos.push(newRepoData);
            }
            renderRepoList();
            closeModal();
        };

        const handleDeleteRepo = () => {
            const id = getElement('repo-id').value;
            if (!id) return;
            if (confirm(i18n.t('dashboard_server_github_modal_delete_confirm'))) {
                dataFromAPI.settings.githubRepos = dataFromAPI.settings.githubRepos.filter(r => r.id !== id);
                renderRepoList();
                closeModal();
            }
        };

        const createDefaultRepoConfig = () => {
            return {
                id: null, name: '', url: '', secret: '', enabled: true,
                commits: { enabled: false, channelId: null, branchFilter: { mode: 'blacklist', list: [] }, messageFilter: { mode: 'blacklist', list: [] }, authorFilter: { mode: 'blacklist', list: [] } },
                pullRequests: { enabled: true, channelId: null, branchFilter: { base: [], head: [] }, labelFilter: { mode: 'blacklist', list: [] }, ignoreDrafts: true },
                issues: { enabled: true, channelId: null, labelFilter: { mode: 'blacklist', list: [] } },
                releases: { enabled: true, channelId: null }
            };
        };

        addRepoBtn.addEventListener('click', () => openModal());
        cancelModalBtn.addEventListener('click', closeModal);
        repoForm.addEventListener('submit', handleFormSubmit);
        deleteRepoBtn.addEventListener('click', handleDeleteRepo);

        renderRepoList();
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
            dataFromAPI.botAvatarUrl = infoData.bot.avatar; // Store bot avatar URL
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
            buildKnowledgePanel(settings.knowledge);
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
            personality: getPersonality(), // Use the new getter function
            examples: getExamples(),       // Use the new getter function
            contextLimit: parseInt(getElement('ai-context-limit').value, 10) || 15,
            enabledTools: enabledTools
        };

        const musicConfig = {
            djRole: getElement('music-dj-role').value.trim()
        };

        const faq = (dataFromAPI.settings && dataFromAPI.settings.faq) ? dataFromAPI.settings.faq : [];
        const knowledge = (dataFromAPI.settings && dataFromAPI.settings.knowledge) ? dataFromAPI.settings.knowledge : [];

        const githubRepos = (dataFromAPI.settings && dataFromAPI.settings.githubRepos) ? dataFromAPI.settings.githubRepos : [];

        saveStatus.textContent = i18n.t('dashboard_server_saving_status');
        try {
            const token = localStorage.getItem('dashboard-token');
            const response = await fetch(`/api/guilds/${guildId}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ aiChannelIds, aiConfig, faq, knowledge, musicConfig, githubRepos })
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

    function addMessageToChat(role, content, avatarUrl) {
        const messageContainer = document.createElement('div');
        messageContainer.className = `chat-message-container`;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}-message`;
        messageDiv.textContent = content;

        if (role === 'bot') {
            const avatarImg = document.createElement('img');
            avatarImg.src = avatarUrl || '/favicon.ico'; // Fallback icon
            avatarImg.className = 'chat-avatar';
            messageContainer.appendChild(avatarImg);
            messageContainer.appendChild(messageDiv);
        } else {
            // User messages align to the right and don't need an avatar
            messageContainer.appendChild(messageDiv);
            messageContainer.classList.add('user-container');
        }

        chatDisplay.appendChild(messageContainer);
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
            personality: getPersonality(), // Use the getter
            examples: getExamples(),       // Use the getter
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
            addMessageToChat('bot', data.reply, dataFromAPI.botAvatarUrl);
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

    // Placeholders traduzidos
    chatInput.placeholder = i18n.t('dashboard_server_ai_tester_input_placeholder');
    getElement('faq-new-question').placeholder = i18n.t('dashboard_server_faq_new_question_placeholder');
    getElement('faq-new-answer').placeholder = i18n.t('dashboard_server_faq_new_answer_placeholder');
    getElement('knowledge-new-question').placeholder = i18n.t('dashboard_server_knowledge_new_question_placeholder');
    getElement('knowledge-new-answer').placeholder = i18n.t('dashboard_server_knowledge_new_answer_placeholder');

    initializePage();
});
