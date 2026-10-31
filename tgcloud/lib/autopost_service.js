import { api } from 'sdk';
import { 
  getDueAutoPostSchedules, 
  updateAutoPostLastPosted, 
  getUserById, 
  getUserByTelegramId, 
  createPost, 
  getUserPosts, 
  getCustomSources 
} from './database.js';
import { 
  NEWS_PLATFORMS, 
  fetchRSSFeed, 
  getPlatformById, 
  formatNewsArticle 
} from './news.js';
import { formatChannelHandle } from './channel.js';
import { generateIdea } from './agent.js';

export async function processSingleAutoPost(schedule) {
  let user = await getUserById(schedule.user_id);
  if (!user) {
    user = await getUserByTelegramId(schedule.user_id);
  }
  if (!user) {
    throw new Error(`User not found for schedule ${schedule.id}`);
  }

  const userChannelLink = formatChannelHandle(schedule.channel_id);
  const showSourceLink = user?.show_source_link === 1;
  const useDotPunctuation = user?.use_dot_punctuation === 1;

  let platformId = schedule.source_platform;
  let articleToPost = null;
  let platformObj = null;

  // If a source platform is chosen, fetch its news
  if (platformId) {
    if (platformId.startsWith('custom_')) {
      const customId = parseInt(platformId.replace('custom_', ''), 10);
      const userCustoms = await getCustomSources(user.id);
      const match = userCustoms.find(c => c.id === customId);
      if (match) {
        platformObj = {
          id: platformId,
          name: match.source_name,
          url: match.source_url,
          isCustom: true
        };
      }
    } else {
      platformObj = getPlatformById(platformId);
    }
  }

  // If no platform or default, pick a top news platform (like techcrunch or bbcworld)
  if (!platformObj) {
    platformObj = getPlatformById('techcrunch') || NEWS_PLATFORMS[0];
  }

  // Helper to normalize strings for robust duplicate matching
  function normalizeKey(str) {
    if (!str) return '';
    return str
      .replace(/<[^>]*>/g, '')
      .replace(/&[a-z0-9#]+;/gi, '')
      .replace(/https?:\/\/(?:www\.)?/gi, '')
      .replace(/\/+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  // Fetch feed and find a strictly fresh, unposted article
  if (platformObj && platformObj.url) {
    try {
      const articles = await fetchRSSFeed(platformObj.url, platformObj.name);
      if (articles && articles.length > 0) {
        const userRecentPosts = await getUserPosts(user.id);
        const postedUrlKeys = new Set();
        const postedTitleKeys = new Set();

        for (const p of userRecentPosts) {
          // Track posted URL links
          const linkMatch = (p.content || '').match(/href=["']([^"']+)["']/i);
          if (linkMatch && linkMatch[1]) {
            postedUrlKeys.add(normalizeKey(linkMatch[1]));
          }

          // Track posted article titles (headline is first line in post content)
          const firstLine = (p.content || '').split('\n').find(l => l.trim().length > 0) || '';
          if (firstLine) {
            postedTitleKeys.add(normalizeKey(firstLine));
          }
        }

        // Find the first article that hasn't been posted yet (by URL and by title)
        articleToPost = articles.find(a => {
          const urlKey = normalizeKey(a.link);
          const titleKey = normalizeKey(a.title);

          const isUrlPosted = urlKey && postedUrlKeys.has(urlKey);
          const isTitlePosted = titleKey && postedTitleKeys.has(titleKey);

          return !isUrlPosted && !isTitlePosted;
        });

        if (!articleToPost) {
          console.log(`All ${articles.length} articles from ${platformObj.name} have already been posted. Trying adjacent platforms...`);
          // Try other platforms in same category or top platforms to find fresh content
          for (const altPlat of NEWS_PLATFORMS) {
            if (altPlat.id === platformObj.id || !altPlat.url) continue;
            try {
              const altArticles = await fetchRSSFeed(altPlat.url, altPlat.name);
              const freshAlt = altArticles.find(a => {
                const urlKey = normalizeKey(a.link);
                const titleKey = normalizeKey(a.title);
                return !postedUrlKeys.has(urlKey) && !postedTitleKeys.has(titleKey);
              });
              if (freshAlt) {
                articleToPost = freshAlt;
                platformObj = altPlat;
                console.log(`Found fresh alternative article from ${altPlat.name}: ${freshAlt.title}`);
                break;
              }
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      console.error(`Error fetching platform articles for ${platformObj.name}:`, e.message);
    }
  }

  let postedContent = '';
  let postTitle = '';

  if (articleToPost) {
    // Format news article using user's content structure & translation
    postedContent = await formatNewsArticle(
      articleToPost, 
      userChannelLink, 
      showSourceLink, 
      useDotPunctuation, 
      user.telegram_id,
      schedule.target_lang || 'am'
    );
    postTitle = articleToPost.title || 'News Article';

    // Post to channel (with photo/video if available)
    if (articleToPost.video) {
      try {
        await api.sendVideo({
          chat_id: schedule.channel_id,
          video: articleToPost.video,
          caption: postedContent,
          parse_mode: 'HTML'
        });
      } catch (err) {
        console.warn('Failed video post, trying text fallback:', err.message);
        await api.sendMessage({
          chat_id: schedule.channel_id,
          text: postedContent,
          parse_mode: 'HTML'
        });
      }
    } else if (articleToPost.image) {
      try {
        await api.sendPhoto({
          chat_id: schedule.channel_id,
          photo: articleToPost.image,
          caption: postedContent,
          parse_mode: 'HTML'
        });
      } catch (err) {
        console.warn('Failed photo post, trying text fallback:', err.message);
        await api.sendMessage({
          chat_id: schedule.channel_id,
          text: postedContent,
          parse_mode: 'HTML'
        });
      }
    } else {
      await api.sendMessage({
        chat_id: schedule.channel_id,
        text: postedContent,
        parse_mode: 'HTML'
      });
    }

    // Save post record
    await createPost(
      user.id, 
      schedule.channel_id, 
      postedContent, 
      articleToPost.category || 'news', 
      platformObj?.name || 'News', 
      articleToPost.video || articleToPost.image || null
    );

  } else {
    // Fallback if no article could be fetched
    try {
      const idea = await generateIdea(user.telegram_id);
      postedContent = idea.content;
      postTitle = idea.topic;

      await api.sendMessage({
        chat_id: schedule.channel_id,
        text: postedContent,
        parse_mode: 'Markdown'
      });

      await createPost(user.id, schedule.channel_id, postedContent, idea.category, null, null);
    } catch (e) {
      console.warn('generateIdea fallback failed, attempting emergency news synthesis:', e.message);
      // Emergency article synthesis from techcrunch
      const emergencyArticles = await fetchRSSFeed('https://techcrunch.com/feed/', 'TechCrunch');
      if (emergencyArticles && emergencyArticles.length > 0) {
        postedContent = await formatNewsArticle(
          emergencyArticles[0],
          userChannelLink,
          showSourceLink,
          useDotPunctuation,
          user.telegram_id
        );
        postTitle = emergencyArticles[0].title || 'Tech News';
        await api.sendMessage({
          chat_id: schedule.channel_id,
          text: postedContent,
          parse_mode: 'HTML'
        });
        await createPost(user.id, schedule.channel_id, postedContent, 'technology', 'TechCrunch', null);
      }
    }
  }

  // Update schedule next_post_at and last_posted_at
  await updateAutoPostLastPosted(schedule.id);

  return {
    scheduleId: schedule.id,
    channelId: schedule.channel_id,
    title: postTitle,
    content: postedContent,
    platform: platformObj?.name || 'General'
  };
}

export async function checkAndTriggerDueAutoPosts() {
  const dueSchedules = await getDueAutoPostSchedules();
  if (!dueSchedules || dueSchedules.length === 0) return 0;

  console.log(`⏱️ AutoPost worker found ${dueSchedules.length} due schedule(s)`);

  let count = 0;
  for (const schedule of dueSchedules) {
    try {
      await processSingleAutoPost(schedule);
      count++;
    } catch (err) {
      console.error(`AutoPost failed for schedule ${schedule.id}:`, err.message);
    }
  }
  return count;
}
