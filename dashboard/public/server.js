document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('id');
    if (!guildId) {
        window.location.href = '/index.html';
        return;
    }

    if (window.i18n) {
        await window.i18n.ready;
    }

    const serverNameTitle = document.getElementById('server-name-title');

    async function initializePage() {
        try {
            const token = localStorage.getItem('dashboard-token');
            if (!token) {
                window.location.href = '/login.html';
                return;
            }

            const guildsRes = await fetch('/api/guilds', { headers: { 'Authorization': `Bearer ${token}` } });

            if (guildsRes.status === 401) {
                 localStorage.removeItem('dashboard-token');
                 window.location.href = '/login.html';
                 return;
            }
            if (!guildsRes.ok) {
                throw new Error('Failed to fetch guilds');
            }

            const guildsData = await guildsRes.json();
            const currentGuild = guildsData.find(g => g.id === guildId);

            if (currentGuild) {
                serverNameTitle.innerHTML = `<i class="material-icons">dns</i> <span>${i18n.t('dashboard_server_managing_title', { serverName: currentGuild.name })}</span>`;
            } else {
                 serverNameTitle.innerHTML = `<i class="material-icons">error</i> <span>${i18n.t('err_guild_not_found', { guildId: guildId })}</span>`;
            }

            if(window.applyTranslations) window.applyTranslations();

        } catch (error) {
            console.error("Erro na inicialização:", error);
            serverNameTitle.innerHTML = `<i class="material-icons">error</i> <span>${i18n.t('dashboard_server_error_loading')}</span>`;
        }
    }

    initializePage();
});