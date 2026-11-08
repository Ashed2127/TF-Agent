import { getDailyRecommendations } from '../lib/recommendations.js';

export default async function (input, ctx) {
  console.log('getRecommendations endpoint called, init data:', ctx.initData);

  const userId = ctx.initData?.user?.id;
  if (!userId) {
    return {
      error: 'Unauthorized',
      message: 'User not authenticated'
    };
  }

  try {
    const recommendations = await getDailyRecommendations(userId);
    return recommendations;
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return {
      error: error.message,
      articles: []
    };
  }
}
