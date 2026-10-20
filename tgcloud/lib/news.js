import { fetch } from 'sdk';
import { OPENROUTER_API_KEY } from './secrets.js';
import { getCustomSources } from './database.js';

/**
 * Scrape main image from article page
 */
async function scrapeImageFromPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      return '';
    }
    
    const html = await response.text();
    
    // Try to find og:image (Open Graph image)
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogImageMatch) {
      let imageUrl = ogImageMatch[1].trim();
      // Decode HTML entities
      imageUrl = imageUrl.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      return imageUrl;
    }
    
    // Try to find twitter:image
    const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
    if (twitterImageMatch) {
      let imageUrl = twitterImageMatch[1].trim();
      imageUrl = imageUrl.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      return imageUrl;
    }
    
    // Try to find the first large image in the content
    const imgMatch = html.match(/<img[^>]*src=["']([^"']*\.(?:jpg|jpeg|png|webp))["'][^>]*(?:width=["']\d{3,}["']|class=["'][^"']*(?:featured|hero|main|thumbnail)[^"']*["'])/i);
    if (imgMatch) {
      let imageUrl = imgMatch[1].trim();
      imageUrl = imageUrl.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      return imageUrl;
    }
    
    // Fallback: first image with reasonable size
    const fallbackImgMatch = html.match(/<img[^>]*src=["']([^"']*\.(?:jpg|jpeg|png|webp))["'][^>]*>/i);
    if (fallbackImgMatch) {
      let imageUrl = fallbackImgMatch[1].trim();
      imageUrl = imageUrl.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      return imageUrl;
    }
    
    return '';
  } catch (error) {
    console.error('Error scraping image from page:', error.message);
    return '';
  }
}

/**
 * Scrape full article text from webpage to provide rich context to AI
 */
export async function scrapeArticleBody(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return '';
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) return '';
    const html = await response.text();

    // Strip script, style, nav, footer, header, noscript
    let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    clean = clean.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ');
    clean = clean.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ');
    clean = clean.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ');

    // Extract all <p> paragraphs
    const paragraphs = [];
    const pMatches = clean.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    for (const match of pMatches) {
      let pText = match[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pText.length > 50 &&
          !pText.toLowerCase().includes('cookie') &&
          !pText.toLowerCase().includes('subscribe to our') &&
          !pText.toLowerCase().includes('sign up for') &&
          !pText.toLowerCase().includes('all rights reserved')) {
        paragraphs.push(pText);
      }
    }

    return paragraphs.slice(0, 5).join('\n\n');
  } catch (error) {
    console.error('Error scraping article body:', error.message);
    return '';
  }
}

/**
 * Top News Categories
 */
export const NEWS_CATEGORIES = [
  { id: 'tech', name: '💻 Tech & AI', description: 'AI, software, computing & gadgets' },
  { id: 'business', name: '📈 Business & Finance', description: 'Markets, economy, banking & commerce' },
  { id: 'world', name: '🌍 World News', description: 'Global headlines & international events' },
  { id: 'startups', name: '🚀 Startups & Africa', description: 'African tech, VC funding & innovation' },
  { id: 'science', name: '🔬 Science & Space', description: 'Science breakthroughs, health & space' },
  { id: 'education', name: '📚 Education', description: 'Learning, schools, universities & skills' },
  { id: 'crypto', name: '🪙 Crypto & Web3', description: 'Bitcoin, Ethereum, DeFi & blockchain' },
  { id: 'entertainment', name: '🎬 Entertainment', description: 'Movies, gaming, music & culture' },
  { id: 'sports', name: '⚽ Sports', description: 'Global football, athletics & tournaments' }
];

/**
 * News platforms configuration mapped by category
 */
export const NEWS_PLATFORMS = [
  // Tech & AI
  { id: 'techcrunch', name: 'TechCrunch', category: 'tech', url: 'https://techcrunch.com/feed/' },
  { id: 'theverge', name: 'The Verge', category: 'tech', url: 'https://www.theverge.com/rss/index.xml' },
  { id: 'wired', name: 'WIRED', category: 'tech', url: 'https://www.wired.com/feed/rss' },
  { id: 'arstechnica', name: 'Ars Technica', category: 'tech', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { id: 'venturebeat', name: 'VentureBeat', category: 'tech', url: 'https://venturebeat.com/feed/' },
  { id: 'hackernews', name: 'Hacker News', category: 'tech', url: 'https://news.ycombinator.com/rss' },
  { id: 'engadget', name: 'Engadget', category: 'tech', url: 'https://www.engadget.com/rss.xml' },
  { id: 'zdnet', name: 'ZDNet', category: 'tech', url: 'https://www.zdnet.com/news/rss.xml' },

  // Business & Finance
  { id: 'bloomberg', name: 'Bloomberg Tech', category: 'business', url: 'https://www.bloomberg.com/feeds/technology/news.rss' },
  { id: 'cnbc', name: 'CNBC Business', category: 'business', url: 'https://search.cnbc.com/rs/search/view.html?partnerId=2000&keywords=business&sort=date' },
  { id: 'inc42', name: 'Inc42', category: 'business', url: 'https://inc42.com/feed/' },
  { id: 'yourstory', name: 'YourStory', category: 'business', url: 'https://yourstory.com/feed' },
  { id: 'marketwatch', name: 'MarketWatch', category: 'business', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },

  // World News
  { id: 'bbcworld', name: 'BBC World News', category: 'world', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'aljazeera', name: 'Al Jazeera', category: 'world', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'theguardian', name: 'The Guardian', category: 'world', url: 'https://www.theguardian.com/world/rss' },
  { id: 'africanews', name: 'Africanews', category: 'world', url: 'https://www.africanews.com/feed/' },
  { id: 'dw', name: 'DW News', category: 'world', url: 'https://rss.dw.com/rdf/rss-en-all' },

  // Startups & Africa
  { id: 'techcabal', name: 'TechCabal', category: 'startups', url: 'https://techcabal.com/feed/' },
  { id: 'disruptafrica', name: 'Disrupt Africa', category: 'startups', url: 'https://disrupt-africa.com/feed/' },
  { id: 'techinafrica', name: 'Tech In Africa', category: 'startups', url: 'https://techinafrica.com/feed' },
  { id: 'restofworld', name: 'Rest of World', category: 'startups', url: 'https://restofworld.org/feed/latest/' },
  { id: 'producthunt', name: 'Product Hunt', category: 'startups', url: 'https://www.producthunt.com/feed' },
  { id: 'entrackr', name: 'Entrackr', category: 'startups', url: 'https://entrackr.com/rss' },

  // Science & Space
  { id: 'sciencedaily', name: 'ScienceDaily', category: 'science', url: 'https://www.sciencedaily.com/rss/all.xml' },
  { id: 'physorg', name: 'Phys.org', category: 'science', url: 'https://phys.org/rss-feed/' },
  { id: 'spacecom', name: 'Space.com', category: 'science', url: 'https://www.space.com/feeds/all' },
  { id: 'nature', name: 'Nature News', category: 'science', url: 'https://www.nature.com/nature.rss' },

  // Education
  { id: 'educationweek', name: 'Education Week', category: 'education', url: 'https://www.edweek.org/feed' },
  { id: 'chronicle', name: 'The Chronicle', category: 'education', url: 'https://www.chronicle.com/rss' },
  { id: 'insidehighered', name: 'Inside Higher Ed', category: 'education', url: 'https://www.insidehighered.com/rss.xml' },
  { id: 'edsurge', name: 'EdSurge', category: 'education', url: 'https://www.edsurge.com/rss' },

  // Crypto & Web3
  { id: 'coindesk', name: 'CoinDesk', category: 'crypto', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { id: 'cointelegraph', name: 'Cointelegraph', category: 'crypto', url: 'https://cointelegraph.com/rss' },
  { id: 'decrypt', name: 'Decrypt', category: 'crypto', url: 'https://decrypt.co/feed' },

  // Entertainment
  { id: 'variety', name: 'Variety', category: 'entertainment', url: 'https://variety.com/feed/' },
  { id: 'hollywoodreporter', name: 'Hollywood Reporter', category: 'entertainment', url: 'https://www.hollywoodreporter.com/feed/' },
  { id: 'rollingstone', name: 'Rolling Stone', category: 'entertainment', url: 'https://www.rollingstone.com/feed/' },
  { id: 'ign', name: 'IGN', category: 'entertainment', url: 'https://feeds.feedburner.com/ign/news' },

  // Sports
  { id: 'espn', name: 'ESPN', category: 'sports', url: 'https://www.espn.com/espn/rss/news' },
  { id: 'bbcsport', name: 'BBC Sport', category: 'sports', url: 'https://feeds.bbci.co.uk/sport/rss.xml' }
];

/**
 * Simple RSS/Atom feed parser (no external libraries)
 */
function parseRSS(xmlString) {
  const items = [];
  
  try {
    // Check if it's Atom format (The Verge uses this)
    const isAtom = xmlString.includes('<entry>');
    
    if (isAtom) {
      // Parse Atom format
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
      let match;
      
      while ((match = entryRegex.exec(xmlString)) !== null) {
        const entryContent = match[1];
        
        // Extract title (handle CDATA and HTML)
        const titleMatch = entryContent.match(/<title[^>]*><!\[CDATA\[([^\]]*)\]\]><\/title>/i) ||
                           entryContent.match(/<title[^>]*>([^<]*)<\/title>/i) ||
                           entryContent.match(/<title[^>]*type="html"[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i);
        let title = titleMatch ? titleMatch[1].trim() : '';
        
        // Decode HTML entities in title
        if (title) {
          title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#8217;/g, "'").replace(/&#8230;/g, '...');
        }
        
        // Extract link (Atom uses different format)
        const linkMatch = entryContent.match(/<link[^>]*href="([^"]*)"[^>]*>/i);
        const link = linkMatch ? linkMatch[1].trim() : '';
        
        // Extract content (Atom uses <content> instead of <description>)
        const contentMatch = entryContent.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
        const content = contentMatch ? contentMatch[1].trim() : '';
        
        // Extract image from various sources
        let image = '';
        
        // Try media:content with url attribute
        const mediaContentMatch = entryContent.match(/<media:content[^>]*url="([^"]*)"[^>]*>/i);
        if (mediaContentMatch) {
          image = mediaContentMatch[1].trim();
        }
        
        // Try media:thumbnail
        if (!image) {
          const thumbMatch = entryContent.match(/<media:thumbnail[^>]*url="([^"]*)"[^>]*>/i);
          image = thumbMatch ? thumbMatch[1].trim() : '';
        }
        
        // Try to extract image from content HTML (only if it's a direct image URL, not embedded in complex HTML)
        if (!image && content) {
          const imgMatch = content.match(/<img[^>]*src="([^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/i);
          image = imgMatch ? imgMatch[1].trim() : '';
        }
        
        // Decode HTML entities in image URL
        if (image) {
          image = image.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        }
        
        // Extract published date
        const dateMatch = entryContent.match(/<published>([^<]*)<\/published>/i) ||
                          entryContent.match(/<updated>([^<]*)<\/updated>/i);
        const pubDate = dateMatch ? dateMatch[1].trim() : '';
        
        if (title && link) {
          items.push({
            title,
            link,
            image,
            description: content,
            time: pubDate || 'Recently'
          });
        }
      }
    } else {
      // Parse RSS 2.0 format
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;
      
      while ((match = itemRegex.exec(xmlString)) !== null) {
        const itemContent = match[1];
        
        // Extract title (handle CDATA)
        const titleMatch = itemContent.match(/<title><!\[CDATA\[([^\]]*)\]\]><\/title>/i) ||
                           itemContent.match(/<title>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        // Extract link
        const linkMatch = itemContent.match(/<link>([^<]*)<\/link>/i);
        const link = linkMatch ? linkMatch[1].trim() : '';
        
        // Extract description (handle CDATA)
        const descMatch = itemContent.match(/<description><!\[CDATA\[([^\]]*)\]\]><\/description>/i) ||
                          itemContent.match(/<description>([^<]*)<\/description>/i);
        const description = descMatch ? descMatch[1].trim() : '';
        
        // Extract image from various media tags
        let image = '';
        
        // Try media:content with url attribute
        const mediaContentMatch = itemContent.match(/<media:content[^>]*url="([^"]*)"[^>]*>/i);
        if (mediaContentMatch) {
          image = mediaContentMatch[1].trim();
        }
        
        // Try enclosure
        if (!image) {
          const enclosureMatch = itemContent.match(/<enclosure[^>]*url="([^"]*)"[^>]*>/i);
          image = enclosureMatch ? enclosureMatch[1].trim() : '';
        }
        
        // Try media:thumbnail
        if (!image) {
          const thumbMatch = itemContent.match(/<media:thumbnail[^>]*url="([^"]*)"[^>]*>/i);
          image = thumbMatch ? thumbMatch[1].trim() : '';
        }
        
        // Try to extract image from description HTML (only direct image URLs)
        if (!image && description) {
          const imgMatch = description.match(/<img[^>]*src="([^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/i);
          image = imgMatch ? imgMatch[1].trim() : '';
        }
        
        // Try to extract from content:encoded (only direct image URLs)
        if (!image) {
          const contentMatch = itemContent.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i);
          if (contentMatch) {
            const contentImgMatch = contentMatch[1].match(/<img[^>]*src="([^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/i);
            image = contentImgMatch ? contentImgMatch[1].trim() : '';
          }
        }
        
        // Decode HTML entities in image URL
        if (image) {
          image = image.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        }
        
        // Extract pubDate
        const dateMatch = itemContent.match(/<pubDate>([^<]*)<\/pubDate>/i);
        const pubDate = dateMatch ? dateMatch[1].trim() : '';
        
        if (title && link) {
          items.push({
            title,
            link,
            image,
            description,
            time: pubDate || 'Recently'
          });
        }
      }
    }
  } catch (error) {
    console.error('Error parsing RSS:', error.message);
  }
  
  return items;
}

/**
 * Fetch news from a single RSS feed
 */
export async function fetchRSSFeed(url, platformName) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${platformName}: ${response.status}`);
      return [];
    }
    
    const xmlText = await response.text();
    const items = parseRSS(xmlText);
    
    // Scrape images for articles that don't have them
    const itemsWithImages = await Promise.all(
      items.map(async (item) => {
        if (!item.image && item.link) {
          console.log(`Scraping image for: ${item.title.substring(0, 40)}...`);
          const scrapedImage = await scrapeImageFromPage(item.link);
          if (scrapedImage) {
            console.log(`Found image for: ${item.title.substring(0, 40)}...`);
            return { ...item, image: scrapedImage };
          }
        }
        return item;
      })
    );
    
    // Add platform name
    return itemsWithImages.map(item => ({
      ...item,
      platform: platformName
    }));
    
  } catch (error) {
    console.error(`Error fetching ${platformName}:`, error.message);
    return [];
  }
}

/**
 * Get platform by ID
 */
export function getPlatformById(platformId) {
  return NEWS_PLATFORMS.find(p => p.id === platformId);
}

/**
 * Generate Amharic news content using AI
 */
async function generateAmharicNews(article, userChannelLink = null, botDisplayName = null, showSourceLink = true, useDotPunctuation = false) {
  try {
    // Scrape live webpage for full context
    let articleContext = article.description
      ? article.description.replace(/<[^>]*>/g, '').trim().substring(0, 500)
      : '';

    if (article.link) {
      console.log(`Scraping webpage text from: ${article.link}...`);
      const scrapedText = await scrapeArticleBody(article.link);
      if (scrapedText && scrapedText.length > 50) {
        articleContext = scrapedText.substring(0, 1800);
      }
    }

    if (!articleContext) {
      articleContext = article.title;
    }

    // Build the source line with user channel link if provided
    let sourceLine = '';
    if (showSourceLink) {
      sourceLine = `<a href="${article.link}">${article.platform}</a>`;
      if (userChannelLink) {
        sourceLine += `\n${userChannelLink}`;
      }
    } else if (userChannelLink) {
      sourceLine = userChannelLink;
    }

    // Add bot display name if provided
    let botAttribution = '';
    if (botDisplayName) {
      botAttribution = `\n<b>${botDisplayName}</b>`;
    }

    const prompt = `Translate news to Amharic. Direct, accurate, no hallucinations.

Format:
<b>Amharic title</b>

• Fact 1
• Fact 2
• Fact 3
${showSourceLink ? `\n<a href="${article.link}">${article.platform}</a>` : ''}
${userChannelLink ? `\n${userChannelLink}` : ''}
${botDisplayName ? `\n<b>${botDisplayName}</b>` : ''}

Title: ${article.title}
Text: ${articleContext}

Output only translation.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 400,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      console.error('AI generation failed:', response.status);
      // Fallback to simple format if AI fails
      let fallbackText = `<b>${article.title}</b>

• ${cleanDescription.substring(0, 100)}...`;

      if (showSourceLink) {
        fallbackText += `\n<a href="${article.link}">${article.platform || 'Source'}</a>`;
      }

      if (userChannelLink) {
        fallbackText += `\n${userChannelLink}`;
      }

      if (botDisplayName) {
        fallbackText += `\n<b>${botDisplayName}</b>`;
      }

      return fallbackText;
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid AI response structure');
      let fallbackText = `<b>${article.title}</b>

• ${cleanDescription.substring(0, 100)}...`;

      if (showSourceLink) {
        fallbackText += `\n<a href="${article.link}">${article.platform || 'Source'}</a>`;
      }

      if (userChannelLink) {
        fallbackText += `\n${userChannelLink}`;
      }

      if (botDisplayName) {
        fallbackText += `\n<b>${botDisplayName}</b>`;
      }

      return fallbackText;
    }

    const content = data.choices[0].message.content.trim();

    // Replace Amharic punctuation with . . and . . . pauses only if user prefers it
    let cleaned = content;
    if (useDotPunctuation) {
      cleaned = content
        .replace(/[።፤]/g, ' . . . ')
        .replace(/[፣፡]/g, ' . . ')
        .replace(/\s*\.\s*\.\s*\.\s*/g, ' . . . ')
        .replace(/([^\.])\s*\.\s*\.\s*([^\.])/g, '$1 . . $2')
        .replace(/[ ]{2,}/g, ' ')
        .trim();
    }

    return cleaned;

  } catch (error) {
    console.error('Error generating Amharic news:', error.message);
    // Fallback to simple format
    const cleanDescription = article.description
      ? article.description.replace(/<[^>]*>/g, '').trim().substring(0, 100)
      : '';

    let fallbackText = `<b>${article.title}</b>

• ${cleanDescription}...

<a href="${article.link}">${article.platform || 'Source'}</a>`;

    if (userChannelLink) {
      fallbackText += `\n${userChannelLink}`;
    }

    if (botDisplayName) {
      fallbackText += `\n<b>${botDisplayName}</b>`;
    }

    return fallbackText;
  }
}

/**
 * Format single news article for Telegram
 */
export async function formatNewsArticle(article, userChannelLink = null, botDisplayName = null, showSourceLink = true, useDotPunctuation = false) {
  // Generate Amharic content with AI
  const amharicContent = await generateAmharicNews(article, userChannelLink, botDisplayName, showSourceLink, useDotPunctuation);
  return amharicContent;
}

/**
 * Helper to escape HTML characters in text segments
 */
function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Convert Telegram entities (bold, italic, etc.) into HTML tags
 */
export function entitiesToHTML(text, entities = []) {
  if (!text) return '';
  if (!entities || entities.length === 0) {
    return text;
  }

  // Create tag boundary events
  const events = [];
  for (const entity of entities) {
    const { type, offset, length } = entity;
    if (typeof offset !== 'number' || typeof length !== 'number') continue;

    let openTag = '';
    let closeTag = '';
    if (type === 'bold') {
      openTag = '<b>';
      closeTag = '</b>';
    } else if (type === 'italic') {
      openTag = '<i>';
      closeTag = '</i>';
    } else if (type === 'underline') {
      openTag = '<u>';
      closeTag = '</u>';
    } else if (type === 'strikethrough') {
      openTag = '<s>';
      closeTag = '</s>';
    } else if (type === 'code') {
      openTag = '<code>';
      closeTag = '</code>';
    } else if (type === 'pre') {
      openTag = '<pre>';
      closeTag = '</pre>';
    } else if (type === 'text_link' && entity.url) {
      openTag = `<a href="${entity.url}">`;
      closeTag = '</a>';
    }

    if (openTag && closeTag) {
      events.push({ pos: offset, tag: openTag, isClose: false });
      events.push({ pos: offset + length, tag: closeTag, isClose: true });
    }
  }

  if (events.length === 0) return text;

  // Sort by position ascending. At same position: closing tags before opening tags
  events.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    if (a.isClose && !b.isClose) return -1;
    if (!a.isClose && b.isClose) return 1;
    return 0;
  });

  let result = '';
  let lastPos = 0;
  for (const ev of events) {
    if (ev.pos > lastPos) {
      const slice = text.slice(lastPos, ev.pos);
      result += escapeHTML(slice);
      lastPos = ev.pos;
    }
    result += ev.tag;
  }
  if (lastPos < text.length) {
    result += escapeHTML(text.slice(lastPos));
  }
  return result;
}

/**
 * Format and sanitize user-edited news text to ensure required HTML styling (bold title)
 */
export function formatEditedNewsText(rawText, entities = [], useDotPunctuation = false, addTrueFeedAttribution = false) {
  if (!rawText) return '';

  let formatted = rawText;

  // 1. If Telegram entities exist (user formatted text using Telegram UI), convert to HTML
  if (entities && entities.length > 0) {
    formatted = entitiesToHTML(rawText, entities);
  }

  // 2. Convert common markdown bold/italic syntax if present
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  formatted = formatted.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, '$1<b>$2</b>$3');

  // 3. Ensure title (first non-empty line) is bold
  const lines = formatted.split('\n');
  const firstLineIdx = lines.findIndex(l => l.trim().length > 0);
  if (firstLineIdx !== -1) {
    const trimmedLine = lines[firstLineIdx].trim();
    // If the line is not already wrapped in <b> or <strong>
    if (!trimmedLine.includes('<b>') && !trimmedLine.includes('<strong>')) {
      lines[firstLineIdx] = `<b>${trimmedLine}</b>`;
    }
  }
  formatted = lines.join('\n');

  // 4. Ensure @true_feed is bold (only if requested)
  if (addTrueFeedAttribution) {
    if (formatted.includes('@true_feed')) {
      formatted = formatted.replace(/(?:\*|<b>|<strong>)?@true_feed(?:\*|<\/b>|<\/strong>)?/g, '<b>@true_feed</b>');
    } else {
      formatted = formatted.trim() + '\n\n<b>@true_feed</b>';
    }
  }

  // 5. Replace Amharic punctuation with . . and . . . pauses (only if user prefers it)
  if (useDotPunctuation) {
    formatted = formatted
      .replace(/[።፤]/g, ' . . . ')
      .replace(/[፣፡]/g, ' . . ')
      .replace(/\s*\.\s*\.\s*\.\s*/g, ' . . . ')
      .replace(/([^\.])\s*\.\s*\.\s*([^\.])/g, '$1 . . $2')
      .replace(/[ ]{2,}/g, ' ')
      .trim();
  }

  return formatted;
}
