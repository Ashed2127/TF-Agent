const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getPreviousTopics, getNextCategory, saveIdea } = require('./database');
const { buildPrompt } = require('./prompts');

async function generateIdea() {
  try {
    console.log('🤖 Generating new idea...');
    
    const previousTopics = getPreviousTopics();
    const category = getNextCategory();
    const prompt = buildPrompt(previousTopics, category);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { 
        maxOutputTokens: 1000, 
        temperature: 0.9 
      }
    });
    
    const result = await model.generateContent(prompt);
    const content = result.response.text().trim();
    
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
    
    const id = saveIdea(content, topic, category);
    
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
