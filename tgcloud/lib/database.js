import { db } from 'sdk';
import { eq, desc, sql, and } from 'sdk/db';
import { ideas, pendingEdits, users, customSources, posts, userChannels } from '../schema.js';

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

export async function savePendingEdit(userId, text, imageUrl = null) {
  // Delete any existing pending edit for this user first
  await db.delete(pendingEdits)
    .where(eq(pendingEdits.user_id, userId))
    .run();
  const [edit] = await db.insert(pendingEdits)
    .values({ user_id: userId, text, image_url: imageUrl || null })
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

// User management functions

export async function getOrCreateUser(telegramId, username = null) {
  const existing = await db.select()
    .from(users)
    .where(eq(users.telegram_id, telegramId))
    .limit(1)
    .all();

  if (existing.length > 0) {
    return existing[0];
  }

  const [user] = await db.insert(users)
    .values({
      telegram_id: telegramId,
      username: username,
      user_type: 'guest',
      onboarding_step: 'join_channel'
    })
    .returning()
    .run();
  return user;
}

export async function updateUserType(telegramId, userType) {
  await db.update(users)
    .set({ user_type: userType })
    .where(eq(users.telegram_id, telegramId))
    .run();
}

export async function updateUserOnboardingStep(telegramId, step) {
  if (step === 'completed') {
    await db.update(users)
      .set({
        onboarding_step: step,
        completed_at: sql`(unixepoch())`
      })
      .where(eq(users.telegram_id, telegramId))
      .run();
  } else {
    await db.update(users)
      .set({ onboarding_step: step })
      .where(eq(users.telegram_id, telegramId))
      .run();
  }
}

export async function updateUserChannelId(telegramId, channelId, channelName = null) {
  await db.update(users)
    .set({ channel_id: channelId, channel_name: channelName })
    .where(eq(users.telegram_id, telegramId))
    .run();
}

export async function updateUserTestChannelId(telegramId, testChannelId, testChannelName = null) {
  await db.update(users)
    .set({ test_channel_id: testChannelId, test_channel_name: testChannelName })
    .where(eq(users.telegram_id, telegramId))
    .run();
}

export async function updateUserDisplayName(telegramId, displayName) {
  await db.update(users)
    .set({ display_name: displayName })
    .where(eq(users.telegram_id, telegramId))
    .run();
}

export async function updateUserBotDisplayName(telegramId, botDisplayName) {
  await db.update(users)
    .set({ bot_display_name: botDisplayName })
    .where(eq(users.telegram_id, telegramId))
    .run();
}

export async function updateUserShowSourceLink(telegramId, showSourceLink) {
  await db.update(users)
    .set({ show_source_link: showSourceLink ? 1 : 0 })
    .where(eq(users.telegram_id, telegramId))
    .run();
}

export async function updateUserDotPunctuation(telegramId, useDotPunctuation) {
  await db.update(users)
    .set({ use_dot_punctuation: useDotPunctuation ? 1 : 0 })
    .where(eq(users.telegram_id, telegramId))
    .run();
}

export async function updateUserCategories(telegramId, categories) {
  await db.update(users)
    .set({ categories: JSON.stringify(categories) })
    .where(eq(users.telegram_id, telegramId))
    .run();
}

export async function getUserByTelegramId(telegramId) {
  const result = await db.select()
    .from(users)
    .where(eq(users.telegram_id, telegramId))
    .limit(1)
    .all();
  return result[0] || null;
}

// Custom sources management

export async function addCustomSource(userId, sourceName, sourceUrl) {
  const [source] = await db.insert(customSources)
    .values({
      user_id: userId,
      source_name: sourceName,
      source_url: sourceUrl
    })
    .returning()
    .run();
  return source;
}

export async function getCustomSources(userId) {
  return await db.select()
    .from(customSources)
    .where(eq(customSources.user_id, userId))
    .all();
}

// Posts tracking functions

export async function createPost(userId, channelId, content, category, source = null, imageUrl = null) {
  const [post] = await db.insert(posts)
    .values({
      user_id: userId,
      channel_id: channelId,
      content,
      category,
      source,
      image_url: imageUrl
    })
    .returning()
    .run();

  // Update user stats
  await db.update(users)
    .set({
      posts_count: sql`${users.posts_count} + 1`,
      last_posted_at: sql`(unixepoch())`
    })
    .where(eq(users.id, userId))
    .run();

  return post;
}

export async function getUserPosts(userId) {
  return await db.select()
    .from(posts)
    .where(eq(posts.user_id, userId))
    .orderBy(desc(posts.created_at))
    .all();
}

export async function getAllUsers() {
  return await db.select()
    .from(users)
    .orderBy(desc(users.created_at))
    .all();
}

export async function getAllPosts() {
  return await db.select()
    .from(posts)
    .orderBy(desc(posts.created_at))
    .all();
}

export async function getDashboardStats() {
  const allUsers = await db.select()
    .from(users)
    .all();

  const activeUsers = allUsers.filter(u => u.onboarding_step === 'completed');
  const totalPosts = allUsers.reduce((sum, u) => sum + (u.posts_count || 0), 0);

  const recentPosts = await db.select()
    .from(posts)
    .orderBy(desc(posts.created_at))
    .limit(10)
    .all();

  const recentUsers = await db.select()
    .from(users)
    .orderBy(desc(users.created_at))
    .limit(15)
    .all();

  // Convert timestamps to numbers for JSON serialization
  const serializedPosts = recentPosts.map(post => ({
    ...post,
    created_at: post.created_at ? Number(post.created_at) : null
  }));

  const serializedUsers = recentUsers.map(user => ({
    ...user,
    created_at: user.created_at ? Number(user.created_at) : null,
    completed_at: user.completed_at ? Number(user.completed_at) : null,
    last_posted_at: user.last_posted_at ? Number(user.last_posted_at) : null
  }));

  return {
    users: {
      total_users: allUsers.length,
      active_users: activeUsers.length,
      total_posts: totalPosts
    },
    recentPosts: serializedPosts,
    recentUsers: serializedUsers
  };
}

// Multi-channel management functions

export async function addUserChannel(userId, channelId, channelName = null, isMain = 0, isTest = 0) {
  const [channel] = await db.insert(userChannels)
    .values({
      user_id: userId,
      channel_id: channelId,
      channel_name: channelName,
      is_main: isMain,
      is_test: isTest
    })
    .returning()
    .run();
  return channel;
}

export async function getUserChannels(userId) {
  return await db.select()
    .from(userChannels)
    .where(eq(userChannels.user_id, userId))
    .orderBy(desc(userChannels.is_main), desc(userChannels.created_at))
    .all();
}

export async function deleteUserChannel(channelId) {
  await db.delete(userChannels)
    .where(eq(userChannels.id, channelId))
    .run();
}

export async function getUserChannelById(channelId) {
  const result = await db.select()
    .from(userChannels)
    .where(eq(userChannels.id, channelId))
    .limit(1)
    .all();
  return result[0] || null;
}

export async function getUserChannelByChannelId(userId, channelId) {
  const result = await db.select()
    .from(userChannels)
    .where(and(eq(userChannels.user_id, userId), eq(userChannels.channel_id, channelId)))
    .limit(1)
    .all();
  return result[0] || null;
}

export async function getMainChannel(userId) {
  const result = await db.select()
    .from(userChannels)
    .where(and(eq(userChannels.user_id, userId), eq(userChannels.is_main, 1)))
    .limit(1)
    .all();
  return result[0] || null;
}

export async function getTestChannel(userId) {
  const result = await db.select()
    .from(userChannels)
    .where(and(eq(userChannels.user_id, userId), eq(userChannels.is_test, 1)))
    .limit(1)
    .all();
  return result[0] || null;
}

// Temporary storage for adding new channel
export async function setPendingChannelAdd(userId, channelId, channelName = null) {
  await db.update(users)
    .set({ display_name: `pending_channel:${channelId}:${channelName || ''}` })
    .where(eq(users.telegram_id, userId))
    .run();
}

export async function getPendingChannelAdd(userId) {
  const user = await getUserByTelegramId(userId);
  if (!user || !user.display_name || !user.display_name.startsWith('pending_channel:')) {
    return null;
  }
  const parts = user.display_name.replace('pending_channel:', '').split(':');
  return {
    channelId: parts[0],
    channelName: parts[1] || null
  };
}

export async function clearPendingChannelAdd(userId) {
  await db.update(users)
    .set({ display_name: null })
    .where(eq(users.telegram_id, userId))
    .run();
}

// Migration function to move existing channels to user_channels table
export async function migrateUserChannels(userId) {
  const user = await getUserByTelegramId(userId);
  if (!user) return false;

  const existingChannels = await getUserChannels(user.id);
  if (existingChannels.length > 0) return true; // Already migrated

  let migrated = false;

  // Migrate main channel
  if (user.channel_id) {
    const alreadyExists = await getUserChannelByChannelId(user.id, user.channel_id);
    if (!alreadyExists) {
      await addUserChannel(user.id, user.channel_id, user.channel_name, 1, 0);
      migrated = true;
    }
  }

  // Migrate test channel
  if (user.test_channel_id) {
    const alreadyExists = await getUserChannelByChannelId(user.id, user.test_channel_id);
    if (!alreadyExists) {
      await addUserChannel(user.id, user.test_channel_id, user.test_channel_name, 0, 1);
      migrated = true;
    }
  }

  return migrated;
}

// Function to remove duplicate channels by channel_id
export async function removeDuplicateChannels(userId) {
  const user = await getUserByTelegramId(userId);
  if (!user) return;

  const allChannels = await getUserChannels(user.id);
  const seenChannelIds = new Set();
  const toDelete = [];

  for (const channel of allChannels) {
    if (seenChannelIds.has(channel.channel_id)) {
      toDelete.push(channel.id);
    } else {
      seenChannelIds.add(channel.channel_id);
    }
  }

  for (const channelId of toDelete) {
    await deleteUserChannel(channelId);
  }

  return toDelete.length;
}
