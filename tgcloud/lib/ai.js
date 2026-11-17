import { fetch } from 'sdk';
import { OPENROUTER_API_KEY, GEMINI_API_KEY } from './secrets.js';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const OPENROUTER_MODEL = 'google/gemini-2.5-flash-lite';

function providerOrder(system, user) {
  let hash = 0;
  const input = `${system || ''}\n${user || ''}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 2 === 0 ? ['gemini', 'openrouter'] : ['openrouter', 'gemini'];
}

async function generateWithGemini({ system, user, maxTokens, temperature }) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    })
  });
  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status}`);
  }
  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map(part => part?.text || '').join('').trim() : '';
  if (!text) throw new Error('Gemini returned an empty response');
  return text;
}

async function generateWithOpenRouter({ system, user, maxTokens, temperature }) {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not configured');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user }
      ],
      max_tokens: maxTokens,
      temperature
    })
  });
  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${response.status}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim() || '';
  if (!text) throw new Error('OpenRouter returned an empty response');
  return text;
}

export async function generateText({ system = '', user, maxTokens = 2000, temperature = 0.7 }) {
  const providers = providerOrder(system, user);
  let lastError = null;
  for (const provider of providers) {
    try {
      return provider === 'gemini'
        ? await generateWithGemini({ system, user, maxTokens, temperature })
        : await generateWithOpenRouter({ system, user, maxTokens, temperature });
    } catch (error) {
      lastError = error;
      console.warn(`AI provider ${provider} failed: ${error.message}`);
    }
  }
  throw lastError || new Error('All AI providers failed');
}
