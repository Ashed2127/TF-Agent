const { Telegraf } = require('telegraf');
const { generateIdea } = require('./agent');
const { markPosted, markRejected, getIdeaById } = require('./database');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const OWNER_CHAT_ID = parseInt(process.env.OWNER_CHAT_ID);
const TRUE_FEED_CHANNEL_ID = process.env.TRUE_FEED_CHANNEL_ID;

// Simple in-memory session storage
const sessions = {};

// Authorization middleware
bot.use((ctx, next) => {
  // Check user ID from different possible sources (message, callback query, etc.)
  const userId = ctx.from?.id || ctx.chat?.id;
  if (userId && userId !== OWNER_CHAT_ID) {
    // Only reply if it's a message, not a callback query
    if (ctx.message) {
      ctx.reply('⛔ Unauthorized');
    }
    return;
  }
  
  // Add session support for authorized users
  const chatId = ctx.chat?.id || ctx.from?.id;
  if (chatId) {
    ctx.session = sessions[chatId] = sessions[chatId] || {};
  }
  
  return next();
});

bot.start((ctx) => {
  console.log('Start command received from:', ctx.from?.id);
  ctx.reply(
    '🌱 TF Agent እንኳን ደህና መጡ!\n\n' +
    'ይህ Bot True Feed ቻናልዎን ያስተዳድራል።\n' +
    'አዲስ ሀሳብ ሲፈልጉ ከታች ያለውን Button ይጫኑ።',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌱 አዲስ ሀሳብ ስጠኝ', callback_data: 'new_idea' }]
        ]
      }
    }
  ).catch(err => {
    console.error('Error sending start reply:', err);
  });
});

bot.action('new_idea', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('⏳ ሀሳብ እየተዘጋጀ ነው...');
    
    const idea = await generateIdea();
    
    await ctx.reply(
      idea.content,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve & Post', callback_data: `approve_${idea.id}` },
              { text: '❌ Reject — New Idea', callback_data: `reject_${idea.id}` }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('Error in new_idea callback:', error);
    await ctx.reply(
      '❌ ሀሳብ መፍጠር አልተቻለም። እንደገና ሞክር።',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌱 አዲስ ሀሳብ ስጠኝ', callback_data: 'new_idea' }]
          ]
        }
      }
    );
  }
});

bot.action(/approve_(.+)/, async (ctx) => {
  try {
    const id = ctx.match[1];
    await ctx.answerCbQuery();
    
    const idea = await getIdeaById(id);
    if (!idea) {
      await ctx.reply('❌ Idea not found');
      return;
    }
    
    // Store the idea ID in session for image upload
    ctx.session.pendingIdeaId = id;
    
    await ctx.editMessageText(
      '📸 ምስል አስገቢው እንደሆነ አዲስ ምስል ይላኩ ፡\n\nወይም "ምስል ሳይኖር ቀጥል" የሚለውን ይጫኑ',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭️ ምስል ሳይኖር ቀጥል', callback_data: `post_no_image_${id}` }]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('Error in approve callback:', error);
    await ctx.reply('❌ Error posting idea. Please try again.');
  }
});

// Handle image upload
bot.on('photo', async (ctx) => {
  try {
    if (!ctx.session || !ctx.session.pendingIdeaId) {
      await ctx.reply('❌ እባክዎ አዲስ ሀሳብ ይፍጠሩ እና ከዚያ ያስፈልጉ');
      return;
    }
    
    const id = ctx.session.pendingIdeaId;
    const idea = await getIdeaById(id);
    if (!idea) {
      await ctx.reply('❌ Idea not found');
      return;
    }
    
    // Get the largest photo
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    
    await bot.telegram.sendPhoto(TRUE_FEED_CHANNEL_ID, photo.file_id, {
      caption: idea.content,
      parse_mode: 'HTML'
    });
    
    await markPosted(id);
    
    console.log(`📤 Posted idea [${id}] with image to True Feed`);
    
    await ctx.reply(
      '✅ True Feed ላይ ተለቀቀ!\n\n' + idea.content,
      { parse_mode: 'HTML' }
    );
    
    // Clear session
    delete ctx.session.pendingIdeaId;
    
    await ctx.reply(
      '🎉 ተሳካ! ቀጣዩን ሀሳብ ሲፈልጉ:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌱 አዲስ ሀሳብ ስጠኝ', callback_data: 'new_idea' }]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('Error handling photo upload:', error);
    await ctx.reply('❌ Error posting image. Please try again.');
  }
});

// Handle posting without image
bot.action(/post_no_image_(.+)/, async (ctx) => {
  try {
    const id = ctx.match[1];
    await ctx.answerCbQuery();
    
    const idea = await getIdeaById(id);
    if (!idea) {
      await ctx.reply('❌ Idea not found');
      return;
    }
    
    await bot.telegram.sendMessage(TRUE_FEED_CHANNEL_ID, idea.content, { parse_mode: 'HTML' });
    await markPosted(id);
    
    console.log(`📤 Posted idea [${id}] to True Feed (no image)`);
    
    await ctx.editMessageText(
      '✅ True Feed ላይ ተለቀቀ!\n\n' + idea.content,
      { parse_mode: 'HTML' }
    );
    
    // Clear session
    delete ctx.session.pendingIdeaId;
    
    await ctx.reply(
      '🎉 ተሳካ! ቀጣዩን ሀሳብ ሲፈልጉ:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌱 አዲስ ሀሳብ ስጠኝ', callback_data: 'new_idea' }]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('Error in post_no_image callback:', error);
    await ctx.reply('❌ Error posting idea. Please try again.');
  }
});

bot.action(/reject_(.+)/, async (ctx) => {
  try {
    const id = ctx.match[1];
    await ctx.answerCbQuery();
    
    await markRejected(id);
    console.log(`❌ Rejected idea [${id}]`);
    
    await ctx.editMessageText('❌ ተቀባይነት አላገኘም');
    
    await ctx.reply('⏳ አዲስ ሀሳብ እየተዘጋጀ ነው...');
    
    const newIdea = await generateIdea();
    
    await ctx.reply(
      newIdea.content,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve & Post', callback_data: `approve_${newIdea.id}` },
              { text: '❌ Reject — New Idea', callback_data: `reject_${newIdea.id}` }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('Error in reject callback:', error);
    await ctx.reply(
      '❌ ሀሳብ መፍጠር አልተቻለም። እንደገና ሞክር።',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌱 አዲስ ሀሳብ ስጠኝ', callback_data: 'new_idea' }]
          ]
        }
      }
    );
  }
});

module.exports = { bot };
