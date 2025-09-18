window.i18n = {
    locales: {},
    t: function(key, replacements = {}) {
        let text = this.locales[key] || `Missing key: ${key}`;
        for (const placeholder in replacements) {
            const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
            text = text.replace(regex, replacements[placeholder]);
        }
        return text;
    }
};

async function fetchLocale(lang) {
    try {
        const response = await fetch(`/api/locales/${lang}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    }
}

async function fetchConfig() {
    try {
        const response = await fetch('/config.json');
        if (!response.ok) {
            console.error('Failed to fetch config.json:', response.status, response.statusText);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching config.json:', error);
        return null;
    }
}

async function applyTranslations() {
    const config = await fetchConfig();
    const selectedLang = config && config.language ? config.language : 'en';
    let loadedLocales = await fetchLocale(selectedLang) || await fetchLocale('en');

    if (!loadedLocales) {
        console.error('Could not load any language file.');
        return;
    }
    
    window.i18n.locales = loadedLocales;

    document.querySelectorAll('[data-locale-key]').forEach(element => {
        const key = element.getAttribute('data-locale-key');
        element.innerHTML = i18n.t(key);
    });

    document.querySelectorAll('[data-locale-placeholder-key]').forEach(element => {
        const key = element.getAttribute('data-locale-placeholder-key');
        element.placeholder = i18n.t(key);
    });
}

document.addEventListener('DOMContentLoaded', applyTranslations);