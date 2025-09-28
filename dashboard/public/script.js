document.addEventListener('DOMContentLoaded', () => {
    
    function getElement(id, critical = true) {
        const element = document.getElementById(id);
        if (!element && critical) {
            throw new Error(i18n.t('err_critical_element_not_found', {id: id}));
        }
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
            window.location.href = '/login.html';
            return true;
        }
        return false;
    }

    const botNameElement = getElement('bot-name');
    const guildCountElement = getElement('guild-count');
    const totalCommandsElement = getElement('total-commands');
    const guildsListElement = getElement('guilds-list');
    const chartCanvas = getElement('command-chart', false)?.getContext('2d');
    let commandChart = null;

    const botStatusElement = getElement('bot-status', false);
    const botUptimeElement = getElement('bot-uptime', false);
    const botLatencyElement = getElement('bot-latency', false);

    async function fetchInfoAndTheme() {
        try {
            const token = localStorage.getItem('dashboard-token');
            const response = await fetch('/api/info', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (handleAuthError(response)) return;
            if (!response.ok) throw new Error(i18n.t('err_api_info_response_not_ok'));
            const data = await response.json();

            botNameElement.textContent = data.bot.tag || i18n.t('dashboard_bot_status_offline');
            guildCountElement.textContent = data.guilds;

            // Bot status widget
            if (botStatusElement) {
                botStatusElement.textContent = data.bot.online ? i18n.t('dashboard_bot_status_online') : i18n.t('dashboard_bot_status_offline');
                botStatusElement.style.color = data.bot.online ? '#4ade80' : '#f87171';
            }
            if (botUptimeElement) {
                botUptimeElement.textContent = `${i18n.t('dashboard_bot_status_uptime')}: ${data.bot.uptime || '-'}`;
            }
            if (botLatencyElement) {
                botLatencyElement.textContent = `${i18n.t('dashboard_bot_status_latency')}: ${data.bot.latency !== undefined ? data.bot.latency + 'ms' : '-'}`;
            }

            const primaryColor = data.colors.primary || '#0d1117';
            const accentColor = data.colors.accent1 || '#9900FF';
            document.documentElement.style.setProperty('--bg', primaryColor);
            document.documentElement.style.setProperty('--panel', accentColor ? `rgba(${hexToRgb(accentColor)}, 0.1)` : '#161b22');
            document.documentElement.style.setProperty('--accent', accentColor);
            document.documentElement.style.setProperty('--accent-rgb', hexToRgb(accentColor));
        } catch (error) {
            console.error(i18n.t('err_fetch_bot_info_failed'), error);
            botNameElement.textContent = i18n.t('err_connection_error');
            if (botStatusElement) {
                botStatusElement.textContent = i18n.t('status_disconnected');
                botStatusElement.style.color = '#f87171';
            }
        }
    }

    async function fetchGuilds() {
        try {
            const token = localStorage.getItem('dashboard-token');
            const response = await fetch('/api/guilds', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (handleAuthError(response)) return;
            if (!response.ok) throw new Error(i18n.t('err_api_guilds_response_not_ok'));
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
            console.error(i18n.t('err_fetch_guilds_failed'), error);
            if (guildsListElement) guildsListElement.innerHTML = `<p>${i18n.t('dashboard_error_loading_servers')}</p>`;
        }
    }

    async function fetchStats() {
        try {
            const token = localStorage.getItem('dashboard-token');
            const response = await fetch('/api/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401) {
                localStorage.removeItem('dashboard-token');
                window.location.href = '/login.html';
                return;
            }

            if (!response.ok) throw new Error('Stats API response not OK');

            const data = await response.json();
            displayStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }

    function displayStats(stats) {
        const totalCommandsElement = document.getElementById('total-commands');
        if (totalCommandsElement && stats.totalCommands !== undefined) {
            totalCommandsElement.textContent = stats.totalCommands;
        }

        const commandUsage = stats.commandUsage || [];
        if (commandUsage.length > 0 && window.Chart) {
            const ctx = document.getElementById('command-chart').getContext('2d');
            if (ctx.chart) {
                ctx.chart.destroy();
            }

            const labels = commandUsage.map(item => item.commandName);
            const data = commandUsage.map(item => item.count);

            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
            const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: i18n.t('dashboard_command_usage_chart'),
                        data: data,
                        backgroundColor: `rgba(${accentRgb}, 0.2)`,
                        borderColor: accentColor,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
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
            profileStatus.style.color = 'var(--muted)';
            try {
                const token = localStorage.getItem('dashboard-token');
                const response = await fetch('/api/bot/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ username: username || null, avatar: avatar || null }),
                });
                if (handleAuthError(response)) return;
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || i18n.t('err_unknown'));
                profileStatus.textContent = i18n.t('dashboard_profile_success');
                profileStatus.style.color = '#4ade80';
            } catch (error) {
                profileStatus.textContent = `${i18n.t('dashboard_profile_error')}: ${error.message}`;
                profileStatus.style.color = '#f87171';
            }
            setTimeout(() => { profileStatus.textContent = ''; }, 5000);
        });
    }
    
    fetchInfoAndTheme();
    fetchGuilds();
    fetchStats();
});