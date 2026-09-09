require('dotenv').config();
const { initDB, deleteLastIdea } = require('./src/database');

async function deleteLast() {
  await initDB();
  const deleted = await deleteLastIdea();
  if (deleted) {
    console.log('✅ Last idea deleted successfully');
  } else {
    console.log('❌ No ideas found to delete');
  }
  process.exit(0);
}

deleteLast().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});