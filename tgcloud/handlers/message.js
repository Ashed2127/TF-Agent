// handlers/message.js — runs on each `message` update. The file name is the
// Telegram update type; the platform calls the default export with the matching
// payload (here, a Message). The full update is available as `ctx.update`.

import { api } from 'sdk';
import { generateIdea } from '../lib/agent.js';
import { TRUE_FEED_CHANNEL_ID, TEST_CHANNEL_ID } from '../lib/secrets.js';
import { savePendingEdit, getPendingEdit, deletePendingEdit, getOrCreateUser, getUserByTelegramId, updateUserChannelId, updateUserTestChannelId, updateUserOnboardingStep, updateUserDisplayName, updateUserBotDisplayName, updateUserShowSourceLink, updateUserDotPunctuation, addCustomSource, updateUserType, addUserChannel, getUserChannels, migrateUserChannels, removeDuplicateChannels, getPendingChannelAdd, setPendingChannelAdd, clearPendingChannelAdd, saveContentStructure, getAllUsers, deleteUser, getUserById, createAutoPostSchedule, getAutoPostSchedule, getRepetitiveTaskSchedule, getAutoPostScheduleById, updateAutoPostSchedule, recordUserActivity } from '../lib/database.js';
import { formatEditedNewsText, NEWS_CATEGORIES, directTranslateToAmharic, directTranslateToLanguage, SUPPORTED_LANGUAGES } from '../lib/news.js';
import { extractChannelFromMessage, normalizeChannelId, parseIntervalInput, formatIntervalDisplay, resolveChannelMetadata, checkBotAdminStatus } from '../lib/channel.js';
import { checkAndTriggerDueAutoPosts } from '../lib/autopost_service.js';
import { showAutoPostCategoryPicker } from '../lib/autopost_ui.js';
import { checkAndTriggerDueRecommendations } from '../lib/recommendation_service.js';

const OWNER_CHAT_ID = 685669468; // Your chat ID

export default async function (message, ctx) {
  if (!message.from) {
    console.log('Message has no from field, skipping');
    return;
  }

  const userId = message.from.id;
  const username = message.from.username;
  const firstName = message.from.first_name || '';

  // Handle chat_shared messages (when user clicks "Choose Channel / Group" button)
  if (message.chat_shared) {
    const requestId = message.chat_shared.request_id;

    // Check if this is for channel selection (request_id 3 or 4 for settings, 1 or 2 for onboarding)
    if (requestId === 3 || requestId === 4 || requestId === 1 || requestId === 2) {
      const pendingChannel = await getPendingChannelAdd(userId);

      if (pendingChannel && pendingChannel.channelId === 'waiting') {
        const channelInfo = extractChannelFromMessage(message);

        if (channelInfo && channelInfo.channelId) {
          const enriched = await resolveChannelMetadata(api, channelInfo.channelId, channelInfo.channelName);
          // Save the channel to user's channel_id field for verification
          await updateUserChannelId(userId, enriched.channelId, enriched.channelName);
          await setPendingChannelAdd(userId, enriched.channelId, enriched.channelName);
          await showAddChannelBotAdminInstructions(message.chat.id, enriched.channelId, enriched.channelName);
          return;
        } else {
          await api.sendMessage({
            chat_id: message.chat.id,
            text: '⚠️ Could not extract channel information from selection. Please try again or send your channel username (e.g., @yourchannel) or link instead.',
          });
          return;
        }
      }
    }
  }

  // Proactively check and execute any due scheduled auto posts in background
  try {
    checkAndTriggerDueAutoPosts().catch(e => console.error('AutoPost check error:', e.message));
  } catch (_) {}

  // Proactively check and execute any due recommendations in background
  try {
    checkAndTriggerDueRecommendations().catch(e => console.error('Recommendation check error:', e.message));
  } catch (_) {}

  // Track user activity detection
  try {
    const actType = message.text?.startsWith('/') ? 'command' : 'message';
    const detail = message.text ? message.text.slice(0, 100) : (message.photo ? '[Photo]' : '[Media]');
    recordUserActivity(userId, username, firstName, actType, detail).catch(e => console.error('Activity track error:', e.message));
  } catch (_) {}

  // Handle /start command
  if (message.text === '/start') {
    // Cancel any pending edit on /start
    await deletePendingEdit(userId);

    // Get or create user
    const user = await getOrCreateUser(userId, username, firstName);

    // Enable dot punctuation for owner by default
    if (userId === OWNER_CHAT_ID) {
      await updateUserDotPunctuation(userId, true);
    }

    // Owner gets the old interface
    if (userId === OWNER_CHAT_ID) {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '🌱 TF Agent እንኳን ደህና መጡ!\n\nይህ Bot TF ቻናልዎን ያስተዳድራል።\nከታች ያሉትን አማራጮች ይጫኑ።',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'idea', callback_data: 'new_idea' },
              { text: 'news', callback_data: 'get_news' }
            ],
            [
              { text: 'Credits', callback_data: 'get_credits' },
              { text: 'Settings', callback_data: 'settings' }
            ],
            [
              { text: 'Manage Users', callback_data: 'owner_manage_users' },
              { text: 'Analytics Dashboard', web_app: { url: 'https://app8909892200.tgcloud.ai/' } }
            ],
            [
              { text: '🏆 Creator Rankings', callback_data: 'view_rankings' },
              { text: '🌟 Open Rank Dashboard', web_app: { url: 'https://app8909892200.tgcloud.ai/rank.html' } }
            ]
          ]
        }
      });
      return;
    }

    // Always show User/Guest choice when /start is clicked
    await showUserTypeChoice(message.chat.id);
    return;
  }

  // Handle /users or /manage command (owner only)
  if ((message.text === '/users' || message.text === '/manage' || message.text === '/manage_users') && userId === OWNER_CHAT_ID) {
    const allUsers = await getAllUsers();
    const activeCount = allUsers.filter(u => u.onboarding_step === 'completed').length;
    let text = `👥 <b>User Management (${allUsers.length} total, ${activeCount} active):</b>\n\n`;

    const keyboard = [];
    allUsers.slice(0, 15).forEach(u => {
      const uname = u.username ? `@${u.username}` : (u.display_name || `User #${u.id}`);
      text += `• <b>${uname}</b> (ID: <code>${u.telegram_id}</code>)\n   Channel: ${u.channel_name || u.channel_id || 'None'} | Posts: ${u.posts_count || 0}\n`;
      keyboard.push([
        { text: `Manage ${uname}`, callback_data: `admin_user_${u.id}` }
      ]);
    });

    keyboard.push([
      { text: 'Open Web Dashboard', web_app: { url: 'https://app8909892200.tgcloud.ai/' } }
    ]);

    await api.sendMessage({
      chat_id: message.chat.id,
      text: text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
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

  // Handle /translate command for direct translation
  if (message.text && (message.text === '/translate' || message.text.startsWith('/translate ') || message.text.startsWith('/translate\n'))) {
    let rawQuery = message.text.replace(/^\/translate\s*/i, '').trim();
    const user = await getUserByTelegramId(userId);

    // Check if first word is a language code: am, ti, om
    let targetLang = 'am';
    const firstWordMatch = rawQuery.match(/^([a-z]{2})\s+([\s\S]+)$/i);
    if (firstWordMatch && ['am', 'ti', 'om'].includes(firstWordMatch[1].toLowerCase())) {
      targetLang = firstWordMatch[1].toLowerCase();
      rawQuery = firstWordMatch[2].trim();
    }

    const langInfo = SUPPORTED_LANGUAGES[targetLang] || SUPPORTED_LANGUAGES.am;

    if (rawQuery) {
      const loading = await api.sendMessage({
        chat_id: message.chat.id,
        text: `🔄 Translating directly to ${langInfo.name}...`,
      });
      try {
        const translated = await directTranslateToLanguage(rawQuery, targetLang);
        const editId = await savePendingEdit(userId, translated, null);
        const isOwner = userId === OWNER_CHAT_ID;
        const keyboard = await buildDirectTranslatePostKeyboard(isOwner, user, editId);
        await api.deleteMessage({ chat_id: message.chat.id, message_id: loading.message_id });
        await api.sendMessage({
          chat_id: message.chat.id,
          text: `🌐 <b>Direct Translation (${langInfo.name}):</b>\n\n${translated}`,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      } catch (err) {
        await api.deleteMessage({ chat_id: message.chat.id, message_id: loading.message_id });
        await api.sendMessage({
          chat_id: message.chat.id,
          text: `❌ Translation failed: ${err.message}`,
        });
      }
      return;
    } else {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '🌐 <b>Direct Translation</b>\n\nChoose your target language for direct translation:',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'አማርኛ (Amharic)', callback_data: 'direct_translate_lang_am' }],
            [{ text: 'ትግርኛ (Tigrinya)', callback_data: 'direct_translate_lang_ti' }],
            [{ text: 'Afaan Oromoo', callback_data: 'direct_translate_lang_om' }],
            [{ text: 'Back', callback_data: 'back' }]
          ]
        }
      });
      return;
    }
  }

  const user = await getUserByTelegramId(userId);

  // Handle onboarding channel input (forwarded message, link, or username)
  if (user && (user.onboarding_step === 'provide_channel_id' || user.onboarding_step === 'add_bot_admin')) {
    const channelInfo = extractChannelFromMessage(message);
    if (channelInfo && channelInfo.channelId) {
      const resolved = await resolveChannelMetadata(api, channelInfo.channelId, channelInfo.channelName);
      await updateUserChannelId(userId, resolved.channelId, resolved.channelName);
      await updateUserOnboardingStep(userId, 'add_bot_admin');
      await showAddBotAdminInstructions(message.chat.id, resolved.channelId, resolved.channelName);
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

      // Determine keyboard based on user type and available channels
      const isOwner = userId === OWNER_CHAT_ID;
      let keyboard;

      if (isOwner) {
        keyboard = [
          [
            { text: 'TrueFeed', callback_data: `post_edit_truefeed:${editId}` },
            { text: 'Test', callback_data: `post_edit_test:${editId}` }
          ],
          [
            { text: 'Cancel', callback_data: 'cancel_edit' }
          ]
        ];
      } else if (user?.user_type === 'guest') {
        // Guest mode - no posting, just cancel
        keyboard = [
          [
            { text: 'Cancel', callback_data: 'cancel_edit' }
          ]
        ];
      } else {
        // List all user's registered channels
        await migrateUserChannels(userId);
        await removeDuplicateChannels(userId);
        const channels = await getUserChannels(user.id);

        keyboard = [];
        if (channels && channels.length > 0) {
          for (const channel of channels) {
            const channelName = channel.channel_name || channel.channel_id;
            const typeLabel = channel.is_main ? ' (Main)' : (channel.is_test ? ' (Test)' : '');
            keyboard.push([
              { text: `${channelName}${typeLabel}`, callback_data: `post_edit_channel:${editId}:${channel.id}` }
            ]);
          }
          if (channels.length > 1) {
            keyboard.push([
              { text: 'Post to All Channels', callback_data: `post_edit_all:${editId}` }
            ]);
          }
        } else {
          keyboard.push([
            { text: 'Post to Channel', callback_data: `post_edit_user_main:${editId}` }
          ]);
        }
        keyboard.push([
          { text: 'Cancel', callback_data: 'cancel_edit' }
        ]);
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

    if (user && user.onboarding_step === 'add_custom_source_name') {
      if (incomingText.toLowerCase() === 'cancel') {
        await updateUserOnboardingStep(userId, user.user_type === 'guest' ? 'guest_ready' : 'completed');
        await api.sendMessage({
          chat_id: message.chat.id,
          text: 'Source addition cancelled.',
          reply_markup: {
            inline_keyboard: [[{ text: 'Browse News', callback_data: 'get_news' }]]
          }
        });
        return;
      }

      // Store the source name temporarily and ask for URL
      await updateUserDisplayName(userId, `temp_source_name:${incomingText}`);
      await updateUserOnboardingStep(userId, 'add_custom_source_url');
      await api.sendMessage({
        chat_id: message.chat.id,
        text: `Now send me the RSS feed URL for "${incomingText}":\n\n(Or send "cancel" to abort)`,
      });
      return;
    }

    if (user && user.onboarding_step === 'add_custom_source_url') {
      if (incomingText.toLowerCase() === 'cancel') {
        await updateUserDisplayName(userId, null);
        await updateUserOnboardingStep(userId, user.user_type === 'guest' ? 'guest_ready' : 'completed');
        await api.sendMessage({
          chat_id: message.chat.id,
          text: 'Source addition cancelled.',
          reply_markup: {
            inline_keyboard: [[{ text: 'Browse News', callback_data: 'get_news' }]]
          }
        });
        return;
      }

      const displayName = user.display_name || '';
      const sourceName = displayName.startsWith('temp_source_name:')
        ? displayName.replace('temp_source_name:', '')
        : 'Custom Source';
      const sourceUrl = incomingText.trim();

      // Validate URL format
      if (!/^https?:\/\//i.test(sourceUrl)) {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: 'Please send a valid RSS feed URL starting with http:// or https:// (or send "cancel"):',
        });
        return;
      }

      // Add the custom source
      await addCustomSource(user.id, sourceName, sourceUrl);

      // Clear the temporary display name and restore onboarding step
      await updateUserDisplayName(userId, null);
      await updateUserOnboardingStep(userId, user.user_type === 'guest' ? 'guest_ready' : 'completed');

      await api.sendMessage({
        chat_id: message.chat.id,
        text: `Custom source "${sourceName}" added successfully!\n\nYou can now select it under "My Sources" in the news menu.`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Browse My Sources', callback_data: 'news_cat_custom' },
              { text: 'Browse Categories', callback_data: 'get_news' }
            ]
          ]
        }
      });
      return;
    }

    // Handle adding new channel from settings
    const pendingChannel = await getPendingChannelAdd(userId);
    if (pendingChannel && pendingChannel.channelId === 'waiting') {
      const channelInfo = extractChannelFromMessage(message);
      if (channelInfo && channelInfo.channelId) {
        const enriched = await resolveChannelMetadata(api, channelInfo.channelId, channelInfo.channelName);
        // Store the channel info and ask for bot admin verification
        await setPendingChannelAdd(userId, enriched.channelId, enriched.channelName);
        await showAddChannelBotAdminInstructions(message.chat.id, enriched.channelId, enriched.channelName);
        return;
      }

      // Try text input
      const normalized = normalizeChannelId(incomingText);
      if (normalized) {
        const enriched = await resolveChannelMetadata(api, normalized, normalized);
        await setPendingChannelAdd(userId, enriched.channelId, enriched.channelName);
        await showAddChannelBotAdminInstructions(message.chat.id, enriched.channelId, enriched.channelName);
        return;
      }
    }

    // Handle editing channel link
    if (pendingChannel && pendingChannel.channelId === 'edit_channel') {
      const channelInfo = extractChannelFromMessage(message);
      let newChannelId = null;
      let newChannelName = null;

      if (channelInfo && channelInfo.channelId) {
        const enriched = await resolveChannelMetadata(api, channelInfo.channelId, channelInfo.channelName);
        newChannelId = enriched.channelId;
        newChannelName = enriched.channelName;
      } else {
        // Try text input
        const normalized = normalizeChannelId(incomingText);
        if (normalized) {
          const enriched = await resolveChannelMetadata(api, normalized, normalized);
          newChannelId = enriched.channelId;
          newChannelName = enriched.channelName;
        }
      }

      if (newChannelId) {
        await updateUserChannelId(userId, newChannelId, newChannelName);
        await clearPendingChannelAdd(userId);
        await api.sendMessage({
          chat_id: message.chat.id,
          text: `✅ Channel link updated to: ${newChannelName || newChannelId}`,
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Settings', callback_data: 'settings' }]
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
              [{ text: 'Settings', callback_data: 'settings' }]
            ]
          }
        });
        return;
      }
    }

    // Handle direct translation input
    if (pendingChannel && (pendingChannel.channelId === 'waiting_direct_translation' || pendingChannel.channelId.startsWith('waiting_direct_'))) {
      const targetLang = pendingChannel.channelId.startsWith('waiting_direct_') && pendingChannel.channelId !== 'waiting_direct_translation'
        ? pendingChannel.channelId.replace('waiting_direct_', '')
        : 'am';
      const langInfo = SUPPORTED_LANGUAGES[targetLang] || SUPPORTED_LANGUAGES.am;

      await clearPendingChannelAdd(userId);
      const loading = await api.sendMessage({
        chat_id: message.chat.id,
        text: `🔄 Translating directly to ${langInfo.name}...`,
      });
      try {
        const photoId = (message.photo && message.photo.length > 0)
          ? message.photo[message.photo.length - 1].file_id
          : null;
        const translated = await directTranslateToLanguage(incomingText, targetLang);
        const editId = await savePendingEdit(userId, translated, photoId);
        const isOwner = userId === OWNER_CHAT_ID;
        const keyboard = await buildDirectTranslatePostKeyboard(isOwner, user, editId);
        await api.deleteMessage({ chat_id: message.chat.id, message_id: loading.message_id });

        if (photoId) {
          await api.sendPhoto({
            chat_id: message.chat.id,
            photo: photoId,
            caption: `🌐 <b>Direct Translation (${langInfo.name}):</b>\n\n${translated}`,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await api.sendMessage({
            chat_id: message.chat.id,
            text: `🌐 <b>Direct Translation (${langInfo.name}):</b>\n\n${translated}`,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (err) {
        await api.deleteMessage({ chat_id: message.chat.id, message_id: loading.message_id });
        await api.sendMessage({
          chat_id: message.chat.id,
          text: `❌ Translation failed: ${err.message}`,
        });
      }
      return;
    }

    // Handle content structure input
    if (pendingChannel && pendingChannel.channelId === 'waiting_content_structure') {
      let structureText = incomingText.replace(/^(?:Content Structure\s*|Your current structure:\s*|Current structure:\s*)+/gi, '').trim();

      // Normalize missing brackets (e.g. "Headline ]" -> "[Headline]")
      structureText = structureText.replace(/^([^\[\n\r]+\])/, '[$1');
      structureText = structureText.replace(/(?:^|\n)([^\[\n\r]+)\]/g, (m, p1) => {
        return (m.startsWith('\n') ? '\n[' : '[') + p1.trim() + ']';
      });

      console.log('💾 Saving content structure for user:', user.id);
      console.log('📝 Normalized structure text:', structureText);
      const savedStructure = await saveContentStructure(user.id, structureText);
      console.log('✅ Saved structure result:', savedStructure);
      await clearPendingChannelAdd(userId);
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '✅ <b>Content structure saved!</b>\n\nThe AI will now strictly follow your exact structure, styling, and placeholders.',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Settings', callback_data: 'settings' }]
          ]
        }
      });
      return;
    }

    // Handle custom auto post interval setup or update input
    if (pendingChannel && (pendingChannel.channelId.startsWith('waiting_custom_autopost_setup_') || pendingChannel.channelId.startsWith('waiting_custom_autopost_update_'))) {
      const isSetup = pendingChannel.channelId.startsWith('waiting_custom_autopost_setup_');
      const channelId = isSetup
        ? pendingChannel.channelId.replace('waiting_custom_autopost_setup_', '')
        : pendingChannel.channelId.replace('waiting_custom_autopost_update_', '');
      const text = incomingText.trim();

      if (['cancel', 'abort', 'stop', 'back'].includes(text.toLowerCase())) {
        await clearPendingChannelAdd(userId);
        await api.sendMessage({
          chat_id: message.chat.id,
          text: 'Auto post configuration cancelled.',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Back to Auto Post', callback_data: 'auto_post' }]
            ]
          }
        });
        return;
      }

      const parsedHours = parseIntervalInput(text);
      if (!parsedHours || parsedHours <= 0) {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: `⚠️ <b>Invalid time format.</b>\n\nPlease enter a valid interval, for example:\n• <code>1m</code> (1 minute)\n• <code>30m</code> (30 minutes)\n• <code>2h</code> or <code>4hr</code> (hours)\n• <code>7 hours</code>\n• <code>2</code> (hours)\n\n<i>Or send 'cancel' to abort.</i>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Cancel', callback_data: 'auto_post' }]
            ]
          }
        });
        return;
      }

      await clearPendingChannelAdd(userId);
      // Proceed to choosing content source platform
      await showAutoPostCategoryPicker(message.chat.id, channelId, parsedHours, !isSetup);
      return;
    }

    // Handle custom repetitive task interval input
    if (pendingChannel && (pendingChannel.channelId.startsWith('waiting_custom_reptask_setup_') || pendingChannel.channelId.startsWith('waiting_custom_reptask_update_'))) {
      const isSetup = pendingChannel.channelId.startsWith('waiting_custom_reptask_setup_');
      const channelId = isSetup
        ? pendingChannel.channelId.replace('waiting_custom_reptask_setup_', '')
        : pendingChannel.channelId.replace('waiting_custom_reptask_update_', '');
      const text = incomingText.trim();

      if (['cancel', 'abort', 'stop', 'back'].includes(text.toLowerCase())) {
        await clearPendingChannelAdd(userId);
        await api.sendMessage({
          chat_id: message.chat.id,
          text: 'Repetitive task configuration cancelled.',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Back to Repetitive Task', callback_data: 'repetitive_task' }]
            ]
          }
        });
        return;
      }

      const parsedHours = parseIntervalInput(text);
      if (!parsedHours || parsedHours <= 0) {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: `⚠️ <b>Invalid time format.</b>\n\nPlease enter a valid interval, for example:\n• <code>1m</code> (1 minute)\n• <code>30m</code> (30 minutes)\n• <code>2h</code> or <code>4hr</code> (hours)\n• <code>7 hours</code>\n• <code>2</code> (hours)\n\n<i>Or send 'cancel' to abort.</i>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Cancel', callback_data: 'repetitive_task' }]
            ]
          }
        });
        return;
      }

      // 'task<id>' targets a specific repetitive schedule for interval-only update
      if (channelId.startsWith('task')) {
        const scheduleId = parseInt(channelId.replace('task', ''), 10);
        const user = await getUserByTelegramId(userId);
        const sched = await getAutoPostScheduleById(scheduleId);
        await clearPendingChannelAdd(userId);
        if (sched && sched.user_id === user.id && sched.post_mode === 'repetitive') {
          await updateAutoPostSchedule(sched.id, undefined, parsedHours, true);
          const intervalText = formatIntervalDisplay(parsedHours);
          await api.sendMessage({
            chat_id: message.chat.id,
            text: `✅ <b>Repetitive task #${sched.id} interval updated!</b>\n\nNew interval: Every ${intervalText}`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Back to Repetitive Task', callback_data: 'repetitive_task' }]
              ]
            }
          });
        }
        return;
      }

      await clearPendingChannelAdd(userId);
      const stateKey = isSetup
        ? `waiting_rep_content_setup_${channelId}_${parsedHours}`
        : `waiting_rep_content_update_${channelId}_${parsedHours}`;
      await setPendingChannelAdd(userId, stateKey);

      const intervalText = formatIntervalDisplay(parsedHours);
      await api.sendMessage({
        chat_id: message.chat.id,
        text: `🔁 <b>Setup Repetitive Task Content</b>\n\nChannel: <code>${channelId}</code>\nInterval: <b>Every ${intervalText}</b>\n\nPlease send the exact message or announcement text you want the bot to post repetitively based on this interval.\n\n<i>You can include emojis, custom formatting, and links. Send 'cancel' to abort.</i>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Cancel', callback_data: 'repetitive_task' }]
          ]
        }
      });
      return;
    }

    // Handle editing content of a specific repetitive task
    if (pendingChannel && pendingChannel.channelId.startsWith('waiting_rep_edit_')) {
      const scheduleId = parseInt(pendingChannel.channelId.replace('waiting_rep_edit_', ''), 10);
      const text = incomingText.trim();

      if (['cancel', 'abort', 'stop', 'back'].includes(text.toLowerCase())) {
        await clearPendingChannelAdd(userId);
        await api.sendMessage({
          chat_id: message.chat.id,
          text: 'Edit cancelled.',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Back to Repetitive Task', callback_data: 'repetitive_task' }]
            ]
          }
        });
        return;
      }

      await clearPendingChannelAdd(userId);
      const user = await getUserByTelegramId(userId);
      const sched = await getAutoPostScheduleById(scheduleId);

      if (sched && sched.user_id === user.id && sched.post_mode === 'repetitive') {
        await updateAutoPostSchedule(sched.id, undefined, undefined, undefined, undefined, undefined, 'repetitive', text);
        await api.sendMessage({
          chat_id: message.chat.id,
          text: `✅ <b>Repetitive task #${sched.id} content updated!</b>\n\nChannel: <code>${sched.channel_id}</code>\n\n<b>New Content:</b>\n<i>${text.substring(0, 200)}</i>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Back to Repetitive Task', callback_data: 'repetitive_task' }]
            ]
          }
        });
      }
      return;
    }

    // Handle repetitive content input
    if (pendingChannel && (pendingChannel.channelId.startsWith('waiting_rep_content_setup_') || pendingChannel.channelId.startsWith('waiting_rep_content_update_'))) {
      const isSetup = pendingChannel.channelId.startsWith('waiting_rep_content_setup_');
      const prefix = isSetup ? 'waiting_rep_content_setup_' : 'waiting_rep_content_update_';
      const raw = pendingChannel.channelId.replace(prefix, '');
      const lastUnder = raw.lastIndexOf('_');
      const channelId = lastUnder !== -1 ? raw.substring(0, lastUnder) : raw;
      const intervalHours = lastUnder !== -1 ? parseFloat(raw.substring(lastUnder + 1)) : 2;
      const text = incomingText.trim();

      if (['cancel', 'abort', 'stop', 'back'].includes(text.toLowerCase())) {
        await clearPendingChannelAdd(userId);
        await api.sendMessage({
          chat_id: message.chat.id,
          text: 'Repetitive task setup cancelled.',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Back to Repetitive Task', callback_data: 'repetitive_task' }]
            ]
          }
        });
        return;
      }

      await clearPendingChannelAdd(userId);

      const user = await getUserByTelegramId(userId);

      // 'task<id>' in the channel slot targets a specific repetitive schedule
      if (!isSetup && channelId.startsWith('task')) {
        const scheduleId = parseInt(channelId.replace('task', ''), 10);
        const sched = await getAutoPostScheduleById(scheduleId);
        if (sched && sched.user_id === user.id && sched.post_mode === 'repetitive') {
          await updateAutoPostSchedule(sched.id, undefined, intervalHours, true, undefined, undefined, 'repetitive', text);
          const intervalText = formatIntervalDisplay(intervalHours);
          await api.sendMessage({
            chat_id: message.chat.id,
            text: `✅ <b>Repetitive Task #${sched.id} Updated!</b>\n\n📢 <b>Channel:</b> <code>${sched.channel_id}</code>\n⏱️ <b>Interval:</b> Every ${intervalText}\n🔁 <b>Mode:</b> Repetitive Task\n\n<b>Scheduled Content:</b>\n<i>${text.substring(0, 200)}</i>`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'View Repetitive Tasks', callback_data: 'repetitive_task' }],
                [{ text: 'Back to Settings', callback_data: 'settings' }]
              ]
            }
          });
        }
        return;
      }

      if (isSetup) {
        // Always create a NEW repetitive schedule so users can run multiple
        // tasks across different channels and content
        await createAutoPostSchedule(
          user.id,
          channelId,
          intervalHours,
          'repetitive',
          'custom',
          'repetitive',
          text
        );
      } else {
        const existingRepSchedule = await getRepetitiveTaskSchedule(user.id);
        if (existingRepSchedule) {
          await updateAutoPostSchedule(
            existingRepSchedule.id,
            channelId,
            intervalHours,
            1,
            'repetitive',
            'custom',
            'repetitive',
            text
          );
        } else {
          await createAutoPostSchedule(
            user.id,
            channelId,
            intervalHours,
            'repetitive',
            'custom',
            'repetitive',
            text
          );
        }
      }

      const intervalText = formatIntervalDisplay(intervalHours);
      await api.sendMessage({
        chat_id: message.chat.id,
        text: `✅ <b>Repetitive Task Configured!</b>\n\n📢 <b>Channel:</b> <code>${channelId}</code>\n⏱️ <b>Interval:</b> Every ${intervalText}\n🔁 <b>Mode:</b> Repetitive Task\n\n<b>Scheduled Content:</b>\n<i>${text.substring(0, 200)}</i>\n\nYour repetitive task will automatically run and post simultaneously with your auto posts!`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'View Repetitive Task Settings', callback_data: 'repetitive_task' }],
            [{ text: 'Back to Settings', callback_data: 'settings' }]
          ]
        }
      });
      return;
    }

    // Handle owner confirmation to delete user (typing "Delete")
    if (userId === OWNER_CHAT_ID && pendingChannel && pendingChannel.channelId.startsWith('waiting_confirm_delete_user_')) {
      const targetUserId = parseInt(pendingChannel.channelId.replace('waiting_confirm_delete_user_', ''), 10);
      const text = (message.text || '').trim();

      if (text.toLowerCase() === 'delete') {
        await clearPendingChannelAdd(userId);
        try {
          await deleteUser(targetUserId);
          await api.sendMessage({
            chat_id: message.chat.id,
            text: `✅ Permanently deleted ${pendingChannel.channelName || `User #${targetUserId}`} and all associated records from the database.`,
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Back to Users List', callback_data: 'owner_manage_users' }]
              ]
            }
          });
        } catch (err) {
          await api.sendMessage({
            chat_id: message.chat.id,
            text: `❌ Error deleting user: ${err.message}`,
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Back to Users List', callback_data: 'owner_manage_users' }]
              ]
            }
          });
        }
        return;
      } else if (['cancel', 'abort', 'no', 'stop', 'back'].includes(text.toLowerCase())) {
        await clearPendingChannelAdd(userId);
        await api.sendMessage({
          chat_id: message.chat.id,
          text: '❌ User deletion cancelled.',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Back to User', callback_data: `admin_user_${targetUserId}` }]
            ]
          }
        });
        return;
      } else {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: `⚠️ To confirm deletion of ${pendingChannel.channelName || `User #${targetUserId}`}, you must type <b>Delete</b>.\n\nOr click Cancel below to keep the user:`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Cancel', callback_data: `admin_user_${targetUserId}` }]
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
              [{ text: 'Settings', callback_data: 'settings' }]
            ]
          }
        });
        return;
      }
    }
  }
}

async function buildDirectTranslatePostKeyboard(isOwner, user, editId) {
  if (isOwner) {
    return [
      [
        { text: 'TrueFeed', callback_data: `post_edit_truefeed:${editId}` },
        { text: 'Test', callback_data: `post_edit_test:${editId}` }
      ],
      [
        { text: 'Translate Another', callback_data: 'direct_translate_menu' },
        { text: 'Main Menu', callback_data: 'back' }
      ]
    ];
  } else if (user?.user_type === 'guest') {
    return [
      [
        { text: 'Translate Another', callback_data: 'direct_translate_menu' },
        { text: 'Main Menu', callback_data: 'back' }
      ]
    ];
  } else {
    // List all user's registered channels
    await migrateUserChannels(user.telegram_id);
    await removeDuplicateChannels(user.telegram_id);
    const channels = await getUserChannels(user.id);

    const keyboard = [];
    if (channels && channels.length > 0) {
      for (const channel of channels) {
        const channelName = channel.channel_name || channel.channel_id;
        const typeLabel = channel.is_main ? ' (Main)' : (channel.is_test ? ' (Test)' : '');
        keyboard.push([
          { text: `${channelName}${typeLabel}`, callback_data: `post_edit_channel:${editId}:${channel.id}` }
        ]);
      }
      if (channels.length > 1) {
        keyboard.push([
          { text: 'Post to All Channels', callback_data: `post_edit_all:${editId}` }
        ]);
      }
    } else {
      keyboard.push([
        { text: 'Post to Channel', callback_data: `post_edit_user_main:${editId}` }
      ]);
    }

    keyboard.push([
      { text: 'Translate Another', callback_data: 'direct_translate_menu' },
      { text: 'Main Menu', callback_data: 'back' }
    ]);
    return keyboard;
  }
}

async function showMainMenu(chatId, isOwner = false) {
  const keyboard = [
    [
      { text: 'Content', callback_data: 'generate_content' },
      { text: 'Settings', callback_data: 'settings' }
    ],
    [
      { text: '🏆 Creator Rankings', callback_data: 'view_rankings' }
    ],
    [
      { text: 'Refresh', callback_data: 'refresh_menu' }
    ],
    [
      { text: 'Back', callback_data: 'back' }
    ]
  ];

  // Add analytics and rank dashboard buttons for owner only
  if (isOwner) {
    keyboard.splice(3, 0, [
      { text: 'Analytics Dashboard', web_app: { url: 'https://app8909892200.tgcloud.ai/' } }
    ], [
      { text: '🌟 Open Rank Dashboard', web_app: { url: 'https://app8909892200.tgcloud.ai/rank.html' } }
    ]);
  }

  await api.sendMessage({
    chat_id: chatId,
    text: '🌱 TF Content Creator\n\nWhat would you like to do?',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function showUserTypeChoice(chatId) {
  await api.sendMessage({
    chat_id: chatId,
    text: '🎉 Welcome to TF\n\nChoose how you want to use the bot:',
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'User', callback_data: 'choose_user' },
          { text: 'Guest', callback_data: 'choose_guest' }
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

async function continueOnboarding(chatId, user) {
  switch (user.onboarding_step) {
    case 'provide_channel_id':
      await showChannelIdInstructions(chatId);
      break;
    case 'add_bot_admin':
      await showAddBotAdminInstructions(chatId, user.channel_id, user.channel_name);
      break;
    case 'select_categories':
      await showCategorySelection(chatId);
      break;
    default:
      await showMainMenu(chatId);
  }
}

async function showChannelIdInstructions(chatId) {
  // Offer both the interactive Telegram Chat Picker button AND manual username/link/forward input
  await api.sendMessage({
    chat_id: chatId,
    text: '📝 <b>Step 2: Connect Your Channel or Group</b>\n\nTap the <b>"📢 Choose Channel / Group"</b> button below to select your channel directly from your list, or send your channel username (e.g. <code>@yourchannel</code>), link, or forward a message.',
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [
        [
          {
            text: 'Choose My Channel',
            request_chat: {
              request_id: 1,
              chat_is_channel: true,
              chat_is_created: true,
              request_title: true,
              request_username: true
            }
          },
          {
            text: 'Choose My Group',
            request_chat: {
              request_id: 2,
              chat_is_channel: false,
              chat_is_created: true,
              request_title: true,
              request_username: true
            }
          }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
}

async function showAddBotAdminInstructions(chatId, channelId = null, channelName = null) {
  let botUsername = '';
  try {
    const me = await api.getMe();
    botUsername = me?.username || '';
  } catch (_) {}

  // Format channel details clearly
  let channelInfoText = '';
  if (channelName && channelId && channelName !== channelId) {
    channelInfoText = `📢 <b>Channel:</b> ${channelName} (${channelId})\n\n`;
  } else if (channelId || channelName) {
    channelInfoText = `📢 <b>Channel:</b> ${channelName || channelId}\n\n`;
  }

  // Create direct link to the channel if it's public (has @username)
  let channelUrl = null;
  if (channelId && channelId.startsWith('@')) {
    channelUrl = `https://t.me/${channelId.replace('@', '')}`;
  }

  const inlineKeyboard = [];

  // Add direct channel link button (if public channel)
  if (channelUrl) {
    inlineKeyboard.push([
      { text: '🔗 Open Channel', url: channelUrl }
    ]);
  }

  inlineKeyboard.push([
    { text: '✅ Done', callback_data: 'bot_admin_added' }
  ]);
  inlineKeyboard.push([
    { text: 'Change Channel', callback_data: 'change_channel' }
  ]);

  const botTag = botUsername ? `@${botUsername}` : 'this bot';
  let instructions = `✅ <b>Channel Selected!</b>\n\n${channelInfoText}🤖 <b>Step 3: Add Bot as Admin</b>\n\n`;

  if (channelUrl) {
    instructions += `1. Tap <b>"🔗 Open Channel"</b> to go to your channel\n`;
    instructions += `2. Add ${botTag} as admin with <b>Post Messages</b> permission\n\n`;
  } else {
    instructions += `Add ${botTag} as admin to your channel with <b>Post Messages</b> permission.\n\n`;
  }

  instructions += `Once done, click <b>"✅ Done"</b>:`;

  await api.sendMessage({
    chat_id: chatId,
    text: instructions,
    parse_mode: 'HTML',
    reply_markup: {
      remove_keyboard: true,
      inline_keyboard: inlineKeyboard
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
          [{ text: 'Provide Channel', callback_data: 'change_channel' }]
        ]
      }
    });
    return;
  }

  let channelId = user.channel_id;
  console.log('Checking bot admin status for onboarding channel:', channelId);

  const { isAdmin, status, botUsername, activeChannelId, error } = await checkBotAdminStatus(api, channelId);

  if (!isAdmin) {
    const botTag = botUsername ? `@${botUsername}` : 'this bot';
    const addBotUrl = botUsername
      ? `https://t.me/${botUsername}?startgroup=true&admin=post_messages+edit_messages+delete_messages`
      : null;

    const keyboardRows = [];
    if (addBotUrl) {
      keyboardRows.push([{ text: '➕ Add Bot as Admin Automatically', url: addBotUrl }]);
    }
    keyboardRows.push([{ text: 'Done', callback_data: 'bot_admin_added' }]);
    keyboardRows.push([{ text: 'Change Channel', callback_data: 'change_channel' }]);

    const errText = error?.description || error?.message || '';
    let detailMsg = '';
    if (errText.includes('chat not found')) {
      detailMsg = `\n\n⚠️ Telegram could not find channel "${channelId}".\n• If your channel is public, please make sure the username is correct (e.g., @mychannel).\n• If your channel is private, forward any post from your channel directly to this chat!`;
    }

    await api.sendMessage({
      chat_id: chatId,
      text: `❌ The bot is not yet an administrator in <b>${channelId}</b>.${detailMsg}\n\nPlease make sure:\n1. Add ${botTag} to your channel\n2. Promote the bot to <b>Administrator</b> with <b>Post Messages</b> permission\n\nOnce added, click <b>"Done"</b>:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboardRows
      }
    });
    return;
  }

  // Bot is verified as admin! Enrich channel info (username & title) now that bot has admin access
  if (activeChannelId && activeChannelId !== channelId) {
    channelId = activeChannelId;
  }
  try {
    const enriched = await resolveChannelMetadata(api, channelId, user.channel_name);
    if (enriched.channelId !== user.channel_id || enriched.channelName !== user.channel_name) {
      channelId = enriched.channelId;
      await updateUserChannelId(user.telegram_id, enriched.channelId, enriched.channelName);
    }
  } catch (_) {}

  await updateUserOnboardingStep(user.telegram_id, 'select_categories');
  await showCategorySelection(chatId);
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
    { text: 'Add Custom Source', callback_data: 'add_custom_source' }
  ]);
  keyboard.push([
    { text: 'Complete Setup', callback_data: 'complete_setup' }
  ]);

  await api.sendMessage({
    chat_id: chatId,
    text: '📂 Step 4: Select Content Categories\n\nChoose the types of content you want to generate:',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function showAddChannelBotAdminInstructions(chatId, channelId = null, channelName = null) {
  let botUsername = '';
  try {
    const me = await api.getMe();
    botUsername = me?.username || '';
  } catch (_) {}

  // Format channel details clearly
  let channelInfoText = '';
  if (channelName && channelId && channelName !== channelId) {
    channelInfoText = `📢 <b>Channel:</b> ${channelName} (${channelId})\n\n`;
  } else if (channelId || channelName) {
    channelInfoText = `📢 <b>Channel:</b> ${channelName || channelId}\n\n`;
  }

  // Create direct link to the channel if it's public (has @username)
  let channelUrl = null;
  if (channelId && channelId.startsWith('@')) {
    channelUrl = `https://t.me/${channelId.replace('@', '')}`;
  }

  const inlineKeyboard = [];

  // Add direct channel link button (if public channel)
  if (channelUrl) {
    inlineKeyboard.push([
      { text: '🔗 Open Channel', url: channelUrl }
    ]);
  }

  inlineKeyboard.push([
    { text: '✅ Done', callback_data: 'bot_admin_added' }
  ]);

  const botTag = botUsername ? `@${botUsername}` : 'this bot';
  let instructions = `✅ <b>Channel Selected!</b>\n\n${channelInfoText}🤖 <b>Add Bot as Admin</b>\n\n`;

  if (channelUrl) {
    instructions += `1. Tap <b>"🔗 Open Channel"</b> to go to your channel\n`;
    instructions += `2. Add ${botTag} as admin with <b>Post Messages</b> permission\n\n`;
  } else {
    instructions += `Add ${botTag} as admin to your channel with <b>Post Messages</b> permission.\n\n`;
  }

  instructions += `Once added, tap <b>"✅ Done"</b> below to continue:`;

  await api.sendMessage({
    chat_id: chatId,
    text: instructions,
    parse_mode: 'HTML',
    reply_markup: {
      remove_keyboard: true,
      inline_keyboard: inlineKeyboard
    }
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

  let targetChannelId = channelId;
  let targetChannelName = channelName || targetChannelId;

  console.log('Checking verifyAndAddChannel admin status for:', targetChannelId);
  const { isAdmin, status, botUsername, activeChannelId, error } = await checkBotAdminStatus(api, targetChannelId);

  if (!isAdmin) {
    const botTag = botUsername ? `@${botUsername}` : 'this bot';
    const addBotUrl = botUsername
      ? `https://t.me/${botUsername}?startgroup=true&admin=post_messages+edit_messages+delete_messages`
      : null;

    const keyboardRows = [];
    if (addBotUrl) {
      keyboardRows.push([{ text: '➕ Add Bot as Admin Automatically', url: addBotUrl }]);
    }
    keyboardRows.push([{ text: 'Done', callback_data: 'bot_admin_added' }]);

    const errText = error?.description || error?.message || '';
    let detailMsg = '';
    if (errText.includes('chat not found')) {
      detailMsg = `\n\n⚠️ Telegram could not find channel "${targetChannelId}".\n• If your channel is public, please make sure the username is correct (e.g., @mychannel).\n• If your channel is private, forward any post from your channel directly to this chat!`;
    }

    await api.sendMessage({
      chat_id: chatId,
      text: `❌ The bot is not yet an administrator in <b>${targetChannelId}</b>.${detailMsg}\n\nPlease make sure:\n1. Add ${botTag} to your channel\n2. Promote the bot to <b>Administrator</b> with <b>Post Messages</b> permission\n\nOnce added, send "done" or click "Done" below to continue:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboardRows
      }
    });
    return;
  }

  // Bot is verified as admin! Enrich channel info (username & title) now that bot has admin access
  if (activeChannelId && activeChannelId !== targetChannelId) {
    targetChannelId = activeChannelId;
  }
  try {
    const enriched = await resolveChannelMetadata(api, targetChannelId, targetChannelName);
    targetChannelId = enriched.channelId;
    targetChannelName = enriched.channelName;
  } catch (_) {}

  // Add the channel
  await addUserChannel(user.id, targetChannelId, targetChannelName, 0, 0);
  await clearPendingChannelAdd(user.telegram_id);

  await api.sendMessage({
    chat_id: chatId,
    text: `✅ Channel "${targetChannelName || targetChannelId}" has been added successfully!\n\nYou can now post content to this channel.`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Settings', callback_data: 'settings' }
        ]
      ]
    }
  });
}

