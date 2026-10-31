import { api } from 'sdk';
import { NEWS_CATEGORIES, NEWS_PLATFORMS } from './news.js';
import { getCustomSources, getAutoPostSchedule } from './database.js';

export async function showAutoPostIntervalPicker(chatId, channelId, isUpdate = false) {
  const prefix = isUpdate ? 'update_auto_post' : 'setup_auto_post';
  const customPrefix = isUpdate ? 'custom_auto_post_update' : 'custom_auto_post_setup';

  const keyboard = [
    [
      { text: '🧪 5 sec (Test)', callback_data: `${prefix}_${channelId}_0.00138889` }
    ],
    [
      { text: '30 min', callback_data: `${prefix}_${channelId}_0.5` },
      { text: '1 hr', callback_data: `${prefix}_${channelId}_1` }
    ],
    [
      { text: '2 hr', callback_data: `${prefix}_${channelId}_2` },
      { text: '3 hr', callback_data: `${prefix}_${channelId}_3` }
    ],
    [
      { text: '⏱️ Custom Interval', callback_data: `${customPrefix}_${channelId}` }
    ],
    [
      { text: '« Back', callback_data: isUpdate ? 'auto_post' : 'ap_sel_chn' }
    ]
  ];

  await api.sendMessage({
    chat_id: chatId,
    text: `⏱️ <b>Auto Post Interval</b>\n\nChannel: <code>${channelId}</code>\n\nChoose how often you want new content to be automatically posted:`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

export async function showAutoPostCategoryPicker(chatId, channelId, intervalHours, isUpdate = false) {
  const userSchedule = await getAutoPostSchedule(chatId);
  const actionPrefix = isUpdate ? 'ap_up_cat' : 'ap_st_cat';

  const keyboard = [];
  for (let i = 0; i < NEWS_CATEGORIES.length; i += 2) {
    const row = [];
    row.push({
      text: NEWS_CATEGORIES[i].name,
      callback_data: `${actionPrefix}_${channelId}_${intervalHours}_${NEWS_CATEGORIES[i].id}`
    });
    if (i + 1 < NEWS_CATEGORIES.length) {
      row.push({
        text: NEWS_CATEGORIES[i + 1].name,
        callback_data: `${actionPrefix}_${channelId}_${intervalHours}_${NEWS_CATEGORIES[i + 1].id}`
      });
    }
    keyboard.push(row);
  }

  // Check for custom sources
  const customSources = await getCustomSources(chatId);
  if (customSources && customSources.length > 0) {
    keyboard.push([
      { 
        text: `⭐ My Sources (${customSources.length})`, 
        callback_data: `${actionPrefix}_${channelId}_${intervalHours}_custom` 
      }
    ]);
  }

  keyboard.push([
    { text: '🌐 All News Platforms', callback_data: `${actionPrefix}_${channelId}_${intervalHours}_all` }
  ]);

  keyboard.push([
    { text: 'Cancel', callback_data: 'auto_post' }
  ]);

  await api.sendMessage({
    chat_id: chatId,
    text: `📡 <b>Select Content Source Category:</b>\n\nChoose the category of platforms for your automated posts:`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

export async function showAutoPostPlatformPicker(chatId, userId, channelId, intervalHours, catId, isUpdate = false) {
  const actionPrefix = isUpdate ? 'ap_up_plat' : 'ap_st_plat';
  let platforms = [];

  if (catId === 'custom') {
    const customSources = await getCustomSources(userId);
    platforms = customSources.map(s => ({
      id: `custom_${s.id}`,
      name: `⭐ ${s.source_name}`
    }));
  } else if (catId === 'all') {
    platforms = NEWS_PLATFORMS;
  } else {
    platforms = NEWS_PLATFORMS.filter(p => p.category === catId);
  }

  const keyboard = [];
  for (let i = 0; i < platforms.length; i += 2) {
    const row = [];
    row.push({
      text: platforms[i].name,
      callback_data: `${actionPrefix}_${channelId}_${intervalHours}_${platforms[i].id}`
    });
    if (i + 1 < platforms.length) {
      row.push({
        text: platforms[i + 1].name,
        callback_data: `${actionPrefix}_${channelId}_${intervalHours}_${platforms[i + 1].id}`
      });
    }
    keyboard.push(row);
  }

  keyboard.push([
    { text: '« Back to Categories', callback_data: `${isUpdate ? 'ap_up_back' : 'ap_st_back'}_${channelId}_${intervalHours}` },
    { text: 'Cancel', callback_data: 'auto_post' }
  ]);

  const catObj = NEWS_CATEGORIES.find(c => c.id === catId);
  const catName = catObj ? catObj.name : (catId === 'custom' ? 'My Sources' : 'All Platforms');

  await api.sendMessage({
    chat_id: chatId,
    text: `📰 <b>${catName}</b>\n\nSelect the platform to generate and auto-post content from:`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}
