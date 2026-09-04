const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'tf-agent.db');
let db;

function initDB() {
  db = new Database(dbPath);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      topic TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      posted_at DATETIME
    )
  `);
  
  console.log('✅ Database initialized');
}

function saveIdea(content, topic, category) {
  const stmt = db.prepare(`
    INSERT INTO ideas (content, topic, category, status)
    VALUES (?, ?, ?, 'pending')
  `);
  const result = stmt.run(content, topic, category);
  return result.lastInsertRowid;
}

function getPreviousTopics() {
  const stmt = db.prepare(`
    SELECT DISTINCT topic FROM ideas 
    WHERE status IN ('posted', 'rejected')
    ORDER BY created_at DESC
    LIMIT 20
  `);
  const rows = stmt.all();
  return rows.map(row => row.topic);
}

function getNextCategory() {
  const categories = ['physical', 'service', 'digital', 'eco', 'food', 'skills'];
  
  const stmt = db.prepare(`
    SELECT category FROM ideas 
    ORDER BY created_at DESC 
    LIMIT 1
  `);
  const lastIdea = stmt.get();
  
  if (!lastIdea) {
    return categories[0];
  }
  
  const currentIndex = categories.indexOf(lastIdea.category);
  const nextIndex = (currentIndex + 1) % categories.length;
  return categories[nextIndex];
}

function markPosted(id) {
  const stmt = db.prepare(`
    UPDATE ideas 
    SET status = 'posted', posted_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  stmt.run(id);
}

function markRejected(id) {
  const stmt = db.prepare(`
    UPDATE ideas 
    SET status = 'rejected' 
    WHERE id = ?
  `);
  stmt.run(id);
}

function getAllIdeas() {
  const stmt = db.prepare(`
    SELECT * FROM ideas 
    ORDER BY created_at DESC
  `);
  return stmt.all();
}

function getStats() {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END) as posted,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM ideas
  `);
  return stmt.get();
}

function getIdeaById(id) {
  const stmt = db.prepare(`
    SELECT * FROM ideas WHERE id = ?
  `);
  return stmt.get(id);
}

module.exports = {
  initDB,
  saveIdea,
  getPreviousTopics,
  getNextCategory,
  markPosted,
  markRejected,
  getAllIdeas,
  getStats,
  getIdeaById
};
