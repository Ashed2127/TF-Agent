import { db } from 'sdk';
import { eq, desc, sql, and } from 'sdk/db';
import { ideas, pendingEdits, users, customSources, posts, userChannels, contentStructures, autoPostSchedules, postInteractions } from '../schema.js';

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

export async function getUserById(id) {
  const result = await db.select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .all();
  return result[0] || null;
}

// User Data Management & Deletion functions (Owner actions)

export async function clearUserData(userId) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // 1. Delete user channels
  await db.delete(userChannels)
    .where(eq(userChannels.user_id, user.id))
    .run();

  // 2. Delete auto post schedules (by internal user.id and telegram_id)
  await db.delete(autoPostSchedules)
    .where(eq(autoPostSchedules.user_id, user.id))
    .run();
  if (user.telegram_id) {
    await db.delete(autoPostSchedules)
      .where(eq(autoPostSchedules.user_id, user.telegram_id))
      .run();
  }

  // 3. Delete custom sources
  await db.delete(customSources)
    .where(eq(customSources.user_id, user.id))
    .run();

  // 4. Delete content structure
  await db.delete(contentStructures)
    .where(eq(contentStructures.user_id, user.id))
    .run();

  // 5. Delete pending edits (by telegram_id or id)
  if (user.telegram_id) {
    await db.delete(pendingEdits)
      .where(eq(pendingEdits.user_id, user.telegram_id))
      .run();
  }
  await db.delete(pendingEdits)
    .where(eq(pendingEdits.user_id, user.id))
    .run();

  // 6. Delete posts
  await db.delete(posts)
    .where(eq(posts.user_id, user.id))
    .run();

  // 7. Reset user settings back to initial state
  const [updatedUser] = await db.update(users)
    .set({
      user_type: 'guest',
      onboarding_step: 'join_channel',
      channel_id: null,
      channel_name: null,
      test_channel_id: null,
      test_channel_name: null,
      display_name: null,
      bot_display_name: null,
      show_source_link: 1,
      use_dot_punctuation: 0,
      categories: null,
      posts_count: 0,
      completed_at: null,
      last_posted_at: null
    })
    .where(eq(users.id, user.id))
    .returning()
    .run();

  return updatedUser;
}

export async function deleteUser(userId) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Clear all associated data first
  await db.delete(userChannels)
    .where(eq(userChannels.user_id, user.id))
    .run();

  await db.delete(autoPostSchedules)
    .where(eq(autoPostSchedules.user_id, user.id))
    .run();
  if (user.telegram_id) {
    await db.delete(autoPostSchedules)
      .where(eq(autoPostSchedules.user_id, user.telegram_id))
      .run();
  }

  await db.delete(customSources)
    .where(eq(customSources.user_id, user.id))
    .run();

  await db.delete(contentStructures)
    .where(eq(contentStructures.user_id, user.id))
    .run();

  if (user.telegram_id) {
    await db.delete(pendingEdits)
      .where(eq(pendingEdits.user_id, user.telegram_id))
      .run();
  }
  await db.delete(pendingEdits)
    .where(eq(pendingEdits.user_id, user.id))
    .run();

  await db.delete(posts)
    .where(eq(posts.user_id, user.id))
    .run();

  if (user.telegram_id) {
    await db.delete(postInteractions)
      .where(eq(postInteractions.user_telegram_id, user.telegram_id))
      .run();
  }

  // Delete the user record
  await db.delete(users)
    .where(eq(users.id, user.id))
    .run();

  return { success: true, id: user.id, telegram_id: user.telegram_id };
}

export async function clearUserPosts(userId) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  await db.delete(posts)
    .where(eq(posts.user_id, user.id))
    .run();

  await db.update(users)
    .set({ posts_count: 0, last_posted_at: null })
    .where(eq(users.id, user.id))
    .run();

  return { success: true, user_id: user.id };
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

  const allPosts = await db.select()
    .from(posts)
    .all();

  const allChannels = await db.select()
    .from(userChannels)
    .all();

  const allSchedules = await db.select()
    .from(autoPostSchedules)
    .all();

  const allCustomSources = await db.select()
    .from(customSources)
    .all();

  const allInteractions = await db.select()
    .from(postInteractions)
    .orderBy(desc(postInteractions.created_at))
    .limit(100)
    .all();

  const activeUsers = allUsers.filter(u => u.onboarding_step === 'completed');
  const totalPostsCount = allUsers.reduce((sum, u) => sum + (u.posts_count || 0), 0);
  const registeredPostsCount = allPosts.length;
  const activeSchedulesCount = allSchedules.filter(s => s.is_active === 1).length;

  const recentPosts = await db.select()
    .from(posts)
    .orderBy(desc(posts.created_at))
    .limit(20)
    .all();

  const recentUsers = await db.select()
    .from(users)
    .orderBy(desc(users.created_at))
    .limit(25)
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

  const serializedChannels = allChannels.map(ch => ({
    ...ch,
    created_at: ch.created_at ? Number(ch.created_at) : null
  }));

  const serializedSchedules = allSchedules.map(sc => ({
    ...sc,
    last_posted_at: sc.last_posted_at ? Number(sc.last_posted_at) : null,
    next_post_at: sc.next_post_at ? Number(sc.next_post_at) : null,
    created_at: sc.created_at ? Number(sc.created_at) : null
  }));

  const serializedInteractions = allInteractions.map(inter => ({
    ...inter,
    created_at: inter.created_at ? Number(inter.created_at) : null
  }));

  return {
    users: {
      total_users: allUsers.length,
      active_users: activeUsers.length,
      total_posts: Math.max(totalPostsCount, registeredPostsCount),
      total_channels: allChannels.length,
      active_schedules: activeSchedulesCount,
      custom_sources: allCustomSources.length,
      total_interactions: allInteractions.length
    },
    recentPosts: serializedPosts,
    recentUsers: serializedUsers,
    channels: serializedChannels,
    schedules: serializedSchedules,
    interactions: serializedInteractions,
    customSourcesCount: allCustomSources.length
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

// Content structure management functions

export async function saveContentStructure(userId, structureTemplate) {
  const existing = await db.select()
    .from(contentStructures)
    .where(eq(contentStructures.user_id, userId))
    .limit(1)
    .all();

  if (existing.length > 0) {
    const [updated] = await db.update(contentStructures)
      .set({
        structure_template: structureTemplate,
        updated_at: sql`(unixepoch())`
      })
      .where(eq(contentStructures.id, existing[0].id))
      .returning()
      .run();
    return updated;
  }

  const [structure] = await db.insert(contentStructures)
    .values({
      user_id: userId,
      structure_template: structureTemplate
    })
    .returning()
    .run();
  return structure;
}

export async function getContentStructure(userId) {
  const result = await db.select()
    .from(contentStructures)
    .where(eq(contentStructures.user_id, userId))
    .limit(1)
    .all();
  return result[0] || null;
}

export async function deleteContentStructure(userId) {
  await db.delete(contentStructures)
    .where(eq(contentStructures.user_id, userId))
    .run();
}

// Auto post schedule management functions

export async function createAutoPostSchedule(userId, channelId, intervalHours) {
  const nextPostAt = new Date();
  nextPostAt.setHours(nextPostAt.getHours() + intervalHours);

  const [schedule] = await db.insert(autoPostSchedules)
    .values({
      user_id: userId,
      channel_id: channelId,
      interval_hours: intervalHours,
      next_post_at: nextPostAt.getTime() / 1000
    })
    .returning()
    .run();
  return schedule;
}

export async function getAutoPostSchedule(userId) {
  const result = await db.select()
    .from(autoPostSchedules)
    .where(eq(autoPostSchedules.user_id, userId))
    .limit(1)
    .all();
  return result[0] || null;
}

export async function updateAutoPostSchedule(scheduleId, channelId, intervalHours, isActive) {
  const updateData = {};
  if (channelId !== undefined) updateData.channel_id = channelId;
  if (intervalHours !== undefined) updateData.interval_hours = intervalHours;
  if (isActive !== undefined) updateData.is_active = isActive ? 1 : 0;

  const [updated] = await db.update(autoPostSchedules)
    .set(updateData)
    .where(eq(autoPostSchedules.id, scheduleId))
    .returning()
    .run();
  return updated;
}

export async function toggleAutoPostSchedule(scheduleId) {
  const schedule = await db.select()
    .from(autoPostSchedules)
    .where(eq(autoPostSchedules.id, scheduleId))
    .limit(1)
    .all();

  if (schedule.length === 0) return null;

  const newStatus = schedule[0].is_active === 1 ? 0 : 1;
  const [updated] = await db.update(autoPostSchedules)
    .set({ is_active: newStatus })
    .where(eq(autoPostSchedules.id, scheduleId))
    .returning()
    .run();
  return updated;
}

export async function deleteAutoPostSchedule(scheduleId) {
  await db.delete(autoPostSchedules)
    .where(eq(autoPostSchedules.id, scheduleId))
    .run();
}

export async function updateAutoPostLastPosted(scheduleId) {
  const schedule = await db.select()
    .from(autoPostSchedules)
    .where(eq(autoPostSchedules.id, scheduleId))
    .limit(1)
    .all();

  if (schedule.length === 0) return null;

  const now = Math.floor(Date.now() / 1000);
  const nextPostAt = now + (schedule[0].interval_hours * 3600);

  const [updated] = await db.update(autoPostSchedules)
    .set({
      last_posted_at: now,
      next_post_at: nextPostAt
    })
    .where(eq(autoPostSchedules.id, scheduleId))
    .returning()
    .run();
  return updated;
}

export async function getDueAutoPostSchedules() {
  const now = Math.floor(Date.now() / 1000);
  return await db.select()
    .from(autoPostSchedules)
    .where(and(
      eq(autoPostSchedules.is_active, 1),
      sql`${autoPostSchedules.next_post_at} <= ${now}`
    ))
    .all();
}

// Post Interactions (Reactions) Functions

export async function recordPostInteraction(postId, channelId, userTelegramId, username = null, firstName = null, reactionType = 'like') {
  // Check if user already reacted with this reaction
  const existing = await db.select()
    .from(postInteractions)
    .where(and(
      eq(postInteractions.post_id, postId),
      eq(postInteractions.user_telegram_id, userTelegramId),
      eq(postInteractions.reaction_type, reactionType)
    ))
    .limit(1)
    .all();

  if (existing.length > 0) {
    // Toggle off (unlike)
    await db.delete(postInteractions)
      .where(eq(postInteractions.id, existing[0].id))
      .run();
    return { action: 'removed', reactionType };
  }

  // Insert reaction
  const [created] = await db.insert(postInteractions)
    .values({
      post_id: postId,
      channel_id: channelId ? String(channelId) : null,
      user_telegram_id: userTelegramId,
      username: username || null,
      first_name: firstName || null,
      reaction_type: reactionType
    })
    .returning()
    .run();

  return { action: 'added', reactionType, interaction: created };
}

export async function getPostReactionsSummary(postId) {
  const reactions = await db.select()
    .from(postInteractions)
    .where(eq(postInteractions.post_id, postId))
    .all();

  const counts = { like: 0, fire: 0, bulb: 0 };
  for (const r of reactions) {
    counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
  }
  return { counts, total: reactions.length, reactions };
}

export async function getAllInteractions() {
  return await db.select()
    .from(postInteractions)
    .orderBy(desc(postInteractions.created_at))
    .all();
}
