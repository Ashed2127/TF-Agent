import { getUserByTelegramId } from '../lib/database.js';
import { db } from 'sdk';
import { users } from '../schema.js';
import { eq, sql } from 'sdk/db';

export default async function (input, ctx) {
  console.log('resetRecommendation endpoint called');

  const { telegramId } = input;
  if (!telegramId) {
    return {
      success: false,
      error: 'telegramId is required'
    };
  }

  try {
    // Reset last_recommendation_at to null so they become due immediately
    await db.update(users)
      .set({ last_recommendation_at: null })
      .where(eq(users.telegram_id, telegramId))
      .run();

    const user = await getUserByTelegramId(telegramId);

    return {
      success: true,
      message: `Reset recommendation time for ${user?.first_name || telegramId}. They will now be due for a recommendation.`,
      user: {
        telegramId: user?.telegram_id,
        firstName: user?.first_name,
        recommendationsEnabled: user?.recommendations_enabled,
        interval: user?.recommendation_interval
      }
    };
  } catch (error) {
    console.error('Error in resetRecommendation endpoint:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
