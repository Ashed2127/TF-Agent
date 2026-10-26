import { api } from 'sdk';
import { getDueAutoPostSchedules, updateAutoPostLastPosted, getUserByTelegramId, getUserById, createPost } from '../lib/database.js';
import { generateIdea } from '../lib/agent.js';

export default async function (input, ctx) {
  console.log('Auto post endpoint called');

  try {
    // Get all due auto post schedules
    const dueSchedules = await getDueAutoPostSchedules();
    console.log(`Found ${dueSchedules.length} due auto post schedules`);

    const results = [];

    for (const schedule of dueSchedules) {
      try {
        console.log(`Processing auto post for user ${schedule.user_id} to channel ${schedule.channel_id}`);

        // Get user info (schedule.user_id can be database user id or telegram_id)
        let user = await getUserById(schedule.user_id);
        if (!user) {
          user = await getUserByTelegramId(schedule.user_id);
        }
        if (!user) {
          console.error(`User not found for schedule ${schedule.id}`);
          continue;
        }

        // Generate content using user's content structure
        const idea = await generateIdea(user.telegram_id);
        console.log(`Generated idea: ${idea.topic}`);

        // Post to channel
        await api.sendMessage({
          chat_id: schedule.channel_id,
          text: idea.content,
          parse_mode: 'Markdown',
        });

        // Create post record
        await createPost(user.id, schedule.channel_id, idea.content, idea.category, null, null);

        // Update schedule with last posted time
        await updateAutoPostLastPosted(schedule.id);

        results.push({
          schedule_id: schedule.id,
          user_id: schedule.user_id,
          channel_id: schedule.channel_id,
          status: 'success',
          topic: idea.topic
        });

        console.log(`Successfully posted to ${schedule.channel_id}: ${idea.topic}`);

      } catch (error) {
        console.error(`Error processing auto post schedule ${schedule.id}:`, error);
        results.push({
          schedule_id: schedule.id,
          user_id: schedule.user_id,
          channel_id: schedule.channel_id,
          status: 'error',
          error: error.message
        });
      }
    }

    return {
      processed: dueSchedules.length,
      results
    };

  } catch (error) {
    console.error('Error in auto post endpoint:', error);
    return {
      error: error.message
    };
  }
}
