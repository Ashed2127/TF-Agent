import { fetch } from 'sdk';
import { getPreviousTopics, getNextCategory, saveIdea } from './database.js';
import { OPENROUTER_API_KEY } from './secrets.js';

function buildPrompt(previousTopics, category) {
  const previousTopicsList = previousTopics.length > 0
    ? previousTopics.map(t => `- ${t}`).join('\n')
    : '(none yet)';

  return `Amharic business idea. Short, clear.

Format:
🟢 Hybrid: [Name]

Value [5+ lines insight]

@true_feed

Avoid: ${previousTopicsList}
Category: ${category}

Use ". . ." for pauses. No Amharic punctuation (።፤፣፡). Output only from 🟢 to @true_feed.`;
}

export async function generateIdea() {
  try {
    console.log('🤖 Generating new idea...');
    
    const previousTopics = await getPreviousTopics();
    console.log('Previous topics:', previousTopics);
    
    const category = await getNextCategory();
    console.log('Category:', category);
    
    const prompt = buildPrompt(previousTopics, category);
    console.log('Prompt length:', prompt.length);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.9
      })
    });
    
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('API response data keys:', Object.keys(data));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid API response structure');
    }
    
    const content = data.choices[0].message.content.trim();
    
    if (!content) {
      throw new Error('Empty response from OpenRouter');
    }
    
    // Remove HTML tags to avoid Telegram parsing issues
    let cleanContent = content.replace(/<[^>]*>/g, '');
    
    // Make @true_feed bold using Markdown
    cleanContent = cleanContent.replace('@true_feed', '*@true_feed*');
    
    // Validate that the content includes the required structure
    if (!cleanContent.includes('🟢')) {
      console.error('❌ AI response missing required structure:', cleanContent);
      throw new Error('AI response missing required structure (Title section)');
    }
    
    // Normalize Hybrid colon in title if needed
    cleanContent = cleanContent.replace(/🟢\s*Hybrid[፡:]/g, '🟢 Hybrid:');

    // Replace Amharic punctuation with . . and . . . pauses
    cleanContent = cleanContent.replace(/[።፤]/g, ' . . . ');
    cleanContent = cleanContent.replace(/[፣፡]/g, ' . . ');

    // Normalize spacing around pauses (. . . and . .)
    cleanContent = cleanContent.replace(/\s*\.\s*\.\s*\.\s*/g, ' . . . ');
    cleanContent = cleanContent.replace(/([^\.])\s*\.\s*\.\s*([^\.])/g, '$1 . . $2');
    cleanContent = cleanContent.replace(/[ ]{2,}/g, ' ').trim();
    
    // Validate that content includes required pauses (. . . or . .)
    if (!cleanContent.includes('. . .') && !cleanContent.includes('. .')) {
      console.error('❌ AI response missing required pauses (. . . or . .):', cleanContent);
      throw new Error('AI response missing required pauses (. . .)');
    }
    
    // Validate that content includes *@true_feed*
    if (!cleanContent.includes('*@true_feed*')) {
      console.error('❌ AI response missing @true_feed:', cleanContent);
      throw new Error('AI response missing @true_feed');
    }
    
    const lines = cleanContent.split('\n');
    const firstLine = lines[0];
    
    let topic = '';
    const colonIndex = firstLine.indexOf(':');
    if (colonIndex !== -1) {
      topic = firstLine.substring(colonIndex + 1).trim();
    } else {
      // Extract topic from title by removing emojis and formatting
      topic = firstLine
        .replace('🟢', '')
        .replace('Hybrid -', '')
        .replace(/<[^>]*>/g, '')
        .replace('</strong>', '')
        .replace('<strong>', '')
        .trim();
    }
    
    // Validate that topic does not contain "Digital"
    if (topic.includes('Digital') || topic.includes('digital')) {
      console.error('❌ Topic contains forbidden word "Digital":', topic);
      throw new Error('Topic contains forbidden word "Digital" - use "Hybrid" instead');
    }
    
    const id = await saveIdea(cleanContent, topic, category);
    
    console.log(`✅ Idea generated: ${topic} (ID: ${id})`);
    console.log('Content preview:', cleanContent.substring(0, 100));
    
    return { id, content: cleanContent, topic, category };
    
  } catch (error) {
    console.error('❌ Error generating idea:', error.message);
    throw new Error(`Failed to generate idea: ${error.message}`);
  }
}
