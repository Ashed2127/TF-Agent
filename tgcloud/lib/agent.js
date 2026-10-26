import { fetch } from 'sdk';
import { getPreviousTopics, getNextCategory, saveIdea, getContentStructure, getUserByTelegramId, getUserById } from './database.js';
import { OPENROUTER_API_KEY } from './secrets.js';

const OWNER_CHAT_ID = 685669468;

// Default owner structure (fallback if no custom structure set)
const OWNER_STRUCTURE = `🟢 Hybrid: [Name]

Value [5+ lines insight]

@true_feed`;

// Default user structure (fallback if no custom structure set)
const DEFAULT_USER_STRUCTURE = `🟢 Hybrid: [Name]

Value [5+ lines insight]

@true_feed`;

function buildPrompt(previousTopics, category, structure) {
  const previousTopicsList = previousTopics.length > 0
    ? previousTopics.map(t => `- ${t}`).join('\n')
    : '(none yet)';

  return {
    system: `You are an expert Amharic content generator. You MUST strictly follow the EXACT structure template provided by the user. Match the layout, section sequence, blank lines, bullet styles, and emojis of the template. Output ONLY the final generated post without any introductory or concluding comments.`,
    user: `Generate an Amharic business idea in the category: ${category}

STRUCTURE TEMPLATE TO FOLLOW:
${structure}

INSTRUCTIONS:
1. Follow the template layout, section order, emojis, and formatting EXACTLY.
2. If the template uses placeholders (such as [Name], [Title], [Idea], [Details], [5+ lines insight], [ርዕስ], [መረጃ], etc.), replace each placeholder with appropriate Amharic content. Do not leave placeholder brackets.
3. If the template is a sample post, replicate its exact structure, replacing the sample text with the new business idea.
4. Keep all emojis, line breaks, prefixes, and channel handles from the template.
5. Avoid these previously used topics: ${previousTopicsList}
6. Output ONLY the filled-in template.`
  };
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
    let user = null;
    const isOwner = (userId === OWNER_CHAT_ID);

    if (userId) {
      user = await getUserByTelegramId(userId);
      if (!user) {
        user = await getUserById(userId);
      }
      if (user) {
        console.log('🔍 Found user record for telegram_id:', userId, 'with user.id:', user.id);
        const customStructure = await getContentStructure(user.id);
        console.log('🔍 Custom structure query result:', customStructure);
        if (customStructure && customStructure.structure_template) {
          structure = customStructure.structure_template.trim();
          console.log('✅ Using USER custom structure for user:', userId);
          console.log('📝 Structure preview:', structure.substring(0, 100));
        } else {
          console.log('⚠️ No custom structure found for user.id:', user.id);
        }
      } else {
        console.log('⚠️ User not found for telegram_id:', userId);
      }
    }

    // Fall back to default template if no custom structure was set
    if (!structure) {
      if (isOwner) {
        structure = OWNER_STRUCTURE;
        console.log('👑 Using default OWNER structure for user:', userId);
      } else {
        structure = DEFAULT_USER_STRUCTURE;
        console.log('ℹ️ Using DEFAULT USER structure for user:', userId);
      }
    }

    const prompt = buildPrompt(previousTopics, category, structure);
    console.log('Prompt length:', prompt.user.length);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        max_tokens: 800,
        temperature: 0.8
      })
    });

    console.log('API response status:', response.status);

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

    // Remove HTML tags to avoid Telegram parsing issues
    let cleanContent = content.replace(/<[^>]*>/g, '').trim();

    // If user explicitly enabled dot punctuation in settings, apply it
    if (user?.use_dot_punctuation === 1) {
      cleanContent = cleanContent
        .replace(/[።፤]/g, ' . . . ')
        .replace(/[፣፡]/g, ' . . ')
        .replace(/\s*\.\s*\.\s*\.\s*/g, ' . . . ')
        .replace(/([^\.])\s*\.\s*\.\s*([^\.])/g, '$1 . . $2')
        .replace(/[ ]{2,}/g, ' ')
        .trim();
    }

    // Extract topic from first line for database tracking
    const lines = cleanContent.split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0] || '';
    let topic = '';
    const colonIndex = firstLine.indexOf(':') !== -1 ? firstLine.indexOf(':') : firstLine.indexOf('፡');
    if (colonIndex !== -1) {
      topic = firstLine.substring(colonIndex + 1).trim();
    } else {
      topic = firstLine
        .replace(/^[^\p{L}\p{N}]+/gu, '') // remove leading symbols/emojis
        .replace(/<[^>]*>/g, '')
        .replace(/[\*\_\[\]]/g, '')
        .trim();
    }

    if (!topic || topic.length < 2) {
      topic = firstLine.substring(0, 50).trim() || category;
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
