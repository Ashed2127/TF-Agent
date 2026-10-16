import { db } from 'sdk';
import { eq, desc, sql } from 'sdk/db';
import { ideas, pendingEdits } from '../schema.js';

export async function saveIdea(content, topic, category) {
  const [idea] = await db.insert(ideas)
    .values({ content, topic, category, status: 'pending' })
    .returning()
    .run();
  return idea.id;
}

export async function getPreviousTopics() {
  const result = await db.select({ topic: ideas.topic })
    .from(ideas)
    .where(sql`${ideas.status} IN ('posted', 'rejected')`)
    .orderBy(desc(ideas.created_at))
    .limit(20)
    .distinct()
    .all();
  return result.map(r => r.topic);
}

export async function getNextCategory() {
  const categories = ['physical', 'service', 'hybrid', 'eco', 'food', 'skills'];
  
  const result = await db.select({ category: ideas.category })
    .from(ideas)
    .orderBy(desc(ideas.created_at))
    .limit(1)
    .all();
  
  const lastIdea = result[0];
  
  if (!lastIdea) {
    return categories[0];
  }
  
  const currentIndex = categories.indexOf(lastIdea.category);
  const nextIndex = (currentIndex + 1) % categories.length;
  return categories[nextIndex];
}

export async function markPosted(id) {
  await db.update(ideas)
    .set({ status: 'posted', posted_at: sql`(unixepoch())` })
    .where(eq(ideas.id, id))
    .run();
}

export async function markRejected(id) {
  await db.update(ideas)
    .set({ status: 'rejected' })
    .where(eq(ideas.id, id))
    .run();
}

export async function getAllIdeas() {
  return await db.select()
    .from(ideas)
    .orderBy(desc(ideas.created_at))
    .all();
}

export async function getStats() {
  const result = await db.select({
    total: sql<number>`COUNT(*)`,
    posted: sql<number>`SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END)`,
    rejected: sql<number>`SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END)`,
    pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
  })
  .from(ideas)
  .all();
  
  const stats = result[0];
  
  return {
    total: stats?.total || 0,
    posted: stats?.posted || 0,
    rejected: stats?.rejected || 0,
    pending: stats?.pending || 0,
  };
}

export async function getIdeaById(id) {
  const result = await db.select()
    .from(ideas)
    .where(eq(ideas.id, id))
    .limit(1)
    .all();
  return result[0] || null;
}

export async function deleteLastIdea() {
  const result = await db.select()
    .from(ideas)
    .orderBy(desc(ideas.created_at))
    .limit(1)
    .all();
  
  const lastIdea = result[0];
  
  if (lastIdea) {
    await db.delete(ideas)
      .where(eq(ideas.id, lastIdea.id))
      .run();
    return true;
  }
  return false;
}

// Pending edit helpers — store edited news text in the DB
// so it doesn't need to fit in callback_data (64-byte limit)

export async function savePendingEdit(userId, text) {
  // Delete any existing pending edit for this user first
  await db.delete(pendingEdits)
    .where(eq(pendingEdits.user_id, userId))
    .run();
  const [edit] = await db.insert(pendingEdits)
    .values({ user_id: userId, text })
    .returning()
    .run();
  return edit.id;
}

export async function getPendingEdit(userId) {
  const result = await db.select()
    .from(pendingEdits)
    .where(eq(pendingEdits.user_id, userId))
    .orderBy(desc(pendingEdits.created_at))
    .limit(1)
    .all();
  return result[0] || null;
}

export async function deletePendingEdit(userId) {
  await db.delete(pendingEdits)
    .where(eq(pendingEdits.user_id, userId))
    .run();
}
