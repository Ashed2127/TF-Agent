const { getPreviousTopics, getNextCategory, saveIdea } = require('./database');
const { buildPrompt } = require('./prompts');

async function generateIdea() {
  try {
    console.log('🤖 Generating new idea...');
    
    const previousTopics = await getPreviousTopics();
    const category = await getNextCategory();
    const prompt = buildPrompt(previousTopics, category);
    
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
        max_tokens: 1000,
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
    
    // Validate that the content includes the required structure
    if (!content.includes('🟢')) {
      console.error('❌ AI response missing required structure:', content);
      throw new Error('AI response missing required structure (Title section)');
    }
    
    const lines = content.split('\n');
    const firstLine = lines[0];
    
    let topic = '';
    const colonIndex = firstLine.indexOf('፡');
    if (colonIndex !== -1) {
      topic = firstLine.substring(colonIndex + 1).trim();
    } else {
      // Extract topic from title by removing emojis and formatting
      topic = firstLine
        .replace('🟢', '')
        .replace('Hybrid -', '')
        .replace(/<[^>]*>/g, '')
        .replace(/፡/, '')
        .trim();
    }
    
    // Validate that topic does not contain "Digital"
    if (topic.includes('Digital') || topic.includes('digital')) {
      console.error('❌ Topic contains forbidden word "Digital":', topic);
      throw new Error('Topic contains forbidden word "Digital" - use "Hybrid" instead');
    }
    
    const id = await saveIdea(content, topic, category);
    
    console.log(`✅ Idea generated: ${topic} (ID: ${id})`);
    
    return { id, content, topic, category };
    
  } catch (error) {
    console.error('❌ Error generating idea:', error.message);
    throw new Error(`Failed to generate idea: ${error.message}`);
  }
}

module.exports = {
  generateIdea
};
