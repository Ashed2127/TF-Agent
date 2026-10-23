import { fetch } from 'sdk';
import { OPENROUTER_API_KEY } from './secrets.js';
import { getCustomSources } from './database.js';

export async function translateToAmharic(text) {
  try {
    console.log('Translating text to Amharic...');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the given text to Amharic. Keep the meaning accurate and use natural Amharic phrasing. Use ". . ." for pauses instead of Amharic punctuation marks (።፤፣፡).'
          },
          {
            role: 'user',
            content: `Translate this to Amharic:\n\n${text}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Translation API Error:', response.status, errorText);
      throw new Error(`Translation API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid translation API response');
    }

    const translatedText = data.choices[0].message.content.trim();

    // Replace Amharic punctuation with . . and . . . pauses
    let cleanText = translatedText.replace(/[።፤]/g, ' . . . ');
    cleanText = cleanText.replace(/[፣፡]/g, ' . . ');

    // Normalize spacing around pauses
    cleanText = cleanText.replace(/\s*\.\s*\.\s*\.\s*/g, ' . . . ');
    cleanText = cleanText.replace(/([^\.])\s*\.\s*\.\s*([^\.])/g, '$1 . . $2');
    cleanText = cleanText.replace(/[ ]{2,}/g, ' ').trim();

    console.log('Translation completed successfully');
    return cleanText;

  } catch (error) {
    console.error('Translation error:', error);
    throw new Error(`Failed to translate: ${error.message}`);
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
  { id: 'research', name: '🔬 Research & Academia', description: 'Academic papers, studies & scientific research' },
  { id: 'crypto', name: '🪙 Crypto & Web3', description: 'Bitcoin, Ethereum, DeFi & blockchain' },
  { id: 'entertainment', name: '🎬 Entertainment', description: 'Movies, gaming, music & culture' },
  { id: 'sports', name: '⚽ Sports', description: 'Global football, athletics & tournaments' }
];

/**
 * News platforms configuration mapped by category
 * Only reputable, active sources with proven journalistic integrity
 */
export const NEWS_PLATFORMS = [
  // Tech & AI - Most Reputable Tech Sources
  { id: 'techcrunch', name: 'TechCrunch', category: 'tech', url: 'https://techcrunch.com/feed/' },
  { id: 'theverge', name: 'The Verge', category: 'tech', url: 'https://www.theverge.com/rss/index.xml' },
  { id: 'wired', name: 'WIRED', category: 'tech', url: 'https://www.wired.com/feed/rss' },
  { id: 'arstechnica', name: 'Ars Technica', category: 'tech', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { id: 'mittechreview', name: 'MIT Technology Review', category: 'tech', url: 'https://www.technologyreview.com/feed/' },
  { id: 'ieee', name: 'IEEE Spectrum', category: 'tech', url: 'https://spectrum.ieee.org/rss/full' },
  { id: 'venturebeat', name: 'VentureBeat', category: 'tech', url: 'https://venturebeat.com/feed/' },
  { id: 'engadget', name: 'Engadget', category: 'tech', url: 'https://www.engadget.com/rss.xml' },
  { id: 'hackernews', name: 'Hacker News', category: 'tech', url: 'https://hnrss.org/frontpage' },
  { id: 'newscientist', name: 'New Scientist', category: 'tech', url: 'https://www.newscientist.com/feed/' },

  // Business & Finance - Most Trusted Financial News
  { id: 'bloomberg', name: 'Bloomberg', category: 'business', url: 'https://www.bloomberg.com/feed' },
  { id: 'ft', name: 'Financial Times', category: 'business', url: 'https://www.ft.com/rss/world' },
  { id: 'economist', name: 'The Economist', category: 'business', url: 'https://www.economist.com/rss' },
  { id: 'reutersbiz', name: 'Reuters Business', category: 'business', url: 'https://www.reuters.com/rssFeed/businessNews' },
  { id: 'wsj', name: 'Wall Street Journal', category: 'business', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
  { id: 'cnbc', name: 'CNBC', category: 'business', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { id: 'forbes', name: 'Forbes', category: 'business', url: 'https://www.forbes.com/business/feed/' },
  { id: 'marketwatch', name: 'MarketWatch', category: 'business', url: 'https://www.marketwatch.com/rss/topstories' },
  { id: 'fastcompany', name: 'Fast Company', category: 'business', url: 'https://www.fastcompany.com/feed' },

  // World News - Most Trusted Global News Organizations
  { id: 'bbcworld', name: 'BBC World News', category: 'world', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'reuters', name: 'Reuters World', category: 'world', url: 'https://www.reuters.com/rssFeed/worldNews' },
  { id: 'apnews', name: 'AP News', category: 'world', url: 'https://feeds.apnews.com/rss/apf-topnews' },
  { id: 'theguardian', name: 'The Guardian', category: 'world', url: 'https://www.theguardian.com/world/rss' },
  { id: 'aljazeera', name: 'Al Jazeera', category: 'world', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'dw', name: 'DW News', category: 'world', url: 'https://rss.dw.com/rdf/rss-en-all' },
  { id: 'npr', name: 'NPR World', category: 'world', url: 'https://feeds.npr.org/1004/rss.xml' },
  { id: 'nytimes', name: 'NY Times World', category: 'world', url: 'https://www.nytimes.com/services/xml/rss/nyt/World.xml' },

  // Startups & Africa - Focused on Innovation
  { id: 'techcabal', name: 'TechCabal', category: 'startups', url: 'https://techcabal.com/feed/' },
  { id: 'disruptafrica', name: 'Disrupt Africa', category: 'startups', url: 'https://disrupt-africa.com/feed/' },
  { id: 'restofworld', name: 'Rest of World', category: 'startups', url: 'https://restofworld.org/feed/latest/' },
  { id: 'producthunt', name: 'Product Hunt', category: 'startups', url: 'https://www.producthunt.com/feed' },
  { id: 'techpointafrica', name: 'Techpoint Africa', category: 'startups', url: 'https://techpoint.africa/feed' },
  { id: 'weetracker', name: 'WeeTracker', category: 'startups', url: 'https://weetracker.com/feed' },
  { id: 'ventureburn', name: 'Ventureburn', category: 'startups', url: 'https://ventureburn.com/feed' },

  // Science & Space - Top Scientific Sources
  { id: 'sciencedaily', name: 'ScienceDaily', category: 'science', url: 'https://www.sciencedaily.com/rss/all.xml' },
  { id: 'physorg', name: 'Phys.org', category: 'science', url: 'https://phys.org/rss-feed/' },
  { id: 'spacecom', name: 'Space.com', category: 'science', url: 'https://www.space.com/feeds/all' },
  { id: 'nasa', name: 'NASA News', category: 'science', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss' },
  { id: 'sciam', name: 'Scientific American', category: 'science', url: 'https://www.scientificamerican.com/feed' },
  { id: 'naturebriefing', name: 'Nature Briefing', category: 'science', url: 'https://www.nature.com/nature/articles/rss' },
  { id: 'livescience', name: 'Live Science', category: 'science', url: 'https://www.livescience.com/feeds/all' },
  { id: 'natgeo', name: 'National Geographic', category: 'science', url: 'https://www.nationalgeographic.com/feed' },

  // Education - Leading Education Publications
  { id: 'educationweek', name: 'Education Week', category: 'education', url: 'https://www.edweek.org/feed' },
  { id: 'chronicle', name: 'The Chronicle', category: 'education', url: 'https://www.chronicle.com/rss' },
  { id: 'insidehighered', name: 'Inside Higher Ed', category: 'education', url: 'https://www.insidehighered.com/rss.xml' },
  { id: 'edsurge', name: 'EdSurge', category: 'education', url: 'https://www.edsurge.com/rss' },
  { id: 'timeshighered', name: 'Times Higher Education', category: 'education', url: 'https://www.timeshighereducation.com/rss/world-university-rankings' },

  // Research & Academia - Top Academic Journals
  { id: 'nature', name: 'Nature', category: 'research', url: 'https://www.nature.com/nature.rss' },
  { id: 'science', name: 'Science', category: 'research', url: 'https://www.science.org/rss/news_current.xml' },
  { id: 'pnas', name: 'PNAS', category: 'research', url: 'https://www.pnas.org/rss/pnas/current.xml' },
  { id: 'cell', name: 'Cell', category: 'research', url: 'https://www.cell.com/rss' },
  { id: 'arxiv', name: 'arXiv', category: 'research', url: 'https://export.arxiv.org/rss/cs.AI' },
  { id: 'eurekalert', name: 'EurekAlert!', category: 'research', url: 'https://www.eurekalert.org/rss.xml' },
  { id: 'plosone', name: 'PLOS ONE', category: 'research', url: 'https://www.plos.org/feed/plosone' },
  { id: 'theconversation', name: 'The Conversation', category: 'research', url: 'https://theconversation.com/technology/rss' },

  // Crypto & Web3 - Reputable Crypto News
  { id: 'coindesk', name: 'CoinDesk', category: 'crypto', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { id: 'cointelegraph', name: 'Cointelegraph', category: 'crypto', url: 'https://cointelegraph.com/rss' },
  { id: 'decrypt', name: 'Decrypt', category: 'crypto', url: 'https://decrypt.co/feed' },
  { id: 'blockworks', name: 'Blockworks', category: 'crypto', url: 'https://blockworks.co/feed' },
  { id: 'defiant', name: 'The Defiant', category: 'crypto', url: 'https://thedefiant.io/feed' },
  { id: 'bankless', name: 'Bankless', category: 'crypto', url: 'https://newsletter.banklesshq.com/feed' },

  // Entertainment - Top Entertainment News
  { id: 'variety', name: 'Variety', category: 'entertainment', url: 'https://variety.com/feed/' },
  { id: 'hollywoodreporter', name: 'Hollywood Reporter', category: 'entertainment', url: 'https://www.hollywoodreporter.com/feed/' },
  { id: 'rollingstone', name: 'Rolling Stone', category: 'entertainment', url: 'https://www.rollingstone.com/feed/' },
  { id: 'ign', name: 'IGN', category: 'entertainment', url: 'https://www.ign.com/feed/news' },
  { id: 'deadline', name: 'Deadline Hollywood', category: 'entertainment', url: 'https://deadline.com/feed' },
  { id: 'polygon', name: 'Polygon', category: 'entertainment', url: 'https://www.polygon.com/rss/index.xml' },
  { id: 'billboard', name: 'Billboard', category: 'entertainment', url: 'https://www.billboard.com/feed' },

  // Sports - Major Sports News
  { id: 'espn', name: 'ESPN', category: 'sports', url: 'https://www.espn.com/espn/rss/news' },
  { id: 'bbcsport', name: 'BBC Sport', category: 'sports', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { id: 'si', name: 'Sports Illustrated', category: 'sports', url: 'https://www.si.com/rss' },
  { id: 'theathletic', name: 'The Athletic', category: 'sports', url: 'https://theathletic.com/feed' },
  { id: 'bleacherreport', name: 'Bleacher Report', category: 'sports', url: 'https://bleacherreport.com/feed' },
  { id: 'skysports', name: 'Sky Sports', category: 'sports', url: 'https://www.skysports.com/rss/0,20514,00.xml' },
  { id: 'goalcom', name: 'Goal.com', category: 'sports', url: 'https://www.goal.com/en/feeds/news' }
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

        // Extract video from enclosure or media:content
        let video = '';

        // Try enclosure with video mime type
        const enclosureMatch = entryContent.match(/<enclosure[^>]*url="([^"]*)"[^>]*type="video\/[^"]*"[^>]*>/i);
        if (enclosureMatch) {
          video = enclosureMatch[1].trim();
        }

        // Try media:content with video type
        if (!video) {
          const mediaVideoMatch = entryContent.match(/<media:content[^>]*url="([^"]*)"[^>]*type="video\/[^"]*"[^>]*>/i);
          if (mediaVideoMatch) {
            video = mediaVideoMatch[1].trim();
          }
        }

        // Try enclosure with common video extensions
        if (!video) {
          const enclosureExtMatch = entryContent.match(/<enclosure[^>]*url="([^"]*\.(?:mp4|webm|mov|avi|mkv))"[^>]*>/i);
          if (enclosureExtMatch) {
            video = enclosureExtMatch[1].trim();
          }
        }

        // Decode HTML entities in video URL
        if (video) {
          video = video.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
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
            video,
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

        // Try media:content with url attribute (but only if it's an image)
        const mediaContentMatch = itemContent.match(/<media:content[^>]*url="([^"]*)"[^>]*type="image\/[^"]*"[^>]*>/i);
        if (mediaContentMatch) {
          image = mediaContentMatch[1].trim();
        }

        // Try enclosure with image type
        if (!image) {
          const enclosureMatch = itemContent.match(/<enclosure[^>]*url="([^"]*)"[^>]*type="image\/[^"]*"[^>]*>/i);
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

        // Extract video from enclosure or media:content
        let video = '';

        // Try enclosure with video mime type
        const enclosureVideoMatch = itemContent.match(/<enclosure[^>]*url="([^"]*)"[^>]*type="video\/[^"]*"[^>]*>/i);
        if (enclosureVideoMatch) {
          video = enclosureVideoMatch[1].trim();
        }

        // Try media:content with video type
        if (!video) {
          const mediaVideoMatch = itemContent.match(/<media:content[^>]*url="([^"]*)"[^>]*type="video\/[^"]*"[^>]*>/i);
          if (mediaVideoMatch) {
            video = mediaVideoMatch[1].trim();
          }
        }

        // Try enclosure with common video extensions
        if (!video) {
          const enclosureExtMatch = itemContent.match(/<enclosure[^>]*url="([^"]*\.(?:mp4|webm|mov|avi|mkv))"[^>]*>/i);
          if (enclosureExtMatch) {
            video = enclosureExtMatch[1].trim();
          }
        }

        // Decode HTML entities in video URL
        if (video) {
          video = video.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        }

        // Extract pubDate
        const dateMatch = itemContent.match(/<pubDate>([^<]*)<\/pubDate>/i);
        const pubDate = dateMatch ? dateMatch[1].trim() : '';
        
        if (title && link) {
          items.push({
            title,
            link,
            image,
            video,
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

    // Add platform name
    return items.map(item => ({
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
async function generateAmharicNews(article, userChannelLink = null, showSourceLink = true, useDotPunctuation = false) {
  try {
    // Use RSS description for context (no web scraping)
    let articleContext = article.description
      ? article.description.replace(/<[^>]*>/g, '').trim().substring(0, 1000)
      : '';

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

    const prompt = `Translate news to Amharic. Direct, accurate, no hallucinations.

Format:
<b>Amharic title</b>

• Fact 1
• Fact 2
• Fact 3
${showSourceLink ? `\n<a href="${article.link}">${article.platform}</a>` : ''}
${userChannelLink ? `\n${userChannelLink}` : ''}

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

    return fallbackText;
  }
}

/**
 * Format single news article for Telegram
 */
export async function formatNewsArticle(article, userChannelLink = null, showSourceLink = true, useDotPunctuation = false) {
  // Generate Amharic content with AI
  const amharicContent = await generateAmharicNews(article, userChannelLink, showSourceLink, useDotPunctuation);
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
