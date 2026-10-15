const { bot } = require('../src/bot-webhook');

module.exports = async (req, res) => {
  try {
    // Handle Telegram webhook updates
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
};
