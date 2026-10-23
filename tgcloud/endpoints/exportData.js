import { db } from 'sdk';
import { getAllUsers, getAllPosts, getUserChannels, getCustomSources, getContentStructure, getAutoPostSchedule } from '../lib/database.js';

const OWNER_CHAT_ID = 685669468;

export default async function (input, ctx) {
  console.log('Export data endpoint called');

  // Check if user is owner
  const userId = ctx.initData?.user?.id;
  if (!userId || userId !== OWNER_CHAT_ID) {
    return {
      error: 'Unauthorized',
      message: 'Only the owner can export data'
    };
  }

  try {
    // Get all data
    const users = await getAllUsers();
    const posts = await getAllPosts();

    // Get detailed data for each user
    const detailedData = await Promise.all(users.map(async (user) => {
      const channels = await getUserChannels(user.id);
      const customSources = await getCustomSources(user.id);
      const contentStructure = await getContentStructure(user.id);
      const autoPostSchedule = await getAutoPostSchedule(user.id);

      return {
        user: {
          id: user.id,
          telegram_id: user.telegram_id,
          username: user.username,
          user_type: user.user_type,
          onboarding_step: user.onboarding_step,
          channel_id: user.channel_id,
          channel_name: user.channel_name,
          test_channel_id: user.test_channel_id,
          test_channel_name: user.test_channel_name,
          display_name: user.display_name,
          bot_display_name: user.bot_display_name,
          show_source_link: user.show_source_link,
          use_dot_punctuation: user.use_dot_punctuation,
          categories: user.categories,
          posts_count: user.posts_count,
          last_posted_at: user.last_posted_at ? Number(user.last_posted_at) : null,
          created_at: user.created_at ? Number(user.created_at) : null,
          completed_at: user.completed_at ? Number(user.completed_at) : null,
        },
        channels: channels.map(c => ({
          id: c.id,
          channel_id: c.channel_id,
          channel_name: c.channel_name,
          is_main: c.is_main,
          is_test: c.is_test,
          created_at: c.created_at ? Number(c.created_at) : null,
        })),
        custom_sources: customSources.map(s => ({
          id: s.id,
          source_name: s.source_name,
          source_url: s.source_url,
          created_at: s.created_at ? Number(s.created_at) : null,
        })),
        content_structure: contentStructure ? {
          id: contentStructure.id,
          structure_template: contentStructure.structure_template,
          created_at: contentStructure.created_at ? Number(contentStructure.created_at) : null,
          updated_at: contentStructure.updated_at ? Number(contentStructure.updated_at) : null,
        } : null,
        auto_post_schedule: autoPostSchedule ? {
          id: autoPostSchedule.id,
          channel_id: autoPostSchedule.channel_id,
          interval_hours: autoPostSchedule.interval_hours,
          is_active: autoPostSchedule.is_active,
          last_posted_at: autoPostSchedule.last_posted_at ? Number(autoPostSchedule.last_posted_at) : null,
          next_post_at: autoPostSchedule.next_post_at ? Number(autoPostSchedule.next_post_at) : null,
          created_at: autoPostSchedule.created_at ? Number(autoPostSchedule.created_at) : null,
        } : null,
      };
    }));

    // Get all posts with user info
    const postsWithUsers = posts.map(post => {
      const user = users.find(u => u.id === post.user_id);
      return {
        id: post.id,
        user_id: post.user_id,
        user_telegram_id: user ? user.telegram_id : null,
        user_username: user ? user.username : null,
        channel_id: post.channel_id,
        content: post.content,
        category: post.category,
        source: post.source,
        image_url: post.image_url,
        created_at: post.created_at ? Number(post.created_at) : null,
      };
    });

    const exportData = {
      export_date: new Date().toISOString(),
      total_users: users.length,
      total_posts: posts.length,
      users: detailedData,
      posts: postsWithUsers,
    };

    return exportData;

  } catch (error) {
    console.error('Error exporting data:', error);
    return {
      error: error.message,
      details: error.toString()
    };
  }
}
