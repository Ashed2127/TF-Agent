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

    // Pick 2 random platforms from this category to get variety
    const shuffled = platforms.sort(() => 0.5 - Math.random());
    const selectedPlatforms = shuffled.slice(0, 2);

    for (const platform of selectedPlatforms) {
      try {
        const categoryArticles = await fetchRSSFeed(platform.url, platform.name);
        if (Array.isArray(categoryArticles) && categoryArticles.length > 0) {
          // Take first 3 articles from this platform
          const selectedArticles = categoryArticles.slice(0, 3).map(article => ({
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

  // Prepare article summaries for AI with links
  const articleSummaries = articles.map((article, index) => {
    return `${index + 1}. ${article.title || 'No title'}\n   Category: ${article.category}\n   Source: ${article.platform}\n   Link: ${article.link || article.url || 'No link'}\n   ${article.description || article.snippet || ''}`;
  }).join('\n\n');

  const prompt = `You are an expert news curator. Create a personalized, engaging news digest for ${firstName}.

Context:
- Today is ${dayOfWeek}
- User's interests: ${user.categories || 'General news'}

Source Articles:
${articleSummaries}

Instructions:
1. CRITICAL: Select ONLY the most impressive, impactful, and memorable stories - whether they're funny, sad, shocking, inspiring, or fascinating. Every story must leave a strong impression.
2. Prioritize stories that will make the user think, feel, or remember something significant. Skip mundane or routine news.
3. Select 5-7 stories that cover different emotions and impact levels - mix of shocking (sad/tragic), funny/humorous, inspiring/uplifting, and fascinating/mind-blowing content.
4. Group them by region/topic (e.g., Ethiopia, Iran, Ukraine, Elsewhere)
5. Write a warm, personalized opening: "Hey ${firstName} — happy ${dayOfWeek} ☺️ Here's what the world did while you were getting on with your week:"
6. For each story:
   - Write a compelling 2-3 sentence summary that captures the emotional impact
   - Include the most important facts
   - Add "Also worth knowing" section with 2-3 bullet points of related context
   - At the end of each story, add the source platform as a clickable link where the platform name itself is the link. Format: "Source: [Platform Name](article_url)" - this will display as "Source: Platform Name" with Platform Name being clickable
7. End with a warm closing like "Somewhere in there, a ${dayOfWeek}. Rest up 🥰"
8. Keep the tone conversational, informative, and engaging
9. Make it feel like a smart friend sharing the most impressive and memorable news
10. IMPORTANT: Use Markdown format for links like this: [Platform Name](article_url) - the platform name should be the clickable text

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
            content: 'You are an expert news curator who creates engaging, personalized news digests. You select the most important and interesting stories and present them in a warm, conversational tone.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
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

  const selectedArticles = articles.slice(0, 7);
  selectedArticles.forEach((article, index) => {
    digest += `${article.title || 'No title'}\n`;
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

  // Generate AI digest
  const digest = await generateAIDigest(user, articles);

  // Save to database
  await db.insert(dailyRecommendations)
    .values({
      user_id: userId,
      recommendation_date: today,
      digest_content: digest,
      raw_articles: JSON.stringify(articles.slice(0, 20)), // Store up to 20 articles
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
