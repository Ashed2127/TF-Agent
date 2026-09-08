require('dotenv').config();
const express = require('express');
const { initDB, getAllIdeas, getStats } = require('./src/database');
const { bot } = require('./src/bot');

const app = express();
const PORT = process.env.PORT || 3000;

initDB();

bot.launch();

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});

app.get('/api/ideas', (req, res) => {
  try {
    const ideas = getAllIdeas();
    res.json(ideas);
  } catch (error) {
    console.error('Error fetching ideas:', error);
    res.status(500).json({ error: 'Failed to fetch ideas' });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 TF Agent running on port ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
