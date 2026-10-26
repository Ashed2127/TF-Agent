// handlers/message_reaction.js — runs whenever a user sets or changes a native Telegram emoji reaction
// Payload is MessageReactionUpdated: { chat, message_id, user, actor_chat, date, old_reaction, new_reaction }

import { recordPostInteraction } from '../lib/database.js';

export default async function (reactionUpdated, ctx) {
  try {
    console.log('Received native message_reaction update:', JSON.stringify(reactionUpdated));

    const chat = reactionUpdated.chat;
    const messageId = reactionUpdated.message_id;
    const user = reactionUpdated.user;
    const newReactions = reactionUpdated.new_reaction || [];

    // If reaction was removed completely
    if (newReactions.length === 0) {
      console.log(`User removed reactions on message ${messageId}`);
      return;
    }

    const channelIdentifier = chat?.username ? `@${chat.username}` : (chat?.id ? String(chat.id) : null);
    const userTelegramId = user ? user.id : (reactionUpdated.actor_chat ? reactionUpdated.actor_chat.id : 0);
    const username = user?.username ? `@${user.username}` : (reactionUpdated.actor_chat?.username ? `@${reactionUpdated.actor_chat.username}` : null);
    const firstName = user?.first_name || reactionUpdated.actor_chat?.title || 'Subscriber';

    // Loop through each emoji reaction applied by the user
    for (const r of newReactions) {
      let emojiStr = 'like';
      if (r.type === 'emoji' && r.emoji) {
        emojiStr = r.emoji;
      } else if (r.type === 'custom_emoji') {
        emojiStr = 'custom';
      }

      console.log(`Recording reaction: ${emojiStr} from user: ${firstName} (${username || userTelegramId}) in ${channelIdentifier}`);
      await recordPostInteraction(messageId, channelIdentifier, userTelegramId, username, firstName, emojiStr);
    }

  } catch (error) {
    console.error('Error handling message_reaction update:', error);
  }
}
