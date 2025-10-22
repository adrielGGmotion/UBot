// Wait for the i18n to be ready before executing any logic
document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n) {
        await window.i18n.ready;
    }

    function getElement(id, critical = true) {
        const element = document.getElementById(id);
        if (!element && critical) {
            // Use a simple error message as i18n might not be available
            const errorMsg = `Critical element not found: #${id}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        return element;
    }

    function hexToRgb(hex) {
        if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) return '0, 255, 0';
        let c = hex.substring(1).split('');
        if (c.length === 3) { c = [c[0], c[0], c[1], c[1], c[2], c[2]]; }
        c = '0x' + c.join('');
        return `${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}`;
    }

    function handleAuthError(response) {
        if (response.status === 401) {
            // The token is now a secure httpOnly cookie. Client-side JS cannot remove it.
            // Just redirect to login. The server will handle auth status.
            window.location.href = '/login.html';
            return true;
        }
        return false;
    }

    async function fetchInfoAndTheme() {
        try {
            // The browser will automatically send the httpOnly cookie.
            const response = await fetch('/api/info');
            if (handleAuthError(response)) return;

            const data = await response.json();

            const botNameElement = getElement('bot-name', false);
            const guildCountElement = getElement('guild-count', false);
            const botStatusElement = getElement('bot-status', false);
            const botUptimeElement = getElement('bot-uptime', false);
            const botLatencyElement = getElement('bot-latency', false);

            if (botNameElement) botNameElement.textContent = data.bot.tag || i18n.t('dashboard_bot_status_offline');
            if (guildCountElement) guildCountElement.textContent = data.guilds;

            if (botStatusElement) {
                botStatusElement.textContent = data.bot.online ? i18n.t('dashboard_bot_status_online') : i18n.t('dashboard_bot_status_offline');
            }
            if (botUptimeElement) botUptimeElement.textContent = data.bot.uptime || '-';
            if (botLatencyElement) botLatencyElement.textContent = `${data.bot.latency !== undefined ? data.bot.latency : '-'}ms`;

        } catch (error) {
            console.error("Failed to fetch bot info:", error);
        }
    }

    async function fetchGuilds() {
        const guildsListElement = getElement('guilds-list', false);
        if (!guildsListElement) return;

        try {
            const response = await fetch('/api/guilds');
            if (handleAuthError(response)) return;
            const guilds = await response.json();

            guildsListElement.innerHTML = '';
            guilds.forEach(guild => {
                const guildItem = document.createElement('a');
                guildItem.href = `/server.html?id=${guild.id}`;
                guildItem.className = 'guild-item';
                const icon = guild.icon ? `<img src="${guild.icon}" alt="${i18n.t('dashboard_guild_icon_alt', { guildName: guild.name })}">` : `<div class="guild-icon-placeholder">${guild.name.charAt(0)}</div>`;
                guildItem.innerHTML = `${icon}<span>${guild.name}</span>`;
                guildsListElement.appendChild(guildItem);
            });
        } catch (error) {
            console.error("Failed to fetch guilds:", error);
            guildsListElement.innerHTML = `<p>${i18n.t('dashboard_error_loading_servers')}</p>`;
        }
    }

    async function fetchStats() {
        const totalCommandsElement = getElement('total-commands', false);
        const chartCanvas = getElement('command-chart', false)?.getContext('2d');
        if (!totalCommandsElement && !chartCanvas) return;

        try {
            const response = await fetch('/api/stats');
            if (handleAuthError(response)) return;
            const stats = await response.json();

            if (totalCommandsElement) totalCommandsElement.textContent = stats.totalCommands;

            if (chartCanvas && stats.commandUsage) {
                const labels = stats.commandUsage.map(cmd => cmd.commandName);
                const data = stats.commandUsage.map(cmd => cmd.count);

                const style = getComputedStyle(document.documentElement);
                const accentColor = style.getPropertyValue('--accent').trim();
                const panelColor = style.getPropertyValue('--panel').trim();
                const textColor = style.getPropertyValue('--text-primary').trim();
                const borderColor = style.getPropertyValue('--border-color').trim();

                new Chart(chartCanvas, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: i18n.t('dashboard_stats_command_usage'),
                            data,
                            backgroundColor: accentColor,
                            borderColor: accentColor,
                            borderWidth: 1,
                            hoverBackgroundColor: panelColor,
                            hoverBorderColor: accentColor,
                            borderRadius: 6,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: textColor,
                                    precision: 0
                                },
                                grid: {
                                    color: borderColor
                                }
                            },
                            x: {
                                ticks: {
                                    color: textColor
                                },
                                grid: {
                                    display: false
                                }
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }

    const profileForm = getElement('profile-form', false);
    if (profileForm) {
        profileForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const profileStatus = getElement('profile-status');
            const username = getElement('username').value;
            const avatar = getElement('avatar').value;
            profileStatus.textContent = i18n.t('dashboard_profile_saving');
            try {
                const response = await fetch('/api/bot/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username || null, avatar: avatar || null }),
                });
                if (handleAuthError(response)) return;
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                profileStatus.textContent = i18n.t('dashboard_profile_success');
            } catch (error) {
                profileStatus.textContent = `${i18n.t('dashboard_profile_error')}: ${error.message}`;
            }
            setTimeout(() => { profileStatus.textContent = ''; }, 5000);
        });
    }

    // --- Log Viewer ---
    const logsModal = getElement('logs-modal', false);
    const seeMoreLogsBtn = getElement('see-more-logs-btn', false);
    const closeModalBtn = logsModal ? logsModal.querySelector('.close-btn') : null;
    const logLevelFilter = getElement('log-level-filter', false);
    const logPeriodFilter = getElement('log-period-filter', false);

    let currentLogPage = 1;
    let currentLogLevel = '';
    let currentLogPeriod = '';

    const formatTimestamp = (isoString) => {
        const date = new Date(isoString);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    };

    const renderLogs = (logs, container) => {
        container.innerHTML = logs.length ? '' : `<p>${i18n.t('dashboard_log_no_logs')}</p>`;
        logs.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry log-level-${log.level.toLowerCase()}`;
            logEntry.innerHTML = `
                <span class="log-timestamp">${formatTimestamp(log.timestamp)}</span>
                <span class="log-level">${log.level}</span>
                <span class="log-message">${log.message}</span>
                ${log.user ? `<span class="log-user" title="User ID: ${log.user.id}">${log.user.tag}</span>` : ''}
            `;
            container.appendChild(logEntry);
        });
    };

    const renderPagination = (totalPages, currentPage, container) => {
        container.innerHTML = '';
        if (totalPages <= 1) return;

        // Previous Button
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '<<';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            currentLogPage--;
            fetchLogsForModal();
        });
        container.appendChild(prevBtn);

        // Page Info
        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        container.appendChild(pageInfo);

        // Next Button
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '>>';
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.addEventListener('click', () => {
            currentLogPage++;
            fetchLogsForModal();
        });
        container.appendChild(nextBtn);
    };

    async function fetchRecentLogs() {
        const logsList = getElement('logs-list', false);
        if (!logsList) return;

        try {
            // Fetch the last 5 logs for the first guild in the list (or a default)
            // This is a simplification; in a real multi-server dash, you'd select a guild.
            // For this project, we assume a single-server context for the main page logs.
            const guildsResponse = await fetch('/api/guilds');
            if (handleAuthError(guildsResponse)) return;
            const guilds = await guildsResponse.json();
            if (!guilds.length) return;
            const guildId = guilds[0].id;

            const response = await fetch(`/api/guilds/${guildId}/logs?page=1&limit=5`);
            if (handleAuthError(response)) return;
            const data = await response.json();
            renderLogs(data.logs, logsList);
        } catch (error) {
            console.error('Failed to fetch recent logs:', error);
            logsList.innerHTML = `<p>${i18n.t('dashboard_log_fetch_error')}</p>`;
        }
    }

    async function fetchLogsForModal() {
        const modalLogsList = getElement('modal-logs-list', false);
        const paginationContainer = getElement('log-pagination-controls', false);
        if (!modalLogsList) return;

        try {
            const guildsResponse = await fetch('/api/guilds');
            if (handleAuthError(guildsResponse)) return;
            const guilds = await guildsResponse.json();
            if (!guilds.length) return;
            const guildId = guilds[0].id;

            const response = await fetch(`/api/guilds/${guildId}/logs?level=${currentLogLevel}&period=${currentLogPeriod}&page=${currentLogPage}&limit=20`);
            if (handleAuthError(response)) return;
            const data = await response.json();

            renderLogs(data.logs, modalLogsList);
            renderPagination(data.totalPages, data.currentPage, paginationContainer);
        } catch (error) {
            console.error('Failed to fetch modal logs:', error);
            modalLogsList.innerHTML = `<p>${i18n.t('dashboard_log_fetch_error')}</p>`;
        }
    }

    if (seeMoreLogsBtn) {
        seeMoreLogsBtn.addEventListener('click', () => {
            currentLogPage = 1;
            fetchLogsForModal();
            logsModal.style.display = 'block';
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            logsModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target === logsModal) {
            logsModal.style.display = 'none';
        }
    });

    if (logLevelFilter) {
        logLevelFilter.addEventListener('change', () => {
            currentLogLevel = logLevelFilter.value;
            currentLogPage = 1;
            fetchLogsForModal();
        });
    }

    if (logPeriodFilter) {
        logPeriodFilter.addEventListener('change', () => {
            currentLogPeriod = logPeriodFilter.value;
            currentLogPage = 1;
            fetchLogsForModal();
        });
    }

    // --- WebSocket Connection ---
    const socket = io();

    socket.on('new_log', (log) => {
        const logsList = getElement('logs-list', false);
        if (logsList) {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry log-level-${log.level.toLowerCase()}`;
            logEntry.innerHTML = `
                <span class="log-timestamp">${formatTimestamp(log.timestamp)}</span>
                <span class="log-level">${log.level}</span>
                <span class="log-message">${log.message}</span>
                ${log.user ? `<span class="log-user" title="User ID: ${log.user.id}">${log.user.tag}</span>` : ''}
            `;
            logsList.prepend(logEntry);

            // Keep the list tidy by removing the oldest log entry if it exceeds a certain number
            if (logsList.children.length > 10) {
                logsList.lastChild.remove();
            }
        }
    });

    // Execute all fetch operations
    fetchInfoAndTheme();
    fetchGuilds();
    fetchStats();
    fetchRecentLogs();
});