import { api } from 'sdk';
import { NEWS_CATEGORIES, NEWS_PLATFORMS } from './news.js';
import { getCustomSources, getAutoPostSchedule, getUserByTelegramId, createAutoPostSchedule, updateAutoPostSchedule } from './database.js';
import { parseAutoPostPlatforms } from './autopost_platforms.js';

export async function showAutoPostIntervalPicker(chatId, channelId, isUpdate = false) {
  const prefix = isUpdate ? 'update_auto_post' : 'setup_auto_post';
  const customPrefix = isUpdate ? 'custom_auto_post_update' : 'custom_auto_post_setup';

  const keyboard = [
    [
      { text: '⏱️ 1 min', callback_data: `${prefix}_${channelId}_0.01666667` },
      { text: '2 hr', callback_data: `${prefix}_${channelId}_2` }
    ],
    [
      { text: '4 hr', callback_data: `${prefix}_${channelId}_4` },
      { text: '7 hr', callback_data: `${prefix}_${channelId}_7` }
    ],
    [
      { text: '⚙️ Custom Interval', callback_data: `${customPrefix}_${channelId}` }
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
    text: `📡 <b>Select Content Source Category:</b>\n\nChoose the category of platforms for your automated posts. You can pick multiple platforms across categories:`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

// Ensures a news auto-post schedule row exists and matches the chosen
// channel/interval. The schedule row itself stores the selected platforms,
// so multi-select state survives across picker screens without extra state.
async function ensureAutoPostSchedule(userId, channelId, intervalHours) {
  let schedule = await getAutoPostSchedule(userId, 'news');
  if (!schedule) {
    const user = await getUserByTelegramId(userId);
    if (!user) return null;
    schedule = await createAutoPostSchedule(user.id, channelId, intervalHours, null, null, 'news', null);
    await updateAutoPostSchedule(schedule.id, undefined, undefined, false);
    return schedule;
  }

  const sameChannel = schedule.channel_id === channelId;
  const sameInterval = Math.abs(Number(schedule.interval_hours) - Number(intervalHours)) < 1e-9;
  if (!sameChannel || !sameInterval) {
    schedule = await updateAutoPostSchedule(schedule.id, channelId, intervalHours, undefined) || schedule;
  }
  return schedule;
}

export async function showAutoPostPlatformPicker(chatId, userId, channelId, intervalHours, catId, isUpdate = false) {
  const schedule = await ensureAutoPostSchedule(userId, channelId, intervalHours);
  if (!schedule) return;

  const selected = new Set(parseAutoPostPlatforms(schedule.source_platform));
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
    const p1 = platforms[i];
    row.push({
      text: `${selected.has(p1.id) ? '✅ ' : ''}${p1.name}`,
      callback_data: `ap_ptog_${catId}:${p1.id}`
    });
    if (i + 1 < platforms.length) {
      const p2 = platforms[i + 1];
      row.push({
        text: `${selected.has(p2.id) ? '✅ ' : ''}${p2.name}`,
        callback_data: `ap_ptog_${catId}:${p2.id}`
      });
    }
    keyboard.push(row);
  }

  keyboard.push([
    { text: `✅ Done (${selected.size} selected)`, callback_data: 'ap_pdone' }
  ]);

  keyboard.push([
    { text: '« Back to Categories', callback_data: `${isUpdate ? 'ap_up_back' : 'ap_st_back'}_${channelId}_${intervalHours}` },
    { text: 'Cancel', callback_data: 'ap_cancel' }
  ]);

  const catObj = NEWS_CATEGORIES.find(c => c.id === catId);
  const catName = catObj ? catObj.name : (catId === 'custom' ? 'My Sources' : 'All Platforms');

  await api.sendMessage({
    chat_id: chatId,
    text: `📰 <b>${catName}</b>\n\nTap platforms to select or deselect them. You can add platforms from multiple categories — selected: <b>${selected.size}</b>`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

export async function showAutoPostLanguagePicker(chatId, isUpdate = false) {
  const schedule = await getAutoPostSchedule(chatId, 'news');
  const selectedCount = schedule ? parseAutoPostPlatforms(schedule.source_platform).length : 0;

  const keyboard = [
    [
      { text: '🇪🇹 አማርኛ (Amharic)', callback_data: 'ap_nlang_am' },
      { text: '🇪🇹 ትግርኛ (Tigrinya)', callback_data: 'ap_nlang_ti' }
    ],
    [
      { text: '🇪🇹 Afaan Oromoo', callback_data: 'ap_nlang_om' },
      { text: '🇬🇧 English (Original)', callback_data: 'ap_nlang_en' }
    ],
    [
      { text: '« Back to Auto Post', callback_data: 'auto_post' }
    ]
  ];

  await api.sendMessage({
    chat_id: chatId,
    text: `🌐 <b>Select Translation Language:</b>\n\nChoose the target language for auto-posted articles. Selected sources: <b>${selectedCount}</b>`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

export async function showRepetitiveIntervalPicker(chatId, channelId, isUpdate = false) {
  const customPrefix = isUpdate ? 'custom_rep_task_update' : 'custom_rep_task_setup';
  const actionPrefix = isUpdate ? 'rep_up_ivl' : 'rep_st_ivl';

  const keyboard = [
    [
      { text: '⏱️ 1 min', callback_data: `${actionPrefix}_${channelId}_0.01666667` },
      { text: '30 min', callback_data: `${actionPrefix}_${channelId}_0.5` }
    ],
    [
      { text: '1 hr', callback_data: `${actionPrefix}_${channelId}_1` },
      { text: '2 hr', callback_data: `${actionPrefix}_${channelId}_2` }
    ],
    [
      { text: '4 hr', callback_data: `${actionPrefix}_${channelId}_4` },
      { text: '8 hr', callback_data: `${actionPrefix}_${channelId}_8` }
    ],
    [
      { text: '⚙️ Custom Interval', callback_data: `${customPrefix}_${channelId}` }
    ],
    [
      { text: '« Back', callback_data: isUpdate ? 'repetitive_task' : 'rep_sel_chn' }
    ]
  ];

  await api.sendMessage({
    chat_id: chatId,
    text: `⏱️ <b>Repetitive Task Interval</b>\n\nChannel: <code>${channelId}</code>\n\nChoose how often you want this repetitive message or reminder to be posted:`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}
