document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('id');
    if (!guildId) {
        window.location.href = '/index.html';
        return;
    }

    // Wait for i18n to be ready
    if (window.i18n) {
        await window.i18n.ready;
    }

    const token = localStorage.getItem('dashboard-token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const headers = { 'Authorization': `Bearer ${token}` };

    // DOM Elements
    const serverNameTitle = document.getElementById('server-name-title');
    const settingsForm = document.getElementById('settings-form');
    const djRoleInput = document.getElementById('dj-role');
    const musicAutoplayInput = document.getElementById('music-autoplay');
    const musicEmbedColorInput = document.getElementById('music-embed-color');
    const githubReposContainer = document.getElementById('github-repos-container');
    const addRepoBtn = document.getElementById('add-repo-btn');
    const repoModal = document.getElementById('repo-modal');
    const repoForm = document.getElementById('repo-form');
    const closeModalBtn = repoModal ? repoModal.querySelector('.close-btn') : null;
    const deleteRepoBtn = document.getElementById('delete-repo-btn');

    let serverSettings = {};
    let availableChannels = [];

    async function fetchGuildInfo() {
        try {
            const res = await fetch('/api/guilds', { headers });
            if (res.status === 401) throw new Error('Unauthorized');
            const guilds = await res.json();
            const guild = guilds.find(g => g.id === guildId);
            if (serverNameTitle) {
                if (guild) {
                    serverNameTitle.innerHTML = `<i class="material-icons">dns</i> <span>${i18n.t('dashboard_server_managing_title', { serverName: guild.name })}</span>`;
                } else {
                    serverNameTitle.innerHTML = `<i class="material-icons">error</i> <span>${i18n.t('err_guild_not_found')}</span>`;
                }
            }
        } catch (error) {
            console.error('Failed to fetch guild info:', error);
            if (error.message === 'Unauthorized') {
                localStorage.removeItem('dashboard-token');
                window.location.href = '/login.html';
            }
        }
    }

    async function fetchSettings() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/settings`, { headers });
            if (res.status === 401) throw new Error('Unauthorized');
            const data = await res.json();
            serverSettings = data.settings || {};
            availableChannels = data.availableChannels || [];
            populateForm();
            renderGithubRepos();
            populateChannelSelects();
            if (window.applyTranslationsToDOM) {
                window.applyTranslationsToDOM();
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            if (error.message === 'Unauthorized') {
                localStorage.removeItem('dashboard-token');
                window.location.href = '/login.html';
            }
        }
    }

    function populateForm() {
        if (!djRoleInput || !musicAutoplayInput || !musicEmbedColorInput) return;
        if (!serverSettings.musicConfig) serverSettings.musicConfig = {};
        djRoleInput.value = serverSettings.musicConfig.djRole || 'DJ';
        musicAutoplayInput.checked = serverSettings.musicConfig.autoplay || false;
        musicEmbedColorInput.checked = serverSettings.musicConfig.embedColor || false;
    }

    function renderGithubRepos() {
        if (!githubReposContainer) return;
        githubReposContainer.innerHTML = '';
        if (!serverSettings.githubRepos || serverSettings.githubRepos.length === 0) {
            githubReposContainer.innerHTML = `<p data-locale-key="settings_github_no_repos">${i18n.t('settings_github_no_repos')}</p>`;
            return;
        }
        serverSettings.githubRepos.forEach((repo, index) => {
            const repoElement = document.createElement('div');
            repoElement.className = 'repo-item';
            repoElement.innerHTML = `<span>${repo.name}</span><button type="button" class="btn btn-secondary edit-repo-btn" data-index="${index}" data-locale-key="settings_github_edit_repo">${i18n.t('settings_github_edit_repo')}</button>`;
            githubReposContainer.appendChild(repoElement);
        });
    }

    function populateChannelSelects() {
        if (!repoModal) return;
        const selects = repoModal.querySelectorAll('select[id$="-channelId"]');
        selects.forEach(select => {
            select.innerHTML = `<option value="" data-locale-key="settings_select_channel">${i18n.t('settings_select_channel')}</option>`;
            availableChannels.forEach(channel => {
                const option = document.createElement('option');
                option.value = channel.id;
                option.textContent = channel.name;
                select.appendChild(option);
            });
        });
    }

    function openRepoModal(repoIndex = null) {
        if (!repoForm || !repoModal || !deleteRepoBtn) return;
        repoForm.reset();
        populateChannelSelects(); // Ensure selects are populated before filling
        const isNew = repoIndex === null;
        document.getElementById('repo-index').value = isNew ? '' : repoIndex;
        deleteRepoBtn.style.display = isNew ? 'none' : 'inline-block';

        const modalTitleKey = isNew ? 'settings_github_modal_add_title' : 'settings_github_modal_edit_title';
        const modalTitle = repoModal.querySelector('h3');
        if (modalTitle) modalTitle.setAttribute('data-locale-key', modalTitleKey);

        if (!isNew) {
            const repo = serverSettings.githubRepos[repoIndex];
            document.getElementById('repo-name').value = repo.name;
            document.getElementById('repo-secret').value = repo.secret;

            // Commits
            const commits = repo.commits || {};
            document.getElementById('commits-enabled').checked = commits.enabled;
            document.getElementById('commits-channelId').value = commits.channelId || '';

            // Pull Requests
            const pulls = repo.pullRequests || {};
            document.getElementById('pulls-enabled').checked = pulls.enabled;
            document.getElementById('pulls-channelId').value = pulls.channelId || '';
            document.getElementById('pulls-ignore-drafts').checked = pulls.ignoreDrafts !== false;
            (pulls.eventFilter || []).forEach(event => {
                const checkbox = repoForm.querySelector(`input[type="checkbox"][value="${event}"]`);
                if(checkbox) checkbox.checked = true;
            });

            // Issues
            const issues = repo.issues || {};
            document.getElementById('issues-enabled').checked = issues.enabled;
            document.getElementById('issues-channelId').value = issues.channelId || '';
             (issues.eventFilter || []).forEach(event => {
                const checkbox = repoModal.querySelector(`#repo-form input[type="checkbox"][value="${event}"]`);
                if (checkbox) checkbox.checked = true;
            });

            // Releases
            const releases = repo.releases || {};
            document.getElementById('releases-enabled').checked = releases.enabled;
            document.getElementById('releases-channelId').value = releases.channelId || '';
             (releases.typeFilter || []).forEach(event => {
                const checkbox = repoModal.querySelector(`#repo-form input[type="checkbox"][value="${event}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        if(window.applyTranslations) window.applyTranslations();
        repoModal.style.display = 'block';
    }

    function closeRepoModal() {
        if (repoModal) repoModal.style.display = 'none';
    }

    if (addRepoBtn) addRepoBtn.addEventListener('click', () => openRepoModal());
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeRepoModal);

    if (repoModal) {
        window.addEventListener('click', (event) => {
            if (event.target === repoModal) {
                closeRepoModal();
            }
        });
    }

    if (githubReposContainer) {
        githubReposContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('edit-repo-btn')) {
                const index = event.target.dataset.index;
                openRepoModal(index);
            }
        });
    }

    if (repoModal) {
        const collapsibleBtns = repoModal.querySelectorAll('.collapsible-btn');
        collapsibleBtns.forEach(button => {
            button.addEventListener('click', () => {
                button.classList.toggle('active');
                const content = button.nextElementSibling;
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                } else {
                    content.style.maxHeight = content.scrollHeight + "px";
                }
            });
        });
    }

    if (repoForm) {
        repoForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const repoIndex = document.getElementById('repo-index').value;
            const isNew = repoIndex === '';

            const pullEventFilters = Array.from(repoForm.querySelectorAll('fieldset:nth-of-type(1) input[type="checkbox"]:checked')).map(cb => cb.value);
            const issueEventFilters = Array.from(repoForm.querySelectorAll('fieldset:nth-of-type(2) input[type="checkbox"]:checked')).map(cb => cb.value);
            const releaseTypeFilters = Array.from(repoForm.querySelectorAll('fieldset:nth-of-type(3) input[type="checkbox"]:checked')).map(cb => cb.value);

            const repoData = {
                name: document.getElementById('repo-name').value,
                secret: document.getElementById('repo-secret').value,
                commits: {
                    enabled: document.getElementById('commits-enabled').checked,
                    channelId: document.getElementById('commits-channelId').value,
                },
                pullRequests: {
                    enabled: document.getElementById('pulls-enabled').checked,
                    channelId: document.getElementById('pulls-channelId').value,
                    ignoreDrafts: document.getElementById('pulls-ignore-drafts').checked,
                    eventFilter: pullEventFilters,
                },
                issues: {
                    enabled: document.getElementById('issues-enabled').checked,
                    channelId: document.getElementById('issues-channelId').value,
                    eventFilter: issueEventFilters,
                },
                releases: {
                    enabled: document.getElementById('releases-enabled').checked,
                    channelId: document.getElementById('releases-channelId').value,
                    typeFilter: releaseTypeFilters,
                },
            };

            if (isNew) {
                if (!serverSettings.githubRepos) serverSettings.githubRepos = [];
                serverSettings.githubRepos.push(repoData);
            } else {
                serverSettings.githubRepos[repoIndex] = repoData;
            }

            renderGithubRepos();
            closeRepoModal();
        });
    }

    if (deleteRepoBtn) {
        deleteRepoBtn.addEventListener('click', () => {
            const repoIndex = document.getElementById('repo-index').value;
            if (repoIndex !== '') {
                serverSettings.githubRepos.splice(repoIndex, 1);
                renderGithubRepos();
                closeRepoModal();
            }
        });
    }

    if (settingsForm) {
        settingsForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = { ...serverSettings };

            if (djRoleInput && musicAutoplayInput && musicEmbedColorInput) {
                formData.musicConfig = {
                    djRole: djRoleInput.value,
                    autoplay: musicAutoplayInput.checked,
                    embedColor: musicEmbedColorInput.checked,
                };
            }

            if (githubReposContainer) {
                formData.githubRepos = serverSettings.githubRepos;
            }

            try {
                const res = await fetch(`/api/guilds/${guildId}/settings`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Failed to save settings');
                }
                alert(i18n.t('settings_updated_success'));
            } catch (error) {
                console.error('Failed to save settings:', error);
                alert(`${i18n.t('settings_updated_error')}: ${error.message}`);
            }
        });
    }

    // Initial Load
    await fetchGuildInfo();
    await fetchSettings();
    if (window.applyTranslations) {
        window.applyTranslations();
    }
});