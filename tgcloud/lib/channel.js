/**
 * Normalizes user input or links into a valid Telegram chat identifier.
 * Valid outputs:
 * - '@username' for public channels/groups
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

  // If it starts with @
  if (str.startsWith('@')) {
    const username = str.substring(1).split(/[/?#\s]/)[0];
    return `@${username}`;
  }

  // Bare username like 'identityBox' (contains only alphanumeric and underscores)
  if (/^[a-zA-Z0-9_]{3,}$/.test(str)) {
    return `@${str}`;
  }

  return str;
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
