import { getDashboardStats } from '../lib/database.js';

const OWNER_CHAT_ID = 685669468;

export default async function (input, ctx) {
  console.log('Dashboard endpoint called, init data:', ctx.initData);

  // Check if user is owner
  const userId = ctx.initData?.user?.id;
  if (!userId || userId !== OWNER_CHAT_ID) {
    return {
      error: 'Unauthorized',
      message: 'Only the owner can access the dashboard'
    };
  }

  try {
    const stats = await getDashboardStats();
    console.log('Dashboard stats fetched:', stats);
    return stats;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return { error: error.message, details: error.toString() };
  }
}
