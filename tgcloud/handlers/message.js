// handlers/message.js — runs on each `message` update. The file name is the
// Telegram update type; the platform calls the default export with the matching
// payload (here, a Message). The full update is available as `ctx.update`.

import { api } from 'sdk';
import { generateIdea } from '../lib/agent.js';
import { TRUE_FEED_CHANNEL_ID, TEST_CHANNEL_ID } from '../lib/secrets.js';

const OWNER_CHAT_ID = 685669468; // Your chat ID

export default async function (message, ctx) {
  const userId = message.from.id;

  // Authorization check
  if (userId !== OWNER_CHAT_ID) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '⛔ Unauthorized',
    });
    return;
  }

  // Handle /start command
  if (message.text === '/start') {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '🌱 TF Agent እንኳን ደህና መጡ!\n\nይህ Bot True Feed ቻናልዎን ያስተዳድራል።\nከታች ያሉትን አማራጮች ይጫኑ።',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'idea', callback_data: 'new_idea' },
            { text: '📰 news', callback_data: 'get_news' }
          ]
        ]
      }
    });
    return;
  }

  // Handle /test command for debugging
  if (message.text === '/test') {
    try {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '🧪 Testing idea generation...',
      });

      const idea = await generateIdea();

      console.log('Idea generated successfully:', idea.topic);

      await api.sendMessage({
        chat_id: message.chat.id,
        text: `✅ Test successful!\n\nTopic: ${idea.topic}\nCategory: ${idea.category}\n\n${idea.content}`,
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Test error:', error);
      await api.sendMessage({
        chat_id: message.chat.id,
        text: `❌ Test failed: ${error.message}`,
      });
    }
    return;
  }

  // Handle edited news post (after clicking Edit button)
  // Only trigger if not a command (doesn't start with /)
  if (message.text && !message.text.startsWith('/') && message.text.length > 10) {
    // Show buttons to choose where to post
    const encodedText = encodeURIComponent(message.text);
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Where do you want to post this edited news?',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📢 TrueFeed', callback_data: `post_edit_truefeed:${encodedText}` },
            { text: '🧪 Test', callback_data: `post_edit_test:${encodedText}` }
          ],
          [
            { text: '❌ Cancel', callback_data: 'cancel_edit' }
          ]
        ]
      }
    });
    return;
  }
}
