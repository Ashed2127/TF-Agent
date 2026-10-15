require('dotenv').config();
const express = require('express');
const { initDB, getAllIdeas, getStats } = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDB();

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});

app.get('/api/ideas', async (req, res) => {
  try {
    const ideas = await getAllIdeas();
    res.json(ideas);
  } catch (error) {
    console.error('Error fetching ideas:', error);
    res.status(500).json({ error: 'Failed to fetch ideas' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// For local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 TF Agent running on port ${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
