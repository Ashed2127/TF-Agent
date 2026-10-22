import { db } from 'sdk';

async function clearCategories() {
  const result = await db.run('UPDATE users SET categories = NULL');
  console.log('Cleared categories for all users:', result);
}

clearCategories();
