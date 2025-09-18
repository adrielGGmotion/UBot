const aiHandler = require('../features/aiHandler');

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    await aiHandler.processMessage(client, message);
  }
};