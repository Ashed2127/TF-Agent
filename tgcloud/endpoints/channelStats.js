import { api, EndpointError } from 'sdk';
import { getUserChannels, getUserById, getUserByTelegramId } from '../lib/database.js';

export default async function (input, ctx) {
  const callerId = ctx.initData?.user?.id;
  if (!callerId) {
    throw new EndpointError('Authentication required', { code: 'UNAUTHORIZED' });
  }

  const { channel_id } = input || {};

  // If a specific channel_id is provided, look it up directly
  if (channel_id) {
    try {
      const count = await api.getChatMemberCount({ chat_id: channel_id });
      let chat = null;
      try {
        chat = await api.getChat({ chat_id: channel_id });
      } catch (e) {
        // chat metadata optional
      }
      return {
        ok: true,
        channel_id,
        title: chat?.title || null,
        username: chat?.username ? `@${chat.username}` : null,
        subscribers: count
      };
    } catch (err) {
      return {
        ok: false,
        channel_id,
        error: err.description || err.message || 'Failed to fetch subscriber count'
      };
    }
  }

  // Otherwise, lookup channels for the requesting user
  let user = await getUserByTelegramId(callerId);
  if (!user) {
    user = await getUserById(callerId);
  }

  const channelList = [];
  if (user?.channel_id) {
    channelList.push({ channel_id: user.channel_id, name: user.channel_name || user.channel_id });
  }

  if (user?.id) {
    try {
      const dbChannels = await getUserChannels(user.id);
      dbChannels.forEach(ch => {
        if (!channelList.some(c => c.channel_id === ch.channel_id)) {
          channelList.push({ channel_id: ch.channel_id, name: ch.channel_name || ch.channel_id });
        }
      });
    } catch (e) {
      // Ignore channel query failure
    }
  }

  if (channelList.length === 0) {
    return {
      ok: true,
      channels: [],
      message: 'No registered channel found for this user'
    };
  }

  const results = [];
  for (const item of channelList) {
    try {
      const count = await api.getChatMemberCount({ chat_id: item.channel_id });
      results.push({
        channel_id: item.channel_id,
        name: item.name,
        subscribers: count,
        ok: true
      });
    } catch (err) {
      results.push({
        channel_id: item.channel_id,
        name: item.name,
        error: err.description || err.message,
        ok: false
      });
    }
  }

  return {
    ok: true,
    channels: results
  };
}
