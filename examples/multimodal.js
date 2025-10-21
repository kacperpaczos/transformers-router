/**
 * Multimodal AI Example
 * Demonstrates LLM, TTS, STT, and Embeddings together
 */

import { createAIProvider } from '../dist/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('=== Multimodal AI Example ===\n');

  // Create AI provider with all modalities
  const provider = createAIProvider({
    llm: {
      model: 'onnx-community/Qwen2.5-0.5B-Instruct',
      dtype: 'q4',
    },
    embedding: {
      model: 'Xenova/all-MiniLM-L6-v2',
      dtype: 'fp32',
    },
    // Uncomment if you want to test TTS/STT (requires audio models)
    // tts: {
    //   model: 'Xenova/speecht5_tts',
    //   dtype: 'fp32',
    // },
    // stt: {
    //   model: 'Xenova/whisper-tiny',
    //   dtype: 'q8',
    // },
  });

  // Track progress
  provider.on('progress', ({ modality, file, progress }) => {
    console.log(`Loading ${modality}: ${file} (${progress}%)`);
  });

  provider.on('ready', ({ modality }) => {
    console.log(`${modality} model ready`);
  });

  try {
    // 1. Chat with LLM
    console.log('--- LLM Chat ---');
    console.log('User: What is artificial intelligence?');
    const chatResponse = await provider.chat(
      'What is artificial intelligence? Answer in one short sentence.',
      { maxTokens: 50 }
    );
    console.log(`AI: ${chatResponse.content}\n`);

    // 2. Embeddings & Similarity
    console.log('--- Embeddings & Semantic Search ---');
    const texts = [
      'The cat sits on the mat',
      'A dog plays in the park',
      'The feline rests on the carpet',
      'Machine learning is fascinating',
    ];

    const query = 'A cat on a rug';
    console.log(`Query: "${query}"`);
    console.log('Texts:', texts);

    const mostSimilar = await provider.findSimilar(query, texts);
    console.log(`\nMost similar: "${mostSimilar.text}"`);
    console.log(`Similarity score: ${(mostSimilar.similarity * 100).toFixed(2)}%\n`);

    // 3. Calculate similarity between two texts
    const text1 = 'I love programming';
    const text2 = 'Coding is my passion';
    const similarity = await provider.similarity(text1, text2);
    console.log(`Similarity between:`);
    console.log(`  "${text1}"`);
    console.log(`  "${text2}"`);
    console.log(`Score: ${(similarity * 100).toFixed(2)}%\n`);

    // 4. TTS Example (if enabled)
    // console.log('--- Text to Speech ---');
    // const audioBlob = await provider.speak('Hello, this is a test.');
    // const audioPath = path.join(__dirname, 'output.wav');
    // const buffer = await audioBlob.arrayBuffer();
    // fs.writeFileSync(audioPath, Buffer.from(buffer));
    // console.log(`Audio saved to: ${audioPath}\n`);

    // 5. STT Example (if enabled and you have an audio file)
    // console.log('--- Speech to Text ---');
    // const audioUrl = 'path/to/audio.wav';
    // const transcription = await provider.listen(audioUrl);
    // console.log(`Transcription: ${transcription}\n`);

    // Check status of all models
    console.log('--- Model Status ---');
    const statuses = provider.getAllStatuses();
    statuses.forEach((status) => {
      console.log(
        `${status.modality}: ${status.loaded ? 'Loaded' : 'Not loaded'}${
          status.model ? ` (${status.model})` : ''
        }`
      );
    });
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\nCleaning up...');
    await provider.dispose();
    console.log('Done!');
  }
}

main();

