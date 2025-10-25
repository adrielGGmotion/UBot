document.addEventListener('DOMContentLoaded', () => {
    const guildId = new URLSearchParams(window.location.search).get('id');
    if (!guildId) {
        console.error('No guild ID found in URL.');
        return;
    }

    const primaryColorPicker = document.getElementById('primary-color-picker');
    const primaryColorText = document.getElementById('primary-color-text');
    const accentColorPicker = document.getElementById('accent-color-picker');
    const accentColorText = document.getElementById('accent-color-text');
    const errorColorPicker = document.getElementById('error-color-picker');
    const errorColorText = document.getElementById('error-color-text');
    const saveButton = document.getElementById('save-appearance');

    function syncColorInputs(picker, text, cssVariable) {
        picker.addEventListener('input', () => {
            text.value = picker.value;
            document.documentElement.style.setProperty(cssVariable, picker.value);
        });
        text.addEventListener('input', () => {
            picker.value = text.value;
            document.documentElement.style.setProperty(cssVariable, text.value);
        });
    }

    syncColorInputs(primaryColorPicker, primaryColorText, '--primary-color');
    syncColorInputs(accentColorPicker, accentColorText, '--accent-color');
    syncColorInputs(errorColorPicker, errorColorText, '--error-color');

    async function fetchSettings() {
        try {
            const response = await fetch(`/api/guilds/${guildId}/guild-settings`);
            if (!response.ok) throw new Error('Failed to fetch settings');
            const settings = await response.json();

            if (settings.colors) {
                primaryColorPicker.value = settings.colors.primary || '#000000';
                primaryColorText.value = settings.colors.primary || '#000000';
                accentColorPicker.value = settings.colors.accent1 || '#00ff00';
                accentColorText.value = settings.colors.accent1 || '#00ff00';
                errorColorPicker.value = settings.colors.error || '#FF0000';
                errorColorText.value = settings.colors.error || '#FF0000';
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    }

    async function saveSettings() {
        const settings = {
            colors: {
                primary: primaryColorText.value,
                accent1: accentColorText.value,
                error: errorColorText.value,
            }
        };

        try {
            const response = await fetch(`/api/guilds/${guildId}/guild-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (!response.ok) throw new Error('Failed to save settings');

            // Add user feedback (e.g., a toast notification)
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Failed to save settings.');
        }
    }

    saveButton.addEventListener('click', saveSettings);

    fetchSettings();
});
