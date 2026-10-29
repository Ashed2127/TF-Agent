/**
 * Normalizes user input or links into a valid Telegram chat identifier.
 * Valid outputs:
 * - '@username' for public channels/groups (spaces removed, formatted as @username)
 * - '-100xxxxxxxxxx' or '-xxxxxxxxxx' for numeric chat IDs
 */
export function normalizeChannelId(input) {
  if (!input || typeof input !== 'string') return null;
  let str = input.trim();

  // If it's already an integer chat ID (e.g. -100... or -...)
  if (/^-?\d+$/.test(str)) {
    if (/^100\d+$/.test(str)) {
      return `-${str}`;
    }
    return str;
  }

  // Private channel link: https://t.me/c/1234567890/456 -> -1001234567890
  const privateMatch = str.match(/(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/c\/(\d+)/i);
  if (privateMatch) {
    return `-100${privateMatch[1]}`;
  }

  // Public channel link: https://t.me/channelname or t.me/channelname
  const urlMatch = str.match(/(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/i);
  if (urlMatch) {
    const username = urlMatch[1];
    if (!['joinchat', 'c', '+'].includes(username.toLowerCase())) {
      return `@${username}`;
    }
  }

  // If it starts with @ or has spaces/multiple words
  if (str.startsWith('@')) {
    // Strip '@', remove any spaces between words, strip trailing punctuation/queries
    const username = str.substring(1).split(/[/?#]/)[0].replace(/\s+/g, '');
    return `@${username}`;
  }

  // Bare username or title with two/more words (e.g., 'True Feed' -> '@TrueFeed', 'my channel' -> '@mychannel')
  const noSpaces = str.replace(/\s+/g, '');
  if (/^[a-zA-Z0-9_]{3,}$/.test(noSpaces)) {
    return `@${noSpaces}`;
  }

  return str;
}

/**
 * Normalizes any channel name / username / link into @username format.
 * Never uses t.me/ and does not separate two words with spaces.
 */
export function formatChannelHandle(channel) {
  if (!channel) return null;
  let str = String(channel).trim();
  if (!str) return null;

  // If it's purely a numeric chat ID, return it as-is
  if (/^-?\d+$/.test(str)) {
    return str;
  }

  // Strip t.me/ or telegram.me/ URL prefix if present
  str = str.replace(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\//i, '');

  // Strip leading @
  str = str.replace(/^@+/, '');

  // Strip path/query parameters
  str = str.split(/[/?#]/)[0];

  // Remove any spaces if username has two or more words (e.g. 'true feed' -> 'truefeed')
  str = str.replace(/\s+/g, '');

  return str ? `@${str}` : null;
}

/**
 * Extracts channel information from a forwarded message or text input.
 */
export function extractChannelFromMessage(message) {
  if (!message) return null;

  // Bot API 6.7+ chat_shared (when user clicks "Choose Channel / Group" button)
  if (message.chat_shared && message.chat_shared.chat_id) {
    const rawChatId = message.chat_shared.chat_id;
    let channelId;
    if (message.chat_shared.username) {
      channelId = `@${message.chat_shared.username.replace(/^@/, '')}`;
    } else {
      channelId = String(rawChatId);
      if (!channelId.startsWith('-')) {
        channelId = `-100${channelId}`;
      }
    }
    return {
      channelId,
      channelName: message.chat_shared.title || (message.chat_shared.username ? `@${message.chat_shared.username.replace(/^@/, '')}` : channelId)
    };
  }

  // Bot API 7.0+ forward_origin
  if (message.forward_origin && message.forward_origin.type === 'channel' && message.forward_origin.chat) {
    const chat = message.forward_origin.chat;
    const channelId = chat.username ? `@${chat.username}` : String(chat.id);
    return {
      channelId,
      channelName: chat.title || (chat.username ? `@${chat.username}` : channelId)
    };
  }

  // Legacy forward_from_chat
  if (message.forward_from_chat && (message.forward_from_chat.type === 'channel' || message.forward_from_chat.type === 'supergroup')) {
    const chat = message.forward_from_chat;
    const channelId = chat.username ? `@${chat.username}` : String(chat.id);
    return {
      channelId,
      channelName: chat.title || (chat.username ? `@${chat.username}` : channelId)
    };
  }

  // Text input (text or caption)
  const rawText = (message.text || message.caption || '').trim();
  if (!rawText) return null;

  const normalized = normalizeChannelId(rawText);
  if (!normalized) return null;

  return {
    channelId: normalized,
    channelName: normalized
  };
}
