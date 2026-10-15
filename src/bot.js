const { Telegraf } = require('telegraf');
const { generateIdea } = require('./agent');
const { markPosted, markRejected, getIdeaById } = require('./database');
const axios = require('axios');
const {
  fetchNewsFromAllSources,
  fetchTechCrunchNews,
  fetchTheVergeNews,
  fetchBBCTechNews,
  fetchWiredNews,
  fetchVentureBeatNews,
  fetchEngadgetNews,
  fetchArsTechnicaNews,
  fetchTheInformationNews,
  fetchRestOfWorldNews,
  fetchFastCompanyNews,
  fetchMITTechReviewNews,
  fetchTheNewStackNews,
  fetchHackerNews,
  fetchTechmemeNews,
  fetchSiftedNews,
  fetchTechEuNews,
  fetchTheNextWebNews,
  fetchYourStoryNews,
  fetchTheMorningContextNews,
  fetchEntrackrNews,
  fetchTechNodeNews,
  fetchKrASIANews,
  fetchTechCabalNews,
  fetchDisruptAfricaNews,
  fetchTechpointAfricaNews,
  fetchWamdaNews,
  fetchMagnittNews,
  fetchSmartCompanyNews,
  fetchStartupDailyNews,
  fetchTechGuideNews,
  fetchGizmodoAustraliaNews,
  fetchContxtoNews,
  fetchStartupsLatamNews,
  fetchBrazilJournalNews,
  fetchLatamListNews,
  fetchCNETNews,
  fetchTechRadarNews,
  fetchGizmodoNews,
  fetchMashableNews,
  fetchDigitalTrendsNews,
  fetchZDNETNews,
  fetchInfoWorldNews,
  fetchTechRepublicNews,
  fetchGartnerNews,
  fetchHackerNoonNews,
  fetchDEVCommunityNews,
  fetchSlashdotNews,
  fetchDZoneNews,
  fetchKrebsOnSecurityNews,
  fetchDaringFireballNews,
  fetchPragmaticEngineerNews,
  fetchNetflixTechBlogNews,
  fetchCloudflareBlogNews,
  fetchTelegramGramNews
} = require('./newsScraper');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const OWNER_CHAT_ID = parseInt(process.env.OWNER_CHAT_ID);
const TRUE_FEED_CHANNEL_ID = process.env.TRUE_FEED_CHANNEL_ID ? parseInt(process.env.TRUE_FEED_CHANNEL_ID) : null;

/**
 * Translate text to Amharic using OpenRouter API
 */
async function translateToAmharic(text) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the given text to Amharic. Keep the Ethiopian context. CRITICAL: Keep the following in English: company names (e.g., Google, Apple, Microsoft), person names (e.g., Elon Musk, Jeff Bezos), coined names/brand names (e.g., iPhone, ChatGPT, AI, blockchain), technical terms, product names, and subject names. ONLY translate the descriptive parts, connecting words, and general concepts. Return ONLY the translation, no explanations.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.error('Translation API error:', response.status);
      return text; // Return original if translation fails
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    }

    return text;
  } catch (error) {
    console.error('Error translating to Amharic:', error.message);
    return text; // Return original if translation fails
  }
}

// Helper function to download image as buffer
async function downloadImage(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    return Buffer.from(response.data, 'binary');
  } catch (error) {
    console.error('Error downloading image:', error.message);
    return null;
  }
}

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

bot.action('get_news', async (ctx) => {
  try {
    await ctx.answerCbQuery();

    // Show news source selection menu with all sources
    await ctx.reply(
      '📰 <b>Select a news source:</b>',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'TechCrunch', callback_data: 'news_techcrunch' },
              { text: 'The Verge', callback_data: 'news_theverge' },
              { text: 'BBC Tech', callback_data: 'news_bbctech' }
            ],
            [
              { text: 'Wired', callback_data: 'news_wired' },
              { text: 'VentureBeat', callback_data: 'news_venturebeat' },
              { text: 'Engadget', callback_data: 'news_engadget' }
            ],
            [
              { text: 'Ars Technica', callback_data: 'news_arstechnica' },
              { text: 'The Information', callback_data: 'news_theinformation' },
              { text: 'Rest of World', callback_data: 'news_restofworld' }
            ],
            [
              { text: 'Fast Company', callback_data: 'news_fastcompany' },
              { text: 'MIT Tech Review', callback_data: 'news_mittechreview' },
              { text: 'The New Stack', callback_data: 'news_thenewstack' }
            ],
            [
              { text: 'Hacker News', callback_data: 'news_hackernews' },
              { text: 'Techmeme', callback_data: 'news_techmeme' },
              { text: 'Sifted', callback_data: 'news_sifted' }
            ],
            [
              { text: 'Tech.eu', callback_data: 'news_techceu' },
              { text: 'The Next Web', callback_data: 'news_thenextweb' },
              { text: 'YourStory', callback_data: 'news_yourstory' }
            ],
            [
              { text: 'Morning Context', callback_data: 'news_morningcontext' },
              { text: 'Entrackr', callback_data: 'news_entrackr' },
              { text: 'TechNode', callback_data: 'news_technode' }
            ],
            [
              { text: 'KrASIA', callback_data: 'news_krasia' },
              { text: 'TechCabal', callback_data: 'news_techcabal' },
              { text: 'Disrupt Africa', callback_data: 'news_disruptafrica' }
            ],
            [
              { text: 'Techpoint Africa', callback_data: 'news_techpointafrica' },
              { text: 'Wamda', callback_data: 'news_wamda' },
              { text: 'Magnitt', callback_data: 'news_magnitt' }
            ],
            [
              { text: 'SmartCompany', callback_data: 'news_smartcompany' },
              { text: 'Startup Daily', callback_data: 'news_startupdaily' },
              { text: 'Tech Guide', callback_data: 'news_techguide' }
            ],
            [
              { text: 'Gizmodo AU', callback_data: 'news_gizmodoau' },
              { text: 'Contxto', callback_data: 'news_contxto' },
              { text: 'Startups Latam', callback_data: 'news_startupslatam' }
            ],
            [
              { text: 'Brazil Journal', callback_data: 'news_braziljournal' },
              { text: 'LatamList', callback_data: 'news_latamlist' }
            ],
            [
              { text: 'CNET', callback_data: 'news_cnet' },
              { text: 'TechRadar', callback_data: 'news_techradar' },
              { text: 'Gizmodo', callback_data: 'news_gizmodo' }
            ],
            [
              { text: 'Mashable', callback_data: 'news_mashable' },
              { text: 'Digital Trends', callback_data: 'news_digitaltrends' },
              { text: 'ZDNET', callback_data: 'news_zdnet' }
            ],
            [
              { text: 'InfoWorld', callback_data: 'news_infoworld' },
              { text: 'TechRepublic', callback_data: 'news_techrepublic' },
              { text: 'Gartner', callback_data: 'news_gartner' }
            ],
            [
              { text: 'HackerNoon', callback_data: 'news_hackernoon' },
              { text: 'DEV Community', callback_data: 'news_devcommunity' },
              { text: 'Slashdot', callback_data: 'news_slashdot' }
            ],
            [
              { text: 'DZone', callback_data: 'news_dzone' },
              { text: 'Krebs Security', callback_data: 'news_krebssecurity' },
              { text: 'Daring Fireball', callback_data: 'news_daringfireball' }
            ],
            [
              { text: 'Pragmatic Eng', callback_data: 'news_pragmaticeng' },
              { text: 'Netflix Tech', callback_data: 'news_netflixtech' },
              { text: 'Cloudflare Blog', callback_data: 'news_cloudflare' }
            ],
            [
              { text: 'Telegram Gram', callback_data: 'news_telegramgram' }
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

bot.action('news_theinformation', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'The Information', fetchTheInformationNews, 'news_theinformation');
});

bot.action('news_restofworld', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Rest of World', fetchRestOfWorldNews, 'news_restofworld');
});

bot.action('news_fastcompany', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Fast Company', fetchFastCompanyNews, 'news_fastcompany');
});

bot.action('news_mittechreview', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'MIT Technology Review', fetchMITTechReviewNews, 'news_mittechreview');
});

bot.action('news_thenewstack', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'The New Stack', fetchTheNewStackNews, 'news_thenewstack');
});

bot.action('news_hackernews', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Hacker News', fetchHackerNews, 'news_hackernews');
});

bot.action('news_techmeme', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Techmeme', fetchTechmemeNews, 'news_techmeme');
});

bot.action('news_sifted', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Sifted', fetchSiftedNews, 'news_sifted');
});

bot.action('news_techceu', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Tech.eu', fetchTechEuNews, 'news_techceu');
});

bot.action('news_thenextweb', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'The Next Web', fetchTheNextWebNews, 'news_thenextweb');
});

bot.action('news_yourstory', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'YourStory', fetchYourStoryNews, 'news_yourstory');
});

bot.action('news_morningcontext', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'The Morning Context', fetchTheMorningContextNews, 'news_morningcontext');
});

bot.action('news_entrackr', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Entrackr', fetchEntrackrNews, 'news_entrackr');
});

bot.action('news_technode', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'TechNode', fetchTechNodeNews, 'news_technode');
});

bot.action('news_krasia', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'KrASIA', fetchKrASIANews, 'news_krasia');
});

bot.action('news_techcabal', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'TechCabal', fetchTechCabalNews, 'news_techcabal');
});

bot.action('news_disruptafrica', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Disrupt Africa', fetchDisruptAfricaNews, 'news_disruptafrica');
});

bot.action('news_techpointafrica', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Techpoint Africa', fetchTechpointAfricaNews, 'news_techpointafrica');
});

bot.action('news_wamda', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Wamda', fetchWamdaNews, 'news_wamda');
});

bot.action('news_magnitt', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Magnitt', fetchMagnittNews, 'news_magnitt');
});

bot.action('news_smartcompany', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'SmartCompany', fetchSmartCompanyNews, 'news_smartcompany');
});

bot.action('news_startupdaily', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Startup Daily', fetchStartupDailyNews, 'news_startupdaily');
});

bot.action('news_techguide', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Tech Guide', fetchTechGuideNews, 'news_techguide');
});

bot.action('news_gizmodoau', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Gizmodo Australia', fetchGizmodoAustraliaNews, 'news_gizmodoau');
});

bot.action('news_contxto', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Contxto', fetchContxtoNews, 'news_contxto');
});

bot.action('news_startupslatam', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Startups Latam', fetchStartupsLatamNews, 'news_startupslatam');
});

bot.action('news_braziljournal', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Brazil Journal', fetchBrazilJournalNews, 'news_braziljournal');
});

bot.action('news_latamlist', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'LatamList', fetchLatamListNews, 'news_latamlist');
});

bot.action('news_cnet', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'CNET', fetchCNETNews, 'news_cnet');
});

bot.action('news_techradar', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'TechRadar', fetchTechRadarNews, 'news_techradar');
});

bot.action('news_gizmodo', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Gizmodo', fetchGizmodoNews, 'news_gizmodo');
});

bot.action('news_mashable', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Mashable', fetchMashableNews, 'news_mashable');
});

bot.action('news_digitaltrends', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Digital Trends', fetchDigitalTrendsNews, 'news_digitaltrends');
});

bot.action('news_zdnet', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'ZDNET', fetchZDNETNews, 'news_zdnet');
});

bot.action('news_infoworld', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'InfoWorld', fetchInfoWorldNews, 'news_infoworld');
});

bot.action('news_techrepublic', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'TechRepublic', fetchTechRepublicNews, 'news_techrepublic');
});

bot.action('news_gartner', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Gartner', fetchGartnerNews, 'news_gartner');
});

bot.action('news_hackernoon', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'HackerNoon', fetchHackerNoonNews, 'news_hackernoon');
});

bot.action('news_devcommunity', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'DEV Community', fetchDEVCommunityNews, 'news_devcommunity');
});

bot.action('news_slashdot', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Slashdot', fetchSlashdotNews, 'news_slashdot');
});

bot.action('news_dzone', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'DZone', fetchDZoneNews, 'news_dzone');
});

bot.action('news_krebssecurity', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Krebs on Security', fetchKrebsOnSecurityNews, 'news_krebssecurity');
});

bot.action('news_daringfireball', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Daring Fireball', fetchDaringFireballNews, 'news_daringfireball');
});

bot.action('news_pragmaticeng', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'The Pragmatic Engineer', fetchPragmaticEngineerNews, 'news_pragmaticeng');
});

bot.action('news_netflixtech', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Netflix Tech Blog', fetchNetflixTechBlogNews, 'news_netflixtech');
});

bot.action('news_cloudflare', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Cloudflare Blog', fetchCloudflareBlogNews, 'news_cloudflare');
});

bot.action('news_telegramgram', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'Telegram Gram', fetchTelegramGramNews, 'news_telegramgram');
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

  // Translate title and source to Amharic
  const translatedTitle = await translateToAmharic(article.title);
  const translatedSource = await translateToAmharic(article.source);

  const caption = `<b>${translatedTitle}</b>\n\n<a href="${article.link}">${translatedSource}</a>\n\n<b>@true_feed</b>`;

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

    // Translate title and source to Amharic
    const translatedTitle = await translateToAmharic(article.title);
    const translatedSource = await translateToAmharic(article.source);

    const caption = `<b>${translatedTitle}</b>\n\n<a href="${article.link}">${translatedSource}</a>\n\n<b>@true_feed</b>`;

    // Post to channel with image if available
    let posted = false;
    if (article.image) {
      try {
        // Download the image first
        const imageBuffer = await downloadImage(article.image);
        if (imageBuffer) {
          await bot.telegram.sendPhoto(TRUE_FEED_CHANNEL_ID, {
            source: imageBuffer
          }, {
            caption,
            parse_mode: 'HTML',
            disable_web_page_preview: false
          });
          posted = true;
        } else {
          // Fallback to text message if download fails
          await bot.telegram.sendMessage(TRUE_FEED_CHANNEL_ID, caption, {
            parse_mode: 'HTML',
            disable_web_page_preview: false
          });
          posted = true;
        }
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
            [
              { text: 'idea', callback_data: 'new_idea' },
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
              { text: '📰 news', callback_data: 'get_news' }
            ]
          ]
        }
      }
    );
  }
});

module.exports = { bot };
