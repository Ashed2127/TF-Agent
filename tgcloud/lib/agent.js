import { fetch } from 'sdk';
import { getPreviousTopics, getNextCategory, saveIdea } from './database.js';
import { OPENROUTER_API_KEY } from './secrets.js';

function buildPrompt(previousTopics, category) {
  const previousTopicsList = previousTopics.length > 0 
    ? previousTopics.map(t => `- ${t}`).join('\n')
    : '(none yet)';

  return `Generate business idea post in SIMPLE Amharic. Keep it SHORT but clear.

FORMAT:
🟢 Hybrid: [Name]

Value [at least 5 lines of deep insightful idea]

@true_feed

EXAMPLE:
🟢 Hybrid: ለህፃናት አስተማሪ እቃ

Value ህፃናት እንዴት እንደሚማሩ ያውቃል . . . ትኩረት ይሰጣል የእጅ እና የአይን ችሎታ ይሻሻላል
እያንዳንዱ እቃ የተለየ ትምህርት ያስተምራል . . . ከትዳር ጀምሮ የሚያዳብር መሆን አለበት አዳዲስ ነገሮችን ማግኘት ይፈልጋል
ግልፅ እና ቀላል መሆን አለበት የህፃናት አንግስት ማስተምር ይችላል የእውነተኛ ኑሮ ችሎታዎችን ይሻሻላል

@true_feed

PREVIOUS TOPICS TO AVOID:
${previousTopicsList}

CATEGORY: ${category}

Generate post in Amharic. Keep sentences short and clear. MUST use at most 2-3 ". . ." or ". ." for pauses in the entire post. NEVER use Amharic punctuation like ። ፤ ፣ ፡ — use ". . ." or ". ." instead (use regular ":" only after Hybrid in the title). Focus ONLY on Value section with at least 5 lines of deep insightful content. Output ONLY from 🟢 to @true_feed. Do NOT use any HTML tags or formatting - just plain text. The @true_feed will be automatically formatted as bold.`;
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
        max_tokens: 1000,
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
