const mongoose = require('mongoose');

module.exports = {
  async init({ client }) {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.warn(client.getLocale('warn_mongo_uri_missing'));
      client.db = false;
      return;
    }

    try {
      await mongoose.connect(mongoUri);
      console.log(client.getLocale('log_mongo_connected'));
      client.db = mongoose.connection;

      client.getDbCollection = (collectionName) => {
        if (!client.db) {
          console.error(client.getLocale('err_mongo_action_db_disconnected'));
          return null;
        }

        if (mongoose.models[collectionName]) {
          return mongoose.models[collectionName];
        }

        const flexibleSchema = new mongoose.Schema({}, { strict: false });
        return mongoose.model(collectionName, flexibleSchema);
      };

    } catch (error) {
      console.error(client.getLocale('err_mongo_connection', { message: error.message }));
      client.db = false;
    }
  }
};