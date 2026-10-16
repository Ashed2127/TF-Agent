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
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
