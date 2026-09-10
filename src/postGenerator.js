const { getRecentPosts } = require('./postParser');

async function generatePost() {
  try {
    console.log('🤖 Generating new post based on previous posts...');
    
    const recentPosts = getRecentPosts(5);
    const postsContext = recentPosts.length > 0 
      ? recentPosts.map((post, index) => `Post ${index + 1}: ${post.substring(0, 200)}...`).join('\n\n')
      : 'No previous posts available';
    
    const prompt = `Generate a Telegram post in Amharic that is RELATED to the previous posts of this channel. 

This should NOT be a business idea - it should be a regular post that relates to the channel's content, such as:
- Commentary on business trends
- Motivational content for entrepreneurs
- Discussion about startup challenges
- Tips for business owners
- Industry news relevant to the channel

FORMAT:
Write in the same style as the previous posts. Keep it engaging and relevant to the True Feed channel audience.

Must include an INSANE JOKE at the end that matches the writing style of the channel - make it funny, unexpected, and related to business/entrepreneurship.

Previous posts context:
${postsContext}

Generate the post in Amharic. Keep it conversational and engaging. The joke should be genuinely funny and unexpected.`;
    
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
        max_tokens: 800,
        temperature: 0.9
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
    
    console.log(`✅ Post generated successfully`);
    
    return { content };
    
  } catch (error) {
    console.error('❌ Error generating post:', error.message);
    throw new Error(`Failed to generate post: ${error.message}`);
  }
}

module.exports = {
  generatePost
};