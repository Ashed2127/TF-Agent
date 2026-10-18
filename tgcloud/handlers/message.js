// handlers/message.js — runs on each `message` update. The file name is the
// Telegram update type; the platform calls the default export with the matching
// payload (here, a Message). The full update is available as `ctx.update`.

import { api } from 'sdk';
import { generateIdea } from '../lib/agent.js';
import { TRUE_FEED_CHANNEL_ID, TEST_CHANNEL_ID } from '../lib/secrets.js';
import { savePendingEdit, getPendingEdit, deletePendingEdit, getOrCreateUser, getUserByTelegramId, updateUserChannelId, updateUserTestChannelId, updateUserOnboardingStep, updateUserDisplayName, updateUserBotDisplayName, updateUserShowSourceLink, updateUserDotPunctuation, addCustomSource } from '../lib/database.js';
import { formatEditedNewsText } from '../lib/news.js';
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
            ]
          ]
        }
      });
      return;
    }

    // Public users get onboarding flow
    if (user.onboarding_step === 'join_channel') {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '🎉 Welcome to True Feed Content Creator Bot!\n\nTo get started, please join our True Feed channel first:',
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

    // If user is already onboarded, show main menu
    if (user.onboarding_step === 'completed') {
      await showMainMenu(message.chat.id);
      return;
    }

    // Otherwise, continue onboarding from current step
    await continueOnboarding(message.chat.id, user);
    return;
  }

  // Handle /test command for debugging (owner only)
  if (message.text === '/test' && userId === OWNER_CHAT_ID) {
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
      // Check if user is changing bot name
      if (pendingEdit.text === '__change_bot_name__') {
        if (incomingText.toLowerCase() === 'skip') {
          await updateUserBotDisplayName(userId, null);
          await deletePendingEdit(userId);
          await api.sendMessage({
            chat_id: message.chat.id,
            text: '✅ Bot name reset to default.',
          });
        } else {
          await updateUserBotDisplayName(userId, incomingText);
          await deletePendingEdit(userId);
          await api.sendMessage({
            chat_id: message.chat.id,
            text: `✅ Bot display name updated to: ${incomingText}`,
          });
        }
        return;
      }

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
      } else {
        // Check if user has a test channel configured
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
        await updateUserDisplayName(userId, null);
      } else {
        await updateUserDisplayName(userId, incomingText);
      }
      await updateUserOnboardingStep(userId, 'provide_bot_display_name');
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '📝 Step 4: Bot Display Name (Optional)\n\nCustomize how the bot name appears in your channel posts.\n\n• Type your preferred bot name (e.g., "My News Bot"), OR\n• Type "skip" to use the default name',
      });
      return;
    }

    if (user && user.onboarding_step === 'provide_bot_display_name') {
      if (incomingText.toLowerCase() === 'skip') {
        await updateUserBotDisplayName(userId, null);
      } else {
        await updateUserBotDisplayName(userId, incomingText);
      }
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
  }
}

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
    case 'provide_bot_display_name':
      await api.sendMessage({
        chat_id: chatId,
        text: '📝 Step 4: Bot Display Name (Optional)\n\nCustomize how the bot name appears in your channel posts.\n\n• Type your preferred bot name (e.g., "My News Bot"), OR\n• Type "skip" to use the default name',
      });
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
    text: '📝 Step 1: Select Your Channel\n\nPlease send your channel username (e.g., @yourchannel), channel link (https://t.me/yourchannel), or forward any message from your channel to this chat.',
  });
}

async function showAddBotAdminInstructions(chatId, channelId = null) {
  const channelDisplay = channelId ? ` "${channelId}"` : '';
  await api.sendMessage({
    chat_id: chatId,
    text: `🤖 Step 2: Add Bot as Admin\n\nPlease add this bot as an administrator to your channel${channelDisplay} with the following permissions:\n\n• Post Messages\n• Edit Messages\n\nOnce done, click the button below:`,
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
    text: '✏️ Step 3: Display Name\n\nSend the name you want to be displayed on your channel (e.g., "Your Name" or leave blank to skip)',
  });
}

async function showCategorySelection(chatId) {
  const categories = [
    'tech', 'entertainment', 'education', 'beauty', 'joke', 'fact'
  ];

  const keyboard = [];
  for (let i = 0; i < categories.length; i += 2) {
    const row = [];
    row.push({
      text: categories[i].charAt(0).toUpperCase() + categories[i].slice(1),
      callback_data: `select_category_${categories[i]}`
    });
    if (i + 1 < categories.length) {
      row.push({
        text: categories[i + 1].charAt(0).toUpperCase() + categories[i + 1].slice(1),
        callback_data: `select_category_${categories[i + 1]}`
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
    text: '📂 Step 4: Select Content Categories\n\nChoose the types of content you want to generate:',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

