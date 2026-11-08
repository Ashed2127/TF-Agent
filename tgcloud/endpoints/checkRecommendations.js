import { checkAndTriggerDueRecommendations } from '../lib/recommendation_service.js';

export default async function (input, ctx) {
  console.log('checkRecommendations endpoint called');

  try {
    const count = await checkAndTriggerDueRecommendations();
    console.log(`checkRecommendations: processed ${count} recommendation(s)`);
    return {
      success: true,
      processed: count,
      message: `Checked and processed due recommendations`
    };
  } catch (error) {
    console.error('Error in checkRecommendations endpoint:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
