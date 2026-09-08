import { http } from 'sdk';

export async function generateIdea(previousTopics, category, prompt) {
  const url = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent');
  url.searchParams.append('key', process.env.GEMINI_API_KEY);

  const response = await http.fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.9
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
    throw new Error('Invalid response from Gemini API');
  }

  const content = data.candidates[0].content.parts[0].text.trim();
  
  if (!content) {
    throw new Error('Empty response from Gemini');
  }

  const lines = content.split('\n');
  const firstLine = lines[0];
  
  let topic = '';
  const colonIndex = firstLine.indexOf('፡');
  if (colonIndex !== -1) {
    topic = firstLine.substring(colonIndex + 1).trim();
  } else {
    topic = firstLine.replace('🟩 Business Idea -', '').trim();
  }

  return { content, topic, category };
}
