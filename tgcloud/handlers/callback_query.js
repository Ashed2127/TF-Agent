// handlers/callback_query.js — runs on each callback_query update (button clicks)

import { api } from 'sdk';
import { generateIdea } from '../lib/agent.js';
import { markPosted, markRejected, getIdeaById, savePendingEdit, getPendingEdit, deletePendingEdit, getUserByTelegramId, updateUserOnboardingStep, updateUserCategories, updateUserBotDisplayName, updateUserShowSourceLink, updateUserDotPunctuation, getDashboardStats, getAllUsers, getAllPosts, createPost, getUserPosts, updateUserChannelId, updateUserType, addUserChannel, getUserChannels, deleteUserChannel, getUserChannelById, setPendingChannelAdd, getPendingChannelAdd, clearPendingChannelAdd, migrateUserChannels, removeDuplicateChannels, getCustomSources, getContentStructure, getAutoPostSchedule, saveContentStructure, deleteContentStructure, createAutoPostSchedule, updateAutoPostSchedule, toggleAutoPostSchedule, deleteAutoPostSchedule, getDueAutoPostSchedules, updateAutoPostLastPosted, recordPostInteraction, getPostReactionsSummary } from '../lib/database.js';
import { BotApiError } from 'sdk';
import { TRUE_FEED_CHANNEL_ID, TEST_CHANNEL_ID } from '../lib/secrets.js';
import { NEWS_PLATFORMS, NEWS_CATEGORIES, fetchRSSFeed, getPlatformById, formatNewsArticle, translateToAmharic, directTranslateToAmharic, directTranslateToLanguage, SUPPORTED_LANGUAGES } from '../lib/news.js';
import { normalizeChannelId, extractChannelFromMessage } from '../lib/channel.js';
import { fetchEthiopianDollarRates, fetchBTCPrice, formatEthiopianRates, formatBTCPrice } from '../lib/rates.js';

const OWNER_CHAT_ID = 685669468;

/**
 * Top funny meme / sticker reaction types definition
 * Emojis and labels representing popular funny sticker emotions (lol/dead, mindblown, chad/cool, shocked/crying)
 */
export const FUNNY_STICKER_REACTIONS = [
  { id: 'lol', emoji: '🤣', label: 'Dead', stickerUrl: 'https://cdn-icons-png.flaticon.com/512/742/742751.png' },
  { id: 'mindblown', emoji: '🤯', label: 'Mindblown', stickerUrl: 'https://cdn-icons-png.flaticon.com/512/742/742752.png' },
  { id: 'chad', emoji: '😎', label: 'Chad', stickerUrl: 'https://cdn-icons-png.flaticon.com/512/742/742750.png' },
  { id: 'shocked', emoji: '💀', label: 'Cooked', stickerUrl: 'https://cdn-icons-png.flaticon.com/512/742/742817.png' },
  { id: 'fire', emoji: '🔥', label: 'Fire', stickerUrl: 'https://cdn-icons-png.flaticon.com/512/742/742774.png' }
];

/**
 * Build reaction buttons keyboard for published posts using top funny image/sticker styles
 */
export function buildPostReactionKeyboard(postId, counts = {}) {
  // Construct funny sticker reaction row
  const buttons = FUNNY_STICKER_REACTIONS.map(sticker => {
    const count = counts[sticker.id] || 0;
    const badge = count > 0 ? ` ${count}` : '';
    return {
      text: `${sticker.emoji}${badge}`,
      callback_data: `react:${sticker.id}:${postId}`
    };
  });

  return [buttons];
}

/**
 * Helper function to show the main menu for public users
 */
async function showMainMenu(chatId, isOwner = false) {
  const keyboard = [
    [
      { text: 'Generate Content', callback_data: 'generate_content' },
      { text: 'Settings', callback_data: 'settings' }
    ],
    [
      { text: '🌐 Direct Translation', callback_data: 'direct_translate_menu' },
      { text: 'Rates', callback_data: 'get_rates' }
    ],
    [
      { text: 'My Stats', callback_data: 'my_stats' }
    ],
    [
      { text: 'Refresh', callback_data: 'refresh_menu' }
    ],
    [
      { text: 'Switch to Guest Mode', callback_data: 'switch_to_guest' }
    ],
    [
      { text: 'Back', callback_data: 'back' }
    ]
  ];

  // Add analytics button for owner
  if (isOwner) {
    keyboard.splice(4, 0, [
      { text: ' Analytics Dashboard', web_app: { url: 'https://app8909892200.tgcloud.ai/' } }
    ]);
  }

  await api.sendMessage({
    chat_id: chatId,
    text: 'True Feed Content Creator\n\nWhat would you like to do?',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

/**
 * Helper function to show the guest menu
 */
async function showGuestMenu(chatId) {
  await api.sendMessage({
    chat_id: chatId,
    text: ' True Feed Guest Mode\n\nBrowse and translate news - no channel required!',
    reply_markup: {
      inline_keyboard: [
        [
          { text: ' Browse News', callback_data: 'get_news' },
          { text: 'Rates', callback_data: 'get_rates' }
        ],
        [
          { text: 'Settings', callback_data: 'settings' }
        ],
        [
          { text: ' Switch to User Mode', callback_data: 'switch_to_user' }
        ],
        [
          { text: 'Refresh', callback_data: 'refresh_guest_menu' }
        ],
        [
          { text: 'Back', callback_data: 'back' }
        ]
      ]
    }
  });
}

/**
 * Helper function to show the next news article
 */
async function showNextArticle(callbackQuery, platformId, currentIndex) {
  let platform = getPlatformById(platformId);
  const userId = callbackQuery.from.id;
  const user = await getUserByTelegramId(userId);

  // Handle custom sources
  if (!platform && platformId.startsWith('custom_')) {
    const customSourceId = parseInt(platformId.replace('custom_', ''));
    const customSources = user ? await getCustomSources(user.id) : [];
    const customSource = customSources.find(s => s.id === customSourceId);
    if (customSource) {
      platform = {
        id: platformId,
        name: customSource.source_name,
        category: 'custom',
        url: customSource.source_url,
        isCustom: true
      };
    }
  }

  if (!platform) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: 'Platform not found.',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Back', callback_data: 'back' }
          ]
        ]
      }
    });
    return;
  }

  try {
    // Show loading message
    const loadingMessage = await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ` Fetching next article from ${platform.name}...`,
    });

    const articles = await fetchRSSFeed(platform.url, platform.name);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= articles.length) {
      await api.deleteMessage({
        chat_id: callbackQuery.message.chat.id,
        message_id: loadingMessage.message_id,
      });
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' No more articles from this platform.',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Refresh', callback_data: `news_platform_${platformId}` },
              { text: 'Back', callback_data: 'back' }
            ]
          ]
        }
      });
      return;
    }

    const article = articles[nextIndex];

    // Get user channel link for content creator attribution (only for non-guest users)
    let userChannelLink = null;
    if (user && user.user_type !== 'guest') {
      // Get channels from user_channels table
      const userChannels = await getUserChannels(user.id);
      if (userChannels.length > 0) {
        // Use the first channel or the main channel if available
        const mainChannel = userChannels.find(c => c.is_main === 1) || userChannels[0];
        const channelName = mainChannel.channel_name || mainChannel.channel_id;
        if (channelName) {
          // Format as @channelname if it starts with @, otherwise as t.me/channelname
          if (channelName.startsWith('@')) {
            userChannelLink = channelName;
          } else {
            userChannelLink = `t.me/${channelName}`;
          }
        }
      }
    }

    const showSourceLink = user?.show_source_link === 1;
    const useDotPunctuation = user?.use_dot_punctuation === 1;
    const articleText = await formatNewsArticle(article, userChannelLink, showSourceLink, useDotPunctuation, userId);

    // Delete loading message
    await api.deleteMessage({
      chat_id: callbackQuery.message.chat.id,
      message_id: loadingMessage.message_id,
    });

    // Determine keyboard based on user type and test channel availability
    const isOwner = userId === OWNER_CHAT_ID;
    let keyboard;

    if (isOwner) {
      keyboard = [
        [
          { text: 'TrueFeed', callback_data: `news_truefeed_${platformId}_${nextIndex}` },
          { text: 'Test', callback_data: `news_test_${platformId}_${nextIndex}` }
        ],
        [
          { text: '🌐 Direct Translate', callback_data: `news_direct_pick_${platformId}_${nextIndex}` },
          { text: 'Edit', callback_data: `news_edit_${platformId}_${nextIndex}` }
        ],
        [
          { text: 'Skip', callback_data: `news_skip_${platformId}_${nextIndex}` }
        ],
        [
          { text: 'Back', callback_data: 'get_news' }
        ]
      ];
    } else if (user?.user_type === 'guest') {
      // Guest mode - no posting, just edit and skip
      keyboard = [
        [
          { text: '🌐 Direct Translate', callback_data: `news_direct_pick_${platformId}_${nextIndex}` },
          { text: 'Edit', callback_data: `news_edit_${platformId}_${nextIndex}` }
        ],
        [
          { text: 'Skip', callback_data: `news_skip_${platformId}_${nextIndex}` }
        ],
        [
          { text: 'Back', callback_data: 'get_news' }
        ]
      ];
    } else {
      // User mode - can post to channels
      const hasTestChannel = user && user.test_channel_id;

      if (hasTestChannel) {
        keyboard = [
          [
            { text: ' Main Channel', callback_data: `news_user_channel_${platformId}_${nextIndex}` },
            { text: 'Test Channel', callback_data: `news_user_test_channel_${platformId}_${nextIndex}` }
          ],
          [
            { text: '🌐 Direct Translate', callback_data: `news_direct_pick_${platformId}_${nextIndex}` },
            { text: 'Edit', callback_data: `news_edit_${platformId}_${nextIndex}` }
          ],
          [
            { text: 'Skip', callback_data: `news_skip_${platformId}_${nextIndex}` }
          ],
          [
            { text: 'Back', callback_data: 'get_news' }
          ]
        ];
      } else {
        keyboard = [
          [
            { text: ' Post to Channel', callback_data: `news_user_channel_${platformId}_${nextIndex}` }
          ],
          [
            { text: '🌐 Direct Translate', callback_data: `news_direct_pick_${platformId}_${nextIndex}` },
            { text: 'Edit', callback_data: `news_edit_${platformId}_${nextIndex}` }
          ],
          [
            { text: 'Skip', callback_data: `news_skip_${platformId}_${nextIndex}` }
          ],
          [
            { text: 'Back', callback_data: 'get_news' }
          ]
        ];
      }
    }

    // Send with video if available, otherwise image, otherwise just text
    if (article.video) {
      try {
        await api.sendVideo({
          chat_id: callbackQuery.message.chat.id,
          video: article.video,
          caption: articleText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      } catch (videoError) {
        console.error('Failed to send video, falling back to image:', videoError.message);
        // Fallback to image if video fails
        if (article.image) {
          try {
            await api.sendPhoto({
              chat_id: callbackQuery.message.chat.id,
              photo: article.image,
              caption: articleText,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
          } catch (photoError) {
            console.error('Failed to send photo, falling back to text:', photoError.message);
            await api.sendMessage({
              chat_id: callbackQuery.message.chat.id,
              text: articleText,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
          }
        } else {
          await api.sendMessage({
            chat_id: callbackQuery.message.chat.id,
            text: articleText,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
        }
      }
    } else if (article.image) {
      try {
        await api.sendPhoto({
          chat_id: callbackQuery.message.chat.id,
          photo: article.image,
          caption: articleText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      } catch (photoError) {
        console.error('Failed to send photo, falling back to text:', photoError.message);
        // Fallback to text if photo fails
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: articleText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      }
    } else {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: articleText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    }

  } catch (error) {
    console.error('Error showing next article:', error);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ` Failed to load next article: ${error.message}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Back', callback_data: 'back' }
          ]
        ]
      }
    });
  }
}

export default async function (callbackQuery, ctx) {
  const userId = callbackQuery.from.id;

  const data = callbackQuery.data;
  console.log('Callback received:', data, 'from user:', userId);

  // Handle reaction on posted channel content (e.g., react:like:123 or react:fire:123)
  if (data && data.startsWith('react:')) {
    const parts = data.split(':');
    const reactionType = parts[1] || 'like';
    const postId = parseInt(parts[2], 10);
    const channelId = callbackQuery.message?.chat?.id || null;

    try {
      const username = callbackQuery.from.username ? `@${callbackQuery.from.username}` : null;
      const firstName = callbackQuery.from.first_name || '';

      const result = await recordPostInteraction(postId, channelId, userId, username, firstName, reactionType);
      const summary = await getPostReactionsSummary(postId);

      const stickerDef = FUNNY_STICKER_REACTIONS.find(s => s.id === reactionType);
      const stickerSymbol = stickerDef ? stickerDef.emoji : (reactionType === 'like' ? '❤️' : reactionType);
      const alertMsg = result.action === 'added'
        ? `You reacted with ${stickerSymbol} ${stickerDef ? stickerDef.label : ''}!`
        : `Reaction removed!`;

      try {
        await api.answerCallbackQuery({
          callback_query_id: callbackQuery.id,
          text: alertMsg,
        });
      } catch (_) {}

      // Update button counters on the post
      const updatedKeyboard = buildPostReactionKeyboard(postId, summary.counts);
      if (callbackQuery.message?.message_id && callbackQuery.message?.chat?.id) {
        try {
          await api.editMessageReplyMarkup({
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id,
            reply_markup: {
              inline_keyboard: updatedKeyboard
            }
          });
        } catch (e) {
          console.log('Failed to update inline reaction markup:', e.message);
        }
      }
    } catch (err) {
      console.error('Error handling reaction callback:', err.message);
    }
    return;
  }

  // Answer the callback query (skip if it might be old)
  try {
    await api.answerCallbackQuery({
      callback_query_id: callbackQuery.id,
    });
  } catch (e) {
    console.log('Callback query already answered or expired:', e.message);
  }

  // Handle User/Guest choice
  if (data === 'choose_user') {
    const user = await getUserByTelegramId(userId);

    // Check if user has already completed onboarding
    if (user && user.onboarding_step === 'completed') {
      await updateUserType(userId, 'user');
      await showMainMenu(callbackQuery.message.chat.id, userId === OWNER_CHAT_ID);
      return;
    }

    // Only start onboarding for new users
    await updateUserType(userId, 'user');
    await updateUserOnboardingStep(userId, 'join_channel');
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: 'User Mode Selected!\n\nTo get started, please join our True Feed channel first:',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Join True Feed Channel', url: 'https://t.me/true_feed' }
          ],
          [
            { text: 'I\'ve Joined', callback_data: 'check_join' }
          ]
        ]
      }
    });
    return;
  }

  if (data === 'choose_guest') {
    const user = await getUserByTelegramId(userId);

    // Check if user has already completed onboarding
    if (user && user.onboarding_step === 'completed') {
      await updateUserType(userId, 'guest');
      await showGuestMenu(callbackQuery.message.chat.id);
      return;
    }

    // Only set onboarding for new users
    await updateUserType(userId, 'guest');
    await updateUserOnboardingStep(userId, 'guest_ready');
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Guest Mode Activated!\n\nYou can now browse and translate news without setting up a channel.',
      reply_markup: {
        inline_keyboard: [
          [
            { text: ' Browse News', callback_data: 'get_news' },
            { text: 'Rates', callback_data: 'get_rates' }
          ],
          [
            { text: 'Settings', callback_data: 'settings' }
          ]
        ]
      }
    });
    return;
  }

  if (data === 'refresh_user_type') {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Welcome to True Feed!\n\nChoose how you want to use the bot:',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👤 User', callback_data: 'choose_user' },
            { text: ' Guest', callback_data: 'choose_guest' }
          ],
          [
            { text: 'Refresh', callback_data: 'refresh_user_type' }
          ],
          [
            { text: 'Back', callback_data: 'back' }
          ]
        ]
      }
    });
    return;
  }

  if (data === 'switch_to_user') {
    const user = await getUserByTelegramId(userId);

    // Check if user has already completed onboarding
    if (user && user.onboarding_step === 'completed') {
      await updateUserType(userId, 'user');
      await showMainMenu(callbackQuery.message.chat.id, userId === OWNER_CHAT_ID);
      return;
    }

    await updateUserType(userId, 'user');
    await updateUserOnboardingStep(userId, 'join_channel');
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Switching to User Mode...\n\nTo get started, please join our True Feed channel first:',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Join True Feed Channel', url: 'https://t.me/true_feed' }
          ],
          [
            { text: 'I\'ve Joined', callback_data: 'check_join' }
          ]
        ]
      }
    });
    return;
  }

  if (data === 'switch_to_guest') {
    const user = await getUserByTelegramId(userId);

    // Check if user has already completed onboarding
    if (user && user.onboarding_step === 'completed') {
      await updateUserType(userId, 'guest');
      await showGuestMenu(callbackQuery.message.chat.id);
      return;
    }

    // Only set onboarding for new users
    await updateUserType(userId, 'guest');
    await updateUserOnboardingStep(userId, 'guest_ready');
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Switched to Guest Mode!\n\nYou can now browse and translate news without setting up a channel.',
      reply_markup: {
        inline_keyboard: [
          [
            { text: ' Browse News', callback_data: 'get_news' },
            { text: 'Rates', callback_data: 'get_rates' }
          ],
          [
            { text: 'Settings', callback_data: 'settings' }
          ],
          [
            { text: ' Switch to User Mode', callback_data: 'switch_to_user' }
          ],
          [
            { text: 'Refresh', callback_data: 'refresh_guest_menu' }
          ],
          [
            { text: 'Back', callback_data: 'back' }
          ]
        ]
      }
    });
    return;
  }

  // Handle refresh menu buttons
  if (data === 'refresh_menu') {
    const user = await getUserByTelegramId(userId);
    if (user && user.user_type === 'user' && user.onboarding_step === 'completed') {
      await showMainMenu(callbackQuery.message.chat.id, userId === OWNER_CHAT_ID);
    }
    return;
  }

  if (data === 'refresh_guest_menu') {
    const user = await getUserByTelegramId(userId);
    if (user && user.user_type === 'guest') {
      await showGuestMenu(callbackQuery.message.chat.id);
    }
    return;
  }

  // Handle public onboarding callbacks (no auth check)
  if (data === 'check_join') {
    await handleCheckJoin(callbackQuery, userId);
    return;
  }

  if (data === 'change_channel') {
    await handleChangeChannel(callbackQuery, userId);
    return;
  }

  if (data === 'bot_admin_added') {
    await handleBotAdminAdded(callbackQuery, userId);
    return;
  }

  if (data === 'skip_display_name') {
    await handleSkipDisplayName(callbackQuery, userId);
    return;
  }

  if (data.startsWith('select_category_')) {
    await handleSelectCategory(callbackQuery, userId, data);
    return;
  }

  if (data === 'add_custom_source') {
    await handleAddCustomSource(callbackQuery, userId);
    return;
  }

  if (data === 'complete_setup') {
    await handleCompleteSetup(callbackQuery, userId);
    return;
  }

  if (data === 'generate_content') {
    await handleGenerateContent(callbackQuery, userId);
    return;
  }

  if (data === 'get_rates') {
    await handleGetRates(callbackQuery, userId);
    return;
  }

  if (data === 'rate_dollar') {
    await handleDollarRate(callbackQuery, userId);
    return;
  }

  if (data === 'rate_btc') {
    await handleBTCRate(callbackQuery, userId);
    return;
  }

  if (data.startsWith('news_user_channel_')) {
    await handlePostToUserChannel(callbackQuery, userId, data);
    return;
  }

  if (data.startsWith('news_user_test_channel_')) {
    await handlePostToUserTestChannel(callbackQuery, userId, data);
    return;
  }

  if (data.startsWith('news_direct_pick_')) {
    const parts = data.replace('news_direct_pick_', '').split('_');
    const platformId = parts.slice(0, -1).join('_');
    const currentIndex = parseInt(parts[parts.length - 1], 10);

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '🌐 <b>Choose Translation Language:</b>\n\nSelect which language you want to directly translate this article to (exact content preserved):',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇪🇹 አማርኛ (Amharic)', callback_data: `news_direct_am_${platformId}_${currentIndex}` }
          ],
          [
            { text: '🇪🇹 ትግርኛ (Tigrinya)', callback_data: `news_direct_ti_${platformId}_${currentIndex}` }
          ],
          [
            { text: '🇪🇹 Afaan Oromoo', callback_data: `news_direct_om_${platformId}_${currentIndex}` }
          ],
          [
            { text: '↩️ Cancel', callback_data: `news_skip_${platformId}_${currentIndex}` }
          ]
        ]
      }
    });
    return;
  }

  if (data.startsWith('news_translate_') || data.startsWith('news_direct_')) {
    await handleTranslate(callbackQuery, userId, data);
    return;
  }

  if (data === 'direct_translate_menu') {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '🌐 <b>Direct Translation</b>\n\nChoose your target language for direct translation without content modification:',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇪🇹 አማርኛ (Amharic)', callback_data: 'direct_translate_lang_am' }
          ],
          [
            { text: '🇪🇹 ትግርኛ (Tigrinya)', callback_data: 'direct_translate_lang_ti' }
          ],
          [
            { text: '🇪🇹 Afaan Oromoo', callback_data: 'direct_translate_lang_om' }
          ],
          [
            { text: '↩️ Back', callback_data: 'back' }
          ]
        ]
      }
    });
    return;
  }

  if (data.startsWith('direct_translate_lang_')) {
    const lang = data.replace('direct_translate_lang_', '');
    const langInfo = SUPPORTED_LANGUAGES[lang] || SUPPORTED_LANGUAGES.am;
    await setPendingChannelAdd(userId, `waiting_direct_${lang}`);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `🌐 <b>Direct Translation to ${langInfo.label}</b>\n\nSend or forward any English text, news article, or message here.\n\nThe bot will directly translate it to natural ${langInfo.name} without modifying, summarizing, or changing any of the content.`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '↩️ Back', callback_data: 'direct_translate_menu' }]
        ]
      }
    });
    return;
  }

  // Public news handlers (before owner check)
  if (data === 'get_news') {
    const user = await getUserByTelegramId(userId);
    const customSources = user ? await getCustomSources(user.id) : [];

    const keyboard = [];
    for (let i = 0; i < NEWS_CATEGORIES.length; i += 2) {
      const row = [];
      row.push({
        text: NEWS_CATEGORIES[i].name,
        callback_data: `news_cat_${NEWS_CATEGORIES[i].id}`
      });
      if (i + 1 < NEWS_CATEGORIES.length) {
        row.push({
          text: NEWS_CATEGORIES[i + 1].name,
          callback_data: `news_cat_${NEWS_CATEGORIES[i + 1].id}`
        });
      }
      keyboard.push(row);
    }

    // Add My Sources button if user has custom sources
    if (customSources.length > 0) {
      keyboard.push([
        { text: `My Sources (${customSources.length})`, callback_data: 'news_cat_custom' }
      ]);
    }

    keyboard.push([
      { text: 'All Sources', callback_data: 'news_cat_all' },
      { text: 'Refresh', callback_data: 'get_news' }
    ]);
    keyboard.push([
      { text: 'Back', callback_data: 'back' }
    ]);

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: 'Select a news category:',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    return;
  }

  if (data.startsWith('news_cat_')) {
    const catId = data.replace('news_cat_', '');
    let platforms = catId === 'all'
      ? NEWS_PLATFORMS
      : NEWS_PLATFORMS.filter(p => p.category === catId);

    // Handle custom sources category
    if (catId === 'custom') {
      const user = await getUserByTelegramId(userId);
      if (user) {
        const customSources = await getCustomSources(user.id);
        if (customSources.length > 0) {
          platforms = customSources.map((source, index) => ({
            id: `custom_${source.id}`,
            name: ` ${source.source_name}`,
            category: 'custom',
            url: source.source_url,
            isCustom: true
          }));
        } else {
          await api.sendMessage({
            chat_id: callbackQuery.message.chat.id,
            text: ' You have no custom sources yet.\n\nAdd custom sources during setup or in settings.',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Back', callback_data: 'get_news' }
                ]
              ]
            }
          });
          return;
        }
      }
    }

    // Add custom sources for "all" category
    if (catId === 'all') {
      const user = await getUserByTelegramId(userId);
      if (user) {
        const customSources = await getCustomSources(user.id);
        if (customSources.length > 0) {
          const customPlatforms = customSources.map((source, index) => ({
            id: `custom_${source.id}`,
            name: ` ${source.source_name}`,
            category: 'custom',
            url: source.source_url,
            isCustom: true
          }));
          platforms = [...customPlatforms, ...platforms];
        }
      }
    }

    const keyboard = [];
    for (let i = 0; i < platforms.length; i += 2) {
      const row = [];
      row.push({
        text: platforms[i].name,
        callback_data: `news_platform_${platforms[i].id}`
      });
      if (i + 1 < platforms.length) {
        row.push({
          text: platforms[i + 1].name,
          callback_data: `news_platform_${platforms[i + 1].id}`
        });
      }
      keyboard.push(row);
    }
    keyboard.push([
      { text: 'Refresh', callback_data: `news_cat_${catId}` },
      { text: '↩️ Categories', callback_data: 'get_news' }
    ]);

    const catObj = NEWS_CATEGORIES.find(c => c.id === catId);
    const catTitle = catObj ? catObj.name : (catId === 'custom' ? 'My Sources' : 'All Sources');
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `${catTitle} — Choose a source:`,
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    return;
  }

  if (data.startsWith('news_platform_')) {
    const platformId = data.replace('news_platform_', '');
    let platform = getPlatformById(platformId);
    const isOwner = userId === OWNER_CHAT_ID;
    const user = await getUserByTelegramId(userId);

    // Handle custom sources
    if (!platform && platformId.startsWith('custom_')) {
      const customSourceId = parseInt(platformId.replace('custom_', ''));
      const customSources = user ? await getCustomSources(user.id) : [];
      const customSource = customSources.find(s => s.id === customSourceId);
      if (customSource) {
        platform = {
          id: platformId,
          name: customSource.source_name,
          category: 'custom',
          url: customSource.source_url,
          isCustom: true
        };
      }
    }

    if (!platform) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: 'Platform not found.',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Back', callback_data: 'back' }
            ]
          ]
        }
      });
      return;
    }

    try {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ` Fetching news from ${platform.name}...`,
      });

      const articles = await fetchRSSFeed(platform.url, platform.name);

      if (articles.length === 0) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ` No news available from ${platform.name}.`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Back', callback_data: 'back' }
              ]
            ]
          }
        });
        return;
      }

      // Show first article with buttons
      const article = articles[0];

      // Get user channel link for content creator attribution (only for non-guest users)
      let userChannelLink = null;
      if (isOwner) {
        userChannelLink = '@true_feed';
      } else if (user && user.user_type !== 'guest') {
        const userChannels = await getUserChannels(user.id);
        if (userChannels.length > 0) {
          const mainChannel = userChannels.find(c => c.is_main === 1) || userChannels[0];
          const channelName = mainChannel.channel_name || mainChannel.channel_id;
          if (channelName) {
            if (channelName.startsWith('@')) {
              userChannelLink = channelName;
            } else {
              userChannelLink = `t.me/${channelName}`;
            }
          }
        }
      }

      const showSourceLink = user?.show_source_link === 1;
      const useDotPunctuation = user?.use_dot_punctuation === 1;
      const articleText = await formatNewsArticle(article, userChannelLink, showSourceLink, useDotPunctuation, userId);

      // Different buttons for owner vs user vs guest
      let keyboard;
      if (isOwner) {
        keyboard = [
          [
            { text: 'TrueFeed', callback_data: `news_truefeed_${platformId}_0` },
            { text: 'Test', callback_data: `news_test_${platformId}_0` }
          ],
          [
            { text: '🌐 Direct Translate', callback_data: `news_direct_pick_${platformId}_0` },
            { text: 'Edit', callback_data: `news_edit_${platformId}_0` }
          ],
          [
            { text: 'Skip', callback_data: `news_skip_${platformId}_0` }
          ],
          [
            { text: 'Back', callback_data: 'back' }
          ]
        ];
      } else if (user?.user_type === 'guest') {
        // Guest mode - no posting, just edit and skip
        keyboard = [
          [
            { text: '🌐 Direct Translate', callback_data: `news_direct_pick_${platformId}_0` },
            { text: 'Edit', callback_data: `news_edit_${platformId}_0` }
          ],
          [
            { text: 'Skip', callback_data: `news_skip_${platformId}_0` }
          ],
          [
            { text: 'Back', callback_data: 'back' }
          ]
        ];
      } else {
        // User mode - can post to channels
        const hasTestChannel = user && user.test_channel_id;

        if (hasTestChannel) {
          keyboard = [
            [
              { text: ' Main Channel', callback_data: `news_user_channel_${platformId}_0` },
              { text: 'Test Channel', callback_data: `news_user_test_channel_${platformId}_0` }
            ],
            [
              { text: '🌐 Direct Translate', callback_data: `news_direct_pick_${platformId}_0` },
              { text: 'Edit', callback_data: `news_edit_${platformId}_0` }
            ],
            [
              { text: 'Skip', callback_data: `news_skip_${platformId}_0` }
            ],
            [
              { text: 'Back', callback_data: 'back' }
            ]
          ];
        } else {
          keyboard = [
            [
              { text: ' Post to Channel', callback_data: `news_user_channel_${platformId}_0` }
            ],
            [
              { text: '🌐 Direct Translate', callback_data: `news_direct_pick_${platformId}_0` },
              { text: 'Edit', callback_data: `news_edit_${platformId}_0` }
            ],
            [
              { text: 'Skip', callback_data: `news_skip_${platformId}_0` }
            ],
            [
              { text: 'Back', callback_data: 'back' }
            ]
          ];
        }
      }

      // Send with video if available, otherwise image, otherwise just text
      if (article.video) {
        try {
          await api.sendVideo({
            chat_id: callbackQuery.message.chat.id,
            video: article.video,
            caption: articleText,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
        } catch (videoError) {
          console.error('Failed to send video, falling back to image:', videoError.message);
          // Fallback to image if video fails
          if (article.image) {
            try {
              await api.sendPhoto({
                chat_id: callbackQuery.message.chat.id,
                photo: article.image,
                caption: articleText,
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: keyboard
                }
              });
            } catch (photoError) {
              console.error('Failed to send photo, falling back to text:', photoError.message);
              await api.sendMessage({
                chat_id: callbackQuery.message.chat.id,
                text: articleText,
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: keyboard
                }
              });
            }
          } else {
            await api.sendMessage({
              chat_id: callbackQuery.message.chat.id,
              text: articleText,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
          }
        }
      } else if (article.image) {
        try {
          await api.sendPhoto({
            chat_id: callbackQuery.message.chat.id,
            photo: article.image,
            caption: articleText,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
        } catch (photoError) {
          console.error('Failed to send photo, falling back to text:', photoError.message);
          // Fallback to text if photo fails
          await api.sendMessage({
            chat_id: callbackQuery.message.chat.id,
            text: articleText,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
        }
      } else {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: articleText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      }

    } catch (error) {
      console.error('Error fetching news:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ` Failed to fetch news: ${error.message}`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Back', callback_data: 'back' }
            ]
          ]
        }
      });
    }
    return;
  }

  if (data.startsWith('news_skip_')) {
    const parts = data.replace('news_skip_', '').split('_');
    const platformId = parts[0];
    const currentIndex = parseInt(parts[1]);

    await showNextArticle(callbackQuery, platformId, currentIndex);
    return;
  }

  if (data.startsWith('news_edit_')) {
    console.log('news_edit callback received:', data);
    const parts = data.replace('news_edit_', '').split('_');
    const platformId = parts[0];
    const currentIndex = parseInt(parts[1]);

    // Extract image from the current message if it was a photo message
    let imageUrl = null;
    if (callbackQuery.message?.photo && callbackQuery.message.photo.length > 0) {
      imageUrl = callbackQuery.message.photo[callbackQuery.message.photo.length - 1].file_id;
    } else {
      // Fallback: look up article from RSS feed
      const platform = getPlatformById(platformId);
      if (platform) {
        try {
          const articles = await fetchRSSFeed(platform.url, platform.name);
          if (articles && articles[currentIndex] && articles[currentIndex].image) {
            imageUrl = articles[currentIndex].image;
          }
        } catch (e) {
          console.error('Error fetching article image for edit:', e);
        }
      }
    }

    console.log('Saving pending edit with image:', imageUrl);

    // Create a placeholder pending edit so the message handler knows
    // the user's next message is an edit (not a random message) and retains the image
    await savePendingEdit(callbackQuery.from.id, '__waiting__', imageUrl);

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Please send your edited version of the news.\n\nReply with the text you want to post.',
    });
    return;
  }

  // Handle settings button (public)
  if (data === 'settings') {
    const user = await getUserByTelegramId(userId);
    const showSourceLink = user?.show_source_link === 1 ? 'Yes' : 'No';
    const useDotPunctuation = user?.use_dot_punctuation === 1 ? 'Yes' : 'No';
    const categories = user.categories ? JSON.parse(user.categories) : [];
    const categoryNames = categories.map(catId => {
      const cat = NEWS_CATEGORIES.find(c => c.id === catId);
      return cat ? cat.name : catId;
    });
    const categoriesText = categoryNames.length > 0 ? categoryNames.join(', ') : 'None';

    const isOwner = userId === OWNER_CHAT_ID;
    const isGuest = user?.user_type === 'guest';
    const userChannels = await getUserChannels(user.id);

    // Get content structure and auto post status
    const contentStructure = await getContentStructure(user.id);
    const autoPostSchedule = await getAutoPostSchedule(user.id);
    const contentStructureStatus = contentStructure ? 'Set' : 'Not set';
    const autoPostStatus = autoPostSchedule ? (autoPostSchedule.is_active === 1 ? 'Active' : 'Paused') : 'Not set';

    // Build keyboard - only show channel management for non-guest users
    const keyboard = [
      [
        { text: 'Toggle Source Link', callback_data: 'toggle_source_link' }
      ],
      ...(isOwner ? [[{ text: 'Toggle Dot Punctuation', callback_data: 'toggle_dot_punctuation' }]] : []),
    ];

    // Add content structure and auto post options for non-guest users
    if (!isGuest) {
      keyboard.push(
        [
          { text: 'Content Structure', callback_data: 'content_structure' }
        ],
        [
          { text: 'Auto Post', callback_data: 'auto_post' }
        ],
        [
          { text: 'Manage Channels', callback_data: 'manage_channels' }
        ],
        [
          { text: 'Edit Channel Link', callback_data: 'edit_channel_link' },
          { text: ' Add Channel', callback_data: 'add_channel' }
        ]
      );
    }

    keyboard.push([
      { text: 'Back', callback_data: 'back' }
    ]);

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `Settings\n\nShow Source Link: ${showSourceLink}${isOwner ? `\nUse Dot Punctuation: ${useDotPunctuation}` : ''}\nYour Categories: ${categoriesText}${!isGuest ? `\nContent Structure: ${contentStructureStatus}\nAuto Post: ${autoPostStatus}\nYour Channels: ${userChannels.length}` : ''}\n\nWhat would you like to change?`,
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    return;
  }

  // Handle toggle source link
  if (data === 'toggle_source_link') {
    const user = await getUserByTelegramId(userId);
    const newValue = user?.show_source_link === 1 ? 0 : 1;
    await updateUserShowSourceLink(userId, newValue === 1);

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ` Source link ${newValue === 1 ? 'enabled' : 'disabled'}.`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Back', callback_data: 'settings' }
          ]
        ]
      }
    });
    return;
  }

  // Handle toggle dot punctuation (owner only)
  if (data === 'toggle_dot_punctuation') {
    const user = await getUserByTelegramId(userId);
    const newValue = user?.use_dot_punctuation === 1 ? 0 : 1;
    await updateUserDotPunctuation(userId, newValue === 1);

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ` Dot punctuation ${newValue === 1 ? 'enabled' : 'disabled'}.`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Back', callback_data: 'settings' }
          ]
        ]
      }
    });
    return;
  }

  // Handle manage channels
  if (data === 'manage_channels') {
    await handleManageChannels(callbackQuery, userId);
    return;
  }

  // Handle edit channel link
  if (data === 'edit_channel_link') {
    const user = await getUserByTelegramId(userId);
    const currentChannel = user.channel_name || user.channel_id || 'Not set';

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `Edit Channel Link\n\nCurrent channel: ${currentChannel}\n\nPlease send your new channel link or username (e.g., @mychannel or https://t.me/mychannel)`,
    });
    await setPendingChannelAdd(userId, 'edit_channel');
    return;
  }

  // Handle add channel
  if (data === 'add_channel') {
    await handleAddChannelStart(callbackQuery, userId);
    return;
  }

  // Handle content structure button
  if (data === 'content_structure') {
    const user = await getUserByTelegramId(userId);
    const contentStructure = await getContentStructure(user.id);

    if (contentStructure) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `Content Structure\n\nYour current structure:\n\n${contentStructure.structure_template}\n\nWhat would you like to do?`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Edit Structure', callback_data: 'edit_content_structure' }
            ],
            [
              { text: 'Delete Structure', callback_data: 'delete_content_structure' }
            ],
            [
              { text: 'Back', callback_data: 'settings' }
            ]
          ]
        }
      });
    } else {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `Content Structure\n\nYou haven't set up your content structure yet.\n\nThis helps the AI understand your posting style. Send a sample post that represents your desired format and style.`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Set Structure', callback_data: 'set_content_structure' }
            ],
            [
              { text: 'Back', callback_data: 'settings' }
            ]
          ]
        }
      });
    }
    return;
  }

  // Handle set content structure
  if (data === 'set_content_structure') {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `Set Content Structure\n\nPlease send a sample post that represents your desired format and style.\n\nThis can include:\n- Your title format\n- How you structure your content\n- Any special formatting you use\n- Your tone and style`,
    });
    await setPendingChannelAdd(userId, 'waiting_content_structure');
    return;
  }

  // Handle edit content structure
  if (data === 'edit_content_structure') {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `Edit Content Structure\n\nPlease send your new content structure sample.`,
    });
    await setPendingChannelAdd(userId, 'waiting_content_structure');
    return;
  }

  // Handle delete content structure
  if (data === 'delete_content_structure') {
    const user = await getUserByTelegramId(userId);
    await deleteContentStructure(user.id);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `Content structure deleted.`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Back', callback_data: 'settings' }
          ]
        ]
      }
    });
    return;
  }

  // Handle auto post button
  if (data === 'auto_post') {
    const user = await getUserByTelegramId(userId);
    const autoPostSchedule = await getAutoPostSchedule(user.id);
    const userChannels = await getUserChannels(user.id);
    const isOwner = userId === OWNER_CHAT_ID;

    if (autoPostSchedule) {
      const intervalText = autoPostSchedule.interval_hours < 1
        ? `${autoPostSchedule.interval_hours * 60} seconds`
        : `${autoPostSchedule.interval_hours} hour(s)`;
      const statusText = autoPostSchedule.is_active === 1 ? 'Active' : 'Paused';
      const channel = userChannels.find(c => c.channel_id === autoPostSchedule.channel_id);
      const channelName = channel ? channel.channel_name || channel.channel_id : autoPostSchedule.channel_id;

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `Auto Post Settings\n\nStatus: ${statusText}\nChannel: ${channelName}\nInterval: ${intervalText}\n\nWhat would you like to do?`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '▶️ Run Auto Post Now', callback_data: 'run_auto_post_now' }
            ],
            [
              { text: autoPostSchedule.is_active === 1 ? 'Pause' : 'Resume', callback_data: 'toggle_auto_post' }
            ],
            [
              { text: 'Edit Schedule', callback_data: 'edit_auto_post' }
            ],
            [
              { text: 'Delete Schedule', callback_data: 'delete_auto_post' }
            ],
            [
              { text: 'Back', callback_data: 'settings' }
            ]
          ]
        }
      });
    } else {
      if (userChannels.length === 0) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `Auto Post\n\nYou need to add a channel first before setting up auto post.`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Add Channel', callback_data: 'add_channel' }
              ],
              [
                { text: 'Back', callback_data: 'settings' }
              ]
            ]
          }
        });
      } else {
        let keyboard = [];

        // Add test interval (visible to all for testing)
        keyboard.push(
          ...userChannels.map(channel => [
            { text: `🧪 TEST: ${channel.channel_name || channel.channel_id} - 15 sec`, callback_data: `setup_auto_post_${channel.channel_id}_0.004` }
          ])
        );

        keyboard.push(
          ...userChannels.map(channel => [
            { text: `${channel.channel_name || channel.channel_id} - 1 hour`, callback_data: `setup_auto_post_${channel.channel_id}_1` },
            { text: `${channel.channel_name || channel.channel_id} - 3 hours`, callback_data: `setup_auto_post_${channel.channel_id}_3` }
          ]),
          ...userChannels.map(channel => [
            { text: `${channel.channel_name || channel.channel_id} - 6 hours`, callback_data: `setup_auto_post_${channel.channel_id}_6` },
            { text: `${channel.channel_name || channel.channel_id} - 12 hours`, callback_data: `setup_auto_post_${channel.channel_id}_12` }
          ]),
          [
            { text: 'Back', callback_data: 'settings' }
          ]
        );

        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `Auto Post\n\nSet up automatic posting to your channel.\n\nChoose a channel and posting interval.\n\n🧪 TEST MODE: 15 seconds for quick testing`,
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      }
    }
    return;
  }

  // Handle setup auto post
  if (data.startsWith('setup_auto_post_')) {
    const parts = data.replace('setup_auto_post_', '').split('_');
    const channelId = parts[0];
    const intervalHours = parseFloat(parts[1]);

    const user = await getUserByTelegramId(userId);
    await createAutoPostSchedule(user.id, channelId, intervalHours);

    const intervalText = intervalHours < 1
      ? `${intervalHours * 60} seconds`
      : `Every ${intervalHours} hour(s)`;

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `Auto post enabled!\n\nChannel: ${channelId}\nInterval: ${intervalText}\n\nThe bot will automatically generate and post content based on your schedule.`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Back', callback_data: 'settings' }
          ]
        ]
      }
    });
    return;
  }

  // Handle toggle auto post
  if (data === 'toggle_auto_post') {
    const user = await getUserByTelegramId(userId);
    const schedule = await getAutoPostSchedule(user.telegram_id);
    if (schedule) {
      const updated = await toggleAutoPostSchedule(schedule.id);
      const statusText = updated.is_active === 1 ? 'Active' : 'Paused';
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `Auto post ${statusText}.`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Back', callback_data: 'auto_post' }
            ]
          ]
        }
      });
    }
    return;
  }

  // Handle edit auto post
  if (data === 'edit_auto_post') {
    const user = await getUserByTelegramId(userId);
    const schedule = await getAutoPostSchedule(user.id);
    const userChannels = await getUserChannels(user.id);

    if (schedule && userChannels.length > 0) {
      let keyboard = [];

      // Add test interval (visible to all for testing)
      keyboard.push(
        ...userChannels.map(channel => [
          { text: `🧪 TEST: ${channel.channel_name || channel.channel_id} - 15 sec`, callback_data: `update_auto_post_${channel.channel_id}_0.004` }
        ])
      );

      keyboard.push(
        ...userChannels.map(channel => [
          { text: `${channel.channel_name || channel.channel_id} - 1 hour`, callback_data: `update_auto_post_${channel.channel_id}_1` },
          { text: `${channel.channel_name || channel.channel_id} - 3 hours`, callback_data: `update_auto_post_${channel.channel_id}_3` }
        ]),
        ...userChannels.map(channel => [
          { text: `${channel.channel_name || channel.channel_id} - 6 hours`, callback_data: `update_auto_post_${channel.channel_id}_6` },
          { text: `${channel.channel_name || channel.channel_id} - 12 hours`, callback_data: `update_auto_post_${channel.channel_id}_12` }
        ]),
        [
          { text: 'Back', callback_data: 'auto_post' }
        ]
      );

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `Edit Auto Post Schedule\n\nChoose a new interval:\n\n🧪 TEST MODE: 15 seconds for quick testing`,
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    }
    return;
  }

  // Handle update auto post
  if (data.startsWith('update_auto_post_')) {
    const parts = data.replace('update_auto_post_', '').split('_');
    const channelId = parts[0];
    const intervalHours = parseFloat(parts[1]);

    const user = await getUserByTelegramId(userId);
    const schedule = await getAutoPostSchedule(user.telegram_id);
    if (schedule) {
      await updateAutoPostSchedule(schedule.id, channelId, intervalHours, true);

      const intervalText = intervalHours < 1
        ? `${intervalHours * 60} seconds`
        : `Every ${intervalHours} hour(s)`;

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `Auto post schedule updated!\n\nChannel: ${channelId}\nInterval: ${intervalText}`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Back', callback_data: 'auto_post' }
            ]
          ]
        }
      });
    }
    return;
  }

  // Handle delete auto post
  if (data === 'delete_auto_post') {
    const user = await getUserByTelegramId(userId);
    const schedule = await getAutoPostSchedule(user.telegram_id);
    if (schedule) {
      await deleteAutoPostSchedule(schedule.id);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `Auto post schedule deleted.`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Back', callback_data: 'settings' }
            ]
          ]
        }
      });
    }
    return;
  }

  // Handle run auto post now
  if (data === 'run_auto_post_now') {
    const user = await getUserByTelegramId(userId);
    const schedule = await getAutoPostSchedule(user.telegram_id);

    if (!schedule) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `No auto post schedule found.`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Back', callback_data: 'auto_post' }
            ]
          ]
        }
      });
      return;
    }

    if (schedule.is_active !== 1) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `Auto post is paused. Please resume it first.`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Back', callback_data: 'auto_post' }
            ]
          ]
        }
      });
      return;
    }

    try {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `🔄 Running auto post...\n\nGenerating content...`,
      });

      console.log('Starting auto post for user:', user.id, 'to channel:', schedule.channel_id);

      // Generate content using user's content structure
      const idea = await generateIdea(user.telegram_id);
      console.log(`Generated idea: ${idea.topic}`);

      // Post to channel
      await api.sendMessage({
        chat_id: schedule.channel_id,
        text: idea.content,
        parse_mode: 'Markdown',
      });
      console.log('Posted to channel:', schedule.channel_id);

      // Create post record
      await createPost(user.id, schedule.channel_id, idea.content, idea.category, null, null);

      // Update schedule with last posted time
      await updateAutoPostLastPosted(schedule.id);

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `✅ Auto post successful!\n\nPosted to: ${schedule.channel_id}\nTopic: ${idea.topic}\n\nClick button to run again or go back to settings.`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '▶️ Run Again', callback_data: 'run_auto_post_now' }
            ],
            [
              { text: 'Back', callback_data: 'auto_post' }
            ]
          ]
        }
      });

    } catch (error) {
      console.error('Error running auto post:', error);
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = error.toString ? error.toString() : String(error);

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `❌ Auto post failed\n\nError: ${errorMessage}\n\nDetails: ${errorDetails.substring(0, 200)}${errorDetails.length > 200 ? '...' : ''}\n\nPlease try again or check your content structure settings.`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '▶️ Try Again', callback_data: 'run_auto_post_now' }
            ],
            [
              { text: 'Back', callback_data: 'auto_post' }
            ]
          ]
        }
      });
    }
    return;
  }

  // Handle delete channel
  if (data.startsWith('delete_channel_')) {
    const channelId = parseInt(data.replace('delete_channel_', ''));
    await handleDeleteChannel(callbackQuery, userId, channelId);
    return;
  }

  // Handle channel info
  if (data.startsWith('channel_info_')) {
    const channelId = parseInt(data.replace('channel_info_', ''));
    await handleChannelInfo(callbackQuery, userId, channelId);
    return;
  }

  // Handle post to specific channel by DB channel ID
  if (data.startsWith('post_chan:')) {
    const parts = data.split(':');
    const channelTableId = parseInt(parts[1], 10);
    const platformId = parts[2];
    const currentIndex = parseInt(parts[3], 10);

    const targetChannel = await getUserChannelById(channelTableId);
    if (!targetChannel) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Channel not found.',
      });
      return;
    }
    const channelName = targetChannel.channel_name || targetChannel.channel_id;
    await postArticleToChannel(callbackQuery, userId, platformId, currentIndex, targetChannel.channel_id, channelName);
    return;
  }

  // Handle post to specific channel (legacy fallback)
  if (data.startsWith('post_to_channel_')) {
    const raw = data.replace('post_to_channel_', '');
    const lastUnderscore = raw.lastIndexOf('_');
    const currentIndex = parseInt(raw.substring(lastUnderscore + 1), 10);
    const rest = raw.substring(0, lastUnderscore);
    const secondLast = rest.lastIndexOf('_');
    const platformId = rest.substring(secondLast + 1);
    const firstPart = rest.substring(0, secondLast);
    const firstUnderscore = firstPart.indexOf('_');
    const telegramChannelId = firstPart.substring(0, firstUnderscore);
    const channelName = firstPart.substring(firstUnderscore + 1);
    await postArticleToChannel(callbackQuery, userId, platformId, currentIndex, telegramChannelId, channelName);
    return;
  }

  // Handle post to all channels
  if (data.startsWith('post_to_all_')) {
    const parts = data.replace('post_to_all_', '').split('_');
    const platformId = parts[0];
    const currentIndex = parseInt(parts[1]);
    await postArticleToAllChannels(callbackQuery, userId, platformId, currentIndex);
    return;
  }

  // Handle my stats button (public)
  if (data === 'my_stats') {
    const user = await getUserByTelegramId(userId);
    if (!user) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' User not found.',
      });
      return;
    }

    const userPosts = await getUserPosts(user.id);
    const categories = user.categories ? JSON.parse(user.categories) : [];
    const categoryNames = categories.map(catId => {
      const cat = NEWS_CATEGORIES.find(c => c.id === catId);
      return cat ? cat.name : catId;
    });
    const categoriesText = categoryNames.length > 0 ? categoryNames.join(', ') : 'None';

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ` Your Stats\n\n Total Posts: ${user.posts_count || 0}\nYour Categories: ${categoriesText}\n Channel: ${user.channel_name || user.channel_id || 'Not set'}\n👤 Display Name: ${user.display_name || 'Not set'}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Back', callback_data: 'back' }
          ]
        ]
      }
    });
    return;
  }

  // Handle post edited news to a specific channel from user channels list
  if (data.startsWith('post_edit_channel:')) {
    const parts = data.split(':');
    const channelTableId = parseInt(parts[2], 10);

    try {
      const pendingEdit = await getPendingEdit(callbackQuery.from.id);
      if (!pendingEdit || pendingEdit.text === '__waiting__') {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '⚠️ No content found. Please try again.',
        });
        return;
      }

      const user = await getUserByTelegramId(callbackQuery.from.id);
      const targetChannel = await getUserChannelById(channelTableId);

      if (!targetChannel) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ Channel not found.',
        });
        return;
      }

      console.log('Posting edited news to selected user channel:', targetChannel.channel_id);

      const createdPost = await createPost(user.id, targetChannel.channel_id, pendingEdit.text, 'edited', null, pendingEdit.image_url);
      const reactionKeyboard = createdPost ? buildPostReactionKeyboard(createdPost.id) : null;

      if (pendingEdit.image_url) {
        try {
          await api.sendPhoto({
            chat_id: targetChannel.channel_id,
            photo: pendingEdit.image_url,
            caption: pendingEdit.text,
            parse_mode: 'HTML',
            reply_markup: reactionKeyboard ? { inline_keyboard: reactionKeyboard } : undefined
          });
        } catch (photoError) {
          console.error('Failed to post photo to channel, falling back to text:', photoError);
          await api.sendMessage({
            chat_id: targetChannel.channel_id,
            text: pendingEdit.text,
            parse_mode: 'HTML',
            reply_markup: reactionKeyboard ? { inline_keyboard: reactionKeyboard } : undefined
          });
        }
      } else {
        await api.sendMessage({
          chat_id: targetChannel.channel_id,
          text: pendingEdit.text,
          parse_mode: 'HTML',
          reply_markup: reactionKeyboard ? { inline_keyboard: reactionKeyboard } : undefined
        });
      }

      await deletePendingEdit(callbackQuery.from.id);

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `✅ Content posted successfully to <b>${targetChannel.channel_name || targetChannel.channel_id}</b>!`,
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error posting to selected channel:', error);
      if (error instanceof BotApiError) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `❌ Failed to post: ${error.description}. Make sure the bot is an admin in your channel with "Post Messages" permission.`,
        });
      } else {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `❌ Failed to post: ${error.message}`,
        });
      }
    }
    return;
  }

  // Handle post edited news to all user channels
  if (data.startsWith('post_edit_all:')) {
    try {
      const pendingEdit = await getPendingEdit(callbackQuery.from.id);
      if (!pendingEdit || pendingEdit.text === '__waiting__') {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '⚠️ No content found. Please try again.',
        });
        return;
      }

      const user = await getUserByTelegramId(callbackQuery.from.id);
      await migrateUserChannels(userId);
      await removeDuplicateChannels(userId);
      const userChannels = await getUserChannels(user.id);

      if (!userChannels || userChannels.length === 0) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ No channels found.',
        });
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const ch of userChannels) {
        try {
          const createdPost = await createPost(user.id, ch.channel_id, pendingEdit.text, 'edited', null, pendingEdit.image_url);
          const reactionKeyboard = createdPost ? buildPostReactionKeyboard(createdPost.id) : null;

          if (pendingEdit.image_url) {
            try {
              await api.sendPhoto({
                chat_id: ch.channel_id,
                photo: pendingEdit.image_url,
                caption: pendingEdit.text,
                parse_mode: 'HTML',
                reply_markup: reactionKeyboard ? { inline_keyboard: reactionKeyboard } : undefined
              });
            } catch (err) {
              await api.sendMessage({
                chat_id: ch.channel_id,
                text: pendingEdit.text,
                parse_mode: 'HTML',
                reply_markup: reactionKeyboard ? { inline_keyboard: reactionKeyboard } : undefined
              });
            }
          } else {
            await api.sendMessage({
              chat_id: ch.channel_id,
              text: pendingEdit.text,
              parse_mode: 'HTML',
              reply_markup: reactionKeyboard ? { inline_keyboard: reactionKeyboard } : undefined
            });
          }
          successCount++;
        } catch (postErr) {
          console.error(`Failed to post to channel ${ch.channel_id}:`, postErr);
          failCount++;
        }
      }

      await deletePendingEdit(callbackQuery.from.id);

      if (failCount === 0) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `✅ Posted to all ${successCount} channel(s)!`,
        });
      } else {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `⚠️ Posted to ${successCount} channel(s), failed on ${failCount} channel(s).`,
        });
      }
    } catch (error) {
      console.error('Error posting to all channels:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `❌ Failed to post: ${error.message}`,
      });
    }
    return;
  }

  // Handle post edited news to user's main channel (public)
  if (data.startsWith('post_edit_user_main:')) {
    console.log('=== post_edit_user_main handler triggered ===');
    console.log('Callback data:', data);
    console.log('User ID:', userId);
    try {
      const pendingEdit = await getPendingEdit(callbackQuery.from.id);
      console.log('Pending edit:', pendingEdit);

      if (!pendingEdit || pendingEdit.text === '__waiting__') {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ' No edited text found. Please try editing again.',
        });
        return;
      }

      const user = await getUserByTelegramId(callbackQuery.from.id);
      console.log('User:', user);

      if (!user || !user.channel_id) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ' Channel not found. Please complete onboarding first.',
        });
        return;
      }

      console.log('Posting edited news to user channel:', user.channel_id);

      // Post with image if available, otherwise just text
      if (pendingEdit.image_url) {
        try {
          await api.sendPhoto({
            chat_id: user.channel_id,
            photo: pendingEdit.image_url,
            caption: pendingEdit.text,
            parse_mode: 'HTML',
          });
        } catch (photoError) {
          console.error('Failed to post edited photo to user channel, falling back to text:', photoError);
          await api.sendMessage({
            chat_id: user.channel_id,
            text: pendingEdit.text,
            parse_mode: 'HTML',
          });
        }
      } else {
        await api.sendMessage({
          chat_id: user.channel_id,
          text: pendingEdit.text,
          parse_mode: 'HTML',
        });
      }

      // Track the post in database
      await createPost(user.id, user.channel_id, pendingEdit.text, 'edited', null, pendingEdit.image_url);

      await deletePendingEdit(callbackQuery.from.id);

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: 'Edited news posted to your channel!',
      });
    } catch (error) {
      console.error('Error posting edited news to user channel:', error);
      if (error instanceof BotApiError) {
        console.error('Bot API Error code:', error.code, 'description:', error.description);
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ` Failed to post: ${error.description}. Make sure the bot is an admin in your channel with "Post Messages" permission.`,
        });
      } else {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ` Failed to post: ${error.message}`,
        });
      }
    }
    return;
  }

  // Handle post edited news to user's test channel (public)
  if (data.startsWith('post_edit_user_test:')) {
    try {
      const pendingEdit = await getPendingEdit(callbackQuery.from.id);
      if (!pendingEdit || pendingEdit.text === '__waiting__') {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ' No edited text found. Please try editing again.',
        });
        return;
      }

      const user = await getUserByTelegramId(callbackQuery.from.id);
      if (!user || !user.test_channel_id) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: 'Test channel not found. Please configure your test channel in settings.',
        });
        return;
      }

      console.log('Posting edited news to user test channel:', user.test_channel_id);

      // Post with image if available, otherwise just text
      if (pendingEdit.image_url) {
        try {
          await api.sendPhoto({
            chat_id: user.test_channel_id,
            photo: pendingEdit.image_url,
            caption: pendingEdit.text,
            parse_mode: 'HTML',
          });
        } catch (photoError) {
          console.error('Failed to post edited photo to user test channel, falling back to text:', photoError);
          await api.sendMessage({
            chat_id: user.test_channel_id,
            text: pendingEdit.text,
            parse_mode: 'HTML',
          });
        }
      } else {
        await api.sendMessage({
          chat_id: user.test_channel_id,
          text: pendingEdit.text,
          parse_mode: 'HTML',
        });
      }

      // Track the post in database
      await createPost(user.id, user.test_channel_id, pendingEdit.text, 'edited', null, pendingEdit.image_url);

      await deletePendingEdit(callbackQuery.from.id);

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: 'Edited news posted to your test channel!',
      });
    } catch (error) {
      console.error('Error posting edited news to test channel:', error);
      if (error instanceof BotApiError) {
        console.error('Bot API Error code:', error.code, 'description:', error.description);
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ` Failed to post: ${error.description}. Make sure the bot is an admin in your test channel with "Post Messages" permission.`,
        });
      } else {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ` Failed to post: ${error.message}`,
        });
      }
    }
    return;
  }

  // Handle cancel edit (public)
  if (data === 'cancel_edit') {
    await deletePendingEdit(callbackQuery.from.id);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: 'Edit cancelled.',
    });
    return;
  }

  // Handle back button (public)
  if (data === 'back') {
    const user = await getUserByTelegramId(userId);
    const isOwner = userId === OWNER_CHAT_ID;

    if (isOwner) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' TF Agent እንኳን ደህና መጡ!\n\nይህ Bot True Feed ቻናልዎን ያስተዳድራል።\nከታች ያሉትን አማራጮች ይጫኑ።',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'idea', callback_data: 'new_idea' },
              { text: ' news', callback_data: 'get_news' }
            ],
            [
              { text: 'Rates', callback_data: 'get_rates' },
              { text: 'Settings', callback_data: 'settings' }
            ],
            [
              { text: ' Analytics Dashboard', web_app: { url: 'https://app8909892200.tgcloud.ai/' } }
            ]
          ]
        }
      });
    } else {
      // Show user/guest mode choice for non-owner users
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' Welcome to True Feed!\n\nChoose how you want to use the bot:',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👤 User', callback_data: 'choose_user' },
              { text: ' Guest', callback_data: 'choose_guest' }
            ],
            [
              { text: 'Refresh', callback_data: 'refresh_user_type' }
            ],
            [
              { text: 'Back', callback_data: 'back' }
            ]
          ]
        }
      });
    }
    return;
  }

  // Owner-specific callbacks (authorization check)
  if (userId !== OWNER_CHAT_ID) {
    await api.answerCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: '⛔ Unauthorized',
    });
    return;
  }

  // Handle new_idea button (owner only)
  if (data === 'new_idea') {
    try {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: 'Generating idea...',
      });

      const user = await getUserByTelegramId(userId);
      const idea = await generateIdea(user.telegram_id);

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: idea.content,
        reply_markup: {
          inline_keyboard: [
            [
              { text: ' Approve & Post', callback_data: `approve_${idea.id}` },
              { text: ' Reject — New Idea', callback_data: `reject_${idea.id}` }
            ],
            [
              { text: 'Back', callback_data: 'back' }
            ]
          ]
        }
      });

    } catch (error) {
      console.error('Error in new_idea callback:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' Failed to generate idea. Please try again.',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'idea', callback_data: 'new_idea' },
              { text: ' news', callback_data: 'get_news' }
            ]
          ]
        }
      });
    }
  }

  // Handle newsTrueFeed - post to main channel, then show next article (owner only)
  if (data.startsWith('news_truefeed_')) {
    const parts = data.replace('news_truefeed_', '').split('_');
    const platformId = parts[0];
    const currentIndex = parseInt(parts[1]);

    const platform = getPlatformById(platformId);

    if (!platform) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: 'Platform not found.',
      });
      return;
    }

    const user = await getUserByTelegramId(userId);

    try {
      const articles = await fetchRSSFeed(platform.url, platform.name);

      if (currentIndex >= articles.length) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ' Article no longer available.',
        });
        return;
      }

      const article = articles[currentIndex];
      const showSourceLink = user?.show_source_link === 1;
      const useDotPunctuation = user?.use_dot_punctuation === 1;
      const articleText = await formatNewsArticle(article, '@true_feed', showSourceLink, useDotPunctuation, userId);
      
      // Record created post & build funny sticker reaction keyboard
      const createdPost = await createPost(user?.id || 1, TRUE_FEED_CHANNEL_ID, articleText, article.category || 'news', platform.name, article.image);
      const reactionKeyboard = createdPost ? buildPostReactionKeyboard(createdPost.id) : null;
      const postMarkup = reactionKeyboard ? { inline_keyboard: reactionKeyboard } : undefined;

      // Post to the True Feed channel with interactive funny sticker reactions
      if (article.image) {
        try {
          await api.sendPhoto({
            chat_id: TRUE_FEED_CHANNEL_ID,
            photo: article.image,
            caption: articleText,
            parse_mode: 'HTML',
            reply_markup: postMarkup,
          });
        } catch (photoError) {
          console.error('Failed to send photo to channel, falling back to text:', photoError.message);
          await api.sendMessage({
            chat_id: TRUE_FEED_CHANNEL_ID,
            text: articleText,
            parse_mode: 'HTML',
            reply_markup: postMarkup,
          });
        }
      } else {
        await api.sendMessage({
          chat_id: TRUE_FEED_CHANNEL_ID,
          text: articleText,
          parse_mode: 'HTML',
          reply_markup: postMarkup,
        });
      }
      
      // Confirm to the owner
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' Posted toTrueFeed!',
      });
      
    } catch (error) {
      console.error('Error posting article toTrueFeed:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ` Failed to post article: ${error.message}`,
      });
    }
    
    // Show next article
    await showNextArticle(callbackQuery, platformId, currentIndex);
  }
  
  // Handle newsTest - post to test channel, then show next article (owner only)
  if (data.startsWith('news_test_')) {
    const parts = data.replace('news_test_', '').split('_');
    const platformId = parts[0];
    const currentIndex = parseInt(parts[1]);

    const platform = getPlatformById(platformId);

    if (!platform) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: 'Platform not found.',
      });
      return;
    }

    const user = await getUserByTelegramId(userId);

    try {
      const articles = await fetchRSSFeed(platform.url, platform.name);

      if (currentIndex >= articles.length) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ' Article no longer available.',
        });
        return;
      }

      const article = articles[currentIndex];
      const showSourceLink = user?.show_source_link === 1;
      const useDotPunctuation = user?.use_dot_punctuation === 1;
      const articleText = await formatNewsArticle(article, '@true_feed', showSourceLink, useDotPunctuation, userId);

      // Post to theTest channel
      if (article.image) {
        try {
          await api.sendPhoto({
            chat_id: TEST_CHANNEL_ID,
            photo: article.image,
            caption: articleText,
            parse_mode: 'HTML',
          });
        } catch (photoError) {
          console.error('Failed to send photo to test channel, falling back to text:', photoError.message);
          await api.sendMessage({
            chat_id: TEST_CHANNEL_ID,
            text: articleText,
            parse_mode: 'HTML',
          });
        }
      } else {
        await api.sendMessage({
          chat_id: TEST_CHANNEL_ID,
          text: articleText,
          parse_mode: 'HTML',
        });
      }

      // Confirm to the owner
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' Posted toTest channel!',
      });

    } catch (error) {
      console.error('Error posting article to test channel:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ` Failed to post article: ${error.message}`,
      });
    }

    // Show next article
    await showNextArticle(callbackQuery, platformId, currentIndex);
  }

  // Handle post edited news toTrueFeed (owner only)
  if (data.startsWith('post_edit_truefeed:')) {
    try {
      const pendingEdit = await getPendingEdit(callbackQuery.from.id);
      if (!pendingEdit || pendingEdit.text === '__waiting__') {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ' No edited text found. Please try editing again.',
        });
        return;
      }

      console.log('Posting edited news toTrueFeed channel:', TRUE_FEED_CHANNEL_ID);

      const createdPost = await createPost(user?.id || 1, TRUE_FEED_CHANNEL_ID, pendingEdit.text, 'edited', null, pendingEdit.image_url);
      const reactionKeyboard = createdPost ? buildPostReactionKeyboard(createdPost.id) : null;
      const postMarkup = reactionKeyboard ? { inline_keyboard: reactionKeyboard } : undefined;

      // Post with image if available, otherwise just text
      if (pendingEdit.image_url) {
        try {
          await api.sendPhoto({
            chat_id: TRUE_FEED_CHANNEL_ID,
            photo: pendingEdit.image_url,
            caption: pendingEdit.text,
            parse_mode: 'HTML',
            reply_markup: postMarkup,
          });
        } catch (photoError) {
          console.error('Failed to post edited photo toTrueFeed, falling back to text:', photoError);
          await api.sendMessage({
            chat_id: TRUE_FEED_CHANNEL_ID,
            text: pendingEdit.text,
            parse_mode: 'HTML',
            reply_markup: postMarkup,
          });
        }
      } else {
        await api.sendMessage({
          chat_id: TRUE_FEED_CHANNEL_ID,
          text: pendingEdit.text,
          parse_mode: 'HTML',
          reply_markup: postMarkup,
        });
      }

      await deletePendingEdit(callbackQuery.from.id);

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: 'Edited news posted toTrueFeed!',
      });
    } catch (error) {
      console.error('Error posting edited news toTrueFeed:', error);
      if (error instanceof BotApiError) {
        console.error('Bot API Error code:', error.code, 'description:', error.description);
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ` Failed to post: ${error.description}`,
        });
      } else {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ` Failed to post: ${error.message}`,
        });
      }
    }
  }

  // Handle post edited news toTest (owner only)
  if (data.startsWith('post_edit_test:')) {
    try {
      const pendingEdit = await getPendingEdit(callbackQuery.from.id);
      if (!pendingEdit || pendingEdit.text === '__waiting__') {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ' No edited text found. Please try editing again.',
        });
        return;
      }

      console.log('Posting edited news toTest channel:', TEST_CHANNEL_ID);

      // Post with image if available, otherwise just text
      if (pendingEdit.image_url) {
        try {
          await api.sendPhoto({
            chat_id: TEST_CHANNEL_ID,
            photo: pendingEdit.image_url,
            caption: pendingEdit.text,
            parse_mode: 'HTML',
          });
        } catch (photoError) {
          console.error('Failed to post edited photo toTest channel, falling back to text:', photoError);
          await api.sendMessage({
            chat_id: TEST_CHANNEL_ID,
            text: pendingEdit.text,
            parse_mode: 'HTML',
          });
        }
      } else {
        await api.sendMessage({
          chat_id: TEST_CHANNEL_ID,
          text: pendingEdit.text,
          parse_mode: 'HTML',
        });
      }

      await deletePendingEdit(callbackQuery.from.id);

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: 'Edited news posted toTest channel!',
      });
    } catch (error) {
      console.error('Error posting edited news toTest channel:', error);
      if (error instanceof BotApiError) {
        console.error('Bot API Error code:', error.code, 'description:', error.description);
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ` Failed to post: ${error.description}`,
        });
      } else {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ` Failed to post: ${error.message}`,
        });
      }
    }
  }

  // Handle approve button
  if (data.startsWith('approve_')) {
    const ideaId = parseInt(data.replace('approve_', ''));
    
    try {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' Approving and posting idea...',
      });
      
      const idea = await getIdeaById(ideaId);
      
      if (!idea) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: ' Idea not found.',
        });
        return;
      }
      
      // Post to the True Feed channel
      await api.sendMessage({
        chat_id: TRUE_FEED_CHANNEL_ID,
        text: idea.content,
      });
      
      await markPosted(ideaId);
      
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' Idea approved and posted to channel!',
      });
      
    } catch (error) {
      console.error('Error approving idea:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ` Failed to approve idea: ${error.message}`,
      });
    }
  }
  
  // Handle reject button
  if (data.startsWith('reject_')) {
    const ideaId = parseInt(data.replace('reject_', ''));

    try {
      await markRejected(ideaId);

      // Generate new idea
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: 'Generating idea...',
      });

      const user = await getUserByTelegramId(userId);
      const idea = await generateIdea(user.telegram_id);

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: idea.content,
        reply_markup: {
          inline_keyboard: [
            [
              { text: ' Approve & Post', callback_data: `approve_${idea.id}` },
              { text: ' Reject — New Idea', callback_data: `reject_${idea.id}` }
            ],
            [
              { text: 'Back', callback_data: 'back' }
            ]
          ]
        }
      });

    } catch (error) {
      console.error('Error rejecting idea:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' Failed to reject idea.',
      });
    }
  }
}

// Onboarding handler functions

async function handleCheckJoin(callbackQuery, userId) {
  try {
    // Check if user is a member of True Feed channel
    const chatMember = await api.getChatMember({
      chat_id: TRUE_FEED_CHANNEL_ID,
      user_id: userId
    });

    if (chatMember.status === 'left' || chatMember.status === 'kicked') {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' You haven\'t joined the True Feed channel yet. Please join first:',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Join True Feed Channel', url: 'https://t.me/true_feed' }
            ],
            [
              { text: 'I\'ve Joined', callback_data: 'check_join' }
            ]
          ]
        }
      });
      return;
    }

    // User is a member, proceed to next step
    await updateUserOnboardingStep(userId, 'provide_channel_id');
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' You\'ve joined the channel!\n\n📝 Step 1: Connect Your Channel\n\nPlease send your channel username (e.g., @yourchannel), channel link (https://t.me/yourchannel), or simply forward any post from your channel to this chat.',
    });
  } catch (error) {
    console.error('Error checking channel membership:', error);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Failed to verify channel membership. Please try again.',
    });
  }
}

async function handleChangeChannel(callbackQuery, userId) {
  await updateUserOnboardingStep(userId, 'provide_channel_id');
  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: '📝 Step 1: Select Your Channel\n\nPlease send your channel username (e.g., @yourchannel), channel link (https://t.me/yourchannel), or forward any message from your channel to this chat.',
  });
}

async function handleBotAdminAdded(callbackQuery, userId) {
  const user = await getUserByTelegramId(userId);

  if (!user || !user.channel_id) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Channel ID not found. Please provide your channel first.',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📝 Provide Channel', callback_data: 'change_channel' }
          ]
        ]
      }
    });
    return;
  }

  // Normalize channel ID in case it was stored as a URL, link, or bare username
  let channelId = normalizeChannelId(user.channel_id);
  if (channelId && channelId !== user.channel_id) {
    await updateUserChannelId(userId, channelId, user.channel_name || channelId);
  } else if (!channelId) {
    channelId = user.channel_id;
  }

  try {
    // Get bot's user ID
    const botInfo = await api.getMe();
    const botId = botInfo.id;

    // Check if bot is admin in the user's channel
    const botMember = await api.getChatMember({
      chat_id: channelId,
      user_id: botId
    });

    const isAdmin = botMember.status === 'administrator' || botMember.status === 'creator';

    if (!isAdmin) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ` The bot is not yet an administrator in ${channelId}.\n\nPlease add @${botInfo.username || 'this bot'} as an administrator to your channel with permission to Post Messages.\n\nOnce added, click the button below:`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: ' Done', callback_data: 'bot_admin_added' }
            ],
            [
              { text: ' Change Channel', callback_data: 'change_channel' }
            ]
          ]
        }
      });
      return;
    }

    // Bot is admin, proceed to next step
    await updateUserOnboardingStep(userId, 'provide_display_name');
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ` Great! Bot is verified as an admin in ${channelId}.\n\n Step 3: Display Name (Optional)\n\nSend the name you want to be displayed on your channel (e.g., "Your Name")`,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Skip This Step', callback_data: 'skip_display_name' }]
        ]
      }
    });
  } catch (error) {
    console.error('Error checking bot admin status:', error);
    const errText = error?.description || error?.message || '';
    let detailMsg = '';
    if (errText.includes('chat not found')) {
      detailMsg = `\n\n⚠️ Telegram could not find channel "${channelId}".\n• If your channel is public, please make sure the username is correct (e.g., @mychannel).\n• If your channel is private, forward any post from your channel directly to this chat!`;
    }
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ` Failed to verify bot admin status for ${channelId}.${detailMsg}\n\nPlease make sure:\n1. The bot is added as admin to your channel\n2. The channel ID is correct\n\nClick the button below to try again:`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: ' Done', callback_data: 'bot_admin_added' }
          ],
          [
            { text: ' Change Channel', callback_data: 'change_channel' }
          ]
        ]
      }
    });
  }
}

async function handleSkipDisplayName(callbackQuery, userId) {
  await updateUserOnboardingStep(userId, 'select_categories');

  const keyboard = [];
  for (let i = 0; i < NEWS_CATEGORIES.length; i += 2) {
    const row = [];
    row.push({
      text: NEWS_CATEGORIES[i].name,
      callback_data: `select_category_${NEWS_CATEGORIES[i].id}`
    });
    if (i + 1 < NEWS_CATEGORIES.length) {
      row.push({
        text: NEWS_CATEGORIES[i + 1].name,
        callback_data: `select_category_${NEWS_CATEGORIES[i + 1].id}`
      });
    }
    keyboard.push(row);
  }

  keyboard.push([
    { text: ' Add Custom Source', callback_data: 'add_custom_source' }
  ]);
  keyboard.push([
    { text: ' Complete Setup', callback_data: 'complete_setup' }
  ]);

  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: ' Step 5: Select Content Categories\n\nChoose the types of content you want to generate:',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function handleSelectCategory(callbackQuery, userId, data) {
  const category = data.replace('select_category_', '');
  const user = await getUserByTelegramId(userId);

  let categories = [];
  if (user.categories) {
    try {
      categories = JSON.parse(user.categories);
    } catch (e) {
      categories = [];
    }
  }

  if (!categories.includes(category)) {
    categories.push(category);
    await updateUserCategories(userId, categories);
  }

  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: ` Added "${category}" to your categories!`,
  });

  // Show category selection again
  const keyboard = [];
  for (let i = 0; i < NEWS_CATEGORIES.length; i += 2) {
    const row = [];
    const cat1 = NEWS_CATEGORIES[i];
    const isSelected1 = categories.includes(cat1.id);
    row.push({
      text: `${isSelected1 ? ' ' : ''}${cat1.name}`,
      callback_data: `select_category_${cat1.id}`
    });
    if (i + 1 < NEWS_CATEGORIES.length) {
      const cat2 = NEWS_CATEGORIES[i + 1];
      const isSelected2 = categories.includes(cat2.id);
      row.push({
        text: `${isSelected2 ? ' ' : ''}${cat2.name}`,
        callback_data: `select_category_${cat2.id}`
      });
    }
    keyboard.push(row);
  }

  keyboard.push([
    { text: ' Add Custom Source', callback_data: 'add_custom_source' }
  ]);
  keyboard.push([
    { text: ' Complete Setup', callback_data: 'complete_setup' }
  ]);

  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: ' Step 5: Select Content Categories\n\nChoose the types of content you want to generate:',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function handleAddCustomSource(callbackQuery, userId) {
  await updateUserOnboardingStep(userId, 'add_custom_source_name');
  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: ' Add Custom Source\n\nSend me the name of your custom source (e.g., "My Blog"):',
  });
}

async function handleCompleteSetup(callbackQuery, userId) {
  const user = await getUserByTelegramId(userId);

  if (!user.channel_id) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Please complete all setup steps first.',
    });
    return;
  }

  await updateUserOnboardingStep(userId, 'completed');

  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: ' Setup Complete!\n\nYou can now start generating content for your channel. Click the button below to begin:',
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Generate Content', callback_data: 'generate_content' }
        ]
      ]
    }
  });
}

async function handleGenerateContent(callbackQuery, userId) {
  const user = await getUserByTelegramId(userId);

  if (!user || !user.channel_id) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Please complete setup first.',
    });
    return;
  }

  const keyboard = [];
  for (let i = 0; i < NEWS_CATEGORIES.length; i += 2) {
    const row = [];
    row.push({
      text: NEWS_CATEGORIES[i].name,
      callback_data: `news_cat_${NEWS_CATEGORIES[i].id}`
    });
    if (i + 1 < NEWS_CATEGORIES.length) {
      row.push({
        text: NEWS_CATEGORIES[i + 1].name,
        callback_data: `news_cat_${NEWS_CATEGORIES[i + 1].id}`
      });
    }
    keyboard.push(row);
  }
  keyboard.push([
    { text: 'All Sources', callback_data: 'news_cat_all' },
    { text: '↩️ Main Menu', callback_data: 'back' }
  ]);

  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: ' Select a category to generate content:',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function handleGetRates(callbackQuery, userId) {
  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: ' <b>ExchangeRates</b>\n\nSelect a rate to view:',
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Dollar (USD/ETB)', callback_data: 'rate_dollar' },
          { text: 'Bitcoin (BTC)', callback_data: 'rate_btc' }
        ],
        [
          { text: 'Back', callback_data: 'back' }
        ]
      ]
    }
  });
}

async function handleDollarRate(callbackQuery, userId) {
  let loadingMsg = null;
  try {
    loadingMsg = await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '⏳ Fetching Ethiopian dollar rates...',
    });

    const rates = await fetchEthiopianDollarRates();
    const message = formatEthiopianRates(rates);

    if (loadingMsg && loadingMsg.message_id) {
      try {
        await api.deleteMessage({
          chat_id: callbackQuery.message.chat.id,
          message_id: loadingMsg.message_id
        });
      } catch (_) {}
    }

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: message,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Refresh', callback_data: 'rate_dollar' }
          ],
          [
            { text: 'Back', callback_data: 'get_rates' }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Error handling dollar rate:', error);
    if (loadingMsg && loadingMsg.message_id) {
      try {
        await api.deleteMessage({
          chat_id: callbackQuery.message.chat.id,
          message_id: loadingMsg.message_id
        });
      } catch (_) {}
    }
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '❌ Failed to fetch dollar rates. Please try again later.',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Back', callback_data: 'get_rates' }
          ]
        ]
      }
    });
  }
}

async function handleBTCRate(callbackQuery, userId) {
  let loadingMsg = null;
  try {
    loadingMsg = await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '⏳ Fetching Bitcoin price...',
    });

    const btcData = await fetchBTCPrice();
    const message = formatBTCPrice(btcData);

    if (loadingMsg && loadingMsg.message_id) {
      try {
        await api.deleteMessage({
          chat_id: callbackQuery.message.chat.id,
          message_id: loadingMsg.message_id
        });
      } catch (_) {}
    }

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: message,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Refresh', callback_data: 'rate_btc' }
          ],
          [
            { text: 'Back', callback_data: 'get_rates' }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Error handling BTC rate:', error);
    if (loadingMsg && loadingMsg.message_id) {
      try {
        await api.deleteMessage({
          chat_id: callbackQuery.message.chat.id,
          message_id: loadingMsg.message_id
        });
      } catch (_) {}
    }
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '❌ Failed to fetch Bitcoin price. Please try again later.',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Back', callback_data: 'get_rates' }
          ]
        ]
      }
    });
  }
}

async function handlePostToUserChannel(callbackQuery, userId, data) {
  const parts = data.replace('news_user_channel_', '').split('_');
  const platformId = parts[0];
  const currentIndex = parseInt(parts[1]);

  const user = await getUserByTelegramId(userId);
  const platform = getPlatformById(platformId);

  // Migrate existing channels if needed
  await migrateUserChannels(userId);

  // Remove any duplicate channels
  await removeDuplicateChannels(userId);

  const userChannels = await getUserChannels(user.id);

  if (!user || userChannels.length === 0) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' No channels found. Please add a channel in settings first.',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Settings', callback_data: 'settings' }]
        ]
      }
    });
    return;
  }

  if (!platform) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: 'Platform not found.',
    });
    return;
  }

  // If user has multiple channels, show channel selection
  if (userChannels.length > 1) {
    await showChannelSelectionForPost(callbackQuery, userId, platformId, currentIndex, userChannels);
    return;
  }

  // Single channel - post directly
  const telegramChannelId = userChannels[0].channel_id;
  const channelName = userChannels[0].channel_name || userChannels[0].channel_id;
  await postArticleToChannel(callbackQuery, userId, platformId, currentIndex, telegramChannelId, channelName);
}

async function showChannelSelectionForPost(callbackQuery, userId, platformId, currentIndex, userChannels) {
  const keyboard = [];
  for (const channel of userChannels) {
    const channelName = channel.channel_name || channel.channel_id;
    const typeLabel = channel.is_main ? ' 🌟 Main' : (channel.is_test ? ' 🧪 Test' : '');
    keyboard.push([
      { text: `📢 ${channelName}${typeLabel}`, callback_data: `post_chan:${channel.id}:${platformId}:${currentIndex}` }
    ]);
  }

  // Add "Post to All" button if user has more than 1 channel
  if (userChannels.length > 1) {
    keyboard.push([
      { text: '📢 Post to All Channels', callback_data: `post_to_all_${platformId}_${currentIndex}` }
    ]);
  }

  keyboard.push([
    { text: '↩️ Cancel', callback_data: `news_skip_${platformId}_${currentIndex}` }
  ]);

  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: '📢 <b>Select Channel:</b>\n\nChoose which channel you want to post this article to:',
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function postArticleToChannel(callbackQuery, userId, platformId, currentIndex, telegramChannelId, channelName = null) {
  const user = await getUserByTelegramId(userId);
  const platform = getPlatformById(platformId);

  if (!platform) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: 'Platform not found.',
    });
    return;
  }

  try {
    const articles = await fetchRSSFeed(platform.url, platform.name);

    if (currentIndex >= articles.length) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' Article no longer available.',
      });
      return;
    }

    const article = articles[currentIndex];

    // Use the selected channel name for attribution
    let userChannelLink = null;
    if (channelName) {
      if (channelName.startsWith('@')) {
        userChannelLink = channelName;
      } else {
        userChannelLink = `t.me/${channelName}`;
      }
    } else if (user && user.channel_name) {
      if (user.channel_name.startsWith('@')) {
        userChannelLink = user.channel_name;
      } else {
        userChannelLink = `t.me/${user.channel_name}`;
      }
    } else if (user && user.channel_id) {
      userChannelLink = user.channel_id;
    }

    const showSourceLink = user?.show_source_link === 1;
    const useDotPunctuation = user?.use_dot_punctuation === 1;
    const articleText = await formatNewsArticle(article, userChannelLink, showSourceLink, useDotPunctuation, userId);

    // Track the post and prepare reaction buttons
    const createdPost = await createPost(user.id, telegramChannelId, articleText, article.category || 'news', platform.name, article.video || article.image);
    const reactionKeyboard = createdPost ? buildPostReactionKeyboard(createdPost.id) : null;
    const postMarkup = reactionKeyboard ? { inline_keyboard: reactionKeyboard } : undefined;

    // Post to the channel
    if (article.video) {
      try {
        await api.sendVideo({
          chat_id: telegramChannelId,
          video: article.video,
          caption: articleText,
          parse_mode: 'HTML',
          reply_markup: postMarkup
        });
      } catch (videoError) {
        console.error('Failed to send video to channel, falling back to image:', videoError.message);
        if (article.image) {
          try {
            await api.sendPhoto({
              chat_id: telegramChannelId,
              photo: article.image,
              caption: articleText,
              parse_mode: 'HTML',
              reply_markup: postMarkup
            });
          } catch (photoError) {
            console.error('Failed to send photo to channel, falling back to text:', photoError.message);
            await api.sendMessage({
              chat_id: telegramChannelId,
              text: articleText,
              parse_mode: 'HTML',
              reply_markup: postMarkup
            });
          }
        } else {
          await api.sendMessage({
            chat_id: telegramChannelId,
            text: articleText,
            parse_mode: 'HTML',
            reply_markup: postMarkup
          });
        }
      }
    } else if (article.image) {
      try {
        await api.sendPhoto({
          chat_id: telegramChannelId,
          photo: article.image,
          caption: articleText,
          parse_mode: 'HTML',
          reply_markup: postMarkup
        });
      } catch (photoError) {
        console.error('Failed to send photo to channel, falling back to text:', photoError.message);
        await api.sendMessage({
          chat_id: telegramChannelId,
          text: articleText,
          parse_mode: 'HTML',
          reply_markup: postMarkup
        });
      }
    } else {
      await api.sendMessage({
        chat_id: telegramChannelId,
        text: articleText,
        parse_mode: 'HTML',
        reply_markup: postMarkup
      });
    }

    // Confirm to the user
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Posted to your channel!',
    });

    // Show next article
    await showNextArticle(callbackQuery, platformId, currentIndex);

  } catch (error) {
    console.error('Error posting article to user channel:', error);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ` Failed to post article: ${error.message}`,
    });
  }
}

async function handlePostToUserTestChannel(callbackQuery, userId, data) {
  const parts = data.replace('news_user_test_channel_', '').split('_');
  const platformId = parts[0];
  const currentIndex = parseInt(parts[1]);

  const user = await getUserByTelegramId(userId);
  const platform = getPlatformById(platformId);

  if (!user || !user.test_channel_id) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: 'Test channel not found. Please configure your test channel in settings.',
    });
    return;
  }

  if (!platform) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: 'Platform not found.',
    });
    return;
  }

  try {
    const articles = await fetchRSSFeed(platform.url, platform.name);

    if (currentIndex >= articles.length) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' Article no longer available.',
      });
      return;
    }

    const article = articles[currentIndex];

    // Get user channel link for content creator attribution
    let userChannelLink = null;
    if (user && user.channel_name) {
      // Format as @channelname if it starts with @, otherwise as t.me/channelname
      if (user.channel_name.startsWith('@')) {
        userChannelLink = user.channel_name;
      } else {
        userChannelLink = `t.me/${user.channel_name}`;
      }
    } else if (user && user.channel_id) {
      // Use channel_id if channel_name is not available
      userChannelLink = user.channel_id;
    }

    const showSourceLink = user?.show_source_link === 1;
    const useDotPunctuation = user?.use_dot_punctuation === 1;
    const articleText = await formatNewsArticle(article, userChannelLink, showSourceLink, useDotPunctuation, userId);

    // Post to the user's test channel
    if (article.video) {
      try {
        await api.sendVideo({
          chat_id: user.test_channel_id,
          video: article.video,
          caption: articleText,
          parse_mode: 'HTML',
        });
      } catch (videoError) {
        console.error('Failed to send video to test channel, falling back to image:', videoError.message);
        if (article.image) {
          try {
            await api.sendPhoto({
              chat_id: user.test_channel_id,
              photo: article.image,
              caption: articleText,
              parse_mode: 'HTML',
            });
          } catch (photoError) {
            console.error('Failed to send photo to test channel, falling back to text:', photoError.message);
            await api.sendMessage({
              chat_id: user.test_channel_id,
              text: articleText,
              parse_mode: 'HTML',
            });
          }
        } else {
          await api.sendMessage({
            chat_id: user.test_channel_id,
            text: articleText,
            parse_mode: 'HTML',
          });
        }
      }
    } else if (article.image) {
      try {
        await api.sendPhoto({
          chat_id: user.test_channel_id,
          photo: article.image,
          caption: articleText,
          parse_mode: 'HTML',
        });
      } catch (photoError) {
        console.error('Failed to send photo to test channel, falling back to text:', photoError.message);
        await api.sendMessage({
          chat_id: user.test_channel_id,
          text: articleText,
          parse_mode: 'HTML',
        });
      }
    } else {
      await api.sendMessage({
        chat_id: user.test_channel_id,
        text: articleText,
        parse_mode: 'HTML',
      });
    }

    // Track the post (but don't increment main posts count since it's test)
    await createPost(user.id, user.test_channel_id, articleText, article.category || 'news', platform.name, article.video || article.image);

    // Confirm to the user
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Posted to your test channel!',
    });

  } catch (error) {
    console.error('Error posting article to user test channel:', error);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ` Failed to post article: ${error.message}`,
    });
  }

  // Show next article
  await showNextArticle(callbackQuery, platformId, currentIndex);
}

async function handleManageChannels(callbackQuery, userId) {
  const user = await getUserByTelegramId(userId);
  const channels = await getUserChannels(user.id);

  if (channels.length === 0) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: 'Manage Channels\n\nYou have no channels yet. Add your first channel to get started!',
      reply_markup: {
        inline_keyboard: [
          [
            { text: ' Add Channel', callback_data: 'add_channel' }
          ],
          [
            { text: 'Back', callback_data: 'settings' }
          ]
        ]
      }
    });
    return;
  }

  const keyboard = [];
  for (const channel of channels) {
    const channelName = channel.channel_name || channel.channel_id;
    const typeLabel = channel.is_main ? ' 🌟 Main' : (channel.is_test ? ' Test' : '');
    keyboard.push([
      { text: `${channelName}${typeLabel}`, callback_data: `channel_info_${channel.id}` }
    ]);
  }

  keyboard.push([
    { text: ' Add New Channel', callback_data: 'add_channel' }
  ]);
  keyboard.push([
    { text: 'Back', callback_data: 'settings' }
  ]);

  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: `Manage Channels\n\nYou have ${channels.length} channel(s):`,
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function handleAddChannelStart(callbackQuery, userId) {
  const user = await getUserByTelegramId(userId);
  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: ' Add New Channel\n\nPlease send your channel username (e.g., @yourchannel), channel link (https://t.me/yourchannel), or forward any message from your channel to this chat.',
  });
  await setPendingChannelAdd(userId, 'waiting', null);
}

async function handleDeleteChannel(callbackQuery, userId, channelId) {
  const channel = await getUserChannelById(channelId);
  if (!channel) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Channel not found.',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Back', callback_data: 'manage_channels' }]
        ]
      }
    });
    return;
  }

  await deleteUserChannel(channelId);
  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: ` Channel "${channel.channel_name || channel.channel_id}" has been removed.`,
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Back', callback_data: 'manage_channels' }]
      ]
    }
  });
}

async function handleChannelInfo(callbackQuery, userId, channelId) {
  const channel = await getUserChannelById(channelId);
  if (!channel) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' Channel not found.',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Back', callback_data: 'manage_channels' }]
        ]
      }
    });
    return;
  }

  const channelName = channel.channel_name || channel.channel_id;
  const typeLabel = channel.is_main ? 'Main Channel' : (channel.is_test ? 'Test Channel' : 'Additional Channel');

  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: ` ${channelName}\n\nType: ${typeLabel}\nChannel ID: ${channel.channel_id}\nAdded: ${new Date(channel.created_at).toLocaleDateString()}`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🗑️ Remove Channel', callback_data: `delete_channel_${channel.id}` }
        ],
        [
          { text: 'Back', callback_data: 'manage_channels' }
        ]
      ]
    }
  });
}

async function postArticleToAllChannels(callbackQuery, userId, platformId, currentIndex) {
  const user = await getUserByTelegramId(userId);
  const platform = getPlatformById(platformId);

  if (!platform) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: 'Platform not found.',
    });
    return;
  }

  // Migrate and clean up channels
  await migrateUserChannels(userId);
  await removeDuplicateChannels(userId);

  const userChannels = await getUserChannels(user.id);

  if (!user || userChannels.length === 0) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ' No channels found. Please add a channel in settings first.',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Settings', callback_data: 'settings' }]
        ]
      }
    });
    return;
  }

  try {
    const articles = await fetchRSSFeed(platform.url, platform.name);

    if (currentIndex >= articles.length) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ' Article no longer available.',
      });
      return;
    }

    const article = articles[currentIndex];

    // Get user channel link for content creator attribution
    let userChannelLink = null;
    if (user && user.channel_name) {
      if (user.channel_name.startsWith('@')) {
        userChannelLink = user.channel_name;
      } else {
        userChannelLink = `t.me/${user.channel_name}`;
      }
    } else if (user && user.channel_id) {
      userChannelLink = user.channel_id;
    }

    const showSourceLink = user?.show_source_link === 1;
    const useDotPunctuation = user?.use_dot_punctuation === 1;
    const articleText = await formatNewsArticle(article, userChannelLink, showSourceLink, useDotPunctuation, userId);

    // Post to all channels
    let successCount = 0;
    let failCount = 0;

    for (const channel of userChannels) {
      try {
        if (article.video) {
          try {
            await api.sendVideo({
              chat_id: channel.channel_id,
              video: article.video,
              caption: articleText,
              parse_mode: 'HTML',
            });
            successCount++;
          } catch (videoError) {
            console.error('Failed to send video to channel, falling back to image:', videoError.message);
            if (article.image) {
              try {
                await api.sendPhoto({
                  chat_id: channel.channel_id,
                  photo: article.image,
                  caption: articleText,
                  parse_mode: 'HTML',
                });
                successCount++;
              } catch (photoError) {
                console.error('Failed to send photo to channel, falling back to text:', photoError.message);
                await api.sendMessage({
                  chat_id: channel.channel_id,
                  text: articleText,
                  parse_mode: 'HTML',
                });
                successCount++;
              }
            } else {
              await api.sendMessage({
                chat_id: channel.channel_id,
                text: articleText,
                parse_mode: 'HTML',
              });
              successCount++;
            }
          }
        } else if (article.image) {
          try {
            await api.sendPhoto({
              chat_id: channel.channel_id,
              photo: article.image,
              caption: articleText,
              parse_mode: 'HTML',
            });
            successCount++;
          } catch (photoError) {
            console.error('Failed to send photo to channel, falling back to text:', photoError.message);
            await api.sendMessage({
              chat_id: channel.channel_id,
              text: articleText,
              parse_mode: 'HTML',
            });
            successCount++;
          }
        } else {
          await api.sendMessage({
            chat_id: channel.channel_id,
            text: articleText,
            parse_mode: 'HTML',
          });
          successCount++;
        }

        // Track the post for each channel
        await createPost(user.id, channel.channel_id, articleText, article.category || 'news', platform.name, article.video || article.image);
      } catch (error) {
        console.error(`Failed to post to channel ${channel.channel_id}:`, error);
        failCount++;
      }
    }

    // Confirm to the user
    if (failCount === 0) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: ` Posted to all ${successCount} channel(s)!`,
      });
    } else {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `⚠️ Posted to ${successCount} channel(s), failed on ${failCount} channel(s).`,
      });
    }

    // Show next article
    await showNextArticle(callbackQuery, platformId, currentIndex);

  } catch (error) {
    console.error('Error posting article to all channels:', error);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: ` Failed to post article: ${error.message}`,
    });
  }
}

async function handleTranslate(callbackQuery, userId, data) {
  const cleanData = data.replace(/^news_(?:direct|translate)_/, '');
  const parts = cleanData.split('_');
  let targetLang = 'am';
  let platformId = '';
  let currentIndex = 0;

  if (['am', 'ti', 'om'].includes(parts[0])) {
    targetLang = parts[0];
    platformId = parts.slice(1, -1).join('_');
    currentIndex = parseInt(parts[parts.length - 1], 10);
  } else {
    platformId = parts.slice(0, -1).join('_');
    currentIndex = parseInt(parts[parts.length - 1], 10);
  }

  const langInfo = SUPPORTED_LANGUAGES[targetLang] || SUPPORTED_LANGUAGES.am;
  const user = await getUserByTelegramId(userId);
  let platform = getPlatformById(platformId);

  // Handle custom sources
  if (!platform && platformId.startsWith('custom_')) {
    const customSourceId = parseInt(platformId.replace('custom_', ''));
    const customSources = user ? await getCustomSources(user.id) : [];
    const customSource = customSources.find(s => s.id === customSourceId);
    if (customSource) {
      platform = {
        id: platformId,
        name: customSource.source_name,
        category: 'custom',
        url: customSource.source_url,
        isCustom: true
      };
    }
  }

  if (!platform) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: 'Platform not found.',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Back', callback_data: 'get_news' }
          ]
        ]
      }
    });
    return;
  }

  try {
    // Show loading message
    const loadingMessage = await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `🔄 Translating directly to ${langInfo.name} (exact content)...`,
    });

    // Fetch the article
    const articles = await fetchRSSFeed(platform.url, platform.name);
    const article = articles[currentIndex];

    if (!article) {
      await api.deleteMessage({
        chat_id: callbackQuery.message.chat.id,
        message_id: loadingMessage.message_id,
      });
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: 'Article not found.',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Back', callback_data: 'get_news' }
            ]
          ]
        }
      });
      return;
    }

    const isOwner = userId === OWNER_CHAT_ID;

    // Get user channel link for attribution
    let userChannelLink = null;
    if (isOwner) {
      userChannelLink = '@true_feed';
    } else if (user && user.user_type !== 'guest') {
      const userChannels = await getUserChannels(user.id);
      if (userChannels.length > 0) {
        const mainChannel = userChannels.find(c => c.is_main === 1) || userChannels[0];
        const channelName = mainChannel.channel_name || mainChannel.channel_id;
        if (channelName) {
          if (channelName.startsWith('@')) {
            userChannelLink = channelName;
          } else {
            userChannelLink = `t.me/${channelName}`;
          }
        }
      }
    }

    const showSourceLink = user?.show_source_link === 1;

    // Direct translation: translate title and description directly without restructuring
    const cleanTitle = (article.title || '').replace(/<[^>]*>/g, '').trim();
    const cleanDesc = (article.description || article.content || '').replace(/<[^>]*>/g, '').trim();

    const translatedTitle = await directTranslateToLanguage(cleanTitle, targetLang);
    const translatedDesc = await directTranslateToLanguage(cleanDesc, targetLang);

    let directFormattedText = `<b>${translatedTitle}</b>\n\n${translatedDesc}`;
    if (showSourceLink && article.link) {
      directFormattedText += `\n\n<a href="${article.link}">${article.platform || 'Source'}</a>`;
    }
    if (userChannelLink) {
      directFormattedText += `\n\n${userChannelLink}`;
    }

    // Save as pending edit so posting uses this exact direct translation
    const editId = await savePendingEdit(userId, directFormattedText, article.image);

    // Delete loading message
    await api.deleteMessage({
      chat_id: callbackQuery.message.chat.id,
      message_id: loadingMessage.message_id,
    });

    // Determine keyboard based on user type
    let keyboard;
    if (isOwner) {
      keyboard = [
        [
          { text: 'TrueFeed', callback_data: `post_edit_truefeed:${editId}` },
          { text: 'Test', callback_data: `post_edit_test:${editId}` }
        ],
        [
          { text: 'Edit', callback_data: `news_edit_${platformId}_${currentIndex}` },
          { text: 'Skip', callback_data: `news_skip_${platformId}_${currentIndex}` }
        ],
        [
          { text: 'Back', callback_data: 'get_news' }
        ]
      ];
    } else if (user?.user_type === 'guest') {
      keyboard = [
        [
          { text: 'Edit', callback_data: `news_edit_${platformId}_${currentIndex}` },
          { text: 'Skip', callback_data: `news_skip_${platformId}_${currentIndex}` }
        ],
        [
          { text: 'Back', callback_data: 'get_news' }
        ]
      ];
    } else {
      await migrateUserChannels(userId);
      await removeDuplicateChannels(userId);
      const userChannels = await getUserChannels(user.id);

      keyboard = [];
      if (userChannels && userChannels.length > 0) {
        for (const channel of userChannels) {
          const channelName = channel.channel_name || channel.channel_id;
          const typeLabel = channel.is_main ? ' 🌟' : (channel.is_test ? ' 🧪' : '');
          keyboard.push([
            { text: `📢 ${channelName}${typeLabel}`, callback_data: `post_edit_channel:${editId}:${channel.id}` }
          ]);
        }
        if (userChannels.length > 1) {
          keyboard.push([
            { text: '📢 Post to All Channels', callback_data: `post_edit_all:${editId}` }
          ]);
        }
      } else {
        keyboard.push([
          { text: '📢 Post to Channel', callback_data: `post_edit_user_main:${editId}` }
        ]);
      }
      keyboard.push([
        { text: 'Edit', callback_data: `news_edit_${platformId}_${currentIndex}` },
        { text: 'Skip', callback_data: `news_skip_${platformId}_${currentIndex}` }
      ]);
      keyboard.push([
        { text: 'Back', callback_data: 'get_news' }
      ]);
    }

    // Send with video if available, otherwise image, otherwise just text
    if (article.video) {
      try {
        await api.sendVideo({
          chat_id: callbackQuery.message.chat.id,
          video: article.video,
          caption: directFormattedText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
        return;
      } catch (videoError) {
        console.error('Failed to send video, falling back to image:', videoError.message);
      }
    }

    if (article.image) {
      try {
        await api.sendPhoto({
          chat_id: callbackQuery.message.chat.id,
          photo: article.image,
          caption: directFormattedText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
        return;
      } catch (photoError) {
        console.error('Failed to send photo, falling back to text:', photoError.message);
      }
    }

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: directFormattedText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (error) {
    console.error('Error translating article:', error);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `❌ Translation failed: ${error.message}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Back', callback_data: 'get_news' }
          ]
        ]
      }
    });
  }
}
