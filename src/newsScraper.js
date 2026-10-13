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
 * Score article based on impressiveness and usefulness
 */
function scoreArticle(article) {
  let score = 0;
  const title = article.title.toLowerCase();
  const excerpt = (article.excerpt || '').toLowerCase();

  // Keywords that indicate impressive/useful news
  const impressiveKeywords = [
    'breakthrough', 'revolutionary', 'first-ever', 'record', 'unprecedented',
    'launch', 'release', 'announces', 'reveals', 'unveils', 'introduces',
    'raises', 'funding', 'investment', 'acquisition', 'merger', 'ipo',
    'billion', 'million', 'startup', 'ai', 'artificial intelligence',
    'quantum', 'robot', 'autonomous', 'innovative', 'disrupt'
  ];

  const usefulKeywords = [
    'guide', 'how-to', 'tutorial', 'tips', 'best', 'top', 'review',
    'analysis', 'explained', 'understand', 'learn', 'master',
    'productivity', 'efficiency', 'optimization', 'security', 'privacy'
  ];

  // Count impressive keywords
  impressiveKeywords.forEach(keyword => {
    if (title.includes(keyword) || excerpt.includes(keyword)) {
      score += 2;
    }
  });

  // Count useful keywords
  usefulKeywords.forEach(keyword => {
    if (title.includes(keyword) || excerpt.includes(keyword)) {
      score += 1;
    }
  });

  // Bonus for having an image
  if (article.image) {
    score += 1;
  }

  // Bonus for recent news (check publication date if available)
  if (article.time && article.time.includes('2026')) {
    score += 1;
  }

  return score;
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
 * Fetch news from Wired using RSS
 */
async function fetchWiredNews(limit = 5) {
  try {
    const url = 'https://www.wired.com/feed/rss';
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
        const excerpt = description.replace(/<[^>]*>/g, '').substring(0, 200);
        const image = await fetchImageFromPage(link);

        articles.push({
          title,
          link,
          excerpt: excerpt || 'No excerpt available',
          author: 'Wired',
          time: pubDate || 'Recently',
          source: 'Wired',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Wired news:', error.message);
    return [];
  }
}

/**
 * Fetch news from VentureBeat using RSS
 */
async function fetchVentureBeatNews(limit = 5) {
  try {
    const url = 'https://venturebeat.com/feed/';
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
        const excerpt = description.replace(/<[^>]*>/g, '').substring(0, 200);
        const image = await fetchImageFromPage(link);

        articles.push({
          title,
          link,
          excerpt: excerpt || 'No excerpt available',
          author: 'VentureBeat',
          time: pubDate || 'Recently',
          source: 'VentureBeat',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching VentureBeat news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Engadget using RSS
 */
async function fetchEngadgetNews(limit = 5) {
  try {
    const url = 'https://www.engadget.com/rss.xml';
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
        const excerpt = description.replace(/<[^>]*>/g, '').substring(0, 200);
        const image = await fetchImageFromPage(link);

        articles.push({
          title,
          link,
          excerpt: excerpt || 'No excerpt available',
          author: 'Engadget',
          time: pubDate || 'Recently',
          source: 'Engadget',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Engadget news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Ars Technica using RSS
 */
async function fetchArsTechnicaNews(limit = 5) {
  try {
    const url = 'https://feeds.arstechnica.com/arstechnica/index';
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
        const excerpt = description.replace(/<[^>]*>/g, '').substring(0, 200);
        const image = await fetchImageFromPage(link);

        articles.push({
          title,
          link,
          excerpt: excerpt || 'No excerpt available',
          author: 'Ars Technica',
          time: pubDate || 'Recently',
          source: 'Ars Technica',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Ars Technica news:', error.message);
    return [];
  }
}

/**
 * Fetch news from multiple sources
 */
async function fetchNewsFromAllSources(perSource = 3) {
  try {
    const results = await Promise.allSettled([
      fetchTechCrunchNews(perSource),
      fetchTheVergeNews(perSource),
      fetchBBCTechNews(perSource),
      fetchWiredNews(perSource),
      fetchVentureBeatNews(perSource),
      fetchEngadgetNews(perSource),
      fetchArsTechnicaNews(perSource)
    ]);

    // Extract successful results
    const [techCrunch, theVerge, bbcTech, wired, ventureBeat, engadget, arsTechnica] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const sources = ['TechCrunch', 'The Verge', 'BBC Tech', 'Wired', 'VentureBeat', 'Engadget', 'Ars Technica'];
        console.error(`Failed to fetch from ${sources[index]}:`, result.reason.message);
        return [];
      }
    });

    // Combine all sources
    const allNews = [
      ...techCrunch,
      ...theVerge,
      ...bbcTech,
      ...wired,
      ...ventureBeat,
      ...engadget,
      ...arsTechnica
    ];

    if (allNews.length === 0) {
      console.error('No articles fetched from any source');
      return [];
    }

    // Score each article based on impressiveness and usefulness
    const scoredNews = allNews.map(article => ({
      ...article,
      score: scoreArticle(article)
    }));

    // Sort by score (highest first) and return top 10
    const topNews = scoredNews
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ score, ...article }) => article); // Remove score from final output

    return topNews;
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
  fetchWiredNews,
  fetchVentureBeatNews,
  fetchEngadgetNews,
  fetchArsTechnicaNews,
  fetchNewsFromAllSources,
  formatNewsForTelegram
};
