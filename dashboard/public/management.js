document.addEventListener('DOMContentLoaded', async () => {
    // A robust function to wait for the i18n library to be ready.
    async function waitForI18n() {
        while (!window.i18n || !window.i18n.ready) {
            // Poll every 50ms until the i18n object and its ready promise are available.
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return window.i18n.ready;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('id');

    if (!guildId) {
        window.location.href = '/index.html';
        return;
    }

    // Wait for translations to be ready before executing any other logic.
    await waitForI18n();

    // --- DOM Elements ---
    const serverNameTitle = document.getElementById('server-name-title');
    const onlineUsersCount = document.getElementById('online-users-count');
    const serverLogoContainer = document.getElementById('server-logo-container');
    const leaveServerBtn = document.getElementById('leave-server-btn');

    // --- Fetch Guild Data (Info & Stats) ---
    async function fetchGuildData() {
        try {
            // Fetch basic guild info (for name and icon)
            const guildInfoRes = await fetch('/api/guilds');
            if (guildInfoRes.status === 401) throw new Error('Unauthorized');
            const guilds = await guildInfoRes.json();
            const guild = guilds.find(g => g.id === guildId);

            if (guild) {
                serverNameTitle.textContent = i18n.t('dashboard_server_managing_title', { serverName: guild.name });

                // Handle Server Logo
                if (guild.icon) {
                    const iconUrl = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
                    serverLogoContainer.innerHTML = `<img src="${iconUrl}" alt="${guild.name} Logo" class="server-logo">`;
                } else {
                    serverLogoContainer.innerHTML = `<div class="server-logo-placeholder">${guild.name.charAt(0)}</div>`;
                }
            } else {
                serverNameTitle.textContent = i18n.t('err_guild_not_found');
            }

            // Fetch guild stats (for online members)
            const statsRes = await fetch(`/api/guilds/${guildId}/stats`);
            if (statsRes.status === 401) throw new Error('Unauthorized');
            const stats = await statsRes.json();

            if (onlineUsersCount) {
                onlineUsersCount.textContent = stats.onlineMembers || 'N/A';
            }

        } catch (error) {
            console.error('Failed to fetch guild data:', error);
            if (error.message === 'Unauthorized') {
                window.location.href = '/login.html';
            }
        }
    }

    // --- Event Listeners ---
    if (leaveServerBtn) {
        leaveServerBtn.addEventListener('click', async () => {
            const confirmationText = i18n.t('server_actions_leave_confirm');
            if (confirm(confirmationText)) {
                try {
                    const res = await fetch(`/api/guilds/${guildId}/leave`, {
                        method: 'POST',
                    });

                    if (res.ok) {
                        // Redirect to the dashboard index on successful leave
                        window.location.href = '/index.html';
                    } else {
                        const errorData = await res.json();
                        alert(i18n.t('server_actions_leave_error', { error: errorData.message || 'Unknown error' }));
                    }
                } catch (error) {
                    console.error('Error leaving server:', error);
                    alert(i18n.t('server_actions_leave_error', { error: error.message }));
                }
            }
        });
    }

    // --- Fetch Recent Logs ---
    async function fetchRecentLogs() {
        const logsContainer = document.getElementById('logs-container');
        if (!logsContainer) return;

        try {
            const res = await fetch(`/api/guilds/${guildId}/logs?limit=5`);
            if (!res.ok) throw new Error('Failed to fetch logs');
            const data = await res.json();

            if (data.logs && data.logs.length > 0) {
                logsContainer.innerHTML = data.logs.map(log => `
                    <div class="log-item">
                        <span class="log-level ${log.level.toLowerCase()}">${log.level}</span>
                        <span class="log-message">${log.message}</span>
                        <span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                `).join('');
            } else {
                logsContainer.innerHTML = `<p class="no-logs">${i18n.t('server_activity_no_logs')}</p>`;
            }
        } catch (error) {
            console.error('Failed to fetch recent logs:', error);
            logsContainer.innerHTML = `<p class="no-logs error">${i18n.t('server_activity_fetch_error')}</p>`;
        }
    }

    // --- Logs Modal Logic ---
    const logsModal = document.getElementById('logs-modal');
    const seeMoreLogsBtn = document.getElementById('see-more-logs-btn');
    const closeModalBtn = logsModal.querySelector('.close-btn');
    const logLevelFilter = document.getElementById('log-level-filter');
    const logPeriodFilter = document.getElementById('log-period-filter');
    const modalLogsContainer = document.getElementById('modal-logs-container');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');

    let currentPage = 1;
    let totalPages = 1;

    async function fetchDetailedLogs() {
        const level = logLevelFilter.value;
        const period = logPeriodFilter.value;
        try {
            const res = await fetch(`/api/guilds/${guildId}/logs?limit=10&page=${currentPage}&level=${level}&period=${period}`);
            if (!res.ok) throw new Error('Failed to fetch detailed logs');
            const data = await res.json();

            modalLogsContainer.innerHTML = data.logs.map(log => `
                <div class="log-item">
                    <span class="log-level ${log.level.toLowerCase()}">${log.level}</span>
                    <span class="log-message">${log.message}</span>
                    <span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>
                </div>
            `).join('');

            currentPage = data.currentPage;
            totalPages = data.totalPages;
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            prevPageBtn.disabled = currentPage === 1;
            nextPageBtn.disabled = currentPage === totalPages;

        } catch (error) {
            console.error('Failed to fetch detailed logs:', error);
            modalLogsContainer.innerHTML = `<p class="no-logs error">${i18n.t('server_activity_fetch_error')}</p>`;
        }
    }

    seeMoreLogsBtn.onclick = () => {
        logsModal.style.display = 'block';
        fetchDetailedLogs();
    };
    closeModalBtn.onclick = () => logsModal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target == logsModal) {
            logsModal.style.display = 'none';
        }
    };

    logLevelFilter.onchange = fetchDetailedLogs;
    logPeriodFilter.onchange = fetchDetailedLogs;
    prevPageBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            fetchDetailedLogs();
        }
    };
    nextPageBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchDetailedLogs();
        }
    };

    // --- Initial Load ---
    await Promise.all([
        fetchGuildData(),
        fetchRecentLogs()
    ]);

    // Re-apply translations if the function exists
    if (window.applyTranslations) {
        window.applyTranslations();
    }
});