import { checkAndTriggerDueAutoPosts } from '../lib/autopost_service.js';

export default async function (input, ctx) {
  console.log('Auto post endpoint called');
  try {
    const processed = await checkAndTriggerDueAutoPosts();
    return {
      success: true,
      processed
    };
  } catch (error) {
    console.error('Error in auto post endpoint:', error);
    return {
      error: error.message
    };
  }
}
