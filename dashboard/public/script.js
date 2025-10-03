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

    // Execute all fetch operations
    fetchInfoAndTheme();
    fetchGuilds();
    fetchStats();
});