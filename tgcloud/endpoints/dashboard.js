import { getDashboardStats } from '../lib/database.js';

export default async function (input, ctx) {
  try {
    const stats = await getDashboardStats();
    return stats;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return { error: error.message };
  }
}
