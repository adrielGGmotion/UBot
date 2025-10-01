// Create a global promise that resolves when translations are ready.
window.i18n = {
    ready: new Promise(resolve => {
        window.i18n_resolve = resolve;
    }),
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

async function applyTranslations() {
    let selectedLang = 'en'; // Default language
    try {
        const configResponse = await fetch('/config.json');
        if (configResponse.ok) {
            const config = await configResponse.json();
            if (config && config.language) {
                selectedLang = config.language;
            }
        }
    } catch (e) {
        console.error("Could not fetch config.json, defaulting to 'en'.", e);
    }

    let loadedLocales = null;
    try {
        const localeResponse = await fetch(`/api/locales/${selectedLang}`);
        if (localeResponse.ok) {
            loadedLocales = await localeResponse.json();
        } else {
            // Fallback to English if the selected language is not found
            const fallbackResponse = await fetch(`/api/locales/en`);
            if (fallbackResponse.ok) {
                loadedLocales = await fallbackResponse.json();
            }
        }
    } catch (e) {
        console.error("Could not fetch any language file.", e);
    }

    if (!loadedLocales) {
        console.error('Translation system failed to initialize.');
        window.i18n_resolve(); // Resolve the promise anyway to not block other scripts
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

    // Signal that translations are ready.
    window.i18n_resolve();
}

// Apply translations as soon as the DOM is ready.
document.addEventListener('DOMContentLoaded', applyTranslations);