import { api } from 'sdk';
import { getCreatorsRanking } from '../lib/database.js';

export default async function (input, ctx) {
  try {
    const callerId = ctx.initData?.user?.id;
    const rankings = await getCreatorsRanking();

    // Query subscriber counts for unique channels
    const channelIds = new Set();
    rankings.forEach(r => {
      const ch = r.channel_name || r.channel_id;
      if (ch) channelIds.add(ch);
    });

    const subscriberCounts = {};
    for (const chId of channelIds) {
      try {
        const count = await api.getChatMemberCount({ chat_id: chId });
        subscriberCounts[chId] = count;
      } catch (_) {
        subscriberCounts[chId] = null;
      }
    }

    // Attach subscriber counts
    const enriched = rankings.map(r => {
      const chKey = r.channel_name || r.channel_id;
      return {
        ...r,
        subscribers: (chKey && subscriberCounts[chKey] !== undefined) ? subscriberCounts[chKey] : null,
        is_current_user: callerId ? (r.telegram_id === callerId) : false
      };
    });

    return {
      success: true,
      rankings: enriched,
      caller_telegram_id: callerId || null,
      total_creators: enriched.length,
      updated_at: Date.now()
    };
  } catch (error) {
    console.error('Error fetching creator rankings:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
