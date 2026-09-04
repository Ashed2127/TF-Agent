const { Telegraf } = require('telegraf');
const { generateIdea } = require('./agent');
const { markPosted, markRejected, getIdeaById } = require('./database');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const OWNER_CHAT_ID = parseInt(process.env.OWNER_CHAT_ID);
const TRUE_FEED_CHANNEL_ID = process.env.TRUE_FEED_CHANNEL_ID;

bot.use((ctx, next) => {
  if (ctx.from && ctx.from.id !== OWNER_CHAT_ID) {
    ctx.reply('⛔ Unauthorized');
    return;
  }
  return next();
});

bot.start((ctx) => {
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
  );
});

bot.action('new_idea', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('⏳ ሀሳብ እየተዘጋጀ ነው...');
    
    const idea = await generateIdea();
    
    await ctx.reply(
      idea.content,
      {
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

bot.action(/approve_(\d+)/, async (ctx) => {
  try {
    const id = parseInt(ctx.match[1]);
    await ctx.answerCbQuery();
    
    const idea = getIdeaById(id);
    if (!idea) {
      await ctx.reply('❌ Idea not found');
      return;
    }
    
    await bot.telegram.sendMessage(TRUE_FEED_CHANNEL_ID, idea.content);
    markPosted(id);
    
    console.log(`📤 Posted idea [${id}] to True Feed`);
    
    await ctx.editMessageText(
      '✅ True Feed ላይ ተለቀቀ!\n\n' + idea.content
    );
    
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
    console.error('Error in approve callback:', error);
    await ctx.reply('❌ Error posting idea. Please try again.');
  }
});

bot.action(/reject_(\d+)/, async (ctx) => {
  try {
    const id = parseInt(ctx.match[1]);
    await ctx.answerCbQuery();
    
    markRejected(id);
    console.log(`❌ Rejected idea [${id}]`);
    
    await ctx.editMessageText('❌ ተቀባይነት አላገኘም');
    
    await ctx.reply('⏳ አዲስ ሀሳብ እየተዘጋጀ ነው...');
    
    const newIdea = await generateIdea();
    
    await ctx.reply(
      newIdea.content,
      {
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
