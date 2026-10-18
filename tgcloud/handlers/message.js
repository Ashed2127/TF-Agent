// handlers/message.js — runs on each `message` update. The file name is the
// Telegram update type; the platform calls the default export with the matching
// payload (here, a Message). The full update is available as `ctx.update`.

import { api } from 'sdk';
import { generateIdea } from '../lib/agent.js';
import { TRUE_FEED_CHANNEL_ID, TEST_CHANNEL_ID } from '../lib/secrets.js';
import { savePendingEdit, getPendingEdit, deletePendingEdit, getOrCreateUser, getUserByTelegramId, updateUserChannelId, updateUserOnboardingStep, updateUserDisplayName, addCustomSource } from '../lib/database.js';
import { formatEditedNewsText } from '../lib/news.js';

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

  // Handle text input during onboarding
  const incomingText = message.text || message.caption;
  if (incomingText && !incomingText.startsWith('/')) {
    const user = await getUserByTelegramId(userId);

    // Handle edited news post (owner only)
    if (userId === OWNER_CHAT_ID) {
      const pendingEdit = await getPendingEdit(userId);
      if (pendingEdit) {
        // User is in edit mode — preserve original image or use newly uploaded photo
        const newPhotoId = (message.photo && message.photo.length > 0)
          ? message.photo[message.photo.length - 1].file_id
          : null;
        const imageToUse = newPhotoId || pendingEdit.image_url;

        // Extract entities (from text or photo caption)
        const entities = message.entities || message.caption_entities || [];

        // Format text to preserve and enforce HTML boldness (title, @true_feed, entities)
        const formattedText = formatEditedNewsText(incomingText, entities);

        const editId = await savePendingEdit(userId, formattedText, imageToUse);

        const keyboard = [
          [
            { text: '📢 TrueFeed', callback_data: `post_edit_truefeed:${editId}` },
            { text: '🧪 Test', callback_data: `post_edit_test:${editId}` }
          ],
          [
            { text: '❌ Cancel', callback_data: 'cancel_edit' }
          ]
        ];

        // Send formatted preview with buttons so user can see boldness and image
        if (imageToUse) {
          try {
            await api.sendPhoto({
              chat_id: message.chat.id,
              photo: imageToUse,
              caption: formattedText,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
            return;
          } catch (photoErr) {
            console.error('Failed to send preview photo, falling back to message:', photoErr.message);
          }
        }

        await api.sendMessage({
          chat_id: message.chat.id,
          text: formattedText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
        return;
      }
    }

    // Handle onboarding text inputs
    if (user && user.onboarding_step === 'provide_channel_id') {
      // Check if it's a forwarded message from a channel
      if (message.forward_from_chat) {
        const channel = message.forward_from_chat;
        const channelId = channel.id.toString();
        const channelName = channel.title || channel.username || channel.id.toString();

        await updateUserChannelId(userId, channelId, channelName);
        await updateUserOnboardingStep(userId, 'add_bot_admin');
        await api.sendMessage({
          chat_id: message.chat.id,
          text: `✅ Channel detected: ${channelName}\n\n🤖 Step 2: Add Bot as Admin\n\nPlease add this bot as an administrator to your channel with the following permissions:\n\n• Post Messages\n• Edit Messages\n\nOnce done, click the button below:`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Done', callback_data: 'bot_admin_added' }
              ]
            ]
          }
        });
        return;
      }

      // Fallback: user typed the channel ID manually
      await updateUserChannelId(userId, incomingText);
      await updateUserOnboardingStep(userId, 'add_bot_admin');
      await showAddBotAdminInstructions(message.chat.id);
      return;
    }

    if (user && user.onboarding_step === 'provide_display_name') {
      if (incomingText.toLowerCase() === 'skip') {
        await updateUserDisplayName(userId, null);
      } else {
        await updateUserDisplayName(userId, incomingText);
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
      await showAddBotAdminInstructions(chatId);
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
    text: '📝 Step 1: Select Your Channel\n\nForward any message from your channel to this chat. I\'ll automatically detect your channel ID.\n\nOr you can type your channel ID manually (e.g., @yourchannel or -100xxxxxxxxxx)',
  });
}

async function showAddBotAdminInstructions(chatId) {
  await api.sendMessage({
    chat_id: chatId,
    text: '🤖 Step 2: Add Bot as Admin\n\nPlease add this bot as an administrator to your channel with the following permissions:\n\n• Post Messages\n• Edit Messages\n\nOnce done, click the button below:',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Done', callback_data: 'bot_admin_added' }
        ]
      ]
    }
  });
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

