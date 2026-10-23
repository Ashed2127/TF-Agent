import { fetch } from 'sdk';
import { getPreviousTopics, getNextCategory, saveIdea, getContentStructure, getUserByTelegramId } from './database.js';
import { OPENROUTER_API_KEY } from './secrets.js';

const OWNER_CHAT_ID = 685669468;

// Owner's fixed structure (hardcoded, never changes)
const OWNER_STRUCTURE = `🟢 Hybrid: [Name]

Value [5+ lines insight]

@true_feed`;

// Default user structure (used when user hasn't set a custom one)
const DEFAULT_USER_STRUCTURE = `🟢 Hybrid: [Name]

Value [5+ lines insight]

@true_feed`;

function buildPrompt(previousTopics, category, structure, isOwner = false) {
  const previousTopicsList = previousTopics.length > 0
    ? previousTopics.map(t => `- ${t}`).join('\n')
    : '(none yet)';

  const structureLabel = isOwner ? 'Owner Structure' : 'User Structure';

  return `Generate an Amharic business idea. Short, clear.

CRITICAL: You MUST follow this exact structure format:

${structureLabel}:
${structure}

Instructions:
1. Copy the structure format EXACTLY as shown above
2. Replace placeholders like [Name], [Problem], [Solution] with actual content
3. Keep all emojis, spacing, and formatting exactly as shown
4. Generate content that fits the category: ${category}
5. Avoid these topics: ${previousTopicsList}
6. Use ". . ." for pauses. No Amharic punctuation (።፤፣፡)
7. Include @true_feed attribution at the end

Do NOT change the structure format. Only replace the placeholder content.`;
}

export async function generateIdea(userId = null) {
  try {
    console.log('🤖 Generating new idea...');

    const previousTopics = await getPreviousTopics();
    console.log('Previous topics:', previousTopics);

    const category = await getNextCategory();
    console.log('Category:', category);

    // Determine which structure to use
    let structure = null;
    let isOwner = false;

    if (userId === OWNER_CHAT_ID) {
      // Owner always uses the fixed owner structure
      structure = OWNER_STRUCTURE;
      isOwner = true;
      console.log('👑 Using OWNER structure for user:', userId);
    } else if (userId) {
      // Regular user: check if they have a custom structure
      // userId here is telegram_id, but we need to convert to database id for getContentStructure
      const user = await getUserByTelegramId(userId);
      if (user) {
        const customStructure = await getContentStructure(user.id);
        if (customStructure) {
          structure = customStructure.structure_template;
          console.log('✅ Using USER custom structure for user:', userId);
          console.log('User database ID:', user.id);
          console.log('Custom structure full:', structure);
        } else {
          structure = DEFAULT_USER_STRUCTURE;
          console.log('ℹ️ Using DEFAULT USER structure for user:', userId);
          console.log('User database ID:', user.id);
          console.log('No custom structure found in database');
        }
      } else {
        structure = DEFAULT_USER_STRUCTURE;
        console.log('ℹ️ User not found, using DEFAULT USER structure');
        console.log('Telegram ID:', userId);
      }
    } else {
      // No userId provided (fallback)
      structure = DEFAULT_USER_STRUCTURE;
      console.log('ℹ️ No userId provided, using DEFAULT USER structure');
    }

    const prompt = buildPrompt(previousTopics, category, structure, isOwner);
    console.log('Prompt length:', prompt.length);
    console.log('Structure type:', isOwner ? 'OWNER' : (userId ? 'USER' : 'DEFAULT'));
    console.log('Full prompt preview:', prompt.substring(0, 500));

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
        max_tokens: isOwner ? 500 : 800,
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

    // Validate that the content includes the required structure (🟢 emoji)
    if (!cleanContent.includes('🟢')) {
      console.error('❌ AI response missing required structure:', cleanContent);
      throw new Error('AI response missing required structure (Title section)');
    }

    // Normalize Hybrid colon in title if needed
    cleanContent = cleanContent.replace(/🟢\s*Hybrid[፡:]/g, '🟢 Hybrid:');

    // Replace Amharic punctuation with . . and . . . pauses (always apply)
    cleanContent = cleanContent.replace(/[።፤]/g, ' . . . ');
    cleanContent = cleanContent.replace(/[፣፡]/g, ' . . ');

    // Normalize spacing around pauses (. . . and . .)
    cleanContent = cleanContent.replace(/\s*\.\s*\.\s*\.\s*/g, ' . . . ');
    cleanContent = cleanContent.replace(/([^\.])\s*\.\s*\.\s*([^\.])/g, '$1 . . $2');
    cleanContent = cleanContent.replace(/[ ]{2,}/g, ' ').trim();

    // Validate that content includes required pauses (. . . or . .) - always required
    if (!cleanContent.includes('. . .') && !cleanContent.includes('. .')) {
      console.error('❌ AI response missing required pauses (. . . or . .):', cleanContent);
      throw new Error('AI response missing required pauses (. . .)');
    }

    // Validate that content includes *@true_feed* (always required)
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

      // If topic is still empty after cleaning, use first 50 chars of content
      if (!topic || topic.length < 3) {
        topic = cleanContent.split('\n')[0].substring(0, 50).trim();
      }
    }

    // Validate that topic does not contain "Digital" (always enforce)
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
