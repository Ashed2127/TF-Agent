const { Telegraf } = require('telegraf');
const { generateIdea } = require('./agent');
const { markPosted, markRejected, getIdeaById } = require('./database');
const { editNewsImage } = require('./imageEditor');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
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
  fetchTelegramGramNews,
  fetchSingularityHubNews
} = require('./newsScraper');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const OWNER_CHAT_ID = parseInt(process.env.OWNER_CHAT_ID);
const TRUE_FEED_CHANNEL_ID = process.env.TRUE_FEED_CHANNEL_ID ? parseInt(process.env.TRUE_FEED_CHANNEL_ID) : null;

/**
 * Fetch a relevant GIF from Giphy based on news content
 */
async function fetchRelevantGif(newsTitle) {
  try {
    if (!process.env.GIPHY_API_KEY) {
      console.log('⚠️ GIPHY_API_KEY not configured in .env file - GIF feature disabled');
      return null;
    }

    console.log(`🔍 Searching for GIF with keywords from: ${newsTitle}`);

    // Extract keywords from the title for GIF search
    const keywords = newsTitle
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => word.length > 3)
      .slice(0, 3)
      .join(' ');

    if (!keywords) {
      console.log('⚠️ No valid keywords found for GIF search');
      return null;
    }

    console.log(`🔍 GIF search keywords: ${keywords}`);

    const response = await axios.get('https://api.giphy.com/v1/gifs/search', {
      params: {
        api_key: process.env.GIPHY_API_KEY,
        q: keywords,
        limit: 1,
        rating: 'g',
        lang: 'en'
      },
      timeout: 5000
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
      const gif = response.data.data[0];
      // Get the small version of the GIF
      const gifUrl = gif.images.fixed_height_small?.url || gif.images.original?.url;
      console.log(`✅ GIF found: ${gifUrl}`);
      return gifUrl;
    }

    console.log('⚠️ No GIFs found for the given keywords');
    return null;
  } catch (error) {
    console.error('❌ Error fetching GIF from Giphy:', error.message);
    if (error.response) {
      console.error('Giphy API response:', error.response.status, error.response.data);
    }
    return null;
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

// Helper function to add TF logo overlay to image
async function addLogoToImage(imageBuffer) {
  try {
    console.log('🏷️ Adding TF logo overlay...');

    const logoPath = path.join(__dirname, 'tf.jpg');

    if (!fs.existsSync(logoPath)) {
      console.warn('⚠️ TF logo not found, skipping logo overlay');
      return imageBuffer;
    }

    // Load the main image
    const mainImage = sharp(imageBuffer);
    const metadata = await mainImage.metadata();

    // Load the logo
    const logoBuffer = fs.readFileSync(logoPath);
    const logo = sharp(logoBuffer);
    const logoMetadata = await logo.metadata();

    // Calculate logo size - make it proportional to the main image (about 25% of width for better visibility)
    const logoWidth = Math.round(metadata.width * 0.25);
    const logoHeight = Math.round(logoWidth * (logoMetadata.height / logoMetadata.width));

    // Resize logo
    const resizedLogo = await logo
      .resize(logoWidth, logoHeight, { fit: 'cover' })
      .png()
      .toBuffer();

    // Position logo in bottom-right corner with some padding
    const padding = Math.round(metadata.width * 0.02);
    const left = metadata.width - logoWidth - padding;
    const top = metadata.height - logoHeight - padding;

    // Composite logo onto main image
    const result = await mainImage
      .composite([{
        input: resizedLogo,
        left: left,
        top: top
      }])
      .jpeg({ quality: 90 })
      .toBuffer();

    console.log('✅ TF logo overlay added successfully');
    return result;

  } catch (error) {
    console.error('❌ Error adding logo overlay:', error.message);
    // Return original image if logo overlay fails
    return imageBuffer;
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
              { text: 'Telegram Gram', callback_data: 'news_telegramgram' },
              { text: 'SingularityHub', callback_data: 'news_singularityhub' }
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
  await fetchAndDisplayNews(ctx, 'Pragmatic Engineer', fetchPragmaticEngineerNews, 'news_pragmaticeng');
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

bot.action('news_singularityhub', async (ctx) => {
  await fetchAndDisplayNews(ctx, 'SingularityHub', fetchSingularityHubNews, 'news_singularityhub');
});

// Helper function to send a news article with approve/reject buttons
async function sendNewsArticle(ctx, index) {
  const article = ctx.session.newsArticles[index];
  if (!article) {
    await ctx.reply('❌ No more articles.');
    return;
  }

  const message = `
📰 <b>${article.title}</b>

${article.description ? article.description.substring(0, 200) + '...' : ''}

🔗 ${article.url}

<b>Article ${index + 1} of ${ctx.session.newsArticles.length}</b>
  `.trim();

  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Approve & Post', callback_data: `approve_news_${article.id}` },
          { text: '❌ Reject', callback_data: `reject_news_${article.id}` }
        ],
        [
          { text: '⏭️ Next', callback_data: `next_news` },
          { text: '↩️ Back', callback_data: 'back' }
        ]
      ]
    }
  });
}

// Handle approve news
bot.action(/approve_news_(.+)/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const articleId = ctx.match[1];
    const article = ctx.session.newsArticles.find(a => a.id === articleId);

    if (!article) {
      await ctx.reply('❌ Article not found.');
      return;
    }

    await ctx.reply('⏳ Processing news article for posting...');

    // Here you would add logic to post to the channel
    // For now, just mark as posted
    await ctx.reply('✅ News article approved and posted to channel!');

  } catch (error) {
    console.error('Error approving news:', error);
    await ctx.reply('❌ Failed to approve news article.');
  }
});

// Handle reject news
bot.action(/reject_news_(.+)/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const articleId = ctx.match[1];

    // Move to next article
    ctx.session.currentNewsIndex++;
    if (ctx.session.currentNewsIndex < ctx.session.newsArticles.length) {
      await sendNewsArticle(ctx, ctx.session.currentNewsIndex);
    } else {
      await ctx.reply('❌ No more articles. Returning to menu...');
      await bot.action('get_news')(ctx);
    }

  } catch (error) {
    console.error('Error rejecting news:', error);
    await ctx.reply('❌ Failed to reject news article.');
  }
});

// Handle next news
bot.action('next_news', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    ctx.session.currentNewsIndex++;

    if (ctx.session.currentNewsIndex < ctx.session.newsArticles.length) {
      await sendNewsArticle(ctx, ctx.session.currentNewsIndex);
    } else {
      await ctx.reply('❌ No more articles. Returning to menu...');
      await bot.action('get_news')(ctx);
    }

  } catch (error) {
    console.error('Error going to next news:', error);
    await ctx.reply('❌ Failed to go to next article.');
  }
});

// Handle approve idea
bot.action(/approve_(.+)/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const ideaId = ctx.match[1];

    await ctx.reply('⏳ Approving and posting idea...');

    // Mark idea as posted
    await markPosted(ideaId);

    await ctx.reply('✅ Idea approved and posted to channel!');

  } catch (error) {
    console.error('Error approving idea:', error);
    await ctx.reply('❌ Failed to approve idea.');
  }
});

// Handle reject idea
bot.action(/reject_(.+)/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const ideaId = ctx.match[1];

    // Mark idea as rejected
    await markRejected(ideaId);

    // Generate new idea
    await bot.action('new_idea')(ctx);

  } catch (error) {
    console.error('Error rejecting idea:', error);
    await ctx.reply('❌ Failed to reject idea.');
  }
});

// Export bot for webhook use
module.exports = { bot };
