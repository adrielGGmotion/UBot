document.addEventListener('DOMContentLoaded', async () => {
    ensureAuthenticated();

    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('guildId');

    if (!guildId) {
        window.location.href = '/login.html';
        return;
    }

    // --- State ---
    let serverSettings = {};
    let availableChannels = [];

    // --- DOM Elements ---
    const guildNameTitle = document.getElementById('guild-name-title');
    const backToServerBtn = document.getElementById('back-to-server');
    const addRepoBtn = document.getElementById('add-repo-btn');
    const repoListContainer = document.getElementById('repo-list');
    const modal = document.getElementById('repo-modal');
    const modalTitle = document.getElementById('modal-title');
    const repoForm = document.getElementById('repo-form');
    const repoIdInput = document.getElementById('repo-id');
    const repoUrlInput = document.getElementById('repo-url');
    const repoSecretInput = document.getElementById('repo-secret');
    const modalConfigSections = document.getElementById('modal-config-sections');
    const deleteRepoBtn = document.getElementById('delete-repo-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');

    // --- Functions ---

    /**
     * Fetches initial data from the server.
     */
    async function fetchData() {
        try {
            const response = await fetch(`/api/guilds/${guildId}/settings`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!response.ok) throw new Error('Failed to fetch settings');
            const data = await response.json();
            serverSettings = data.settings;
            availableChannels = data.availableChannels;

            const guildResponse = await fetch(`/api/guilds`);
            const guilds = await guildResponse.json();
            const currentGuild = guilds.find(g => g.id === guildId);
            guildNameTitle.textContent = `Repositories for ${currentGuild?.name || 'Unknown Server'}`;

            renderRepoList();
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Could not load server data. Please try again.');
        }
    }

    /**
     * Renders the list of repository cards.
     */
    function renderRepoList() {
        repoListContainer.innerHTML = '';
        if (!serverSettings.githubRepos || serverSettings.githubRepos.length === 0) {
            repoListContainer.innerHTML = '<p>No repositories configured yet. Add one to get started!</p>';
            return;
        }

        serverSettings.githubRepos.forEach(repo => {
            const repoCard = document.createElement('div');
            repoCard.className = 'repo-card';
            repoCard.innerHTML = `
                <div class="repo-info">
                    <h4>${repo.name}</h4>
                    <span>${repo.enabled ? '🟢 Enabled' : '🔴 Disabled'}</span>
                </div>
                <button class="button-like edit-repo-btn" data-repo-id="${repo.id}">Edit</button>
            `;
            repoListContainer.appendChild(repoCard);
        });

        // Add event listeners to the new buttons
        document.querySelectorAll('.edit-repo-btn').forEach(btn => {
            btn.addEventListener('click', () => openModal(btn.dataset.repoId));
        });
    }

    /**
     * Opens and populates the modal for adding or editing a repo.
     * @param {string|null} repoId - The ID of the repo to edit, or null to add a new one.
     */
    function openModal(repoId = null) {
        repoForm.reset();
        modalConfigSections.innerHTML = '';

        let repoData;

        if (repoId) {
            // Edit mode
            repoData = serverSettings.githubRepos.find(r => r.id === repoId);
            if (!repoData) {
                alert('Repository not found!');
                return;
            }
            modalTitle.textContent = 'Edit Repository';
            repoIdInput.value = repoData.id;
            repoUrlInput.value = repoData.url;
            repoUrlInput.disabled = true; // Don't allow changing URL/name
            repoSecretInput.value = repoData.secret || '';
            deleteRepoBtn.style.display = 'inline-block';
        } else {
            // Add mode
            repoData = createDefaultRepoConfig(); // Get a default structure
            modalTitle.textContent = 'Add New Repository';
            repoIdInput.value = '';
            repoUrlInput.disabled = false;
            deleteRepoBtn.style.display = 'none';
        }

        // Build the dynamic part of the form
        buildModalConfigUI(repoData);
        modal.style.display = 'flex';
    }

    /**
     * Closes the modal.
     */
    function closeModal() {
        modal.style.display = 'none';
    }

    /**
     * Builds the UI for all the configuration sections inside the modal.
     * @param {object} repoData - The repository configuration data.
     */
    function buildModalConfigUI(repoData) {
        const createChannelSelect = (selectedId) => {
            const options = availableChannels.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>#${c.name}</option>`).join('');
            return `<option value="">-- Select a Channel --</option>` + options;
        };

        const createFilterInput = (list) => list.join(', ');

        const sections = [
            { key: 'commits', title: 'Commits' },
            { key: 'pullRequests', title: 'Pull Requests' },
            { key: 'issues', title: 'Issues' },
            { key: 'releases', title: 'Releases' },
        ];

        let html = `<div class="form-group"><label>Global Repo Status</label><label class="switch"><input type="checkbox" id="repo-enabled" ${repoData.enabled ? 'checked' : ''}><span class="slider"></span></label></div>`;

        sections.forEach(({ key, title }) => {
            const config = repoData[key];
            html += `
                <div class="config-section">
                    <div class="section-header">
                        <h4>${title}</h4>
                        <label class="switch">
                            <input type="checkbox" id="${key}-enabled" data-section="${key}" ${config.enabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="section-content" id="${key}-content" style="display: ${config.enabled ? 'block' : 'none'};">
                        <div class="form-group">
                            <label for="${key}-channelId">Notification Channel</label>
                            <select id="${key}-channelId">${createChannelSelect(config.channelId)}</select>
                        </div>
                        ${generateExtraFields(key, config)}
                    </div>
                </div>
            `;
        });

        modalConfigSections.innerHTML = html;

        // Add event listeners to section toggles
        document.querySelectorAll('.config-section .switch input').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const content = document.getElementById(`${e.target.dataset.section}-content`);
                if (content) content.style.display = e.target.checked ? 'block' : 'none';
            });
        });
    }

    /**
     * Generates specific form fields for each notification type.
     * @param {string} key - The config key (e.g., 'commits', 'pullRequests').
     * @param {object} config - The configuration object for that key.
     * @returns {string} - The generated HTML string.
     */
    function generateExtraFields(key, config) {
        let fields = '';
        switch (key) {
            case 'commits':
                fields += `
                    <div class="form-group small-group">
                        <label>Branch Filter</label>
                        <select id="commits-branchFilter-mode"><option value="blacklist" ${config.branchFilter.mode === 'blacklist' ? 'selected' : ''}>Blacklist</option><option value="whitelist" ${config.branchFilter.mode === 'whitelist' ? 'selected' : ''}>Whitelist</option></select>
                        <input type="text" id="commits-branchFilter-list" placeholder="main, develop" value="${createFilterInput(config.branchFilter.list)}">
                    </div>
                    <div class="form-group small-group">
                        <label>Message Filter (ignore commits containing these words)</label>
                        <select id="commits-messageFilter-mode"><option value="blacklist" ${config.messageFilter.mode === 'blacklist' ? 'selected' : ''}>Blacklist</option><option value="whitelist" ${config.messageFilter.mode === 'whitelist' ? 'selected' : ''}>Whitelist</option></select>
                        <input type="text" id="commits-messageFilter-list" placeholder="WIP, chore" value="${createFilterInput(config.messageFilter.list)}">
                    </div>
                    <div class="form-group small-group">
                        <label>Author Filter (ignore commits from these authors)</label>
                        <select id="commits-authorFilter-mode"><option value="blacklist" ${config.authorFilter.mode === 'blacklist' ? 'selected' : ''}>Blacklist</option><option value="whitelist" ${config.authorFilter.mode === 'whitelist' ? 'selected' : ''}>Whitelist</option></select>
                        <input type="text" id="commits-authorFilter-list" placeholder="bot-name" value="${createFilterInput(config.authorFilter.list)}">
                    </div>
                `;
                break;
            case 'pullRequests':
                fields += `
                    <div class="form-group"><label>Ignore Draft PRs <input type="checkbox" id="pullRequests-ignoreDrafts" ${config.ignoreDrafts ? 'checked' : ''}></label></div>
                    <div class="form-group"><label>Base Branch Filter (e.g., main)</label><input type="text" id="pullRequests-branchFilter-base" value="${createFilterInput(config.branchFilter.base)}"></div>
                    <div class="form-group small-group">
                        <label>Label Filter</label>
                        <select id="pullRequests-labelFilter-mode"><option value="blacklist" ${config.labelFilter.mode === 'blacklist' ? 'selected' : ''}>Blacklist</option><option value="whitelist" ${config.labelFilter.mode === 'whitelist' ? 'selected' : ''}>Whitelist</option></select>
                        <input type="text" id="pullRequests-labelFilter-list" placeholder="do-not-merge" value="${createFilterInput(config.labelFilter.list)}">
                    </div>
                `;
                break;
            case 'issues':
                 fields += `
                    <div class="form-group small-group">
                        <label>Label Filter</label>
                        <select id="issues-labelFilter-mode"><option value="blacklist" ${config.labelFilter.mode === 'blacklist' ? 'selected' : ''}>Blacklist</option><option value="whitelist" ${config.labelFilter.mode === 'whitelist' ? 'selected' : ''}>Whitelist</option></select>
                        <input type="text" id="issues-labelFilter-list" placeholder="wontfix" value="${createFilterInput(config.labelFilter.list)}">
                    </div>
                `;
                break;
        }
        return fields;
    }

    /**
     * Saves the entire settings object to the server.
     */
    async function saveSettings() {
        try {
            const response = await fetch(`/api/guilds/${guildId}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
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

    /**
     * Handles the form submission for adding or editing a repo.
     */
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
            secret: document.getElementById('repo-secret').value.trim(),
            enabled: document.getElementById('repo-enabled').checked,
            commits: {
                enabled: document.getElementById('commits-enabled').checked,
                channelId: document.getElementById('commits-channelId').value,
                branchFilter: { mode: document.getElementById('commits-branchFilter-mode').value, list: parseList(document.getElementById('commits-branchFilter-list').value) },
                messageFilter: { mode: document.getElementById('commits-messageFilter-mode').value, list: parseList(document.getElementById('commits-messageFilter-list').value) },
                authorFilter: { mode: document.getElementById('commits-authorFilter-mode').value, list: parseList(document.getElementById('commits-authorFilter-list').value) },
            },
            pullRequests: {
                enabled: document.getElementById('pullRequests-enabled').checked,
                channelId: document.getElementById('pullRequests-channelId').value,
                ignoreDrafts: document.getElementById('pullRequests-ignoreDrafts').checked,
                branchFilter: { base: parseList(document.getElementById('pullRequests-branchFilter-base').value), head: [] },
                labelFilter: { mode: document.getElementById('pullRequests-labelFilter-mode').value, list: parseList(document.getElementById('pullRequests-labelFilter-list').value) },
                eventFilter: ['opened', 'closed', 'merged', 'reopened'], // Hardcoded for now
            },
            issues: {
                enabled: document.getElementById('issues-enabled').checked,
                channelId: document.getElementById('issues-channelId').value,
                labelFilter: { mode: document.getElementById('issues-labelFilter-mode').value, list: parseList(document.getElementById('issues-labelFilter-list').value) },
                eventFilter: ['opened', 'closed', 'reopened'], // Hardcoded for now
            },
            releases: {
                enabled: document.getElementById('releases-enabled').checked,
                channelId: document.getElementById('releases-channelId').value,
                typeFilter: ['published', 'prerelease'], // Hardcoded for now
            },
        };

        if (id) {
            // Update existing repo
            const index = serverSettings.githubRepos.findIndex(r => r.id === id);
            serverSettings.githubRepos[index] = newRepoData;
        } else {
            // Add new repo
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

    /**
     * Handles the deletion of a repository.
     */
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
            pullRequests: { enabled: true, channelId: null, eventFilter: ['opened', 'merged', 'closed'], branchFilter: { base: [], head: [] }, labelFilter: { mode: 'blacklist', list: [] }, ignoreDrafts: true },
            issues: { enabled: true, channelId: null, eventFilter: ['opened', 'closed'], labelFilter: { mode: 'blacklist', list: [] } },
            releases: { enabled: true, channelId: null, typeFilter: ['published', 'prerelease'] }
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