import { getDashboardStats } from '../lib/database.js';

export default async function (input, ctx) {
  console.log('Dashboard endpoint called, init data:', ctx.initData);

  try {
    const stats = await getDashboardStats();
    console.log('Dashboard stats fetched:', stats);
    return stats;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return { error: error.message, details: error.toString() };
  }
}
