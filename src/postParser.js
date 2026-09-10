const fs = require('fs');
const path = require('path');

function parsePreviousPosts() {
  try {
    const htmlPath = path.join(__dirname, '../previous_posts/True_Feed(texts only).html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Extract post content from HTML
    const postRegex = /<div class="message default clearfix"[^>]*>[\s\S]*?<div class="text">([\s\S]*?)<\/div>[\s\S]*?<\/div>/g;
    const posts = [];
    let match;
    
    while ((match = postRegex.exec(htmlContent)) !== null) {
      const postContent = match[1];
      
      // Clean up HTML tags and decode entities
      let cleanContent = postContent
        .replace(/<br\/?>/g, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Filter out empty posts and service messages
      if (cleanContent.length > 50 && !cleanContent.includes('Forwarded from')) {
        posts.push(cleanContent);
      }
    }
    
    console.log(`✅ Parsed ${posts.length} previous posts from HTML file`);
    return posts;
    
  } catch (error) {
    console.error('❌ Error parsing previous posts:', error);
    return [];
  }
}

function getRandomPost() {
  const posts = parsePreviousPosts();
  if (posts.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * posts.length);
  return posts[randomIndex];
}

function getRecentPosts(count = 10) {
  const posts = parsePreviousPosts();
  return posts.slice(-count); // Get the last N posts
}

module.exports = {
  parsePreviousPosts,
  getRandomPost,
  getRecentPosts
};