const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Helper function to fetch image from article page
 */
async function fetchImageFromPage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 5000
    });

    const $ = cheerio.load(response.data);

    // Try different meta tags for featured image
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) return ogImage;

    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    if (twitterImage) return twitterImage;

    // Try to find the main article image
    const articleImg = $('article img').first().attr('src');
    if (articleImg) return articleImg;

    return null;
  } catch (error) {
    console.error('Error fetching image from page:', error.message);
    return null;
  }
}

/**
 * Fetch news from TechCrunch using RSS
 */
async function fetchTechCrunchNews(limit = 5) {
  try {
    const url = 'https://techcrunch.com/feed/';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const articles = [];

    for (const element of $('item').toArray()) {
      if (articles.length >= limit) break;

      const $item = $(element);
      const title = $item.find('title').text().trim();
      const link = $item.find('link').text().trim();
      const description = $item.find('description').text().trim();
      const pubDate = $item.find('pubDate').text().trim();

      if (title && link) {
        // Strip HTML from description
        const excerpt = description.replace(/<[^>]*>/g, '').substring(0, 200);

        // Fetch image from article page
        const image = await fetchImageFromPage(link);

        articles.push({
          title,
          link,
          excerpt: excerpt || 'No excerpt available',
          author: 'TechCrunch',
          time: pubDate || 'Recently',
          source: 'TechCrunch',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching TechCrunch news:', error.message);
    return [];
  }
}

/**
 * Fetch news from The Verge using RSS
 */
async function fetchTheVergeNews(limit = 5) {
  try {
    const url = 'https://www.theverge.com/rss/index.xml';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const articles = [];

    for (const element of $('item').toArray()) {
      if (articles.length >= limit) break;

      const $item = $(element);
      const title = $item.find('title').text().trim();
      const link = $item.find('link').text().trim();
      const description = $item.find('description').text().trim();
      const pubDate = $item.find('pubDate').text().trim();

      if (title && link) {
        // Strip HTML from description
        const excerpt = description.replace(/<[^>]*>/g, '').substring(0, 200);

        // Fetch image from article page
        const image = await fetchImageFromPage(link);

        articles.push({
          title,
          link,
          excerpt: excerpt || 'No excerpt available',
          author: 'The Verge',
          time: pubDate || 'Recently',
          source: 'The Verge',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching The Verge news:', error.message);
    return [];
  }
}

/**
 * Fetch news from BBC Tech using RSS
 */
async function fetchBBCTechNews(limit = 5) {
  try {
    const url = 'https://feeds.bbci.co.uk/news/technology/rss.xml';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const articles = [];

    for (const element of $('item').toArray()) {
      if (articles.length >= limit) break;

      const $item = $(element);
      const title = $item.find('title').text().trim();
      const link = $item.find('link').text().trim();
      const description = $item.find('description').text().trim();
      const pubDate = $item.find('pubDate').text().trim();

      if (title && link) {
        // Strip HTML from description
        const excerpt = description.replace(/<[^>]*>/g, '').substring(0, 200);

        // Fetch image from article page
        const image = await fetchImageFromPage(link);

        articles.push({
          title,
          link,
          excerpt: excerpt || 'No excerpt available',
          author: 'BBC Technology',
          time: pubDate || 'Recently',
          source: 'BBC Tech',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching BBC Tech news:', error.message);
    return [];
  }
}

/**
 * Fetch news from multiple sources
 */
async function fetchNewsFromAllSources(perSource = 3) {
  try {
    const [techCrunch, theVerge, bbcTech] = await Promise.all([
      fetchTechCrunchNews(perSource),
      fetchTheVergeNews(perSource),
      fetchBBCTechNews(perSource)
    ]);

    // Combine sources
    const allNews = [...techCrunch, ...theVerge, ...bbcTech];
    
    return allNews;
  } catch (error) {
    console.error('Error fetching news from all sources:', error.message);
    return [];
  }
}

/**
 * Format news for Telegram
 */
function formatNewsForTelegram(articles) {
  if (!articles || articles.length === 0) {
    return '❌ No news articles found at the moment. Please try again later.';
  }

  let message = '📰 <b>Latest Tech News</b>\n\n';

  articles.forEach((article, index) => {
    message += `<b>${index + 1}. ${article.title}</b>\n`;
    // Make the source name a clickable link to the article
    message += `<a href="${article.link}">${article.source}</a>\n`;
    // Add image URL if available
    if (article.image) {
      message += `🖼️ ${article.image}\n`;
    }
    message += '\n';
  });

  // Add @true_feed in bold at the end
  message += '\n<b>@true_feed</b>';

  return message;
}

module.exports = {
  fetchTechCrunchNews,
  fetchTheVergeNews,
  fetchBBCTechNews,
  fetchNewsFromAllSources,
  formatNewsForTelegram
};
