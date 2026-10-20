// handlers/callback_query.js — runs on each callback_query update (button clicks)

import { api } from 'sdk';
import { generateIdea } from '../lib/agent.js';
import { markPosted, markRejected, getIdeaById, savePendingEdit, getPendingEdit, deletePendingEdit, getUserByTelegramId, updateUserOnboardingStep, updateUserCategories, updateUserBotDisplayName, updateUserShowSourceLink, updateUserDotPunctuation, getDashboardStats, getAllUsers, getAllPosts, createPost, getUserPosts, updateUserChannelId, updateUserType } from '../lib/database.js';
import { BotApiError } from 'sdk';
import { TRUE_FEED_CHANNEL_ID, TEST_CHANNEL_ID } from '../lib/secrets.js';
import { NEWS_PLATFORMS, NEWS_CATEGORIES, fetchRSSFeed, getPlatformById, formatNewsArticle } from '../lib/news.js';
import { normalizeChannelId } from '../lib/channel.js';

const OWNER_CHAT_ID = 685669468;

/**
 * Helper function to show the main menu for public users
 */
async function showMainMenu(chatId) {
  await api.sendMessage({
    chat_id: chatId,
    text: '🌱 True Feed Content Creator\n\nWhat would you like to do?',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📰 Generate Content', callback_data: 'generate_content' },
          { text: '⚙️ Settings', callback_data: 'settings' }
        ],
        [
          { text: '📊 My Stats', callback_data: 'my_stats' }
        ]
      ]
    }
  });
}

/**
 * Helper function to show the next news article
 */
async function showNextArticle(callbackQuery, platformId, currentIndex) {
  const platform = getPlatformById(platformId);
  const userId = callbackQuery.from.id;
  const user = await getUserByTelegramId(userId);

  if (!platform) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '❌ Platform not found.',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '↩️ Back', callback_data: 'back' }
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
      text: `📰 Fetching next article from ${platform.name}...`,
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
        text: '📰 No more articles from this platform.',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Refresh', callback_data: `news_platform_${platformId}` },
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ]
        }
      });
      return;
    }

    const article = articles[nextIndex];

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
    const articleText = await formatNewsArticle(article, userChannelLink, null, showSourceLink, useDotPunctuation);

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
          { text: '📢 TrueFeed', callback_data: `news_truefeed_${platformId}_${nextIndex}` },
          { text: '🧪 Test', callback_data: `news_test_${platformId}_${nextIndex}` }
        ],
        [
          { text: '✏️ Edit', callback_data: `news_edit_${platformId}_${nextIndex}` },
          { text: '⏭️ Skip', callback_data: `news_skip_${platformId}_${nextIndex}` }
        ],
        [
          { text: '↩️ Back', callback_data: 'get_news' }
        ]
      ];
    } else if (user?.user_type === 'guest') {
      // Guest mode - no posting, just edit and skip
      keyboard = [
        [
          { text: '✏️ Edit', callback_data: `news_edit_${platformId}_${nextIndex}` },
          { text: '⏭️ Skip', callback_data: `news_skip_${platformId}_${nextIndex}` }
        ],
        [
          { text: '↩️ Back', callback_data: 'get_news' }
        ]
      ];
    } else {
      // User mode - can post to channels
      const hasTestChannel = user && user.test_channel_id;

      if (hasTestChannel) {
        keyboard = [
          [
            { text: '📢 Main Channel', callback_data: `news_user_channel_${platformId}_${nextIndex}` },
            { text: '🧪 Test Channel', callback_data: `news_user_test_channel_${platformId}_${nextIndex}` }
          ],
          [
            { text: '✏️ Edit', callback_data: `news_edit_${platformId}_${nextIndex}` },
            { text: '⏭️ Skip', callback_data: `news_skip_${platformId}_${nextIndex}` }
          ],
          [
            { text: '↩️ Back', callback_data: 'get_news' }
          ]
        ];
      } else {
        keyboard = [
          [
            { text: '📢 Post to Channel', callback_data: `news_user_channel_${platformId}_${nextIndex}` }
          ],
          [
            { text: '✏️ Edit', callback_data: `news_edit_${platformId}_${nextIndex}` },
            { text: '⏭️ Skip', callback_data: `news_skip_${platformId}_${nextIndex}` }
          ],
          [
            { text: '↩️ Back', callback_data: 'get_news' }
          ]
        ];
      }
    }
    
    // Send with image if available, otherwise just text
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
        // Fallback to text if photo fails
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: articleText,
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
      text: `❌ Failed to load next article: ${error.message}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '↩️ Back', callback_data: 'back' }
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
    await updateUserType(userId, 'user');
    await updateUserOnboardingStep(userId, 'join_channel');
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '🎉 User Mode Selected!\n\nTo get started, please join our True Feed channel first:',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📺 Join True Feed Channel', url: 'https://t.me/true_feed' }
          ],
          [
            { text: '✅ I\'ve Joined', callback_data: 'check_join' }
          ]
        ]
      }
    });
    return;
  }

  if (data === 'choose_guest') {
    await updateUserType(userId, 'guest');
    await updateUserOnboardingStep(userId, 'guest_ready');
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '👻 Guest Mode Activated!\n\nYou can now browse and translate news without setting up a channel.',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📰 Browse News', callback_data: 'get_news' }
          ],
          [
            { text: '⚙️ Settings', callback_data: 'settings' }
          ]
        ]
      }
    });
    return;
  }

  if (data === 'switch_to_user') {
    await updateUserType(userId, 'user');
    await updateUserOnboardingStep(userId, 'join_channel');
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '🔄 Switching to User Mode...\n\nTo get started, please join our True Feed channel first:',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📺 Join True Feed Channel', url: 'https://t.me/true_feed' }
          ],
          [
            { text: '✅ I\'ve Joined', callback_data: 'check_join' }
          ]
        ]
      }
    });
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

  if (data.startsWith('news_user_channel_')) {
    await handlePostToUserChannel(callbackQuery, userId, data);
    return;
  }

  if (data.startsWith('news_user_test_channel_')) {
    await handlePostToUserTestChannel(callbackQuery, userId, data);
    return;
  }

  // Public news handlers (before owner check)
  if (data === 'get_news') {
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
      { text: '🌐 All Sources', callback_data: 'news_cat_all' },
      { text: '↩️ Back', callback_data: 'back' }
    ]);

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '📂 Select a news category:',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    return;
  }

  if (data.startsWith('news_cat_')) {
    const catId = data.replace('news_cat_', '');
    const platforms = catId === 'all'
      ? NEWS_PLATFORMS
      : NEWS_PLATFORMS.filter(p => p.category === catId);

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
      { text: '↩️ Categories', callback_data: 'get_news' }
    ]);

    const catObj = NEWS_CATEGORIES.find(c => c.id === catId);
    const catTitle = catObj ? catObj.name : '🌐 All Sources';
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `📰 ${catTitle} — Choose a source to scrape:`,
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    return;
  }

  if (data.startsWith('news_platform_')) {
    const platformId = data.replace('news_platform_', '');
    const platform = getPlatformById(platformId);
    const isOwner = userId === OWNER_CHAT_ID;
    const user = await getUserByTelegramId(userId);

    if (!platform) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Platform not found.',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ]
        }
      });
      return;
    }

    try {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `📰 Fetching news from ${platform.name}...`,
      });

      const articles = await fetchRSSFeed(platform.url, platform.name);

      if (articles.length === 0) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `❌ No news available from ${platform.name}.`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '↩️ Back', callback_data: 'back' }
              ]
            ]
          }
        });
        return;
      }

      // Show first article with buttons
      const article = articles[0];

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

      const botDisplayName = user?.bot_display_name || null;
      const showSourceLink = user?.show_source_link === 1;
      const useDotPunctuation = user?.use_dot_punctuation === 1;
      const articleText = await formatNewsArticle(article, userChannelLink, botDisplayName, showSourceLink, useDotPunctuation);

      // Different buttons for owner vs user vs guest
      let keyboard;
      if (isOwner) {
        keyboard = [
          [
            { text: '📢 TrueFeed', callback_data: `news_truefeed_${platformId}_0` },
            { text: '🧪 Test', callback_data: `news_test_${platformId}_0` }
          ],
          [
            { text: '✏️ Edit', callback_data: `news_edit_${platformId}_0` },
            { text: '⏭️ Skip', callback_data: `news_skip_${platformId}_0` }
          ],
          [
            { text: '↩️ Back', callback_data: 'back' }
          ]
        ];
      } else if (user?.user_type === 'guest') {
        // Guest mode - no posting, just edit and skip
        keyboard = [
          [
            { text: '✏️ Edit', callback_data: `news_edit_${platformId}_0` },
            { text: '⏭️ Skip', callback_data: `news_skip_${platformId}_0` }
          ],
          [
            { text: '↩️ Back', callback_data: 'back' }
          ]
        ];
      } else {
        // User mode - can post to channels
        const hasTestChannel = user && user.test_channel_id;

        if (hasTestChannel) {
          keyboard = [
            [
              { text: '📢 Main Channel', callback_data: `news_user_channel_${platformId}_0` },
              { text: '🧪 Test Channel', callback_data: `news_user_test_channel_${platformId}_0` }
            ],
            [
              { text: '✏️ Edit', callback_data: `news_edit_${platformId}_0` },
              { text: '⏭️ Skip', callback_data: `news_skip_${platformId}_0` }
            ],
            [
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ];
        } else {
          keyboard = [
            [
              { text: '📢 Post to Channel', callback_data: `news_user_channel_${platformId}_0` }
            ],
            [
              { text: '✏️ Edit', callback_data: `news_edit_${platformId}_0` },
              { text: '⏭️ Skip', callback_data: `news_skip_${platformId}_0` }
            ],
            [
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ];
        }
      }

      // Send with image if available, otherwise just text
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
        text: `❌ Failed to fetch news: ${error.message}`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '↩️ Back', callback_data: 'back' }
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
      text: '✏️ Please send your edited version of the news.\n\nReply with the text you want to post.',
    });
    return;
  }

  // Handle settings button (public)
  if (data === 'settings') {
    const user = await getUserByTelegramId(userId);
    const currentBotName = user?.bot_display_name || 'Default';
    const showSourceLink = user?.show_source_link === 1 ? 'Yes' : 'No';
    const useDotPunctuation = user?.use_dot_punctuation === 1 ? 'Yes' : 'No';

    const isOwner = userId === OWNER_CHAT_ID;

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `⚙️ Settings\n\n🤖 Bot Display Name: ${currentBotName}\n🔗 Show Source Link: ${showSourceLink}${isOwner ? `\n✨ Use Dot Punctuation: ${useDotPunctuation}` : ''}\n\nWhat would you like to change?`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🤖 Change Bot Name', callback_data: 'change_bot_name' },
            { text: '🔗 Toggle Source Link', callback_data: 'toggle_source_link' }
          ],
          ...(isOwner ? [[{ text: '✨ Toggle Dot Punctuation', callback_data: 'toggle_dot_punctuation' }]] : []),
          [
            { text: '↩️ Back', callback_data: 'back' }
          ]
        ]
      }
    });
    return;
  }

  // Handle change bot name
  if (data === 'change_bot_name') {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '🤖 Change Bot Display Name\n\nPlease send your preferred bot name (e.g., "My News Bot").\n\nType "skip" to remove custom name and use default.',
    });
    // Store the intent in pending edit
    await savePendingEdit(userId, '__change_bot_name__', null);
    return;
  }

  // Handle toggle source link
  if (data === 'toggle_source_link') {
    const user = await getUserByTelegramId(userId);
    const newValue = user?.show_source_link === 1 ? 0 : 1;
    await updateUserShowSourceLink(userId, newValue === 1);

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `✅ Source link ${newValue === 1 ? 'enabled' : 'disabled'}.`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '↩️ Back to Settings', callback_data: 'settings' }
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
      text: `✅ Dot punctuation ${newValue === 1 ? 'enabled' : 'disabled'}.`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '↩️ Back to Settings', callback_data: 'settings' }
          ]
        ]
      }
    });
    return;
  }

  // Handle my stats button (public)
  if (data === 'my_stats') {
    const user = await getUserByTelegramId(userId);
    if (!user) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ User not found.',
      });
      return;
    }

    const userPosts = await getUserPosts(user.id);
    const categories = user.categories ? JSON.parse(user.categories) : [];

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `📊 Your Stats\n\n📰 Total Posts: ${user.posts_count || 0}\n📂 Categories: ${categories.length > 0 ? categories.join(', ') : 'None'}\n📺 Channel: ${user.channel_name || user.channel_id || 'Not set'}\n👤 Display Name: ${user.display_name || 'Not set'}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '↩️ Back', callback_data: 'back' }
          ]
        ]
      }
    });
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
          text: '❌ No edited text found. Please try editing again.',
        });
        return;
      }

      const user = await getUserByTelegramId(callbackQuery.from.id);
      console.log('User:', user);

      if (!user || !user.channel_id) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ Channel not found. Please complete onboarding first.',
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
        text: '✅ Edited news posted to your channel!',
      });
    } catch (error) {
      console.error('Error posting edited news to user channel:', error);
      if (error instanceof BotApiError) {
        console.error('Bot API Error code:', error.code, 'description:', error.description);
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

  // Handle post edited news to user's test channel (public)
  if (data.startsWith('post_edit_user_test:')) {
    try {
      const pendingEdit = await getPendingEdit(callbackQuery.from.id);
      if (!pendingEdit || pendingEdit.text === '__waiting__') {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ No edited text found. Please try editing again.',
        });
        return;
      }

      const user = await getUserByTelegramId(callbackQuery.from.id);
      if (!user || !user.test_channel_id) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ Test channel not found. Please configure your test channel in settings.',
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
        text: '✅ Edited news posted to your test channel!',
      });
    } catch (error) {
      console.error('Error posting edited news to test channel:', error);
      if (error instanceof BotApiError) {
        console.error('Bot API Error code:', error.code, 'description:', error.description);
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `❌ Failed to post: ${error.description}. Make sure the bot is an admin in your test channel with "Post Messages" permission.`,
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

  // Handle cancel edit (public)
  if (data === 'cancel_edit') {
    await deletePendingEdit(callbackQuery.from.id);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '❌ Edit cancelled.',
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
    } else if (user && user.onboarding_step === 'completed') {
      await showMainMenu(callbackQuery.message.chat.id);
    } else {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '🌱 True Feed Content Creator\n\nWhat would you like to do?',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📰 Generate Content', callback_data: 'generate_content' },
              { text: '⚙️ Settings', callback_data: 'settings' }
            ],
            [
              { text: '📊 My Stats', callback_data: 'my_stats' }
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
        text: '⏳ Generating idea...',
      });

      const idea = await generateIdea();

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: idea.content,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve & Post', callback_data: `approve_${idea.id}` },
              { text: '❌ Reject — New Idea', callback_data: `reject_${idea.id}` }
            ],
            [
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ]
        }
      });

    } catch (error) {
      console.error('Error in new_idea callback:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Failed to generate idea. Please try again.',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'idea', callback_data: 'new_idea' },
              { text: '📰 news', callback_data: 'get_news' }
            ]
          ]
        }
      });
    }
  }

  // Handle news TrueFeed - post to main channel, then show next article (owner only)
  if (data.startsWith('news_truefeed_')) {
    const parts = data.replace('news_truefeed_', '').split('_');
    const platformId = parts[0];
    const currentIndex = parseInt(parts[1]);

    const platform = getPlatformById(platformId);

    if (!platform) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Platform not found.',
      });
      return;
    }

    const user = await getUserByTelegramId(userId);

    try {
      const articles = await fetchRSSFeed(platform.url, platform.name);

      if (currentIndex >= articles.length) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ Article no longer available.',
        });
        return;
      }

      const article = articles[currentIndex];
      const showSourceLink = user?.show_source_link === 1;
      const useDotPunctuation = user?.use_dot_punctuation === 1;
      const articleText = await formatNewsArticle(article, '@true_feed', null, showSourceLink, useDotPunctuation);
      
      // Post to the True Feed channel
      if (article.image) {
        try {
          await api.sendPhoto({
            chat_id: TRUE_FEED_CHANNEL_ID,
            photo: article.image,
            caption: articleText,
            parse_mode: 'HTML',
          });
        } catch (photoError) {
          console.error('Failed to send photo to channel, falling back to text:', photoError.message);
          await api.sendMessage({
            chat_id: TRUE_FEED_CHANNEL_ID,
            text: articleText,
            parse_mode: 'HTML',
          });
        }
      } else {
        await api.sendMessage({
          chat_id: TRUE_FEED_CHANNEL_ID,
          text: articleText,
          parse_mode: 'HTML',
        });
      }
      
      // Confirm to the owner
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '✅ Posted to TrueFeed!',
      });
      
    } catch (error) {
      console.error('Error posting article to TrueFeed:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `❌ Failed to post article: ${error.message}`,
      });
    }
    
    // Show next article
    await showNextArticle(callbackQuery, platformId, currentIndex);
  }
  
  // Handle news Test - post to test channel, then show next article (owner only)
  if (data.startsWith('news_test_')) {
    const parts = data.replace('news_test_', '').split('_');
    const platformId = parts[0];
    const currentIndex = parseInt(parts[1]);

    const platform = getPlatformById(platformId);

    if (!platform) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Platform not found.',
      });
      return;
    }

    const user = await getUserByTelegramId(userId);

    try {
      const articles = await fetchRSSFeed(platform.url, platform.name);

      if (currentIndex >= articles.length) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ Article no longer available.',
        });
        return;
      }

      const article = articles[currentIndex];
      const showSourceLink = user?.show_source_link === 1;
      const useDotPunctuation = user?.use_dot_punctuation === 1;
      const articleText = await formatNewsArticle(article, '@true_feed', null, showSourceLink, useDotPunctuation);

      // Post to the Test channel
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
        text: '🧪 Posted to Test channel!',
      });

    } catch (error) {
      console.error('Error posting article to test channel:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `❌ Failed to post article: ${error.message}`,
      });
    }

    // Show next article
    await showNextArticle(callbackQuery, platformId, currentIndex);
  }

  // Handle post edited news to TrueFeed (owner only)
  if (data.startsWith('post_edit_truefeed:')) {
    try {
      const pendingEdit = await getPendingEdit(callbackQuery.from.id);
      if (!pendingEdit || pendingEdit.text === '__waiting__') {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ No edited text found. Please try editing again.',
        });
        return;
      }

      console.log('Posting edited news to TrueFeed channel:', TRUE_FEED_CHANNEL_ID);

      // Post with image if available, otherwise just text
      if (pendingEdit.image_url) {
        try {
          await api.sendPhoto({
            chat_id: TRUE_FEED_CHANNEL_ID,
            photo: pendingEdit.image_url,
            caption: pendingEdit.text,
            parse_mode: 'HTML',
          });
        } catch (photoError) {
          console.error('Failed to post edited photo to TrueFeed, falling back to text:', photoError);
          await api.sendMessage({
            chat_id: TRUE_FEED_CHANNEL_ID,
            text: pendingEdit.text,
            parse_mode: 'HTML',
          });
        }
      } else {
        await api.sendMessage({
          chat_id: TRUE_FEED_CHANNEL_ID,
          text: pendingEdit.text,
          parse_mode: 'HTML',
        });
      }

      await deletePendingEdit(callbackQuery.from.id);

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '✅ Edited news posted to TrueFeed!',
      });
    } catch (error) {
      console.error('Error posting edited news to TrueFeed:', error);
      if (error instanceof BotApiError) {
        console.error('Bot API Error code:', error.code, 'description:', error.description);
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `❌ Failed to post: ${error.description}`,
        });
      } else {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `❌ Failed to post: ${error.message}`,
        });
      }
    }
  }

  // Handle post edited news to Test (owner only)
  if (data.startsWith('post_edit_test:')) {
    try {
      const pendingEdit = await getPendingEdit(callbackQuery.from.id);
      if (!pendingEdit || pendingEdit.text === '__waiting__') {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ No edited text found. Please try editing again.',
        });
        return;
      }

      console.log('Posting edited news to Test channel:', TEST_CHANNEL_ID);

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
          console.error('Failed to post edited photo to Test channel, falling back to text:', photoError);
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
        text: '🧪 Edited news posted to Test channel!',
      });
    } catch (error) {
      console.error('Error posting edited news to Test channel:', error);
      if (error instanceof BotApiError) {
        console.error('Bot API Error code:', error.code, 'description:', error.description);
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `❌ Failed to post: ${error.description}`,
        });
      } else {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `❌ Failed to post: ${error.message}`,
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
        text: '⏳ Approving and posting idea...',
      });
      
      const idea = await getIdeaById(ideaId);
      
      if (!idea) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ Idea not found.',
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
        text: '✅ Idea approved and posted to channel!',
      });
      
    } catch (error) {
      console.error('Error approving idea:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `❌ Failed to approve idea: ${error.message}`,
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
        text: '⏳ Generating idea...',
      });

      const idea = await generateIdea();

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: idea.content,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve & Post', callback_data: `approve_${idea.id}` },
              { text: '❌ Reject — New Idea', callback_data: `reject_${idea.id}` }
            ],
            [
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ]
        }
      });

    } catch (error) {
      console.error('Error rejecting idea:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Failed to reject idea.',
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
        text: '❌ You haven\'t joined the True Feed channel yet. Please join first:',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📺 Join True Feed Channel', url: 'https://t.me/true_feed' }
            ],
            [
              { text: '✅ I\'ve Joined', callback_data: 'check_join' }
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
      text: '✅ You\'ve joined the channel!\n\n📝 Step 1: Connect Your Channel\n\nPlease send your channel username (e.g., @yourchannel), channel link (https://t.me/yourchannel), or simply forward any post from your channel to this chat.',
    });
  } catch (error) {
    console.error('Error checking channel membership:', error);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '❌ Failed to verify channel membership. Please try again.',
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
      text: '❌ Channel ID not found. Please provide your channel first.',
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
        text: `❌ The bot is not yet an administrator in ${channelId}.\n\nPlease add @${botInfo.username || 'this bot'} as an administrator to your channel with permission to Post Messages.\n\nOnce added, click the button below:`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Done', callback_data: 'bot_admin_added' }
            ],
            [
              { text: '🔄 Change Channel', callback_data: 'change_channel' }
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
      text: `✅ Great! Bot is verified as an admin in ${channelId}.\n\n✏️ Step 3: Display Name\n\nSend the name you want to be displayed on your channel (e.g., "Your Name" or send "skip" to skip this step)`,
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
      text: `❌ Failed to verify bot admin status for ${channelId}.${detailMsg}\n\nPlease make sure:\n1. The bot is added as admin to your channel\n2. The channel ID is correct\n\nClick the button below to try again:`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Done', callback_data: 'bot_admin_added' }
          ],
          [
            { text: '🔄 Change Channel', callback_data: 'change_channel' }
          ]
        ]
      }
    });
  }
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
    text: `✅ Added "${category}" to your categories!`,
  });

  // Show category selection again
  const keyboard = [];
  for (let i = 0; i < NEWS_CATEGORIES.length; i += 2) {
    const row = [];
    const cat1 = NEWS_CATEGORIES[i];
    const isSelected1 = categories.includes(cat1.id);
    row.push({
      text: `${isSelected1 ? '✅ ' : ''}${cat1.name}`,
      callback_data: `select_category_${cat1.id}`
    });
    if (i + 1 < NEWS_CATEGORIES.length) {
      const cat2 = NEWS_CATEGORIES[i + 1];
      const isSelected2 = categories.includes(cat2.id);
      row.push({
        text: `${isSelected2 ? '✅ ' : ''}${cat2.name}`,
        callback_data: `select_category_${cat2.id}`
      });
    }
    keyboard.push(row);
  }

  keyboard.push([
    { text: '➕ Add Custom Source', callback_data: 'add_custom_source' }
  ]);
  keyboard.push([
    { text: '✅ Complete Setup', callback_data: 'complete_setup' }
  ]);

  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: '📂 Step 4: Select Content Categories\n\nChoose the types of content you want to generate:',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function handleAddCustomSource(callbackQuery, userId) {
  await updateUserOnboardingStep(userId, 'add_custom_source_name');
  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: '➕ Add Custom Source\n\nSend me the name of your custom source (e.g., "My Blog"):',
  });
}

async function handleCompleteSetup(callbackQuery, userId) {
  const user = await getUserByTelegramId(userId);

  if (!user.channel_id) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '❌ Please complete all setup steps first.',
    });
    return;
  }

  await updateUserOnboardingStep(userId, 'completed');

  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: '🎉 Setup Complete!\n\nYou can now start generating content for your channel. Click the button below to begin:',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📰 Generate Content', callback_data: 'generate_content' }
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
      text: '❌ Please complete setup first.',
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
    { text: '🌐 All Sources', callback_data: 'news_cat_all' },
    { text: '↩️ Main Menu', callback_data: 'back' }
  ]);

  await api.sendMessage({
    chat_id: callbackQuery.message.chat.id,
    text: '📂 Select a category to scrape and generate content:',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function handlePostToUserChannel(callbackQuery, userId, data) {
  const parts = data.replace('news_user_channel_', '').split('_');
  const platformId = parts[0];
  const currentIndex = parseInt(parts[1]);

  const user = await getUserByTelegramId(userId);
  const platform = getPlatformById(platformId);

  if (!user || !user.channel_id) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '❌ Channel not found.',
    });
    return;
  }

  if (!platform) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '❌ Platform not found.',
    });
    return;
  }

  try {
    const articles = await fetchRSSFeed(platform.url, platform.name);

    if (currentIndex >= articles.length) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Article no longer available.',
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
    const articleText = await formatNewsArticle(article, userChannelLink, null, showSourceLink, useDotPunctuation);

    // Post to the user's channel
    if (article.image) {
      try {
        await api.sendPhoto({
          chat_id: user.channel_id,
          photo: article.image,
          caption: articleText,
          parse_mode: 'HTML',
        });
      } catch (photoError) {
        console.error('Failed to send photo to channel, falling back to text:', photoError.message);
        await api.sendMessage({
          chat_id: user.channel_id,
          text: articleText,
          parse_mode: 'HTML',
        });
      }
    } else {
      await api.sendMessage({
        chat_id: user.channel_id,
        text: articleText,
        parse_mode: 'HTML',
      });
    }

    // Track the post
    await createPost(user.id, user.channel_id, articleText, article.category || 'news', platform.name, article.image);

    // Confirm to the user
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '✅ Posted to your channel!',
    });

  } catch (error) {
    console.error('Error posting article to user channel:', error);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `❌ Failed to post article: ${error.message}`,
    });
  }

  // Show next article
  await showNextArticle(callbackQuery, platformId, currentIndex);
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
      text: '❌ Test channel not found. Please configure your test channel in settings.',
    });
    return;
  }

  if (!platform) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '❌ Platform not found.',
    });
    return;
  }

  try {
    const articles = await fetchRSSFeed(platform.url, platform.name);

    if (currentIndex >= articles.length) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Article no longer available.',
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
    const articleText = await formatNewsArticle(article, userChannelLink, null, showSourceLink, useDotPunctuation);

    // Post to the user's test channel
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

    // Track the post (but don't increment main posts count since it's test)
    await createPost(user.id, user.test_channel_id, articleText, article.category || 'news', platform.name, article.image);

    // Confirm to the user
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '✅ Posted to your test channel!',
    });

  } catch (error) {
    console.error('Error posting article to user test channel:', error);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `❌ Failed to post article: ${error.message}`,
    });
  }

  // Show next article
  await showNextArticle(callbackQuery, platformId, currentIndex);
}
