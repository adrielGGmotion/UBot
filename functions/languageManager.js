const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  client.locales = new Map();

  const loadLocales = () => {
    const langDir = path.join(process.cwd(), 'languages');
    if (!fs.existsSync(langDir)) {
      console.error('Language directory not found!');
      return;
    }

    const langFiles = fs.readdirSync(langDir).filter(file => file.endsWith('.json'));
    for (const file of langFiles) {
      const langName = file.split('.')[0];
      const langContent = JSON.parse(fs.readFileSync(path.join(langDir, file), 'utf8'));
      client.locales.set(langName, langContent);
    }
  };

  loadLocales();

  client.getLocale = (key, replacements = {}) => {
    const lang = client.config.language || 'en';
    const locales = client.locales.get(lang) || client.locales.get('en');
    if (!locales || !locales[key]) {
      return `Missing locale key: ${key}`;
    }

    let locale = locales[key];
    for (const placeholder in replacements) {
      const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
      locale = locale.replace(regex, replacements[placeholder]);
    }
    return locale;
  };
};