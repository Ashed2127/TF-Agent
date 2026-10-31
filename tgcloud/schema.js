import { table, integer, text, sql } from 'sdk/db';

export const ideas = table('ideas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  content: text('content').notNull(),
  topic: text('topic').notNull(),
  category: text('category').notNull(),
  status: text('status').notNull().default('pending'),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  posted_at: integer('posted_at', { mode: 'timestamp' }),
});

export const pendingEdits = table('pending_edits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull(),
  text: text('text').notNull(),
  image_url: text('image_url'),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const users = table('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  telegram_id: integer('telegram_id').notNull().unique(),
  username: text('username'),
  user_type: text('user_type').default('guest'),
  onboarding_step: text('onboarding_step').default('join_channel'),
  channel_id: text('channel_id'),
  channel_name: text('channel_name'),
  test_channel_id: text('test_channel_id'),
  test_channel_name: text('test_channel_name'),
  display_name: text('display_name'),
  bot_display_name: text('bot_display_name'),
  show_source_link: integer('show_source_link').default(1),
  use_dot_punctuation: integer('use_dot_punctuation').default(0),
  categories: text('categories'),
  posts_count: integer('posts_count').default(0),
  last_posted_at: integer('last_posted_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  completed_at: integer('completed_at', { mode: 'timestamp' }),
});

export const customSources = table('custom_sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull(),
  source_name: text('source_name').notNull(),
  source_url: text('source_url').notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const posts = table('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull(),
  channel_id: text('channel_id').notNull(),
  content: text('content').notNull(),
  category: text('category').notNull(),
  source: text('source'),
  image_url: text('image_url'),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const userChannels = table('user_channels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull(),
  channel_id: text('channel_id').notNull(),
  channel_name: text('channel_name'),
  is_main: integer('is_main').default(0),
  is_test: integer('is_test').default(0),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const contentStructures = table('content_structures', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull(),
  structure_template: text('structure_template').notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updated_at: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const autoPostSchedules = table('auto_post_schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull(),
  channel_id: text('channel_id').notNull(),
  interval_hours: integer('interval_hours').notNull(),
  source_platform: text('source_platform'),
  is_active: integer('is_active').default(1),
  last_posted_at: integer('last_posted_at', { mode: 'timestamp' }),
  next_post_at: integer('next_post_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const postInteractions = table('post_interactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  post_id: integer('post_id'),
  channel_id: text('channel_id'),
  user_telegram_id: integer('user_telegram_id').notNull(),
  username: text('username'),
  first_name: text('first_name'),
  reaction_type: text('reaction_type').notNull().default('like'),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
