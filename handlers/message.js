import { api } from 'sdk';

export default async function (message) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text;

  // Authorization check (optional - set OWNER_CHAT_ID in env if needed)
  if (process.env.OWNER_CHAT_ID && userId !== parseInt(process.env.OWNER_CHAT_ID)) {
    await api.sendMessage({
      chat_id: chatId,
      text: '⛔ Unauthorized'
    });
    return;
  }

  if (text === '/start') {
    await api.sendMessage({
      chat_id: chatId,
      text: '🌱 TF Agent እንኳን ደህና መጡ!\n\n' +
            'ይህ Bot True Feed ቻናልዎን ያስተዳድራል።\n' +
            'አዲስ ሀሳብ ሲፈልጉ ከታች ያለውን Button ይጫኑ።',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌱 አዲስ ሀሳብ ስጠኝ', callback_data: 'new_idea' }]
        ]
      }
    });
  }
}
