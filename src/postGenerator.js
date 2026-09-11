const { getRecentPosts } = require('./postParser');

async function generateInsightfulPost() {
  try {
    console.log('🤖 Generating insightful post based on previous posts...');
    
    const recentPosts = getRecentPosts(5);
    const postsContext = recentPosts.length > 0 
      ? recentPosts.map((post, index) => `Post ${index + 1}: ${post.substring(0, 200)}...`).join('\n\n')
      : 'No previous posts available';
    
    const prompt = `Generate a SHORT insightful Telegram post in Amharic that is RELATED to the previous posts of this channel. 

This should focus on:
- Recommendations on tools, strategies, or approaches
- Asking audience for their suggestions and experiences on specific topics
- Building on themes from previous posts
- Maintaining the same conversational tone and writing style

CRITICAL CONSTRAINTS:
- Maximum 10 lines total
- Maximum 3-4 sentences
- Keep it concise and impactful
- Write in True Feed channel style (same as previous posts)
- No jokes included - just serious insight
- Must maintain context and writing style from previous posts
- Focus on recommendations and asking for suggestions

Previous posts context (analyze the writing style and themes):
${postsContext}

Generate the post in Amharic. Keep it short, insightful, and conversational. Maximum 10 lines. Focus on recommendations and asking for suggestions while maintaining the established writing style.`;
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.8
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid API response structure');
    }
    
    const content = data.choices[0].message.content.trim();
    
    if (!content) {
      throw new Error('Empty response from OpenRouter');
    }
    
    console.log(`✅ Insightful post generated successfully`);
    
    return { content };
    
  } catch (error) {
    console.error('❌ Error generating insightful post:', error.message);
    throw new Error(`Failed to generate insightful post: ${error.message}`);
  }
}

async function generateJoke() {
  try {
    console.log('🤖 Generating joke based on True Feed writing style...');
    
    const recentPosts = getRecentPosts(5);
    const postsContext = recentPosts.length > 0 
      ? recentPosts.map((post, index) => `Post ${index + 1}: ${post.substring(0, 150)}...`).join('\n\n')
      : 'No previous posts available';
    
    const prompt = `Generate a SHORT funny joke in Amharic that matches the True Feed channel writing style and is related to business/entrepreneurship/startups.

CRITICAL CONSTRAINTS:
- Maximum 6 lines total
- Maximum 2-3 sentences
- Must be genuinely funny and unexpected
- Follow True Feed channel tone and style
- Related to business, entrepreneurship, or startups
- Make it witty and clever

Previous posts context for style reference:
${postsContext}

Generate the joke in Amharic. Keep it short and funny. Maximum 6 lines.`;
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.95
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid API response structure');
    }
    
    const content = data.choices[0].message.content.trim();
    
    if (!content) {
      throw new Error('Empty response from OpenRouter');
    }
    
    console.log(`✅ Joke generated successfully`);
    
    return { content };
    
  } catch (error) {
    console.error('❌ Error generating joke:', error.message);
    throw new Error(`Failed to generate joke: ${error.message}`);
  }
}

// Keep the old function for backward compatibility
async function generatePost() {
  return generateInsightfulPost();
}

module.exports = {
  generatePost,
  generateInsightfulPost,
  generateJoke
};