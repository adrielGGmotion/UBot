document.addEventListener('DOMContentLoaded', () => {
    const guildId = new URLSearchParams(window.location.search).get('id');

    // On pages without a guildId, we don't need to apply a custom theme.
    if (!guildId) {
        return;
    }

    /**
     * Applies the fetched colors as CSS variables to the document's root element.
     * @param {object} colors - An object containing color properties.
     */
    function applyTheme(colors) {
        if (!colors) return;

        const style = document.createElement('style');
        style.id = 'dynamic-theme-styles';
        style.innerHTML = `
:root {
    --primary-color: ${colors.primary || '#000000'};
    --accent-color: ${colors.accent1 || '#00ff00'};
    --error-color: ${colors.error || '#FF0000'};
    /* Add other color variables as needed */
}
        `;
        document.head.appendChild(style);
    }

    /**
     * Fetches the guild's settings and applies the theme.
     */
    async function fetchAndApplyTheme() {
        try {
            const response = await fetch(`/api/guilds/${guildId}/guild-settings`);
            if (!response.ok) {
                throw new Error('Failed to fetch guild settings for theming.');
            }
            const settings = await response.json();
            if (settings && settings.colors) {
                applyTheme(settings.colors);
            }
        } catch (error) {
            console.error(error);
        }
    }

    fetchAndApplyTheme();
});
