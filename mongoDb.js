const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

// --- Schema Definitions ---
// While Mongoose can be schemaless, defining schemas provides structure and validation.

// A schema for the global FAQ entries.
const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
});

// A flexible schema for server-specific settings.
const serverSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
}, { strict: false });


// --- One-time Data Migration ---

/**
 * Migrates FAQ data from a local JSON file to the MongoDB collection.
 * This is a one-time operation to prevent data duplication.
 * @param {import('mongoose').Connection} db - The Mongoose database connection.
 * @param {import('discord.js').Client} client - The Discord client for logging.
 */
async function migrateFaqData(db, client) {
  const FaqModel = db.model('Faq', faqSchema);
  try {
    const count = await FaqModel.countDocuments();
    if (count > 0) {
      // Data already exists, no migration needed.
      return;
    }

    const faqFilePath = path.join(process.cwd(), 'faq.json');
    const fileContent = await fs.readFile(faqFilePath, 'utf8');
    const faqData = JSON.parse(fileContent);

    if (Array.isArray(faqData) && faqData.length > 0) {
      await FaqModel.insertMany(faqData);
      console.log(client.getLocale('log_faq_migrated', { count: faqData.length }));
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(client.getLocale('log_faq_json_not_found'));
    } else {
      console.error(client.getLocale('err_faq_migration', { message: error.message }));
    }
  }
}


// --- Main Initialization Logic ---

module.exports = {
  async init({ client }) {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.warn(client.getLocale('warn_mongo_uri_missing'));
      client.db = null;
      return;
    }

    try {
      await mongoose.connect(mongoUri);
      console.log(client.getLocale('log_mongo_connected'));
      client.db = mongoose.connection;

      // Register models
      mongoose.model('Faq', faqSchema);
      mongoose.model('server-settings', serverSettingsSchema);

      // Perform one-time data migrations
      await migrateFaqData(client.db, client);

      /**
       * Gets a Mongoose model by name. This is a helper function to ensure
       * that we don't have to re-define schemas everywhere.
       * @param {string} collectionName - The name of the collection/model.
       * @returns {import('mongoose').Model} - The Mongoose model.
       */
      client.getDbCollection = (collectionName) => {
        if (!client.db) {
          console.error(client.getLocale('err_mongo_action_db_disconnected'));
          return null;
        }

        // Check if the model is already registered
        if (mongoose.models[collectionName]) {
          return mongoose.models[collectionName];
        }

        // For any other collections that might not have a strict schema yet
        const flexibleSchema = new mongoose.Schema({}, { strict: false });
        return mongoose.model(collectionName, flexibleSchema);
      };

    } catch (error) {
      console.error(client.getLocale('err_mongo_connection', { message: error.message }));
      client.db = null;
    }
  }
};