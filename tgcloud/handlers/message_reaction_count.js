// handlers/message_reaction_count.js — runs when aggregate reaction counts change on messages in channels
// Payload is MessageReactionCountUpdated: { chat, message_id, date, reactions: [{ type, total_count }] }

import { recordPostInteraction } from '../lib/database.js';

export default async function (countUpdated, ctx) {
  try {
    console.log('Received native message_reaction_count update:', JSON.stringify(countUpdated));

    const chat = countUpdated.chat;
    const messageId = countUpdated.message_id;
    const reactions = countUpdated.reactions || [];

    const channelIdentifier = chat?.username ? `@${chat.username}` : (chat?.id ? String(chat.id) : null);

    for (const r of reactions) {
      const emojiStr = r.type?.emoji || 'reaction';
      console.log(`Channel reaction count update in ${channelIdentifier} for msg ${messageId}: ${emojiStr} = ${r.total_count}`);
      // Record summary interaction marker for the channel post
      await recordPostInteraction(messageId, channelIdentifier, 0, null, `Channel Reactions (${r.total_count})`, emojiStr);
    }

  } catch (error) {
    console.error('Error handling message_reaction_count update:', error);
  }
}
