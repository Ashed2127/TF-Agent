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
 * Fetch news from The Information using RSS
 */
async function fetchTheInformationNews(limit = 5) {
  try {
    const url = 'https://theinformation.com/feed';
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
          author: 'The Information',
          time: pubDate || 'Recently',
          source: 'The Information',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching The Information news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Rest of World using RSS
 */
async function fetchRestOfWorldNews(limit = 5) {
  try {
    const url = 'https://restofworld.org/feed/';
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
          author: 'Rest of World',
          time: pubDate || 'Recently',
          source: 'Rest of World',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Rest of World news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Fast Company using RSS
 */
async function fetchFastCompanyNews(limit = 5) {
  try {
    const url = 'https://www.fastcompany.com/feed';
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
          author: 'Fast Company',
          time: pubDate || 'Recently',
          source: 'Fast Company',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Fast Company news:', error.message);
    return [];
  }
}

/**
 * Fetch news from MIT Technology Review using RSS
 */
async function fetchMITTechReviewNews(limit = 5) {
  try {
    const url = 'https://www.technologyreview.com/feed/';
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
          author: 'MIT Technology Review',
          time: pubDate || 'Recently',
          source: 'MIT Technology Review',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching MIT Technology Review news:', error.message);
    return [];
  }
}

/**
 * Fetch news from The New Stack using RSS
 */
async function fetchTheNewStackNews(limit = 5) {
  try {
    const url = 'https://thenewstack.io/feed/';
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
          author: 'The New Stack',
          time: pubDate || 'Recently',
          source: 'The New Stack',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching The New Stack news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Hacker News using RSS
 */
async function fetchHackerNews(limit = 5) {
  try {
    const url = 'https://hnrss.org/frontpage';
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
          author: 'Hacker News',
          time: pubDate || 'Recently',
          source: 'Hacker News',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Hacker News:', error.message);
    return [];
  }
}

/**
 * Fetch news from Techmeme using RSS
 */
async function fetchTechmemeNews(limit = 5) {
  try {
    const url = 'https://www.techmeme.com/feed.xml';
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
          author: 'Techmeme',
          time: pubDate || 'Recently',
          source: 'Techmeme',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Techmeme news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Sifted using RSS
 */
async function fetchSiftedNews(limit = 5) {
  try {
    const url = 'https://sifted.eu/feed';
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
          author: 'Sifted',
          time: pubDate || 'Recently',
          source: 'Sifted',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Sifted news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Tech.eu using RSS
 */
async function fetchTechEuNews(limit = 5) {
  try {
    const url = 'https://tech.eu/feed/';
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
          author: 'Tech.eu',
          time: pubDate || 'Recently',
          source: 'Tech.eu',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Tech.eu news:', error.message);
    return [];
  }
}

/**
 * Fetch news from The Next Web using RSS
 */
async function fetchTheNextWebNews(limit = 5) {
  try {
    const url = 'https://thenextweb.com/feed';
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
          author: 'The Next Web',
          time: pubDate || 'Recently',
          source: 'The Next Web',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching The Next Web news:', error.message);
    return [];
  }
}

/**
 * Fetch news from YourStory using RSS
 */
async function fetchYourStoryNews(limit = 5) {
  try {
    const url = 'https://yourstory.com/feed';
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
          author: 'YourStory',
          time: pubDate || 'Recently',
          source: 'YourStory',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching YourStory news:', error.message);
    return [];
  }
}

/**
 * Fetch news from The Morning Context using RSS
 */
async function fetchTheMorningContextNews(limit = 5) {
  try {
    const url = 'https://themorningcontext.com/feed';
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
          author: 'The Morning Context',
          time: pubDate || 'Recently',
          source: 'The Morning Context',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching The Morning Context news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Entrackr using RSS
 */
async function fetchEntrackrNews(limit = 5) {
  try {
    const url = 'https://entrackr.com/feed';
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
          author: 'Entrackr',
          time: pubDate || 'Recently',
          source: 'Entrackr',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Entrackr news:', error.message);
    return [];
  }
}

/**
 * Fetch news from TechNode using RSS
 */
async function fetchTechNodeNews(limit = 5) {
  try {
    const url = 'https://technode.com/feed';
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
          author: 'TechNode',
          time: pubDate || 'Recently',
          source: 'TechNode',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching TechNode news:', error.message);
    return [];
  }
}

/**
 * Fetch news from KrASIA using RSS
 */
async function fetchKrASIANews(limit = 5) {
  try {
    const url = 'https://kr-asia.com/feed';
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
          author: 'KrASIA',
          time: pubDate || 'Recently',
          source: 'KrASIA',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching KrASIA news:', error.message);
    return [];
  }
}

/**
 * Fetch news from TechCabal using RSS
 */
async function fetchTechCabalNews(limit = 5) {
  try {
    const url = 'https://techcabal.com/feed';
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
          author: 'TechCabal',
          time: pubDate || 'Recently',
          source: 'TechCabal',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching TechCabal news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Disrupt Africa using RSS
 */
async function fetchDisruptAfricaNews(limit = 5) {
  try {
    const url = 'https://disrupt-africa.com/feed';
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
          author: 'Disrupt Africa',
          time: pubDate || 'Recently',
          source: 'Disrupt Africa',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Disrupt Africa news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Techpoint Africa using RSS
 */
async function fetchTechpointAfricaNews(limit = 5) {
  try {
    const url = 'https://techpoint.africa/feed';
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
          author: 'Techpoint Africa',
          time: pubDate || 'Recently',
          source: 'Techpoint Africa',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Techpoint Africa news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Wamda using RSS
 */
async function fetchWamdaNews(limit = 5) {
  try {
    const url = 'https://www.wamda.com/feed';
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
          author: 'Wamda',
          time: pubDate || 'Recently',
          source: 'Wamda',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Wamda news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Magnitt using RSS
 */
async function fetchMagnittNews(limit = 5) {
  try {
    const url = 'https://magnitt.com/feed';
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
          author: 'Magnitt',
          time: pubDate || 'Recently',
          source: 'Magnitt',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Magnitt news:', error.message);
    return [];
  }
}

/**
 * Fetch news from SmartCompany using RSS
 */
async function fetchSmartCompanyNews(limit = 5) {
  try {
    const url = 'https://www.smartcompany.com.au/feed';
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
          author: 'SmartCompany',
          time: pubDate || 'Recently',
          source: 'SmartCompany',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching SmartCompany news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Startup Daily using RSS
 */
async function fetchStartupDailyNews(limit = 5) {
  try {
    const url = 'https://startupdaily.net/feed';
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
          author: 'Startup Daily',
          time: pubDate || 'Recently',
          source: 'Startup Daily',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Startup Daily news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Tech Guide using RSS
 */
async function fetchTechGuideNews(limit = 5) {
  try {
    const url = 'https://www.techguide.com.au/feed';
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
          author: 'Tech Guide',
          time: pubDate || 'Recently',
          source: 'Tech Guide',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Tech Guide news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Gizmodo Australia using RSS
 */
async function fetchGizmodoAustraliaNews(limit = 5) {
  try {
    const url = 'https://www.gizmodo.com.au/feed';
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
          author: 'Gizmodo Australia',
          time: pubDate || 'Recently',
          source: 'Gizmodo Australia',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Gizmodo Australia news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Contxto using RSS
 */
async function fetchContxtoNews(limit = 5) {
  try {
    const url = 'https://contxto.com/feed';
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
          author: 'Contxto',
          time: pubDate || 'Recently',
          source: 'Contxto',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Contxto news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Startups Latam using RSS
 */
async function fetchStartupsLatamNews(limit = 5) {
  try {
    const url = 'https://startupslatam.com/feed';
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
          author: 'Startups Latam',
          time: pubDate || 'Recently',
          source: 'Startups Latam',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Startups Latam news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Brazil Journal using RSS
 */
async function fetchBrazilJournalNews(limit = 5) {
  try {
    const url = 'https://braziljournal.com/feed';
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
          author: 'Brazil Journal',
          time: pubDate || 'Recently',
          source: 'Brazil Journal',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Brazil Journal news:', error.message);
    return [];
  }
}

/**
 * Fetch news from LatamList using RSS
 */
async function fetchLatamListNews(limit = 5) {
  try {
    const url = 'https://latamlist.com/feed';
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
          author: 'LatamList',
          time: pubDate || 'Recently',
          source: 'LatamList',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching LatamList news:', error.message);
    return [];
  }
}

/**
 * Fetch news from CNET using RSS
 */
async function fetchCNETNews(limit = 5) {
  try {
    const url = 'https://www.cnet.com/rss/all/';
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
          author: 'CNET',
          time: pubDate || 'Recently',
          source: 'CNET',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching CNET news:', error.message);
    return [];
  }
}

/**
 * Fetch news from TechRadar using RSS
 */
async function fetchTechRadarNews(limit = 5) {
  try {
    const url = 'https://www.techradar.com/feeds.xml';
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
          author: 'TechRadar',
          time: pubDate || 'Recently',
          source: 'TechRadar',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching TechRadar news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Gizmodo using RSS
 */
async function fetchGizmodoNews(limit = 5) {
  try {
    const url = 'https://gizmodo.com/feed';
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
          author: 'Gizmodo',
          time: pubDate || 'Recently',
          source: 'Gizmodo',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Gizmodo news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Mashable using RSS
 */
async function fetchMashableNews(limit = 5) {
  try {
    const url = 'https://mashable.com/feeds/rss/all';
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
          author: 'Mashable',
          time: pubDate || 'Recently',
          source: 'Mashable',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Mashable news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Digital Trends using RSS
 */
async function fetchDigitalTrendsNews(limit = 5) {
  try {
    const url = 'https://www.digitaltrends.com/feed/';
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
          author: 'Digital Trends',
          time: pubDate || 'Recently',
          source: 'Digital Trends',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Digital Trends news:', error.message);
    return [];
  }
}

/**
 * Fetch news from ZDNET using RSS
 */
async function fetchZDNETNews(limit = 5) {
  try {
    const url = 'https://www.zdnet.com/news/rss.xml';
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
          author: 'ZDNET',
          time: pubDate || 'Recently',
          source: 'ZDNET',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching ZDNET news:', error.message);
    return [];
  }
}

/**
 * Fetch news from InfoWorld using RSS
 */
async function fetchInfoWorldNews(limit = 5) {
  try {
    const url = 'https://www.infoworld.com/feed/';
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
          author: 'InfoWorld',
          time: pubDate || 'Recently',
          source: 'InfoWorld',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching InfoWorld news:', error.message);
    return [];
  }
}

/**
 * Fetch news from TechRepublic using RSS
 */
async function fetchTechRepublicNews(limit = 5) {
  try {
    const url = 'https://www.techrepublic.com/rssfeeds/articles/';
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
          author: 'TechRepublic',
          time: pubDate || 'Recently',
          source: 'TechRepublic',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching TechRepublic news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Gartner using RSS
 */
async function fetchGartnerNews(limit = 5) {
  try {
    const url = 'http://www.gartner.com/newsroom/rss';
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
          author: 'Gartner',
          time: pubDate || 'Recently',
          source: 'Gartner',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Gartner news:', error.message);
    return [];
  }
}

/**
 * Fetch news from HackerNoon using RSS
 */
async function fetchHackerNoonNews(limit = 5) {
  try {
    const url = 'https://hackernoon.com/feed';
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
          author: 'HackerNoon',
          time: pubDate || 'Recently',
          source: 'HackerNoon',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching HackerNoon news:', error.message);
    return [];
  }
}

/**
 * Fetch news from DEV Community using RSS
 */
async function fetchDEVCommunityNews(limit = 5) {
  try {
    const url = 'https://dev.to/feed';
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
          author: 'DEV Community',
          time: pubDate || 'Recently',
          source: 'DEV Community',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching DEV Community news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Slashdot using RSS
 */
async function fetchSlashdotNews(limit = 5) {
  try {
    const url = 'https://rss.slashdot.org/Slashdot/slashdotMain';
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
          author: 'Slashdot',
          time: pubDate || 'Recently',
          source: 'Slashdot',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Slashdot news:', error.message);
    return [];
  }
}

/**
 * Fetch news from DZone using RSS
 */
async function fetchDZoneNews(limit = 5) {
  try {
    const url = 'https://feeds.dzone.com/home';
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
          author: 'DZone',
          time: pubDate || 'Recently',
          source: 'DZone',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching DZone news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Krebs on Security using RSS
 */
async function fetchKrebsOnSecurityNews(limit = 5) {
  try {
    const url = 'https://krebsonsecurity.com/feed/';
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
          author: 'Krebs on Security',
          time: pubDate || 'Recently',
          source: 'Krebs on Security',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Krebs on Security news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Daring Fireball using RSS
 */
async function fetchDaringFireballNews(limit = 5) {
  try {
    const url = 'https://daringfireball.net/feeds/main';
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
          author: 'Daring Fireball',
          time: pubDate || 'Recently',
          source: 'Daring Fireball',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Daring Fireball news:', error.message);
    return [];
  }
}

/**
 * Fetch news from The Pragmatic Engineer using RSS
 */
async function fetchPragmaticEngineerNews(limit = 5) {
  try {
    const url = 'https://blog.pragmaticengineer.com/rss/';
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
          author: 'The Pragmatic Engineer',
          time: pubDate || 'Recently',
          source: 'The Pragmatic Engineer',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching The Pragmatic Engineer news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Netflix Tech Blog using RSS
 */
async function fetchNetflixTechBlogNews(limit = 5) {
  try {
    const url = 'https://netflixtechblog.com/feed';
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
          author: 'Netflix Tech Blog',
          time: pubDate || 'Recently',
          source: 'Netflix Tech Blog',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Netflix Tech Blog news:', error.message);
    return [];
  }
}

/**
 * Fetch news from Cloudflare Blog using RSS
 */
async function fetchCloudflareBlogNews(limit = 5) {
  try {
    const url = 'https://blog.cloudflare.com/rss/';
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
          author: 'Cloudflare Blog',
          time: pubDate || 'Recently',
          source: 'Cloudflare Blog',
          image
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('Error fetching Cloudflare Blog news:', error.message);
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
      fetchArsTechnicaNews(perSource),
      fetchTheInformationNews(perSource),
      fetchRestOfWorldNews(perSource),
      fetchFastCompanyNews(perSource),
      fetchMITTechReviewNews(perSource),
      fetchTheNewStackNews(perSource),
      fetchHackerNews(perSource),
      fetchTechmemeNews(perSource),
      fetchSiftedNews(perSource),
      fetchTechEuNews(perSource),
      fetchTheNextWebNews(perSource),
      fetchYourStoryNews(perSource),
      fetchTheMorningContextNews(perSource),
      fetchEntrackrNews(perSource),
      fetchTechNodeNews(perSource),
      fetchKrASIANews(perSource),
      fetchTechCabalNews(perSource),
      fetchDisruptAfricaNews(perSource),
      fetchTechpointAfricaNews(perSource),
      fetchWamdaNews(perSource),
      fetchMagnittNews(perSource),
      fetchSmartCompanyNews(perSource),
      fetchStartupDailyNews(perSource),
      fetchTechGuideNews(perSource),
      fetchGizmodoAustraliaNews(perSource),
      fetchContxtoNews(perSource),
      fetchStartupsLatamNews(perSource),
      fetchBrazilJournalNews(perSource),
      fetchLatamListNews(perSource),
      fetchCNETNews(perSource),
      fetchTechRadarNews(perSource),
      fetchGizmodoNews(perSource),
      fetchMashableNews(perSource),
      fetchDigitalTrendsNews(perSource),
      fetchZDNETNews(perSource),
      fetchInfoWorldNews(perSource),
      fetchTechRepublicNews(perSource),
      fetchGartnerNews(perSource),
      fetchHackerNoonNews(perSource),
      fetchDEVCommunityNews(perSource),
      fetchSlashdotNews(perSource),
      fetchDZoneNews(perSource),
      fetchKrebsOnSecurityNews(perSource),
      fetchDaringFireballNews(perSource),
      fetchPragmaticEngineerNews(perSource),
      fetchNetflixTechBlogNews(perSource),
      fetchCloudflareBlogNews(perSource)
    ]);

    // Extract successful results
    const [
      techCrunch,
      theVerge,
      bbcTech,
      wired,
      ventureBeat,
      engadget,
      arsTechnica,
      theInformation,
      restOfWorld,
      fastCompany,
      mitTechReview,
      theNewStack,
      hackerNews,
      techmeme,
      sifted,
      techEu,
      theNextWeb,
      yourStory,
      theMorningContext,
      entrackr,
      techNode,
      krASIA,
      techCabal,
      disruptAfrica,
      techpointAfrica,
      wamda,
      magnitt,
      smartCompany,
      startupDaily,
      techGuide,
      gizmodoAustralia,
      contxto,
      startupsLatam,
      brazilJournal,
      latamList,
      cnet,
      techRadar,
      gizmodo,
      mashable,
      digitalTrends,
      zdnet,
      infoWorld,
      techRepublic,
      gartner,
      hackerNoon,
      devCommunity,
      slashdot,
      dzone,
      krebsOnSecurity,
      daringFireball,
      pragmaticEngineer,
      netflixTechBlog,
      cloudflareBlog
    ] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const sources = [
          'TechCrunch', 'The Verge', 'BBC Tech', 'Wired', 'VentureBeat',
          'Engadget', 'Ars Technica', 'The Information', 'Rest of World',
          'Fast Company', 'MIT Technology Review', 'The New Stack',
          'Hacker News', 'Techmeme', 'Sifted', 'Tech.eu', 'The Next Web',
          'YourStory', 'The Morning Context', 'Entrackr', 'TechNode',
          'KrASIA', 'TechCabal', 'Disrupt Africa', 'Techpoint Africa',
          'Wamda', 'Magnitt', 'SmartCompany', 'Startup Daily', 'Tech Guide',
          'Gizmodo Australia', 'Contxto', 'Startups Latam', 'Brazil Journal',
          'LatamList', 'CNET', 'TechRadar', 'Gizmodo', 'Mashable',
          'Digital Trends', 'ZDNET', 'InfoWorld', 'TechRepublic', 'Gartner',
          'HackerNoon', 'DEV Community', 'Slashdot', 'DZone',
          'Krebs on Security', 'Daring Fireball', 'The Pragmatic Engineer',
          'Netflix Tech Blog', 'Cloudflare Blog'
        ];
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
      ...arsTechnica,
      ...theInformation,
      ...restOfWorld,
      ...fastCompany,
      ...mitTechReview,
      ...theNewStack,
      ...hackerNews,
      ...techmeme,
      ...sifted,
      ...techEu,
      ...theNextWeb,
      ...yourStory,
      ...theMorningContext,
      ...entrackr,
      ...techNode,
      ...krASIA,
      ...techCabal,
      ...disruptAfrica,
      ...techpointAfrica,
      ...wamda,
      ...magnitt,
      ...smartCompany,
      ...startupDaily,
      ...techGuide,
      ...gizmodoAustralia,
      ...contxto,
      ...startupsLatam,
      ...brazilJournal,
      ...latamList,
      ...cnet,
      ...techRadar,
      ...gizmodo,
      ...mashable,
      ...digitalTrends,
      ...zdnet,
      ...infoWorld,
      ...techRepublic,
      ...gartner,
      ...hackerNoon,
      ...devCommunity,
      ...slashdot,
      ...dzone,
      ...krebsOnSecurity,
      ...daringFireball,
      ...pragmaticEngineer,
      ...netflixTechBlog,
      ...cloudflareBlog
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
  fetchNewsFromAllSources,
  formatNewsForTelegram
};
