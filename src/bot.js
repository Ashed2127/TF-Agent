const { Telegraf } = require('telegraf');
const { generateIdea } = require('./agent');
const { generateInsightfulPost, generateJoke } = require('./postGenerator');
const { markPosted, markRejected, getIdeaById } = require('./database');
const {
  fetchNewsFromAllSources,
  fetchTechCrunchNews,
  fetchTheVergeNews,
  fetchBBCTechNews,
  fetchWiredNews,
  fetchVentureBeatNews,
  fetchEngadgetNews,
  fetchArsTechnicaNews
} = require('./newsScraper');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const OWNER_CHAT_ID = parseInt(process.env.OWNER_CHAT_ID);
const TRUE_FEED_CHANNEL_ID = process.env.TRUE_FEED_CHANNEL_ID ? parseInt(process.env.TRUE_FEED_CHANNEL_ID) : null;

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
          ],
          [
            { text: '📰 news', callback_data: 'get_news' }
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
            ],
            [
              { text: '↩️ Back', callback_data: 'back' }
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
            ],
            [
              { text: '📰 news', callback_data: 'get_news' }
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
            ],
            [
              { text: '↩️ Back', callback_data: 'back' }
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
              { text: 'joke', callback_data: 'new_joke' }
            ],
            [
              { text: '📰 news', callback_data: 'get_news' }
            ]
          ]
        }
      }
    );
  }
});

bot.action('back', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply(
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
            ],
            [
              { text: '📰 news', callback_data: 'get_news' }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error in back callback:', error);
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
            ],
            [
              { text: '↩️ Back', callback_data: 'back' }
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
              { text: 'joke', callback_data: 'new_joke' }
            ],
            [
              { text: '📰 news', callback_data: 'get_news' }
            ]
          ]
        }
      }
    );
  }
});

bot.action('get_news', async (ctx) => {
  try {
    await ctx.answerCbQuery();

    // Show news source selection menu
    await ctx.reply(
      '📰 <b>Select a news source:</b>',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'TechCrunch', callback_data: 'news_techcrunch' },
              { text: 'The Verge', callback_data: 'news_theverge' }
            ],
            [
              { text: 'BBC Tech', callback_data: 'news_bbctech' },
              { text: 'Wired', callback_data: 'news_wired' }
            ],
            [
              { text: 'VentureBeat', callback_data: 'news_venturebeat' },
              { text: 'Engadget', callback_data: 'news_engadget' }
            ],
            [
              { text: 'Ars Technica', callback_data: 'news_arstechnica' }
            ],
            [
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error in get_news callback:', error);
    await ctx.reply('❌ Error. Please try again.');
  }
});

// Helper function to fetch and display news from a specific source
async function fetchAndDisplayNews(ctx, sourceName, fetchFunction, sourceCallback) {
  try {
    await ctx.answerCbQuery();
    await ctx.reply(`⏳ Fetching latest news from ${sourceName}...`);

    // Clear previous news articles to ensure fresh content
    ctx.session.newsArticles = null;
    ctx.session.currentNewsIndex = 0;
    ctx.session.currentNewsSource = sourceCallback;

    const articles = await fetchFunction(10);

    if (articles.length === 0) {
      await ctx.reply(`❌ No news articles found from ${sourceName} at the moment. Please try again later.`);
      return;
    }

    // Store articles in session with unique IDs
    ctx.session.newsArticles = articles.map((article, index) => ({
      ...article,
      id: `news_${Date.now()}_${index}`
    }));
    ctx.session.currentNewsIndex = 0;

    // Send first article with approve/reject buttons
    await sendNewsArticle(ctx, 0);

  } catch (error) {
    console.error(`Error fetching news from ${sourceName}:`, error);
    await ctx.reply(`❌ Failed to fetch news from ${sourceName}. Please try again.`);
  }
}

// News source handlers
bot.action('news_techcrunch', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'TechCrunch', fetchTechCrunchNews, 'news_techcrunch');
});

bot.action('news_theverge', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'The Verge', fetchTheVergeNews, 'news_theverge');
});

bot.action('news_bbctech', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'BBC Tech', fetchBBCTechNews, 'news_bbctech');
});

bot.action('news_wired', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Wired', fetchWiredNews, 'news_wired');
});

bot.action('news_venturebeat', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'VentureBeat', fetchVentureBeatNews, 'news_venturebeat');
});

bot.action('news_engadget', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Engadget', fetchEngadgetNews, 'news_engadget');
});

bot.action('news_arstechnica', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Ars Technica', fetchArsTechnicaNews, 'news_arstechnica');
});

/**
 * Helper function to send a news article with approve/reject buttons
 */
async function sendNewsArticle(ctx, index) {
  if (!ctx.session.newsArticles || index >= ctx.session.newsArticles.length) {
    // All articles processed
    const refreshCallback = ctx.session.currentNewsSource || 'get_news';
    await ctx.reply(
      '📰 All news articles reviewed!',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Refresh Same Source', callback_data: refreshCallback },
              { text: '🔄 Change Source', callback_data: 'get_news' }
            ],
            [
              { text: '↩️ Back to Sources', callback_data: 'get_news' },
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ]
        }
      }
    );
    return;
  }

  const article = ctx.session.newsArticles[index];
  const caption = `<b>${article.title}</b>\n\n<a href="${article.link}">${article.source}</a>\n\n<b>@true_feed</b>`;

  ctx.session.currentNewsIndex = index;
  ctx.session.currentNewsId = article.id;

  if (article.image) {
    try {
      await ctx.replyWithPhoto(article.image, {
        caption,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve & Post', callback_data: `approve_news_${article.id}` },
              { text: '❌ Reject', callback_data: `reject_news_${article.id}` }
            ],
            [
              { text: '⏭️ Skip', callback_data: `skip_news_${article.id}` }
            ],
            [
              { text: '↩️ Back to Sources', callback_data: 'get_news' }
            ]
          ]
        }
      });
    } catch (photoError) {
      console.error('Error sending photo:', photoError.message);
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve & Post', callback_data: `approve_news_${article.id}` },
              { text: '❌ Reject', callback_data: `reject_news_${article.id}` }
            ],
            [
              { text: '⏭️ Skip', callback_data: `skip_news_${article.id}` }
            ],
            [
              { text: '↩️ Back to Sources', callback_data: 'get_news' }
            ]
          ]
        }
      });
    }
  } else {
    await ctx.reply(caption, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Approve & Post', callback_data: `approve_news_${article.id}` },
            { text: '❌ Reject', callback_data: `reject_news_${article.id}` }
          ],
          [
            { text: '⏭️ Skip', callback_data: `skip_news_${article.id}` }
          ],
          [
            { text: '↩️ Back to Sources', callback_data: 'get_news' }
          ]
        ]
      }
    });
  }
}

// Handle news article approval
bot.action(/approve_news_(.+)/, async (ctx) => {
  try {
    const id = ctx.match[1];
    await ctx.answerCbQuery();

    const article = ctx.session.newsArticles?.find(a => a.id === id);
    if (!article) {
      await ctx.reply('❌ Article not found');
      return;
    }

    if (!TRUE_FEED_CHANNEL_ID) {
      await ctx.reply('❌ TRUE_FEED_CHANNEL_ID not configured');
      return;
    }

    const caption = `<b>${article.title}</b>\n\n<a href="${article.link}">${article.source}</a>\n\n<b>@true_feed</b>`;

    // Post to channel with image if available
    let posted = false;
    if (article.image) {
      try {
        await bot.telegram.sendPhoto(TRUE_FEED_CHANNEL_ID, article.image, {
          caption,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        });
        posted = true;
      } catch (photoError) {
        console.error('Error posting photo to channel:', photoError.message);
        console.error('Photo error details:', JSON.stringify(photoError.response || photoError, null, 2));
        // Fallback to text message
        await bot.telegram.sendMessage(TRUE_FEED_CHANNEL_ID, caption, {
          parse_mode: 'HTML',
          disable_web_page_preview: false
        });
        posted = true;
      }
    } else {
      await bot.telegram.sendMessage(TRUE_FEED_CHANNEL_ID, caption, {
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });
      posted = true;
    }

    if (posted) {
      console.log(`📤 Posted news article [${id}] to True Feed`);
      // Try to edit the message, if it fails (e.g., photo message), send a new one
      try {
        await ctx.editMessageText('✅ Posted to True Feed!');
      } catch (editError) {
        console.error('Error editing message:', editError.message);
        await ctx.reply('✅ Posted to True Feed!');
      }

      // Move to next article
      const nextIndex = ctx.session.currentNewsIndex + 1;
      await sendNewsArticle(ctx, nextIndex);
    }

  } catch (error) {
    console.error('Error in approve_news callback:', error);
    console.error('Error details:', JSON.stringify(error.response || error, null, 2));
    await ctx.reply('❌ Error posting article. Please try again.');
  }
});

// Handle news article rejection
bot.action(/reject_news_(.+)/, async (ctx) => {
  try {
    const id = ctx.match[1];
    await ctx.answerCbQuery();

    console.log(`❌ Rejected news article [${id}]`);

    // Try to edit the message, if it fails (e.g., photo message), send a new one
    try {
      await ctx.editMessageText('❌ Article rejected');
    } catch (editError) {
      console.error('Error editing message:', editError.message);
      await ctx.reply('❌ Article rejected');
    }

    // Move to next article
    const nextIndex = ctx.session.currentNewsIndex + 1;
    await sendNewsArticle(ctx, nextIndex);

  } catch (error) {
    console.error('Error in reject_news callback:', error);
    await ctx.reply('❌ Error. Please try again.');
  }
});

// Handle news article skip
bot.action(/skip_news_(.+)/, async (ctx) => {
  try {
    const id = ctx.match[1];
    await ctx.answerCbQuery();

    console.log(`⏭️ Skipped news article [${id}]`);

    // Try to edit the message, if it fails (e.g., photo message), send a new one
    try {
      await ctx.editMessageText('⏭️ Skipped');
    } catch (editError) {
      console.error('Error editing message:', editError.message);
      await ctx.reply('⏭️ Skipped');
    }

    // Move to next article
    const nextIndex = ctx.session.currentNewsIndex + 1;
    await sendNewsArticle(ctx, nextIndex);

  } catch (error) {
    console.error('Error in skip_news callback:', error);
    await ctx.reply('❌ Error. Please try again.');
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
            ],
            [
              { text: '📰 news', callback_data: 'get_news' }
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
            ],
            [
              { text: '📰 news', callback_data: 'get_news' }
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
              ],
              [
                { text: '↩️ Back', callback_data: 'back' }
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
              ],
              [
                { text: '↩️ Back', callback_data: 'back' }
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
            ],
            [
              { text: '↩️ Back', callback_data: 'back' }
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
            ],
            [
              { text: '📰 news', callback_data: 'get_news' }
            ]
          ]
        }
      }
    );
  }
});

module.exports = { bot };
