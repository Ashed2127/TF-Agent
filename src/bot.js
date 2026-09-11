const { Telegraf } = require('telegraf');
const { generateIdea } = require('./agent');
const { generateInsightfulPost, generateJoke } = require('./postGenerator');
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
    'ከታች ያሉትን አማራጮች ይጫኑ።',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'idea', callback_data: 'new_idea' },
            { text: 'insight', callback_data: 'new_post' },
            { text: 'joke', callback_data: 'new_joke' }
          ]
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
    await ctx.reply('⏳ Generating idea...');
    
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
      '❌ Failed to generate idea. Please try again.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'idea', callback_data: 'new_idea' },
              { text: 'insight', callback_data: 'new_post' },
              { text: 'joke', callback_data: 'new_joke' }
            ]
          ]
        }
      }
    );
  }
});

bot.action('new_post', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('⏳ ፖስት እየተዘጋጀ ነው...');
    
    const post = await generateInsightfulPost();
    
    // Store post content in session for later use
    const postId = `post_${Date.now()}`;
    ctx.session.pendingIdeaId = postId;
    ctx.session.pendingPostContent = post.content;
    
    await ctx.reply(
      post.content,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve & Post', callback_data: `approve_${postId}` },
              { text: '❌ Reject — New Post', callback_data: 'new_post' }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('Error in new_post callback:', error);
    await ctx.reply(
      '❌ ፖስት መፍጠር አልተቻለም። እንደገና ሞክር።',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'idea', callback_data: 'new_idea' },
              { text: 'insight', callback_data: 'new_post' },
              { text: 'joke', callback_data: 'new_joke' },
              { text: '😂 ግልጽ ውስጥ ዘራፍ', callback_data: 'new_joke' }
            ]
          ]
        }
      }
    );
  }
});

bot.action('new_joke', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('⏳ ግልጽ ውስጥ ዘራፍ እየተዘጋጀ ነው...');
    
    const joke = await generateJoke();
    
    // Store joke content in session for later use
    const jokeId = `joke_${Date.now()}`;
    ctx.session.pendingIdeaId = jokeId;
    ctx.session.pendingPostContent = joke.content;
    
    await ctx.reply(
      joke.content,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve & Post', callback_data: `approve_${jokeId}` },
              { text: '❌ Reject — New Joke', callback_data: 'new_joke' }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('Error in new_joke callback:', error);
    await ctx.reply(
      '❌ ግልጽ ውስጥ ዘራፍ መፍጠር አልተቻለም። እንደገና ሞክር።',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'idea', callback_data: 'new_idea' },
              { text: 'insight', callback_data: 'new_post' },
              { text: 'joke', callback_data: 'new_joke' },
              { text: '😂 ግልጽ ውስጥ ዘራፍ', callback_data: 'new_joke' }
            ]
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
    
    // Check if this is a post or joke approval (contains "approve_post" or "approve_joke")
    if (id.startsWith('post_') || id.startsWith('joke_')) {
      // For posts and jokes, we don't have a database record, so we'll post directly
      await ctx.editMessageText('📸 ምስል አስገቢው እንደሆነ አዲስ ምስል ይላኩ ፡\n\nወይም "ምስል ሳይኖር ቀጥል" የሚለውን ይጫኑ',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⏭️ ምስል ሳይኖር ቀጥል', callback_data: `post_no_image_${id}` }]
            ]
          }
        }
      );
      return;
    }
    
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
      await ctx.reply('❌ እባክዎ አዲስ ሀሳብ ወይም ፖስት ይፍጠሩ እና ከዚያ ያስፈልጉ');
      return;
    }
    
    const id = ctx.session.pendingIdeaId;
    
    // Check if this is a post or joke (starts with "post_" or "joke_")
    if (id.startsWith('post_') || id.startsWith('joke_')) {
      // For posts and jokes, we need to get the content from the session or context
      // Since we don't store post content in database, we'll handle this differently
      await ctx.reply('❌ ፖስት/ግልጽ ውስጥ ዘራፍ ምስል አስገቢው አሁን አይደግፍም። እባክዎ "ምስል ሳይኖር ቀጥል" ይጫኑ።');
      return;
    }
    
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
            [
              { text: 'idea', callback_data: 'new_idea' },
              { text: 'insight', callback_data: 'new_post' },
              { text: 'joke', callback_data: 'new_joke' }
            ]
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
    
    // Check if this is a post or joke (starts with "post_" or "joke_")
    if (id.startsWith('post_') || id.startsWith('joke_')) {
      // For posts and jokes, we need to get the content from the session
      // We'll store the post content in session when generating the post/joke
      if (!ctx.session || !ctx.session.pendingPostContent) {
        await ctx.reply('❌ Post/Joke content not found. Please generate a new post/joke.');
        return;
      }
      
      await bot.telegram.sendMessage(TRUE_FEED_CHANNEL_ID, ctx.session.pendingPostContent, { parse_mode: 'HTML' });
      
      console.log(`📤 Posted ${id.startsWith('joke_') ? 'joke' : 'post'} to True Feed (no image)`);
      
      await ctx.editMessageText(
        '✅ True Feed ላይ ተለቀቀ!\n\n' + ctx.session.pendingPostContent,
        { parse_mode: 'HTML' }
      );
      
      // Clear session
      delete ctx.session.pendingIdeaId;
      delete ctx.session.pendingPostContent;
      
      await ctx.reply(
        '🎉 ተሳካ! ቀጣዩን ሀሳብ ወይም ፖስት ሲፈልጉ:',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'idea', callback_data: 'new_idea' },
                { text: 'insight', callback_data: 'new_post' },
                { text: 'joke', callback_data: 'new_joke' }
              ]
            ]
          }
        }
      );
      return;
    }
    
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
            [
              { text: 'idea', callback_data: 'new_idea' },
              { text: 'insight', callback_data: 'new_post' },
              { text: 'joke', callback_data: 'new_joke' }
            ]
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
    
    // Check if this is a post rejection
    if (id.startsWith('post_')) {
      console.log(`❌ Rejected post [${id}]`);
      await ctx.editMessageText('❌ ተቀባይነት አላገኘም');
      
      // Clear session
      delete ctx.session.pendingIdeaId;
      delete ctx.session.pendingPostContent;
      
      await ctx.reply('⏳ አዲስ ፖስት እየተዘጋጀ ነው...');
      
      const newPost = await generateInsightfulPost();
      
      // Store new post content in session
      const newPostId = `post_${Date.now()}`;
      ctx.session.pendingIdeaId = newPostId;
      ctx.session.pendingPostContent = newPost.content;
      
      await ctx.reply(
        newPost.content,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Approve & Post', callback_data: `approve_${newPostId}` },
                { text: '❌ Reject — New Post', callback_data: 'new_post' }
              ]
            ]
          }
        }
      );
      return;
    }
    
    // Check if this is a joke rejection
    if (id.startsWith('joke_')) {
      console.log(`❌ Rejected joke [${id}]`);
      await ctx.editMessageText('❌ ተቀባይነት አላገኘም');
      
      // Clear session
      delete ctx.session.pendingIdeaId;
      delete ctx.session.pendingPostContent;
      
      await ctx.reply('⏳ አዲስ ግልጽ ውስጥ ዘራፍ እየተዘጋጀ ነው...');
      
      const newJoke = await generateJoke();
      
      // Store new joke content in session
      const newJokeId = `joke_${Date.now()}`;
      ctx.session.pendingIdeaId = newJokeId;
      ctx.session.pendingPostContent = newJoke.content;
      
      await ctx.reply(
        newJoke.content,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Approve & Post', callback_data: `approve_${newJokeId}` },
                { text: '❌ Reject — New Joke', callback_data: 'new_joke' }
              ]
            ]
          }
        }
      );
      return;
    }
    
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
            [
              { text: 'idea', callback_data: 'new_idea' },
              { text: 'insight', callback_data: 'new_post' },
              { text: 'joke', callback_data: 'new_joke' }
            ]
          ]
        }
      }
    );
  }
});

module.exports = { bot };
