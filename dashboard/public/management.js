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

    // --- Initial Load ---
    await fetchGuildData();

    // Re-apply translations if the function exists
    if (window.applyTranslations) {
        window.applyTranslations();
    }
});