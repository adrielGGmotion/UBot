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
    const commandUsageChartCtx = document.getElementById('command-usage-chart').getContext('2d');

    // --- Fetch Guild Info (for name) ---
    async function fetchGuildInfo() {
        try {
            const res = await fetch('/api/guilds');
            if (res.status === 401) throw new Error('Unauthorized');
            const guilds = await res.json();
            const guild = guilds.find(g => g.id === guildId);
            if (guild) {
                // Use i18n for the title
                serverNameTitle.innerHTML = `<i class="material-icons">dns</i> <span>${i18n.t('dashboard_server_managing_title', { serverName: guild.name })}</span>`;
            } else {
                serverNameTitle.innerHTML = `<i class="material-icons">error</i> <span>${i18n.t('err_guild_not_found')}</span>`;
            }
        } catch (error) {
            console.error('Failed to fetch guild info:', error);
            if (error.message === 'Unauthorized') {
                window.location.href = '/login.html';
            }
        }
    }

    // --- Fetch Server Stats ---
    async function fetchServerStats() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/stats`);
            if (res.status === 401) throw new Error('Unauthorized');
            const stats = await res.json();

            // Populate Online Users
            if (onlineUsersCount) {
                onlineUsersCount.textContent = stats.onlineMembers || 'N/A';
            }

            // Populate Command Usage Chart
            if (commandUsageChartCtx && stats.commandUsage) {
                const commandLabels = Object.keys(stats.commandUsage);
                const commandCounts = Object.values(stats.commandUsage);

                new Chart(commandUsageChartCtx, {
                    type: 'doughnut',
                    data: {
                        labels: commandLabels,
                        datasets: [{
                            label: 'Command Usage',
                            data: commandCounts,
                            backgroundColor: [
                                'rgba(255, 99, 132, 0.8)',
                                'rgba(54, 162, 235, 0.8)',
                                'rgba(255, 206, 86, 0.8)',
                                'rgba(75, 192, 192, 0.8)',
                                'rgba(153, 102, 255, 0.8)',
                                'rgba(255, 159, 64, 0.8)'
                            ],
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: {
                                    color: 'var(--text-primary)'
                                }
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Failed to fetch server stats:', error);
            if (error.message === 'Unauthorized') {
                window.location.href = '/login.html';
            }
        }
    }

    // --- Initial Load ---
    await fetchGuildInfo();
    await fetchServerStats();

    // Re-apply translations if the function exists
    if (window.applyTranslations) {
        window.applyTranslations();
    }
});