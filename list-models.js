/**
 * List available Gemini models for your API key
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GOOGLE_AI_API_KEY;

if (!apiKey) {
  console.error('Missing GOOGLE_AI_API_KEY');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    console.log('🔍 Fetching available models...\n');

    const models = await genAI.listModels();

    console.log(`✅ Found ${models.length} models:\n`);

    models.forEach((model, index) => {
      console.log(`${index + 1}. ${model.name}`);
      console.log(`   Display Name: ${model.displayName}`);
      console.log(`   Description: ${model.description}`);
      console.log(`   Supported methods: ${model.supportedGenerationMethods.join(', ')}`);
      console.log();
    });

    console.log('📝 Models that support generateContent:');
    const generateContentModels = models.filter(m =>
      m.supportedGenerationMethods.includes('generateContent')
    );

    generateContentModels.forEach(m => {
      console.log(`   - ${m.name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listModels();
