window.i18n = {
    ready: new Promise(resolve => {
        window.i18n_resolve = resolve;
    }),
    locales: {},
    t: function(key, replacements = {}) {
        let text = this.locales[key] || `Missing key: ${key}`;
        if (!this.locales[key]) {
            console.warn(`Translation key not found: ${key}`);
        }
        for (const placeholder in replacements) {
            const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
            text = text.replace(regex, replacements[placeholder]);
        }
        return text;
    }
};

function applyTranslationsToDOM() {
    console.log("--- applyTranslationsToDOM called ---");
    const elements = document.querySelectorAll('[data-locale-key]');
    console.log(`Found ${elements.length} elements to translate.`);
    console.log("Current i18n.locales state:", window.i18n.locales);

    elements.forEach(element => {
        const key = element.getAttribute('data-locale-key');
        element.innerHTML = i18n.t(key);
    });

    document.querySelectorAll('[data-locale-placeholder-key]').forEach(element => {
        const key = element.getAttribute('data-locale-placeholder-key');
        element.placeholder = i18n.t(key);
    });
    console.log("--- applyTranslationsToDOM finished ---");
}
window.applyTranslationsToDOM = applyTranslationsToDOM;

async function initializeTranslations() {
    console.log("--- initializeTranslations started ---");
    let selectedLang = 'en'; // Default language

    let loadedLocales = null;
    try {
        console.log(`Fetching locales for language: ${selectedLang}`);
        const localeResponse = await fetch(`/api/dashboard/locales/${selectedLang}`);
        if (localeResponse.ok) {
            loadedLocales = await localeResponse.json();
            console.log("Successfully fetched and parsed locales.");
        } else {
            console.warn(`Failed to fetch ${selectedLang}, falling back to 'en'.`);
            const fallbackResponse = await fetch(`/api/dashboard/locales/en`);
            if (fallbackResponse.ok) {
                loadedLocales = await fallbackResponse.json();
                console.log("Successfully fetched and parsed fallback 'en' locales.");
            }
        }
    } catch (e) {
        console.error("Could not fetch any language file.", e);
    }

    if (!loadedLocales) {
        console.error('Translation system failed to initialize.');
        window.i18n_resolve();
        return;
    }

    window.i18n.locales = loadedLocales;
    console.log("Assigned locales to window.i18n.locales.");

    // Apply translations for the first time
    applyTranslationsToDOM();

    // Signal that translations are ready.
    console.log("--- initializeTranslations finished, resolving ready promise. ---");
    window.i18n_resolve();
}

document.addEventListener('DOMContentLoaded', initializeTranslations);