import { api, db } from 'sdk';
import { ideas } from '../schema.js';
import { sql } from 'sdk/db';
import { generateIdea } from '../lib/gemini.js';
import { buildPrompt } from '../lib/prompts.js';

export default async function (callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  try {
    if (data === 'new_idea') {
      await handleNewIdea(chatId, callbackQuery.id);
    } else if (data.startsWith('approve_')) {
      await handleApprove(chatId, callbackQuery.id, messageId, data);
    } else if (data.startsWith('reject_')) {
      await handleReject(chatId, callbackQuery.id, messageId, data);
    }
  } catch (error) {
    console.error('Error in callback query:', error);
    await api.answerCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: '❌ Error occurred',
      show_alert: true
    });
  }
}

async function handleNewIdea(chatId, callbackQueryId) {
  await api.answerCallbackQuery({ callback_query_id: callbackQueryId });
  
  await api.sendMessage({
    chat_id: chatId,
    text: '⏳ ሀሳብ እየተዘጋጀ ነው...'
  });

  // Get previous topics from database
  const previousIdeas = await db.select()
    .from(ideas)
    .where(sql`${ideas.status} = 'posted' OR ${ideas.status} = 'rejected'`)
    .orderBy(sql`${ideas.created_at} DESC`)
    .limit(20)
    .run();

  const previousTopics = [...new Set(previousIdeas.map(idea => idea.topic))];

  // Get next category
  const lastIdea = await db.select()
    .from(ideas)
    .orderBy(sql`${ideas.created_at} DESC`)
    .limit(1)
    .run();

  const categories = ['physical', 'service', 'digital', 'eco', 'food', 'skills'];
  let category = categories[0];
  
  if (lastIdea.length > 0) {
    const currentIndex = categories.indexOf(lastIdea[0].category);
    const nextIndex = (currentIndex + 1) % categories.length;
    category = categories[nextIndex];
  }

  // Build prompt and generate idea
  const prompt = buildPrompt(previousTopics, category);
  const { content, topic } = await generateIdea(previousTopics, category, prompt);

  // Save idea to database
  const now = Math.floor(Date.now() / 1000);
  const [savedIdea] = await db.insert(ideas)
    .values({
      content,
      topic,
      category,
      status: 'pending',
      created_at: now
    })
    .returning()
    .run();

  await api.sendMessage({
    chat_id: chatId,
    text: content,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Approve & Post', callback_data: `approve_${savedIdea.id}` },
          { text: '❌ Reject — New Idea', callback_data: `reject_${savedIdea.id}` }
        ]
      ]
    }
  });
}

async function handleApprove(chatId, callbackQueryId, messageId, data) {
  const id = parseInt(data.replace('approve_', ''));
  await api.answerCallbackQuery({ callback_query_id: callbackQueryId });

  // Get idea from database
  const ideaResults = await db.select()
    .from(ideas)
    .where(sql`${ideas.id} = ${id}`)
    .run();

  if (ideaResults.length === 0) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Idea not found'
    });
    return;
  }

  const idea = ideaResults[0];
  const channelId = process.env.TRUE_FEED_CHANNEL_ID;

  // Post to channel
  await api.sendMessage({
    chat_id: channelId,
    text: idea.content
  });

  // Mark as posted
  const now = Math.floor(Date.now() / 1000);
  await db.update(ideas)
    .set({ status: 'posted', posted_at: now })
    .where(sql`${ideas.id} = ${id}`)
    .run();

  console.log(`📤 Posted idea [${id}] to True Feed`);

  await api.sendMessage({
    chat_id: chatId,
    text: '✅ True Feed ላይ ተለቀቀ!\n\n' + idea.content
  });

  await api.sendMessage({
    chat_id: chatId,
    text: '🎉 ተሳካ! ቀጣዩን ሀሳብ ሲፈልጉ:',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌱 አዲስ ሀሳብ ስጠኝ', callback_data: 'new_idea' }]
      ]
    }
  });
}

async function handleReject(chatId, callbackQueryId, messageId, data) {
  const id = parseInt(data.replace('reject_', ''));
  await api.answerCallbackQuery({ callback_query_id: callbackQueryId });

  // Mark as rejected
  await db.update(ideas)
    .set({ status: 'rejected' })
    .where(sql`${ideas.id} = ${id}`)
    .run();

  console.log(`❌ Rejected idea [${id}]`);

  await api.sendMessage({
    chat_id: chatId,
    text: '❌ ተቀባይነት አላገኘም\n\n⏳ አዲስ ሀሳብ እየተዘጋጀ ነው...'
  });

  // Generate new idea
  await handleNewIdea(chatId, callbackQueryId);
}
