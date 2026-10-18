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
async function generateAmharicNews(article, userChannelLink = null, botDisplayName = null, showSourceLink = true, useDotPunctuation = false) {
  try {
    // Clean description - remove HTML tags
    const cleanDescription = article.description
      ? article.description.replace(/<[^>]*>/g, '').trim().substring(0, 500)
      : article.title;

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

    const prompt = `You are a news writer for True Feed, an Ethiopian tech/business news channel. Convert the following English news article into Amharic.

Structure:
1. Write an impressive Amharic title in BOLD using <b> tags (NO emojis)
2. Add ONE BLANK LINE after the title
3. Below the blank line, write 2-3 short bullet points summarizing the news in Amharic (NO emojis)
${showSourceLink ? `4. Add ONE BLANK LINE after the bullet points\n5. On the new line, add the source link as clickable text using HTML <a> tags: <a href="${article.link}">${article.platform}</a>\n6. Add ONE BLANK LINE after the source link\n7. On the new line, add the content creator's channel link: ${userChannelLink || 'N/A'}` : `4. Add ONE BLANK LINE after the bullet points\n5. On the new line, add the content creator's channel link: ${userChannelLink || 'N/A'}`}
${botAttribution ? `\n${showSourceLink ? '8' : '6'}. Add ONE BLANK LINE after the content creator channel link\n${showSourceLink ? '9' : '7'}. On the new line, add the bot attribution in bold: <b>${botDisplayName}</b>` : ''}

Requirements:
- Keep the news truthful but write it in your own words
- Make the title catchy and impressive
- Use Ethiopian context where appropriate
- Bullet points should be concise (10-15 words each)
- NO emojis anywhere in the text
${showSourceLink ? `- Include the source link exactly as shown: <a href="${article.link}">${article.platform}</a>` : ''}
- Include the content creator's channel link exactly as shown: ${userChannelLink || 'N/A'}
${botAttribution ? `- Include the bot attribution exactly as shown: <b>${botDisplayName}</b>` : ''}
- Maximum ${botAttribution ? '8' : '6'} lines of text total
- Use HTML <b> tags for bold title${botAttribution ? ' and bot attribution' : ''}
${showSourceLink ? '- Use HTML <a> tags for the source link' : ''}
- Add blank lines: one after title, one after bullet points${showSourceLink ? ', one after source link' : ''}${userChannelLink ? ', one after content creator channel link' : ''}
${useDotPunctuation ? '- NEVER use Amharic punctuation like ። ፤ ፣ ፡ — use ". ." or ". . ." for pauses instead' : '- Use proper Amharic punctuation (። ፤ ፣ ፡) as appropriate'}

Original English news:
Title: ${article.title}
Description: ${cleanDescription}
Link: ${article.link}
Platform: ${article.platform}
Content Creator Channel: ${userChannelLink || 'N/A'}
Bot Display Name: ${botDisplayName || 'Default'}
Show Source Link: ${showSourceLink ? 'Yes' : 'No'}

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
