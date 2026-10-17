// handlers/message.js — runs on each `message` update. The file name is the
// Telegram update type; the platform calls the default export with the matching
// payload (here, a Message). The full update is available as `ctx.update`.

import { api } from 'sdk';
import { generateIdea } from '../lib/agent.js';
import { TRUE_FEED_CHANNEL_ID, TEST_CHANNEL_ID } from '../lib/secrets.js';
import { savePendingEdit, getPendingEdit, deletePendingEdit } from '../lib/database.js';

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
    // Cancel any pending edit on /start
    await deletePendingEdit(userId);
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

  // Handle edited news post — only if user previously clicked the Edit button
  // (tracked via a pending_edits row in the DB)
  const incomingText = message.text || message.caption;
  if (incomingText && !incomingText.startsWith('/')) {
    const pendingEdit = await getPendingEdit(userId);
    if (pendingEdit) {
      // User is in edit mode — preserve original image or use newly uploaded photo
      const newPhotoId = (message.photo && message.photo.length > 0)
        ? message.photo[message.photo.length - 1].file_id
        : null;
      const imageToUse = newPhotoId || pendingEdit.image_url;

      const editId = await savePendingEdit(userId, incomingText, imageToUse);
      await api.sendMessage({
        chat_id: message.chat.id,
        text: 'Where do you want to post this edited news?',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📢 TrueFeed', callback_data: `post_edit_truefeed:${editId}` },
              { text: '🧪 Test', callback_data: `post_edit_test:${editId}` }
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
}

