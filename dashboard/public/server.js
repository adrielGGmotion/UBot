document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('id');
    if (!guildId) {
        window.location.href = '/index.html';
        return;
    }

    let dataFromAPI = {};
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

    function buildAiPanel(channels, selectedIds, config, allTools) {
        const listDiv = getElement('channels-list');
        listDiv.innerHTML = '';
        channels.forEach(ch => {
            const isChecked = (selectedIds || []).includes(ch.id);
            listDiv.innerHTML += `<div class="checkbox-group"><input type="checkbox" id="chan-${ch.id}" value="${ch.id}" ${isChecked ? 'checked' : ''}><label for="chan-${ch.id}">#${ch.name}</label></div>`;
        });

        getElement('ai-context-limit').value = config.contextLimit || 15;

        getPersonality = setupDynamicTextAreas('ai-personality-container', 'add-personality-btn', config.personality, 'dashboard_server_ai_personality_placeholder');
        getExamples = setupDynamicTextAreas('ai-examples-container', 'add-example-btn', config.examples, 'dashboard_server_ai_examples_placeholder');

        const toolsListDiv = getElement('ai-tools-list');
        toolsListDiv.innerHTML = '';
        const enabledTools = config.enabledTools || allTools;
        allTools.forEach(toolName => {
            const isChecked = enabledTools.includes(toolName);
            toolsListDiv.innerHTML += `<div class="checkbox-group"><input type="checkbox" id="tool-${toolName}" value="${toolName}" ${isChecked ? 'checked' : ''}><label for="tool-${toolName}">${toolName}</label></div>`;
        });
    }

    function setupDynamicTextAreas(containerId, addButtonId, dataArray, placeholderKey) {
        const container = getElement(containerId);
        const addButton = getElement(addButtonId);
        let internalData = Array.isArray(dataArray) ? [...dataArray] : (dataArray ? [dataArray] : []);

        const render = () => {
            container.innerHTML = '';
            internalData.forEach((item, index) => {
                const inputGroup = document.createElement('div');
                inputGroup.style.display = 'flex';
                inputGroup.style.gap = '10px';
                const textArea = document.createElement('textarea');
                textArea.className = 'form-textarea';
                textArea.placeholder = i18n.t(placeholderKey);
                textArea.value = item;
                textArea.addEventListener('change', (e) => { internalData[index] = e.target.value; });
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.textContent = '-';
                removeBtn.className = 'form-button';
                removeBtn.addEventListener('click', () => { internalData.splice(index, 1); render(); });
                inputGroup.appendChild(textArea);
                inputGroup.appendChild(removeBtn);
                container.appendChild(inputGroup);
            });
        };
        addButton.addEventListener('click', () => { internalData.push(''); render(); });
        render();
        return () => internalData.filter(item => item.trim() !== '');
    }

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
                serverNameTitle.innerHTML = `<i class="material-icons">dns</i> <span>Gerenciando: ${currentGuild.name}</span>`;
            }

            buildAiPanel(availableChannels, settings.aiChannelIds, settings.aiConfig, toolsData.tools);

        } catch (error) {
            console.error("Erro na inicialização:", error);
            const serverNameTitle = getElement('server-name-title');
            serverNameTitle.innerHTML = `<i class="material-icons">error</i> <span>Erro ao carregar dados.</span>`;
        }
    }

    const saveButton = getElement('save-settings-btn');
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            const token = localStorage.getItem('dashboard-token');
            const saveStatus = getElement('save-status');
            saveStatus.textContent = 'Salvando...';

            const aiChannelIds = Array.from(document.querySelectorAll('#channels-list input:checked')).map(cb => cb.value);
            const enabledTools = Array.from(document.querySelectorAll('#ai-tools-list input:checked')).map(cb => cb.value);

            const payload = {
                aiChannelIds,
                aiConfig: {
                    personality: getPersonality(),
                    examples: getExamples(),
                    contextLimit: parseInt(getElement('ai-context-limit').value, 10) || 15,
                    enabledTools
                }
            };

            try {
                const response = await fetch(`/api/guilds/${guildId}/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
                if (handleAuthError(response)) return;
                if (!response.ok) throw new Error('Falha ao salvar');
                saveStatus.textContent = 'Configurações salvas com sucesso!';
                saveStatus.style.color = 'var(--accent)';
            } catch (err) {
                saveStatus.textContent = 'Erro ao salvar.';
                saveStatus.style.color = 'var(--error)';
            }
            setTimeout(() => saveStatus.textContent = '', 3000);
        });
    }

    initializePage();
});