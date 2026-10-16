import { fetch } from 'sdk';
import { OPENROUTER_API_KEY } from './secrets.js';

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
 * News platforms configuration
 */
export const NEWS_PLATFORMS = [
  // Global
  { id: 'techcrunch', name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { id: 'venturebeat', name: 'VentureBeat', url: 'https://venturebeat.com/feed/' },
  { id: 'theinformation', name: 'The Information', url: 'https://www.theinformation.com/feed' },
  { id: 'restofworld', name: 'Rest of World', url: 'https://restofworld.org/feed/latest/' },
  { id: 'bloomberg', name: 'Bloomberg Technology', url: 'https://www.bloomberg.com/feeds/technology/news.rss' },
  { id: 'sifted', name: 'Sifted', url: 'https://sifted.eu/feed/' },
  { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { id: 'arstechnica', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { id: 'techmeme', name: 'Techmeme', url: 'https://www.techmeme.com/feed.xml' },
  { id: 'hackernews', name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
  { id: 'wired', name: 'WIRED', url: 'https://www.wired.com/feed/rss' },
  { id: 'techinasia', name: 'Tech in Asia', url: 'https://www.techinasia.com/feed' },
  { id: 'geekwire', name: 'GeekWire', url: 'https://www.geekwire.com/feed/' },
  { id: 'betalist', name: 'BetaList', url: 'https://betalist.com/posts.rss' },
  { id: 'zdnet', name: 'ZDNet', url: 'https://www.zdnet.com/news/rss.xml' },
  { id: 'tnw', name: 'TNW', url: 'https://thenextweb.com/feed/' },
  { id: 'producthunt', name: 'Product Hunt', url: 'https://www.producthunt.com/feed' },
  
  // Africa
  { id: 'techcabal', name: 'TechCabal', url: 'https://techcabal.com/feed/' },
  { id: 'disruptafrica', name: 'Disrupt Africa', url: 'https://disrupt-africa.com/feed/' },
  { id: 'techinafrica', name: 'Tech In Africa', url: 'https://techinafrica.com/feed' },
  
  // India
  { id: 'yourstory', name: 'YourStory', url: 'https://yourstory.com/feed' },
  { id: 'inc42', name: 'Inc42', url: 'https://inc42.com/feed/' },
  { id: 'entrackr', name: 'Entrackr', url: 'https://entrackr.com/rss' },
  
  // UAE
  { id: 'wamda', name: 'Wamda', url: 'https://www.wamda.com/feed' },
  { id: 'arabianbusiness', name: 'Arabian Business', url: 'https://arabianbusiness.com/feed' },
  
  // China
  { id: 'technode', name: 'TechNode', url: 'https://technode.com/feed/' },
  { id: 'pandaily', name: 'Pandaily', url: 'https://pandaily.com/feed/' },
  { id: 'caixin', name: 'Caixin Global', url: 'https://gateway.caixin.com/api/data/global/feedlyRss.xml' },
  
  // Latin America
  { id: 'latamlist', name: 'LatamList', url: 'https://latamlist.com/feed/' },
  { id: 'contxto', name: 'Contxto', url: 'https://contxto.com/en/feed/' },
  
  // Russia
  { id: 'rusbase', name: 'Rusbase', url: 'https://rb.ru/feeds/all/' }
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
async function generateAmharicNews(article) {
  try {
    // Clean description - remove HTML tags
    const cleanDescription = article.description
      ? article.description.replace(/<[^>]*>/g, '').trim().substring(0, 500)
      : article.title;

    const prompt = `You are a news writer for True Feed, an Ethiopian tech/business news channel. Convert the following English news article into Amharic.

Structure:
1. Write an impressive Amharic title with relevant emojis (keep Ethiopian context, use emotional/impressive emojis like 🚨🔥💡🎉)
2. Below the title, write 2-3 short bullet points summarizing the news in Amharic
3. At the end, add "**@true_feed**" in bold

Requirements:
- Keep the news truthful but write it in your own words
- Make the title catchy and impressive
- Use Ethiopian context where appropriate
- Bullet points should be concise (10-15 words each)
- No platform attribution or source links
- Maximum 5 lines of text total

Original English news:
Title: ${article.title}
Description: ${cleanDescription}

Generate the Amharic news following the structure above. Do not include any explanations, just the formatted news.`;

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
      return `📰 ${article.title}

• ${cleanDescription.substring(0, 100)}...

**@true_feed**`;
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid AI response structure');
      return `📰 ${article.title}

• ${cleanDescription.substring(0, 100)}...

**@true_feed**`;
    }

    const content = data.choices[0].message.content.trim();
    return content;

  } catch (error) {
    console.error('Error generating Amharic news:', error.message);
    // Fallback to simple format
    const cleanDescription = article.description
      ? article.description.replace(/<[^>]*>/g, '').trim().substring(0, 100)
      : '';
    return `📰 ${article.title}

• ${cleanDescription}...

**@true_feed**`;
  }
}

/**
 * Format single news article for Telegram
 */
export async function formatNewsArticle(article) {
  // Generate Amharic content with AI
  const amharicContent = await generateAmharicNews(article);
  return amharicContent;
}
