import { table, integer, text } from 'sdk/db';

export const ideas = table('ideas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  content: text('content').notNull(),
  topic: text('topic').notNull(),
  category: text('category').notNull(),
  status: text('status').notNull().default('pending'),
  created_at: integer('created_at').notNull(),
  posted_at: integer('posted_at'),
});
