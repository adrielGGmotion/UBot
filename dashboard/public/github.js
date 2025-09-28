document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('guildId');

    if (!guildId) {
        window.location.href = '/';
        return;
    }

    // --- State ---
    let serverSettings = { githubRepos: [] };
    let availableChannels = [];

    // --- DOM Elements ---
    const getElement = (id) => document.getElementById(id);
    const guildNameTitle = getElement('guild-name-title');
    const backToServerBtn = getElement('back-to-server');
    const addRepoBtn = getElement('add-repo-btn');
    const repoListContainer = getElement('repo-list');
    const modal = getElement('repo-modal');
    const modalTitle = getElement('modal-title');
    const repoForm = getElement('repo-form');
    const repoIdInput = getElement('repo-id');
    const repoUrlInput = getElement('repo-url');
    const repoSecretInput = getElement('repo-secret');
    const modalConfigSections = getElement('modal-config-sections');
    const deleteRepoBtn = getElement('delete-repo-btn');
    const cancelModalBtn = getElement('cancel-modal-btn');

    // --- Functions ---

    async function fetchData() {
        try {
            const token = localStorage.getItem('dashboard-token');
            const settingsRes = await fetch(`/api/guilds/${guildId}/settings`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!settingsRes.ok) throw new Error('Failed to fetch settings');
            const data = await settingsRes.json();
            serverSettings = data.settings || serverSettings;
            serverSettings.githubRepos = serverSettings.githubRepos || [];
            availableChannels = data.availableChannels || [];

            const guildsRes = await fetch(`/api/guilds`, { headers: { 'Authorization': `Bearer ${token}` } });
            const guilds = await guildsRes.json();
            const currentGuild = guilds.find(g => g.id === guildId);
            guildNameTitle.textContent = `Repositories for ${currentGuild?.name || 'Unknown Server'}`;
            getElement('bot-name').textContent = `U-Bot Dashboard`;

            renderRepoList();
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Could not load server data. Please try again.');
        }
    }

    function renderRepoList() {
        repoListContainer.innerHTML = '';
        if (serverSettings.githubRepos.length === 0) {
            repoListContainer.innerHTML = '<p style="color: var(--muted);">No repositories configured yet. Add one to get started!</p>';
            return;
        }

        serverSettings.githubRepos.forEach(repo => {
            const repoCard = document.createElement('div');
            repoCard.className = 'repo-card';
            const repoName = repo.name || (repo.url ? new URL(repo.url).pathname.substring(1) : 'Unnamed Repo');
            repoCard.innerHTML = `
                <div class="repo-info">
                    <h4>${repoName}</h4>
                    <span>${repo.enabled ? '🟢 Enabled' : '🔴 Disabled'}</span>
                </div>
                <button class="edit-repo-btn" data-repo-id="${repo.id}">Edit</button>
            `;
            repoListContainer.appendChild(repoCard);
        });

        document.querySelectorAll('.edit-repo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openModal(e.currentTarget.dataset.repoId));
        });
    }

    function openModal(repoId = null) {
        repoForm.reset();
        modalConfigSections.innerHTML = '';
        let repoData;

        if (repoId) {
            const originalRepoData = serverSettings.githubRepos.find(r => r.id === repoId);
            if (!originalRepoData) {
                alert('Repository not found!');
                return;
            }
            // Deep copy to avoid modifying the original state until save
            repoData = JSON.parse(JSON.stringify(originalRepoData));
            // Ensure all nested objects exist
            repoData = { ...createDefaultRepoConfig(), ...repoData };


            modalTitle.textContent = 'Edit Repository';
            repoIdInput.value = repoData.id;
            repoUrlInput.value = repoData.url;
            repoUrlInput.disabled = true;
            repoSecretInput.value = repoData.secret || '';
            deleteRepoBtn.style.display = 'inline-block';
        } else {
            repoData = createDefaultRepoConfig();
            modalTitle.textContent = 'Add New Repository';
            repoIdInput.value = '';
            repoUrlInput.disabled = false;
            deleteRepoBtn.style.display = 'none';
        }

        buildModalConfigUI(repoData);
        modal.style.display = 'flex';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    function buildModalConfigUI(repoData) {
        const createChannelSelect = (selectedId) => {
            const options = availableChannels.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>#${c.name}</option>`).join('');
            return `<option value="">-- Select a Channel --</option>${options}`;
        };

        const sections = [
            { key: 'commits', title: 'Commits' },
            { key: 'pullRequests', title: 'Pull Requests' },
            { key: 'issues', title: 'Issues' },
            { key: 'releases', title: 'Releases' },
        ];

        let html = `<div class="form-group" style="flex-direction: row; align-items: center; justify-content: space-between;"><label>Global Repo Status</label><label class="switch"><input type="checkbox" id="repo-enabled" ${repoData.enabled ? 'checked' : ''}><span class="slider"></span></label></div>`;

        sections.forEach(({ key, title }) => {
            const config = repoData[key];
            html += `
                <div class="config-section">
                    <div class="section-header">
                        <h4>${title}</h4>
                        <label class="switch"><input type="checkbox" class="section-toggle" id="${key}-enabled" data-section="${key}" ${config.enabled ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                    <div class="section-content" id="${key}-content" style="display: ${config.enabled ? 'block' : 'none'};">
                        <div class="form-group"><label for="${key}-channelId">Notification Channel</label><select id="${key}-channelId" class="form-select">${createChannelSelect(config.channelId)}</select></div>
                        ${generateExtraFields(key, config)}
                    </div>
                </div>`;
        });

        modalConfigSections.innerHTML = html;

        // Add event listeners to section toggles
        document.querySelectorAll('.section-toggle').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const content = document.getElementById(`${e.target.dataset.section}-content`);
                if (content) content.style.display = e.target.checked ? 'block' : 'none';
            });
        });
    }

    function generateExtraFields(key, config) {
        const createFilterInput = (list) => (list || []).join(', ');
        let fields = '';
        switch (key) {
            case 'commits':
                fields += `<div class="form-group small-group"><label>Branch Filter</label><select class="form-select" id="commits-branchFilter-mode"><option value="blacklist" ${config.branchFilter.mode === 'blacklist' ? 'selected' : ''}>Blacklist</option><option value="whitelist" ${config.branchFilter.mode === 'whitelist' ? 'selected' : ''}>Whitelist</option></select><input type="text" class="form-input" id="commits-branchFilter-list" placeholder="main, develop" value="${createFilterInput(config.branchFilter.list)}"></div>`;
                fields += `<div class="form-group small-group"><label>Message Filter</label><select class="form-select" id="commits-messageFilter-mode"><option value="blacklist" ${config.messageFilter.mode === 'blacklist' ? 'selected' : ''}>Blacklist</option><option value="whitelist" ${config.messageFilter.mode === 'whitelist' ? 'selected' : ''}>Whitelist</option></select><input type="text" class="form-input" id="commits-messageFilter-list" placeholder="WIP, chore" value="${createFilterInput(config.messageFilter.list)}"></div>`;
                fields += `<div class="form-group small-group"><label>Author Filter</label><select class="form-select" id="commits-authorFilter-mode"><option value="blacklist" ${config.authorFilter.mode === 'blacklist' ? 'selected' : ''}>Blacklist</option><option value="whitelist" ${config.authorFilter.mode === 'whitelist' ? 'selected' : ''}>Whitelist</option></select><input type="text" class="form-input" id="commits-authorFilter-list" placeholder="bot-name" value="${createFilterInput(config.authorFilter.list)}"></div>`;
                break;
            case 'pullRequests':
                fields += `<div class="form-group" style="flex-direction: row; align-items: center; gap: 10px;"><label>Ignore Draft PRs</label><input type="checkbox" id="pullRequests-ignoreDrafts" ${config.ignoreDrafts ? 'checked' : ''}></div>`;
                fields += `<div class="form-group"><label>Base Branch Filter (e.g., main)</label><input type="text" class="form-input" id="pullRequests-branchFilter-base" value="${createFilterInput(config.branchFilter.base)}"></div>`;
                fields += `<div class="form-group small-group"><label>Label Filter</label><select class="form-select" id="pullRequests-labelFilter-mode"><option value="blacklist" ${config.labelFilter.mode === 'blacklist' ? 'selected' : ''}>Blacklist</option><option value="whitelist" ${config.labelFilter.mode === 'whitelist' ? 'selected' : ''}>Whitelist</option></select><input type="text" class="form-input" id="pullRequests-labelFilter-list" placeholder="do-not-merge" value="${createFilterInput(config.labelFilter.list)}"></div>`;
                break;
            case 'issues':
                fields += `<div class="form-group small-group"><label>Label Filter</label><select class="form-select" id="issues-labelFilter-mode"><option value="blacklist" ${config.labelFilter.mode === 'blacklist' ? 'selected' : ''}>Blacklist</option><option value="whitelist" ${config.labelFilter.mode === 'whitelist' ? 'selected' : ''}>Whitelist</option></select><input type="text" class="form-input" id="issues-labelFilter-list" placeholder="wontfix" value="${createFilterInput(config.labelFilter.list)}"></div>`;
                break;
        }
        return fields;
    }

    async function saveSettings() {
        try {
            const token = localStorage.getItem('dashboard-token');
            // This needs to post the entire settings object, not just the githubRepos part
            const response = await fetch(`/api/guilds/${guildId}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(serverSettings)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save settings');
            }
            return true;
        } catch (error) {
            console.error('Save failed:', error);
            alert(`Error saving settings: ${error.message}`);
            return false;
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const id = repoIdInput.value;
        const url = repoUrlInput.value.trim();

        if (!url.match(/^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-._]+$/)) {
            alert('Invalid GitHub repository URL.');
            return;
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

        if (id) {
            const index = serverSettings.githubRepos.findIndex(r => r.id === id);
            serverSettings.githubRepos[index] = newRepoData;
        } else {
            if (serverSettings.githubRepos.some(r => r.name === repoName)) {
                alert(`Repository '${repoName}' is already configured.`);
                return;
            }
            serverSettings.githubRepos.push(newRepoData);
        }

        if (await saveSettings()) {
            closeModal();
            renderRepoList();
        }
    }

    async function handleDeleteRepo() {
        const id = repoIdInput.value;
        if (!id) return;
        if (confirm('Are you sure you want to delete this repository configuration? This cannot be undone.')) {
            serverSettings.githubRepos = serverSettings.githubRepos.filter(r => r.id !== id);
            if (await saveSettings()) {
                closeModal();
                renderRepoList();
            }
        }
    }

    function createDefaultRepoConfig() {
        return {
            id: null, name: '', url: '', secret: '', enabled: true,
            commits: { enabled: false, channelId: null, branchFilter: { mode: 'blacklist', list: [] }, messageFilter: { mode: 'blacklist', list: [] }, authorFilter: { mode: 'blacklist', list: [] } },
            pullRequests: { enabled: true, channelId: null, branchFilter: { base: [], head: [] }, labelFilter: { mode: 'blacklist', list: [] }, ignoreDrafts: true },
            issues: { enabled: true, channelId: null, labelFilter: { mode: 'blacklist', list: [] } },
            releases: { enabled: true, channelId: null }
        };
    }

    // --- Event Listeners ---
    backToServerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `/server.html?guildId=${guildId}`;
    });
    addRepoBtn.addEventListener('click', () => openModal());
    cancelModalBtn.addEventListener('click', closeModal);
    repoForm.addEventListener('submit', handleFormSubmit);
    deleteRepoBtn.addEventListener('click', handleDeleteRepo);

    // --- Initial Load ---
    fetchData();
});