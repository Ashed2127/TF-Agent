import { api } from 'sdk';
import { getAllUsers } from './database.js';
import { getDailyRecommendations, isUserDueForRecommendation } from './recommendations.js';

/**
 * Check and trigger due recommendations for all users
 * This should be called periodically (e.g., every hour)
 */
export async function checkAndTriggerDueRecommendations() {
  let processedCount = 0;
  try {
    const allUsers = await getAllUsers();
    const usersWithRecommendations = allUsers.filter(u => u.recommendations_enabled === 1);

    console.log(`Checking ${usersWithRecommendations.length} users for due recommendations`);

    for (const user of usersWithRecommendations) {
      try {
        const isDue = await isUserDueForRecommendation(user.telegram_id);

        if (isDue) {
          console.log(`Sending recommendation to user ${user.telegram_id} (${user.first_name})`);
          await sendRecommendationToUser(user);
          processedCount++;
        }
      } catch (error) {
        console.error(`Error checking recommendation for user ${user.telegram_id}:`, error.message);
      }
    }

    console.log('Recommendation check complete');
  } catch (error) {
    console.error('Error in checkAndTriggerDueRecommendations:', error.message);
  }
  return processedCount;
}

/**
 * Send a recommendation to a specific user
 */
async function sendRecommendationToUser(user) {
  try {
    const result = await getDailyRecommendations(user.telegram_id);

    if (result.digest) {
      await api.sendMessage({
        chat_id: user.telegram_id,
        text: result.digest,
        parse_mode: 'Markdown',
      });
      console.log(`Recommendation sent to ${user.telegram_id}`);
    } else {
      console.log(`No digest generated for ${user.telegram_id}: ${result.message}`);
    }
  } catch (error) {
    console.error(`Error sending recommendation to ${user.telegram_id}:`, error.message);
  }
}
