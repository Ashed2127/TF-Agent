import { api } from 'sdk';
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

    // Query Telegram Bot API for real subscriber counts of unique channels
    const channelIds = new Set();
    if (stats.channels && Array.isArray(stats.channels)) {
      stats.channels.forEach(ch => {
        if (ch.channel_id) channelIds.add(ch.channel_id);
      });
    }
    if (stats.recentUsers && Array.isArray(stats.recentUsers)) {
      stats.recentUsers.forEach(u => {
        if (u.channel_id) channelIds.add(u.channel_id);
      });
    }

    const subscriberCounts = {};
    for (const chId of channelIds) {
      try {
        const count = await api.getChatMemberCount({ chat_id: chId });
        subscriberCounts[chId] = count;
      } catch (err) {
        subscriberCounts[chId] = null;
      }
    }

    stats.subscriberCounts = subscriberCounts;

    // Calculate executive system metrics
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let posts24h = 0;
    let posts7d = 0;
    let reactions24h = 0;

    if (stats.recentPosts && Array.isArray(stats.recentPosts)) {
      stats.recentPosts.forEach(p => {
        if (p.created_at) {
          const t = Number(p.created_at);
          if (t >= oneDayAgo) posts24h++;
          if (t >= sevenDaysAgo) posts7d++;
        }
      });
    }

    if (stats.interactions && Array.isArray(stats.interactions)) {
      stats.interactions.forEach(inter => {
        if (inter.created_at) {
          const t = Number(inter.created_at);
          if (t >= oneDayAgo) reactions24h++;
        }
      });
    }

    let activeSchedulesCount = 0;
    if (stats.schedules && Array.isArray(stats.schedules)) {
      activeSchedulesCount = stats.schedules.filter(s => s.is_active === 1).length;
    }

    stats.executive = {
      posts24h,
      posts7d,
      reactions24h,
      activeSchedulesCount,
      totalChannelsTracked: channelIds.size,
      botOnline: true
    };

    console.log('Dashboard stats fetched with subscriber counts and metrics');
    return stats;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return { error: error.message, details: error.toString() };
  }
}
