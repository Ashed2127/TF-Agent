import { db } from 'sdk';
import { eq, and, sql } from 'sdk/db';
import { dailyRecommendations } from '../schema.js';
import { NEWS_PLATFORMS, NEWS_CATEGORIES, fetchRSSFeed } from './news.js';
import { getUserByTelegramId, updateLastRecommendationTime } from './database.js';
import { fetch } from 'sdk';
import { OPENROUTER_API_KEY } from './secrets.js';

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current day of week name
 */
function getDayOfWeek() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

/**
 * Fetch articles from user's chosen categories
 */
async function fetchArticlesForCategories(categories) {
  const articles = [];
  const platformsByCategory = {};

  // Group platforms by category
  NEWS_PLATFORMS.forEach(platform => {
    if (!platformsByCategory[platform.category]) {
      platformsByCategory[platform.category] = [];
    }
    platformsByCategory[platform.category].push(platform);
  });

  // Fetch articles from each chosen category
  for (const categoryId of categories) {
    const platforms = platformsByCategory[categoryId] || [];
    if (platforms.length === 0) continue;

    // Pick 4 random platforms from this category to get more variety
    const shuffled = platforms.sort(() => 0.5 - Math.random());
    const selectedPlatforms = shuffled.slice(0, 4);

    for (const platform of selectedPlatforms) {
      try {
        const categoryArticles = await fetchRSSFeed(platform.url, platform.name);
        if (Array.isArray(categoryArticles) && categoryArticles.length > 0) {
          // Take first 5 articles from this platform for better selection pool
          const selectedArticles = categoryArticles.slice(0, 5).map(article => ({
            ...article,
            category: categoryId,
            platform: platform.name,
            platformId: platform.id
          }));
          articles.push(...selectedArticles);
        }
      } catch (error) {
        console.error(`Error fetching from ${platform.name}:`, error.message);
      }
    }
  }

  return articles;
}

/**
 * Use AI to curate and summarize articles into a personalized digest
 */
async function generateAIDigest(user, articles) {
  const firstName = user.first_name || 'Friend';
  const dayOfWeek = getDayOfWeek();

  // Prepare article summaries for AI with links and enhanced context
  const articleSummaries = articles.map((article, index) => {
    const title = article.title || 'No title';
    const description = article.description || article.snippet || '';
    const link = article.link || article.url || 'No link';
    const pubDate = article.pubDate || article.published || '';
    const dateStr = pubDate ? `Published: ${pubDate}\n   ` : '';

    return `${index + 1}. ${title}\n   Category: ${article.category}\n   Source: ${article.platform}\n   ${dateStr}Link: ${link}\n   ${description}`;
  }).join('\n\n');

  const prompt = `You are an elite news curator with exceptional taste. Create a personalized, engaging news digest for ${firstName}.

Context:
- Today is ${dayOfWeek}
- User's interests: ${user.categories || 'General news'}

Source Articles:
${articleSummaries}

CRITICAL SELECTION CRITERIA - What Makes Content "Impressive":
1. Emotional Impact: Stories that evoke strong feelings - shock, awe, laughter, inspiration, or deep thought
2. Novelty: Discoveries, breakthroughs, unusual events, or things that challenge expectations
3. Human Interest: Stories about extraordinary people, remarkable achievements, or dramatic life changes
4. World Impact: Events affecting millions, paradigm shifts, or significant historical moments
5. Unexpected Twists: Surprising outcomes, ironic situations, or stories with stunning revelations
6. Visual/Descriptive Power: Stories with vivid imagery that paint mental pictures
7. Relevance: Connection to current zeitgeist, technology, health, finance, or human progress

WHAT TO AVOID:
- Routine updates (stock tickers, minor policy changes, corporate earnings)
- Repetitive news (same event covered multiple ways)
- Predictable stories (expected outcomes, formulaic content)
- Clickbait without substance (sensational titles but empty content)
- Overly technical articles without human angle

Story Selection Process:
1. Review ALL articles and score each on "impressiveness" (1-10)
2. Select top 5-7 stories that score highest
3. Ensure emotional diversity: at least 1-2 inspiring, 1-2 shocking/fascinating, 1-2 humorous/heartwarming
4. Group by region/topic for better flow (e.g., Ethiopia, Africa, Global Tech, Science, Human Stories)
5. Prioritize stories that will be remembered hours or days later

Digest Structure:
1. Warm opening: "Hey ${firstName} — happy ${dayOfWeek} ☺️ Here's what the world did while you were getting on with your week:"
2. For each story:
   - **Hook line**: One sentence that grabs attention
   - **2-3 sentence summary**: Emotionally compelling, fact-rich, paints a vivid picture
   - **"Also worth knowing"**: 2-3 bullet points with fascinating context, stats, or related facts
   - **Source**: "Source: [Platform Name](article_url)" - clickable platform name
3. Warm closing: "Somewhere in there, a ${dayOfWeek}. Rest up 🥰"

Tone Guidelines:
- Conversational like a smart, well-read friend
- Authentic enthusiasm for genuinely impressive stories
- Appropriate gravity for serious topics
- Never cynical or dismissive
- Use vivid language that creates mental imagery

IMPORTANT: Use Markdown format for links like this: [Platform Name](article_url) - the platform name should be the clickable text.

Output ONLY the digest text, no preamble or explanation.`;

  try {
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
            content: 'You are an elite news curator with exceptional editorial judgment. You identify the most remarkable, memorable, and impactful stories from any news feed. Your selections evoke emotion, inspire curiosity, and create lasting impressions. You present stories with warmth, vividness, and authentic engagement.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid AI response');
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating AI digest:', error.message);
    // Fallback: simple concatenation
    return generateFallbackDigest(user, articles);
  }
}

/**
 * Fallback digest generation when AI fails
 */
function generateFallbackDigest(user, articles) {
  const firstName = user.first_name || 'Friend';
  const dayOfWeek = getDayOfWeek();

  let digest = `Hey ${firstName} — happy ${dayOfWeek} ☺️ Here's what the world did while you were getting on with your week:\n\n`;

  // Sort articles by title length to pick potentially more substantive stories
  const sortedArticles = [...articles].sort((a, b) => {
    const aLen = (a.title || '').length;
    const bLen = (b.title || '').length;
    return bLen - aLen; // Longer titles might indicate more substantial stories
  });

  const selectedArticles = sortedArticles.slice(0, 7);
  selectedArticles.forEach((article, index) => {
    digest += `**${article.title || 'No title'}**\n`;
    digest += `${article.description || article.snippet || ''}\n`;
    const link = article.link || article.url;
    if (link) {
      digest += `Source: [${article.platform}](${link})\n\n`;
    } else {
      digest += `Source: ${article.platform}\n\n`;
    }
  });

  digest += `Somewhere in there, a ${dayOfWeek}. Rest up 🥰`;
  return digest;
}

/**
 * Get or generate daily recommendations for a user
 */
export async function getDailyRecommendations(telegramId, forceRefresh = false) {
  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check if recommendations are enabled
  if (user.recommendations_enabled !== 1) {
    return {
      digest: null,
      message: 'Recommendations are not enabled. Enable them in settings.',
      enabled: false
    };
  }

  // Parse user's chosen categories
  const categories = user.categories ? JSON.parse(user.categories) : [];
  if (categories.length === 0) {
    return {
      digest: null,
      message: 'No categories selected. Please select categories in settings.',
      enabled: true
    };
  }

  const today = getTodayDate();
  const userId = user.id;
  const intervalMinutes = user.recommendation_interval || 1440;

  // For intervals less than 24 hours, always fetch fresh content (no caching)
  // For 24-hour interval, use daily cache
  const useCache = intervalMinutes >= 1440 && !forceRefresh;

  if (useCache) {
    const existing = await db.select()
      .from(dailyRecommendations)
      .where(and(
        eq(dailyRecommendations.user_id, userId),
        eq(dailyRecommendations.recommendation_date, today)
      ))
      .limit(1)
      .all();

    if (existing.length > 0) {
      // Return cached recommendations
      const cached = existing[0];
      return {
        digest: cached.digest_content,
        categories: JSON.parse(cached.categories),
        date: cached.recommendation_date,
        cached: true,
        enabled: true
      };
    }
  } else {
    // Delete existing recommendations for today if not using cache
    await db.delete(dailyRecommendations)
      .where(and(
        eq(dailyRecommendations.user_id, userId),
        eq(dailyRecommendations.recommendation_date, today)
      ))
      .run();
  }

  // Fetch articles
  const articles = await fetchArticlesForCategories(categories);

  if (articles.length === 0) {
    return {
      digest: null,
      message: 'No articles found for your categories.',
      enabled: true
    };
  }

  // Cap articles at 40 to avoid overwhelming the AI while maintaining variety
  const maxArticles = 40;
  const cappedArticles = articles.length > maxArticles
    ? articles.slice(0, maxArticles)
    : articles;

  // Generate AI digest
  const digest = await generateAIDigest(user, cappedArticles);

  // Save to database
  await db.insert(dailyRecommendations)
    .values({
      user_id: userId,
      recommendation_date: today,
      digest_content: digest,
      raw_articles: JSON.stringify(cappedArticles), // Store the articles used for this digest
      categories: JSON.stringify(categories)
    })
    .run();

  // Update last recommendation time
  await updateLastRecommendationTime(telegramId);

  return {
    digest,
    categories,
    date: today,
    cached: false,
    enabled: true
  };
}

/**
 * Check if a user is due for a recommendation based on their interval
 */
export async function isUserDueForRecommendation(telegramId) {
  const user = await getUserByTelegramId(telegramId);
  if (!user || user.recommendations_enabled !== 1) {
    return false;
  }

  const intervalMinutes = user.recommendation_interval || 1440;
  const lastRecommendation = user.last_recommendation_at;

  if (!lastRecommendation) {
    return true; // Never received a recommendation
  }

  const now = Math.floor(Date.now() / 1000);
  const minutesSinceLast = (now - Number(lastRecommendation)) / 60;

  return minutesSinceLast >= intervalMinutes;
}

/**
 * Clear old recommendations (older than 30 days)
 */
export async function clearOldRecommendations() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

  await db.delete(dailyRecommendations)
    .where(sql`recommendation_date < ${cutoffDate}`)
    .run();
}
