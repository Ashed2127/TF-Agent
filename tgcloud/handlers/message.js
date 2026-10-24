// handlers/message.js — runs on each `message` update. The file name is the
// Telegram update type; the platform calls the default export with the matching
// payload (here, a Message). The full update is available as `ctx.update`.

import { api } from 'sdk';
import { generateIdea } from '../lib/agent.js';
import { TRUE_FEED_CHANNEL_ID, TEST_CHANNEL_ID } from '../lib/secrets.js';
import { savePendingEdit, getPendingEdit, deletePendingEdit, getOrCreateUser, getUserByTelegramId, updateUserChannelId, updateUserTestChannelId, updateUserOnboardingStep, updateUserDisplayName, updateUserBotDisplayName, updateUserShowSourceLink, updateUserDotPunctuation, addCustomSource, updateUserType, addUserChannel, getPendingChannelAdd, setPendingChannelAdd, clearPendingChannelAdd, saveContentStructure } from '../lib/database.js';
import { formatEditedNewsText, NEWS_CATEGORIES } from '../lib/news.js';
import { extractChannelFromMessage, normalizeChannelId } from '../lib/channel.js';

const OWNER_CHAT_ID = 685669468; // Your chat ID

export default async function (message, ctx) {
  if (!message.from) {
    console.log('Message has no from field, skipping');
    return;
  }

  const userId = message.from.id;
  const username = message.from.username;

  // Handle /start command
  if (message.text === '/start') {
    // Cancel any pending edit on /start
    await deletePendingEdit(userId);

    // Get or create user
    const user = await getOrCreateUser(userId, username);

    // Enable dot punctuation for owner by default
    if (userId === OWNER_CHAT_ID) {
      await updateUserDotPunctuation(userId, true);
    }

    // Owner gets the old interface
    if (userId === OWNER_CHAT_ID) {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '🌱 TF Agent እንኳን ደህና መጡ!\n\nይህ Bot True Feed ቻናልዎን ያስተዳድራል።\nከታች ያሉትን አማራጮች ይጫኑ።',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'idea', callback_data: 'new_idea' },
              { text: '📰 news', callback_data: 'get_news' }
            ],
            [
              { text: '💰 Rates', callback_data: 'get_rates' },
              { text: '⚙️ Settings', callback_data: 'settings' }
            ],
            [
              { text: '📊 Analytics Dashboard', web_app: { url: 'https://app8909892200.tgcloud.ai/' } }
            ]
          ]
        }
      });
      return;
    }

    // Check if user has already completed onboarding
    if (user && user.onboarding_step === 'completed') {
      // Show appropriate menu based on user type
      if (user.user_type === 'guest') {
        await api.sendMessage({
          chat_id: message.chat.id,
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
      } else {
        await showMainMenu(message.chat.id, userId === OWNER_CHAT_ID);
      }
      return;
    }

    // Show User/Guest choice for new users who haven't completed onboarding
    await showUserTypeChoice(message.chat.id);
    return;
  }

  // Handle /test command for debugging (owner only)
  if (message.text === '/test' && userId === OWNER_CHAT_ID) {
    try {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '🧪 Testing idea generation...',
      });

      const user = await getUserByTelegramId(userId);
      const idea = await generateIdea(user.telegram_id);

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

  const user = await getUserByTelegramId(userId);

  // Handle onboarding channel input (forwarded message, link, or username)
  if (user && (user.onboarding_step === 'provide_channel_id' || user.onboarding_step === 'add_bot_admin')) {
    const channelInfo = extractChannelFromMessage(message);
    if (channelInfo && channelInfo.channelId) {
      await updateUserChannelId(userId, channelInfo.channelId, channelInfo.channelName);
      await updateUserOnboardingStep(userId, 'add_bot_admin');
      await showAddBotAdminInstructions(message.chat.id, channelInfo.channelId);
      return;
    }
  }

  // Handle text confirmation in add_bot_admin step (e.g. typing "done")
  if (user && user.onboarding_step === 'add_bot_admin') {
    const text = (message.text || '').trim().toLowerCase();
    if (['done', 'done!', 'added', 'ok', 'ready', 'yes', 'check'].includes(text)) {
      await verifyAndAdvanceBotAdmin(message.chat.id, user);
      return;
    }
  }

  // Handle text input during onboarding
  const incomingText = message.text || message.caption;
  if (incomingText && !incomingText.startsWith('/')) {

    // Handle edited news post (both owner and public users)
    const pendingEdit = await getPendingEdit(userId);
    console.log('Pending edit found:', pendingEdit);
    if (pendingEdit) {
      console.log('User is in edit mode, processing edited text');

      // User is in edit mode — preserve original image or use newly uploaded photo
      const newPhotoId = (message.photo && message.photo.length > 0)
        ? message.photo[message.photo.length - 1].file_id
        : null;
      const imageToUse = newPhotoId || pendingEdit.image_url;

      console.log('Image to use:', imageToUse);

      // Extract entities (from text or photo caption)
      const entities = message.entities || message.caption_entities || [];

      // Format text to preserve and enforce HTML boldness (title, entities)
      const useDotPunctuation = user?.use_dot_punctuation === 1;
      const addTrueFeedAttribution = userId === OWNER_CHAT_ID; // Only add @true_feed for owner
      const formattedText = formatEditedNewsText(incomingText, entities, useDotPunctuation, addTrueFeedAttribution);

      console.log('Formatted text length:', formattedText.length);

      const editId = await savePendingEdit(userId, formattedText, imageToUse);

      console.log('Saved pending edit with ID:', editId);

      // Determine keyboard based on user type and test channel availability
      const isOwner = userId === OWNER_CHAT_ID;
      let keyboard;

      if (isOwner) {
        keyboard = [
          [
            { text: '📢 TrueFeed', callback_data: `post_edit_truefeed:${editId}` },
            { text: '🧪 Test', callback_data: `post_edit_test:${editId}` }
          ],
          [
            { text: '❌ Cancel', callback_data: 'cancel_edit' }
          ]
        ];
      } else if (user?.user_type === 'guest') {
        // Guest mode - no posting, just cancel
        keyboard = [
          [
            { text: '❌ Cancel', callback_data: 'cancel_edit' }
          ]
        ];
      } else {
        // User mode - can post to channels
        const hasTestChannel = user && user.test_channel_id;

        if (hasTestChannel) {
          keyboard = [
            [
              { text: '📢 Main Channel', callback_data: `post_edit_user_main:${editId}` },
              { text: '🧪 Test Channel', callback_data: `post_edit_user_test:${editId}` }
            ],
            [
              { text: '❌ Cancel', callback_data: 'cancel_edit' }
            ]
          ];
        } else {
          keyboard = [
            [
              { text: '📢 Post to Channel', callback_data: `post_edit_user_main:${editId}` }
            ],
            [
              { text: '❌ Cancel', callback_data: 'cancel_edit' }
            ]
          ];
        }
      }

      console.log('Sending preview with keyboard:', JSON.stringify(keyboard));

      // Send formatted preview with buttons so user can see boldness and image
      try {
        if (imageToUse) {
          await api.sendPhoto({
            chat_id: message.chat.id,
            photo: imageToUse,
            caption: formattedText,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
          console.log('Photo preview sent successfully');
        } else {
          await api.sendMessage({
            chat_id: message.chat.id,
            text: formattedText,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
          console.log('Text preview sent successfully');
        }
      } catch (sendError) {
        console.error('Error sending preview:', sendError);
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '❌ Error sending preview. Please try again.',
        });
      }
      return;
    }

    // Handle onboarding text inputs
    if (user && (user.onboarding_step === 'provide_channel_id' || user.onboarding_step === 'add_bot_admin')) {
      const normalized = normalizeChannelId(incomingText);
      if (normalized) {
        await updateUserChannelId(userId, normalized, normalized);
        await updateUserOnboardingStep(userId, 'add_bot_admin');
        await showAddBotAdminInstructions(message.chat.id, normalized);
        return;
      }
    }

    if (user && user.onboarding_step === 'provide_display_name') {
      if (incomingText.toLowerCase() === 'skip') {
        await updateUserOnboardingStep(userId, 'select_categories');
        await showCategorySelection(message.chat.id);
        return;
      }
      await updateUserDisplayName(userId, incomingText);
      await updateUserOnboardingStep(userId, 'select_categories');
      await showCategorySelection(message.chat.id);
      return;
    }

    if (user && user.onboarding_step === 'add_custom_source_name') {
      // Store the source name temporarily and ask for URL
      await updateUserDisplayName(userId, `temp_source_name:${incomingText}`);
      await updateUserOnboardingStep(userId, 'add_custom_source_url');
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '📎 Now send me the RSS feed URL for this source:',
      });
      return;
    }

    if (user && user.onboarding_step === 'add_custom_source_url') {
      const displayName = user.display_name;
      const sourceName = displayName.replace('temp_source_name:', '');
      const sourceUrl = incomingText;

      // Add the custom source
      await addCustomSource(user.id, sourceName, sourceUrl);

      // Clear the temporary display name
      await updateUserDisplayName(userId, null);

      await api.sendMessage({
        chat_id: message.chat.id,
        text: `✅ Custom source "${sourceName}" added successfully!`,
      });

      // Show category selection again
      await showCategorySelection(message.chat.id);
      return;
    }

    // Handle adding new channel from settings
    const pendingChannel = await getPendingChannelAdd(userId);
    if (pendingChannel && pendingChannel.channelId === 'waiting') {
      const channelInfo = extractChannelFromMessage(message);
      if (channelInfo && channelInfo.channelId) {
        // Store the channel info and ask for bot admin verification
        await setPendingChannelAdd(userId, channelInfo.channelId, channelInfo.channelName);
        await showAddChannelBotAdminInstructions(message.chat.id, channelInfo.channelId);
        return;
      }

      // Try text input
      const normalized = normalizeChannelId(incomingText);
      if (normalized) {
        await setPendingChannelAdd(userId, normalized, normalized);
        await showAddChannelBotAdminInstructions(message.chat.id, normalized);
        return;
      }
    }

    // Handle editing channel link
    if (pendingChannel && pendingChannel.channelId === 'edit_channel') {
      const channelInfo = extractChannelFromMessage(message);
      let newChannelId = null;
      let newChannelName = null;

      if (channelInfo && channelInfo.channelId) {
        newChannelId = channelInfo.channelId;
        newChannelName = channelInfo.channelName;
      } else {
        // Try text input
        const normalized = normalizeChannelId(incomingText);
        if (normalized) {
          newChannelId = normalized;
          newChannelName = normalized;
        }
      }

      if (newChannelId) {
        await updateUserChannelId(userId, newChannelId);
        await clearPendingChannelAdd(userId);
        await api.sendMessage({
          chat_id: message.chat.id,
          text: `✅ Channel link updated to: ${newChannelName || newChannelId}`,
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚙️ Settings', callback_data: 'settings' }]
            ]
          }
        });
        return;
      } else {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '❌ Invalid channel format. Please send a valid channel (e.g., @mychannel or https://t.me/mychannel)',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚙️ Settings', callback_data: 'settings' }]
            ]
          }
        });
        return;
      }
    }

    // Handle bot admin verification for new channel
    if (pendingChannel && pendingChannel.channelId !== 'waiting') {
      const text = (message.text || '').trim().toLowerCase();
      if (['done', 'done!', 'added', 'ok', 'ready', 'yes', 'check'].includes(text)) {
        await verifyAndAddChannel(message.chat.id, user, pendingChannel.channelId, pendingChannel.channelName);
        return;
      }
      if (['cancel', 'abort', 'stop', 'no'].includes(text)) {
        await clearPendingChannelAdd(userId);
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '❌ Channel addition cancelled.',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚙️ Settings', callback_data: 'settings' }]
            ]
          }
        });
        return;
      }
    }

    // Handle content structure input
    if (pendingChannel && pendingChannel.channelId === 'waiting_content_structure') {
      const structureText = incomingText;
      console.log('💾 Saving content structure for user:', user.id);
      console.log('📝 Structure text:', structureText);
      await saveContentStructure(user.id, structureText);
      await clearPendingChannelAdd(userId);
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '✅ Content structure saved!\n\nThe AI will now use this structure when generating content for you.',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⚙️ Settings', callback_data: 'settings' }]
          ]
        }
      });
      return;
    }
  }
}

async function showMainMenu(chatId, isOwner = false) {
  const keyboard = [
    [
      { text: '📰 Generate Content', callback_data: 'generate_content' },
      { text: '⚙️ Settings', callback_data: 'settings' }
    ],
    [
      { text: '📊 My Stats', callback_data: 'my_stats' }
    ],
    [
      { text: '🔄 Refresh', callback_data: 'refresh_menu' }
    ],
    [
      { text: '↩️ Back', callback_data: 'back' }
    ]
  ];

  // Add analytics button for owner
  if (isOwner) {
    keyboard.splice(3, 0, [
      { text: '📊 Analytics Dashboard', web_app: { url: 'https://app8909892200.tgcloud.ai/' } }
    ]);
  }

  await api.sendMessage({
    chat_id: chatId,
    text: '🌱 True Feed Content Creator\n\nWhat would you like to do?',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function showUserTypeChoice(chatId) {
  await api.sendMessage({
    chat_id: chatId,
    text: '🎉 Welcome to True Feed!\n\nChoose how you want to use the bot:',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '👤 User', callback_data: 'choose_user' },
          { text: '👻 Guest', callback_data: 'choose_guest' }
        ],
        [
          { text: '🔄 Refresh', callback_data: 'refresh_user_type' }
        ],
        [
          { text: '↩️ Back', callback_data: 'back' }
        ]
      ]
    }
  });
}

async function continueOnboarding(chatId, user) {
  switch (user.onboarding_step) {
    case 'provide_channel_id':
      await showChannelIdInstructions(chatId);
      break;
    case 'add_bot_admin':
      await showAddBotAdminInstructions(chatId, user.channel_id);
      break;
    case 'provide_display_name':
      await showDisplayNameInstructions(chatId);
      break;
    case 'select_categories':
      await showCategorySelection(chatId);
      break;
    default:
      await showMainMenu(chatId);
  }
}

async function showChannelIdInstructions(chatId) {
  await api.sendMessage({
    chat_id: chatId,
    text: '📝 Step 2: Select Your Channel\n\nPlease send your channel username (e.g., @yourchannel), channel link (https://t.me/yourchannel), or forward any message from your channel to this chat.',
  });
}

async function showAddBotAdminInstructions(chatId, channelId = null) {
  const channelDisplay = channelId ? ` "${channelId}"` : '';
  await api.sendMessage({
    chat_id: chatId,
    text: `🤖 Step 3: Add Bot as Admin\n\nPlease add this bot as an administrator to your channel${channelDisplay} with the following permissions:\n\n• Post Messages\n• Edit Messages\n\nOnce done, click the button below:`,
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

async function verifyAndAdvanceBotAdmin(chatId, user) {
  if (!user || !user.channel_id) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Channel ID not found. Please provide your channel first.',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Provide Channel', callback_data: 'change_channel' }]
        ]
      }
    });
    return;
  }

  let channelId = normalizeChannelId(user.channel_id);
  if (channelId && channelId !== user.channel_id) {
    await updateUserChannelId(user.telegram_id, channelId, user.channel_name || channelId);
  } else if (!channelId) {
    channelId = user.channel_id;
  }

  try {
    const botInfo = await api.getMe();
    const botMember = await api.getChatMember({
      chat_id: channelId,
      user_id: botInfo.id
    });

    const isAdmin = botMember.status === 'administrator' || botMember.status === 'creator';
    if (!isAdmin) {
      await api.sendMessage({
        chat_id: chatId,
        text: `❌ The bot is not yet an administrator in ${channelId}.\n\nPlease add @${botInfo.username || 'this bot'} as an administrator to your channel with permission to Post Messages.\n\nOnce added, click the button below:`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Done', callback_data: 'bot_admin_added' }],
            [{ text: '🔄 Change Channel', callback_data: 'change_channel' }]
          ]
        }
      });
      return;
    }

    await updateUserOnboardingStep(user.telegram_id, 'provide_display_name');
    await api.sendMessage({
      chat_id: chatId,
      text: `✅ Great! Bot is verified as an admin in ${channelId}.\n\n✏️ Step 4: Display Name (Optional)\n\nSend the name you want to be displayed on your channel (e.g., "Your Name")`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏭️ Skip This Step', callback_data: 'skip_display_name' }]
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
      chat_id: chatId,
      text: `❌ Failed to verify bot admin status for ${channelId}.${detailMsg}\n\nPlease make sure:\n1. The bot is added as admin to your channel\n2. The channel ID is correct\n\nClick the button below to try again:`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Done', callback_data: 'bot_admin_added' }],
          [{ text: '🔄 Change Channel', callback_data: 'change_channel' }]
        ]
      }
    });
  }
}

async function showDisplayNameInstructions(chatId) {
  await api.sendMessage({
    chat_id: chatId,
    text: '✏️ Step 4: Display Name (Optional)\n\nSend the name you want to be displayed on your channel (e.g., "Your Name")',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⏭️ Skip This Step', callback_data: 'skip_display_name' }]
      ]
    }
  });
}

async function showCategorySelection(chatId) {
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
    { text: '➕ Add Custom Source', callback_data: 'add_custom_source' }
  ]);
  keyboard.push([
    { text: '✅ Complete Setup', callback_data: 'complete_setup' }
  ]);

  await api.sendMessage({
    chat_id: chatId,
    text: '📂 Step 5: Select Content Categories\n\nChoose the types of content you want to generate:',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function showAddChannelBotAdminInstructions(chatId, channelId = null) {
  const channelDisplay = channelId ? ` "${channelId}"` : '';
  await api.sendMessage({
    chat_id: chatId,
    text: `🤖 Add Bot as Admin\n\nPlease add this bot as an administrator to your channel${channelDisplay} with the following permissions:\n\n• Post Messages\n• Edit Messages\n\nOnce done, send "done" to continue:`,
  });
}

async function verifyAndAddChannel(chatId, user, channelId, channelName) {
  if (!channelId) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Channel ID not found.',
    });
    await clearPendingChannelAdd(user.telegram_id);
    return;
  }

  let normalizedChannelId = normalizeChannelId(channelId);
  if (normalizedChannelId && normalizedChannelId !== channelId) {
    channelName = channelName || normalizedChannelId;
    channelId = normalizedChannelId;
  }

  try {
    const botInfo = await api.getMe();
    const botMember = await api.getChatMember({
      chat_id: channelId,
      user_id: botInfo.id
    });

    const isAdmin = botMember.status === 'administrator' || botMember.status === 'creator';

    if (!isAdmin) {
      await api.sendMessage({
        chat_id: chatId,
        text: `❌ The bot is not yet an administrator in ${channelId}.\n\nPlease add @${botInfo.username || 'this bot'} as an administrator to your channel with permission to Post Messages.\n\nOnce added, send "done" to continue:`,
      });
      return;
    }

    // Add the channel
    await addUserChannel(user.id, channelId, channelName, 0, 0);
    await clearPendingChannelAdd(user.telegram_id);

    await api.sendMessage({
      chat_id: chatId,
      text: `✅ Channel "${channelName || channelId}" has been added successfully!\n\nYou can now post content to this channel.`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⚙️ Settings', callback_data: 'settings' }
          ]
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
      chat_id: chatId,
      text: `❌ Failed to verify bot admin status for ${channelId}.${detailMsg}\n\nPlease make sure:\n1. The bot is added as admin to your channel\n2. The channel ID is correct\n\nSend "done" to try again or send "cancel" to abort:`,
    });
  }
}

