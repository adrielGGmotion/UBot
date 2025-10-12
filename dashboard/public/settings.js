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

    // DOM Elements
    const serverNameTitle = document.getElementById('server-name-title');
    const settingsForm = document.getElementById('settings-form');
    const managerRolesSelect = document.getElementById('manager-roles');
    const blacklistedRolesSelect = document.getElementById('blacklisted-roles');
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
    let availableRoles = [];

    async function fetchRoles() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/roles`);
            if (res.status === 401) throw new Error('Unauthorized');
            if (!res.ok) throw new Error('Failed to fetch roles');
            availableRoles = await res.json();
        } catch (error) {
            console.error('Failed to fetch roles:', error);
            if (error.message === 'Unauthorized') {
                window.location.href = '/login.html';
            }
            // Do not redirect for other errors, just log them.
        }
    }

    async function fetchGuildInfo() {
        try {
            const res = await fetch('/api/guilds');
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
                window.location.href = '/login.html';
            }
        }
    }

    async function fetchSettings() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/settings`);
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
                window.location.href = '/login.html';
            }
        }
    }

    function populateRoleSelects() {
        if (!managerRolesSelect || !blacklistedRolesSelect) return;

        // Clear existing options
        managerRolesSelect.innerHTML = '';
        blacklistedRolesSelect.innerHTML = '';

        availableRoles.forEach(role => {
            // Option for Manager Roles
            const managerOption = document.createElement('option');
            managerOption.value = role.id;
            managerOption.textContent = role.name;
            managerRolesSelect.appendChild(managerOption);

            // Option for Blacklisted Roles
            const blacklistedOption = document.createElement('option');
            blacklistedOption.value = role.id;
            blacklistedOption.textContent = role.name;
            blacklistedRolesSelect.appendChild(blacklistedOption);
        });
    }

    function populateForm() {
        if (!musicAutoplayInput || !musicEmbedColorInput) return;
        if (!serverSettings.musicConfig) serverSettings.musicConfig = {};

        populateRoleSelects(); // Populate dropdowns first

        // Set selected manager roles
        if (managerRolesSelect && serverSettings.musicConfig.managerRoles) {
            Array.from(managerRolesSelect.options).forEach(option => {
                if (serverSettings.musicConfig.managerRoles.includes(option.value)) {
                    option.selected = true;
                }
            });
        }

        // Set selected blacklisted roles
        if (blacklistedRolesSelect && serverSettings.musicConfig.blacklistedRoles) {
            Array.from(blacklistedRolesSelect.options).forEach(option => {
                if (serverSettings.musicConfig.blacklistedRoles.includes(option.value)) {
                    option.selected = true;
                }
            });
        }

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
            const repoNameInput = document.getElementById('repo-name');
            const repoSecretInput = document.getElementById('repo-secret');
            if (repoNameInput) repoNameInput.value = repo.name;
            if (repoSecretInput) repoSecretInput.value = repo.secret;

            // Commits
            const commits = repo.commits || {};
            document.getElementById('commits-enabled').checked = commits.enabled || false;
            document.getElementById('commits-channelId').value = commits.channelId || '';
            const branchFilter = commits.branchFilter || { mode: 'whitelist', list: [] };
            document.getElementById('commits-branch-mode').value = branchFilter.mode || 'whitelist';
            document.getElementById('commits-branch-list').value = (branchFilter.list || []).join(', ');

            // Pull Requests
            const pulls = repo.pullRequests || {};
            document.getElementById('pulls-enabled').checked = pulls.enabled || false;
            document.getElementById('pulls-channelId').value = pulls.channelId || '';
            document.getElementById('pulls-ignore-drafts').checked = pulls.ignoreDrafts !== false;
            (pulls.eventFilter || []).forEach(event => {
                const checkbox = repoForm.querySelector(`input[type="checkbox"][value="${event}"][id^="pr-"]`);
                if (checkbox) checkbox.checked = true;
            });

            // Issues
            const issues = repo.issues || {};
            document.getElementById('issues-enabled').checked = issues.enabled || false;
            document.getElementById('issues-channelId').value = issues.channelId || '';
            (issues.eventFilter || []).forEach(event => {
                const checkbox = repoForm.querySelector(`input[type="checkbox"][value="${event}"][id^="issue-"]`);
                if (checkbox) checkbox.checked = true;
            });

            // Releases
            const releases = repo.releases || {};
            document.getElementById('releases-enabled').checked = releases.enabled || false;
            document.getElementById('releases-channelId').value = releases.channelId || '';
            (releases.typeFilter || []).forEach(event => {
                const checkbox = repoForm.querySelector(`input[type="checkbox"][value="${event}"][id^="release-"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        if (window.applyTranslationsToDOM) window.applyTranslationsToDOM();
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

    // This logic is no longer needed with the new card-based design.
    // if (repoModal) { ... }

    if (repoForm) {
        repoForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const repoIndex = document.getElementById('repo-index').value;
            const isNew = repoIndex === '';

            // Helper to get checked values from a group based on a prefix
            const getCheckedValues = (idPrefix) =>
                Array.from(repoForm.querySelectorAll(`input[id^="${idPrefix}-"]:checked`))
                     .map(cb => cb.value);

            const repoData = {
                name: document.getElementById('repo-name').value,
                secret: document.getElementById('repo-secret').value,
                commits: {
                    enabled: document.getElementById('commits-enabled').checked,
                    channelId: document.getElementById('commits-channelId').value,
                    branchFilter: {
                        mode: document.getElementById('commits-branch-mode').value,
                        list: document.getElementById('commits-branch-list').value.split(',').map(b => b.trim()).filter(b => b),
                    },
                },
                pullRequests: {
                    enabled: document.getElementById('pulls-enabled').checked,
                    channelId: document.getElementById('pulls-channelId').value,
                    ignoreDrafts: document.getElementById('pulls-ignore-drafts').checked,
                    eventFilter: getCheckedValues('pr'),
                },
                issues: {
                    enabled: document.getElementById('issues-enabled').checked,
                    channelId: document.getElementById('issues-channelId').value,
                    eventFilter: getCheckedValues('issue'),
                },
                releases: {
                    enabled: document.getElementById('releases-enabled').checked,
                    channelId: document.getElementById('releases-channelId').value,
                    typeFilter: getCheckedValues('release'),
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

            if (managerRolesSelect && blacklistedRolesSelect && musicAutoplayInput && musicEmbedColorInput) {
                const selectedManagerRoles = Array.from(managerRolesSelect.selectedOptions).map(option => option.value);
                const selectedBlacklistedRoles = Array.from(blacklistedRolesSelect.selectedOptions).map(option => option.value);

                formData.musicConfig = {
                    managerRoles: selectedManagerRoles,
                    blacklistedRoles: selectedBlacklistedRoles,
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
                    headers: { 'Content-Type': 'application/json' },
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

    // Music Panel Logic
    const musicControlPanel = document.getElementById('music-control-panel');
    let currentTrackUri = null;
    let syncedLyrics = [];
    let lyricUpdateInterval = null;

    function formatDuration(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    async function fetchAndDisplayLyrics(track) {
        const lyricsContainer = document.getElementById('lyrics-container');
        if (!lyricsContainer) return;

        try {
            const trackName = encodeURIComponent(track.title);
            const artistName = encodeURIComponent(track.author);
            const res = await fetch(`https://lrclib.net/api/get?track_name=${trackName}&artist_name=${artistName}`);

            if (!res.ok) {
                 lyricsContainer.innerHTML = `<p>${i18n.t('lyrics_not_found')}</p>`;
                 return;
            }

            const data = await res.json();

            if (data.syncedLyrics) {
                syncedLyrics = data.syncedLyrics.map(line => ({
                    time: parseInt(line.timestamp, 10),
                    text: line.line
                }));
                 lyricsContainer.innerHTML = `<div class="lyrics-lines">${syncedLyrics.map(l => `<span>${l.text}</span>`).join('')}</div>`;
            } else if (data.plainLyrics) {
                syncedLyrics = [];
                lyricsContainer.innerHTML = `<p>${data.plainLyrics.replace(/\n/g, '<br>')}</p>`;
            } else {
                syncedLyrics = [];
                lyricsContainer.innerHTML = `<p>${i18n.t('lyrics_not_found')}</p>`;
            }
        } catch (error) {
            console.error('Failed to fetch lyrics:', error);
            lyricsContainer.innerHTML = `<p>${i18n.t('lyrics_error')}</p>`;
        }
    }

    function updateLyricHighlight(position) {
        if (syncedLyrics.length === 0 || !document.querySelector('.lyrics-lines')) return;

        let currentIndex = -1;
        for (let i = 0; i < syncedLyrics.length; i++) {
            if (position >= syncedLyrics[i].time) {
                currentIndex = i;
            } else {
                break;
            }
        }

        const lines = document.querySelectorAll('.lyrics-lines span');
        lines.forEach((line, index) => {
            if (index === currentIndex) {
                line.classList.add('active');
                line.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                line.classList.remove('active');
            }
        });
    }

    async function initializeMusicPanel() {
        if (!musicControlPanel) return;

        const panelContent = musicControlPanel.querySelector('.panel-content');

        async function updatePlayerStatus() {
            try {
                if (window.i18n) await window.i18n.ready;

                const res = await fetch(`/api/guilds/${guildId}/player-status`);
                const status = await res.json();

                if (!status.isPlaying) {
                    panelContent.innerHTML = `<p data-locale-key="music_control_panel_idle">${i18n.t('music_control_panel_idle')}</p>`;
                    if (lyricUpdateInterval) clearInterval(lyricUpdateInterval);
                    currentTrackUri = null;
                    if (window.applyTranslationsToDOM) window.applyTranslationsToDOM();
                    return;
                }

                const track = status.track;

                if (track.uri !== currentTrackUri) {
                    currentTrackUri = track.uri;
                    panelContent.innerHTML = `
                        <div class="music-info-container">
                            <img src="${track.artworkUrl || 'https://via.placeholder.com/150'}" alt="Album Art" class="album-art">
                            <div class="track-details">
                                <h3 class="track-title">${track.title}</h3>
                                <p class="track-author">${track.author}</p>
                                <div class="progress-bar-container">
                                    <div class="progress-bar" style="width: ${(track.position / track.duration) * 100}%"></div>
                                </div>
                                <div class="time-stamps">
                                    <span>${formatDuration(track.position)}</span>
                                    <span>${formatDuration(track.duration)}</span>
                                </div>
                                <div class="music-controls">
                                    <button id="player-pause-btn" class="player-btn" style="display: ${status.isPaused ? 'none' : 'inline-flex'}"><i class="material-icons">pause</i></button>
                                    <button id="player-resume-btn" class="player-btn" style="display: ${status.isPaused ? 'inline-flex' : 'none'}"><i class="material-icons">play_arrow</i></button>
                                    <button id="player-skip-btn" class="player-btn"><i class="material-icons">skip_next</i></button>
                                </div>
                            </div>
                        </div>
                        <div id="lyrics-container" class="lyrics-container">
                            <p>${i18n.t('lyrics_loading')}</p>
                        </div>
                        <div id="queue-container" class="queue-container">
                             <h4 data-locale-key="music_queue_title">${i18n.t('music_queue_title')}</h4>
                             <ul class="queue-list"></ul>
                        </div>
                    `;
                    renderQueue(status.queue);
                    await fetchAndDisplayLyrics(track);
                    if (lyricUpdateInterval) clearInterval(lyricUpdateInterval);
                    lyricUpdateInterval = setInterval(() => {
                         const progressBar = document.querySelector('.progress-bar');
                         const currentTimeStamp = document.querySelector('.time-stamps span:first-child');
                         if(progressBar && currentTimeStamp){
                            const currentPosition = parseFloat(progressBar.style.width) / 100 * track.duration + 1000;
                            progressBar.style.width = `${(currentPosition / track.duration) * 100}%`;
                            currentTimeStamp.textContent = formatDuration(currentPosition);
                            updateLyricHighlight(currentPosition);
                         }
                    }, 1000);
                } else {
                     const progressBar = document.querySelector('.progress-bar');
                     const currentTimeStamp = document.querySelector('.time-stamps span:first-child');
                     if(progressBar && currentTimeStamp){
                        progressBar.style.width = `${(track.position / track.duration) * 100}%`;
                        currentTimeStamp.textContent = formatDuration(track.position);
                     }
                     const pauseBtn = document.getElementById('player-pause-btn');
                     const resumeBtn = document.getElementById('player-resume-btn');
                     if(pauseBtn) pauseBtn.style.display = status.isPaused ? 'none' : 'inline-flex';
                     if(resumeBtn) resumeBtn.style.display = status.isPaused ? 'inline-flex' : 'none';
                     renderQueue(status.queue);
                }

            } catch (error) {
                console.error('Failed to update player status:', error);
                panelContent.innerHTML = `<p data-locale-key="music_control_panel_error">${i18n.t('music_control_panel_error', { error: error.message })}</p>`;
                if (window.applyTranslationsToDOM) window.applyTranslationsToDOM();
            }
        }

        panelContent.addEventListener('click', async (e) => {
            const action = e.target.closest('.player-btn')?.id.split('-')[1]; // pause, resume, skip
            if(action) {
                try {
                    await fetch(`/api/guilds/${guildId}/music/control`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action }),
                    });
                    await updatePlayerStatus();
                } catch(err) {
                     console.error(`Failed to perform action: ${action}`, err);
                }
            }
        });

        await updatePlayerStatus();
        setInterval(updatePlayerS
    function renderQueue(queue) {
        const queueList = document.querySelector('.queue-list');
        if (!queueList) return;

        if (queue.length === 0) {
            queueList.innerHTML = `<li class="queue-item">${i18n.t('music_queue_empty')}</li>`;
        } else {
            queueList.innerHTML = queue.map((track, index) => `
                <li class="queue-item">
                    <span class="queue-position">${index + 1}.</span>
                    <span class="queue-title">${track.title}</span>
                    <span class="queue-author">${track.author}</span>
                </li>
            `).join('');
        }
    }
tatus, 5000);
    }


    // Initial Load
    await fetchGuildInfo();
    await fetchRoles(); // Fetch roles before settings
    await fetchSettings();
    await initializeMusicPanel(); // Initialize the panel
    if (window.applyTranslations) {
        window.applyTranslations();
    }
});