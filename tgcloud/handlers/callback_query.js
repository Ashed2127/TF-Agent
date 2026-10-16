// handlers/callback_query.js — runs on each callback_query update (button clicks)

import { api } from 'sdk';
import { generateIdea } from '../lib/agent.js';
import { markPosted, markRejected, getIdeaById, savePendingEdit, getPendingEdit, deletePendingEdit } from '../lib/database.js';
import { TRUE_FEED_CHANNEL_ID, TEST_CHANNEL_ID } from '../lib/secrets.js';
import { NEWS_PLATFORMS, fetchRSSFeed, getPlatformById, formatNewsArticle } from '../lib/news.js';

const OWNER_CHAT_ID = 685669468;

/**
 * Helper function to show the next news article
 */
async function showNextArticle(callbackQuery, platformId, currentIndex) {
  const platform = getPlatformById(platformId);
  
  if (!platform) {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '❌ Platform not found.',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '↩️ Back', callback_data: 'back' }
          ]
        ]
      }
    });
    return;
  }
  
  try {
    const articles = await fetchRSSFeed(platform.url, platform.name);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex >= articles.length) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '📰 No more articles from this platform.',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Refresh', callback_data: `news_platform_${platformId}` },
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ]
        }
      });
      return;
    }
    
    const article = articles[nextIndex];
    const articleText = await formatNewsArticle(article);
    
    const keyboard = [
      [
        { text: '📢 TrueFeed', callback_data: `news_truefeed_${platformId}_${nextIndex}` },
        { text: '🧪 Test', callback_data: `news_test_${platformId}_${nextIndex}` }
      ],
      [
        { text: '✏️ Edit', callback_data: `news_edit_${platformId}_${nextIndex}` },
        { text: '⏭️ Skip', callback_data: `news_skip_${platformId}_${nextIndex}` }
      ],
      [
        { text: '↩️ Back', callback_data: 'get_news' }
      ]
    ];
    
    // Send with image if available, otherwise just text
    if (article.image) {
      try {
        await api.sendPhoto({
          chat_id: callbackQuery.message.chat.id,
          photo: article.image,
          caption: articleText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      } catch (photoError) {
        console.error('Failed to send photo, falling back to text:', photoError.message);
        // Fallback to text if photo fails
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: articleText,
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      }
    } else {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: articleText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    }
    
  } catch (error) {
    console.error('Error showing next article:', error);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: `❌ Failed to load next article: ${error.message}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '↩️ Back', callback_data: 'back' }
          ]
        ]
      }
    });
  }
}

export default async function (callbackQuery, ctx) {
  const userId = callbackQuery.from.id;
  
  // Authorization check
  if (userId !== OWNER_CHAT_ID) {
    await api.answerCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: '⛔ Unauthorized',
    });
    return;
  }
  
  const data = callbackQuery.data;
  console.log('Callback received:', data);
  
  // Answer the callback query (skip if it might be old)
  try {
    await api.answerCallbackQuery({
      callback_query_id: callbackQuery.id,
    });
  } catch (e) {
    console.log('Callback query already answered or expired:', e.message);
  }
  
  // Handle new_idea button
  if (data === 'new_idea') {
    try {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '⏳ Generating idea...',
      });
      
      const idea = await generateIdea();
      
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: idea.content,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve & Post', callback_data: `approve_${idea.id}` },
              { text: '❌ Reject — New Idea', callback_data: `reject_${idea.id}` }
            ],
            [
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('Error in new_idea callback:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Failed to generate idea. Please try again.',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'idea', callback_data: 'new_idea' },
              { text: '📰 news', callback_data: 'get_news' }
            ]
          ]
        }
      });
    }
  }
  
  // Handle back button
  else if (data === 'back') {
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '🌱 TF Agent እንኳን ደህና መጡ!\n\nይህ Bot True Feed ቻናልዎን ያስተዳድራል።\nከታች ያሉትን አማራጮች ይጫኑ።',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'idea', callback_data: 'new_idea' },
            { text: '📰 news', callback_data: 'get_news' }
          ]
        ]
      }
    });
  }
  
  // Handle get_news button - show platform selection
  else if (data === 'get_news') {
    // Organize platforms in rows of 2
    const keyboard = [];
    for (let i = 0; i < NEWS_PLATFORMS.length; i += 2) {
      const row = [];
      row.push({
        text: NEWS_PLATFORMS[i].name,
        callback_data: `news_platform_${NEWS_PLATFORMS[i].id}`
      });
      if (i + 1 < NEWS_PLATFORMS.length) {
        row.push({
          text: NEWS_PLATFORMS[i + 1].name,
          callback_data: `news_platform_${NEWS_PLATFORMS[i + 1].id}`
        });
      }
      keyboard.push(row);
    }
    keyboard.push([
      { text: '↩️ Back', callback_data: 'back' }
    ]);
    
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '📰 Select a news platform:',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  }
  
  // Handle platform selection - fetch and show first news article
  else if (data.startsWith('news_platform_')) {
    const platformId = data.replace('news_platform_', '');
    const platform = getPlatformById(platformId);
    
    if (!platform) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Platform not found.',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ]
        }
      });
      return;
    }
    
    try {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `📰 Fetching news from ${platform.name}...`,
      });
      
      const articles = await fetchRSSFeed(platform.url, platform.name);
      
      if (articles.length === 0) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: `❌ No news available from ${platform.name}.`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '↩️ Back', callback_data: 'back' }
              ]
            ]
          }
        });
        return;
      }
      
      // Show first article with approve/reject/skip buttons
      const article = articles[0];
      const articleText = await formatNewsArticle(article);
      
      const keyboard = [
        [
          { text: '📢 TrueFeed', callback_data: `news_truefeed_${platformId}_0` },
          { text: '🧪 Test', callback_data: `news_test_${platformId}_0` }
        ],
        [
          { text: '✏️ Edit', callback_data: `news_edit_${platformId}_0` },
          { text: '⏭️ Skip', callback_data: `news_skip_${platformId}_0` }
        ],
        [
          { text: '↩️ Back', callback_data: 'get_news' }
        ]
      ];
      
      // Send with image if available, otherwise just text
      if (article.image) {
        try {
          await api.sendPhoto({
            chat_id: callbackQuery.message.chat.id,
            photo: article.image,
            caption: articleText,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
        } catch (photoError) {
          console.error('Failed to send photo, falling back to text:', photoError.message);
          // Fallback to text if photo fails
          await api.sendMessage({
            chat_id: callbackQuery.message.chat.id,
            text: articleText,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
        }
      } else {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: articleText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      }
      
    } catch (error) {
      console.error('Error fetching news:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `❌ Failed to fetch news: ${error.message}`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ]
        }
      });
    }
  }
  
  // Handle news TrueFeed - post to main channel, then show next article
  else if (data.startsWith('news_truefeed_')) {
    const parts = data.replace('news_truefeed_', '').split('_');
    const platformId = parts[0];
    const currentIndex = parseInt(parts[1]);
    
    const platform = getPlatformById(platformId);
    
    if (!platform) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Platform not found.',
      });
      return;
    }
    
    try {
      const articles = await fetchRSSFeed(platform.url, platform.name);
      
      if (currentIndex >= articles.length) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ Article no longer available.',
        });
        return;
      }
      
      const article = articles[currentIndex];
      const articleText = await formatNewsArticle(article);
      
      // Post to the True Feed channel
      if (article.image) {
        try {
          await api.sendPhoto({
            chat_id: TRUE_FEED_CHANNEL_ID,
            photo: article.image,
            caption: articleText,
            parse_mode: 'HTML',
          });
        } catch (photoError) {
          console.error('Failed to send photo to channel, falling back to text:', photoError.message);
          await api.sendMessage({
            chat_id: TRUE_FEED_CHANNEL_ID,
            text: articleText,
            parse_mode: 'HTML',
          });
        }
      } else {
        await api.sendMessage({
          chat_id: TRUE_FEED_CHANNEL_ID,
          text: articleText,
          parse_mode: 'HTML',
        });
      }
      
      // Confirm to the owner
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '✅ Posted to TrueFeed!',
      });
      
    } catch (error) {
      console.error('Error posting article to TrueFeed:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `❌ Failed to post article: ${error.message}`,
      });
    }
    
    // Show next article
    await showNextArticle(callbackQuery, platformId, currentIndex);
  }
  
  // Handle news Test - post to test channel, then show next article
  else if (data.startsWith('news_test_')) {
    const parts = data.replace('news_test_', '').split('_');
    const platformId = parts[0];
    const currentIndex = parseInt(parts[1]);
    
    const platform = getPlatformById(platformId);
    
    if (!platform) {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Platform not found.',
      });
      return;
    }
    
    try {
      const articles = await fetchRSSFeed(platform.url, platform.name);
      
      if (currentIndex >= articles.length) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ Article no longer available.',
        });
        return;
      }
      
      const article = articles[currentIndex];
      const articleText = await formatNewsArticle(article);
      
      // Post to the Test channel
      if (article.image) {
        try {
          await api.sendPhoto({
            chat_id: TEST_CHANNEL_ID,
            photo: article.image,
            caption: articleText,
            parse_mode: 'HTML',
          });
        } catch (photoError) {
          console.error('Failed to send photo to test channel, falling back to text:', photoError.message);
          await api.sendMessage({
            chat_id: TEST_CHANNEL_ID,
            text: articleText,
            parse_mode: 'HTML',
          });
        }
      } else {
        await api.sendMessage({
          chat_id: TEST_CHANNEL_ID,
          text: articleText,
          parse_mode: 'HTML',
        });
      }
      
      // Confirm to the owner
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '🧪 Posted to Test channel!',
      });
      
    } catch (error) {
      console.error('Error posting article to test channel:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `❌ Failed to post article: ${error.message}`,
      });
    }
    
    // Show next article
    await showNextArticle(callbackQuery, platformId, currentIndex);
  }
  
  // Handle news edit - prompt user to send edited version
  else if (data.startsWith('news_edit_')) {
    const parts = data.replace('news_edit_', '').split('_');
    const platformId = parts[0];
    const currentIndex = parseInt(parts[1]);

    // Create a placeholder pending edit so the message handler knows
    // the user's next message is an edit (not a random message)
    await savePendingEdit(callbackQuery.from.id, '__waiting__');

    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '✏️ Please send your edited version of the news.\n\nReply with the text you want to post.',
    });
  }

  // Handle news reject - just show next article
  else if (data.startsWith('news_reject_')) {
    const parts = data.replace('news_reject_', '').split('_');
    const platformId = parts[0];
    const currentIndex = parseInt(parts[1]);

    await showNextArticle(callbackQuery, platformId, currentIndex);
  }

  // Handle news skip - just show next article
  else if (data.startsWith('news_skip_')) {
    const parts = data.replace('news_skip_', '').split('_');
    const platformId = parts[0];
    const currentIndex = parseInt(parts[1]);

    await showNextArticle(callbackQuery, platformId, currentIndex);
  }

  // Handle post edited news to TrueFeed
  else if (data.startsWith('post_edit_truefeed:')) {
    try {
      const pendingEdit = await getPendingEdit(callbackQuery.from.id);
      if (!pendingEdit || pendingEdit.text === '__waiting__') {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ No edited text found. Please try editing again.',
        });
        return;
      }

      await api.sendMessage({
        chat_id: TRUE_FEED_CHANNEL_ID,
        text: pendingEdit.text,
        parse_mode: 'HTML',
      });

      await deletePendingEdit(callbackQuery.from.id);

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '✅ Edited news posted to TrueFeed!',
      });
    } catch (error) {
      console.error('Error posting edited news:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `❌ Failed to post: ${error.message}`,
      });
    }
  }

  // Handle post edited news to Test
  else if (data.startsWith('post_edit_test:')) {
    try {
      const pendingEdit = await getPendingEdit(callbackQuery.from.id);
      if (!pendingEdit || pendingEdit.text === '__waiting__') {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ No edited text found. Please try editing again.',
        });
        return;
      }

      await api.sendMessage({
        chat_id: TEST_CHANNEL_ID,
        text: pendingEdit.text,
        parse_mode: 'HTML',
      });

      await deletePendingEdit(callbackQuery.from.id);

      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '🧪 Edited news posted to Test channel!',
      });
    } catch (error) {
      console.error('Error posting edited news:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `❌ Failed to post: ${error.message}`,
      });
    }
  }

  // Handle cancel edit
  else if (data === 'cancel_edit') {
    await deletePendingEdit(callbackQuery.from.id);
    await api.sendMessage({
      chat_id: callbackQuery.message.chat.id,
      text: '❌ Edit cancelled.',
    });
  }

  // Handle approve button
  else if (data.startsWith('approve_')) {
    const ideaId = parseInt(data.replace('approve_', ''));
    
    try {
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '⏳ Approving and posting idea...',
      });
      
      const idea = await getIdeaById(ideaId);
      
      if (!idea) {
        await api.sendMessage({
          chat_id: callbackQuery.message.chat.id,
          text: '❌ Idea not found.',
        });
        return;
      }
      
      // Post to the True Feed channel
      await api.sendMessage({
        chat_id: TRUE_FEED_CHANNEL_ID,
        text: idea.content,
      });
      
      await markPosted(ideaId);
      
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '✅ Idea approved and posted to channel!',
      });
      
    } catch (error) {
      console.error('Error approving idea:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: `❌ Failed to approve idea: ${error.message}`,
      });
    }
  }
  
  // Handle reject button
  else if (data.startsWith('reject_')) {
    const ideaId = parseInt(data.replace('reject_', ''));
    
    try {
      await markRejected(ideaId);
      
      // Generate new idea
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '⏳ Generating idea...',
      });
      
      const idea = await generateIdea();
      
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: idea.content,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve & Post', callback_data: `approve_${idea.id}` },
              { text: '❌ Reject — New Idea', callback_data: `reject_${idea.id}` }
            ],
            [
              { text: '↩️ Back', callback_data: 'back' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('Error rejecting idea:', error);
      await api.sendMessage({
        chat_id: callbackQuery.message.chat.id,
        text: '❌ Failed to reject idea.',
      });
    }
  }
}
