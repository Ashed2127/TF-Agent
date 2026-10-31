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

  // Fetch feed and find fresh article
  if (platformObj && platformObj.url) {
    try {
      const articles = await fetchRSSFeed(platformObj.url, platformObj.name);
      if (articles && articles.length > 0) {
        const userRecentPosts = await getUserPosts(user.id);
        const postedUrls = new Set(
          userRecentPosts
            .map(p => {
              const m = (p.content || '').match(/href=["']([^"']+)["']/i);
              return m ? m[1] : null;
            })
            .filter(Boolean)
        );

        articleToPost = articles.find(a => a.link && !postedUrls.has(a.link)) || articles[0];
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
      user.telegram_id
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
    const idea = await generateIdea(user.telegram_id);
    postedContent = idea.content;
    postTitle = idea.topic;

    await api.sendMessage({
      chat_id: schedule.channel_id,
      text: postedContent,
      parse_mode: 'Markdown'
    });

    await createPost(user.id, schedule.channel_id, postedContent, idea.category, null, null);
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
