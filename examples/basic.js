/**
 * Basic Usage Example - Getting Started with Transformers Router
 *
 * This example demonstrates the basic usage of the Transformers Router library,
 * showcasing text generation, chat with history, and text-to-speech capabilities.
 */

const { createAIProvider } = require('../dist/index');

// Check if we're in a Node.js environment where console might not be available
const logger = typeof console !== 'undefined' ? console : {
  log: () => {},
  error: () => {},
  warn: () => {}
};

async function main() {
  logger.log('=== Transformers Router - Basic Example ===\n');

  // Create AI provider with multiple modalities
  const provider = createAIProvider({
    llm: {
      model: 'onnx-community/Qwen2.5-0.5B-Instruct',
      dtype: 'q4',
      maxTokens: 100,
      temperature: 0.7,
    },
    tts: {
      model: 'Xenova/speecht5_tts',
      dtype: 'fp32',
    },
    stt: {
      model: 'Xenova/whisper-tiny',
      dtype: 'fp32',
    },
  });

  try {
    // Wait for models to load
    logger.log('Loading models...');
    await provider.warmup('llm');
    await provider.warmup('tts');
    await provider.warmup('stt');
    logger.log('All models loaded successfully.\n');

    // 1. Simple text generation
    logger.log('--- Text Generation ---');
    const response = await provider.chat('Write a short poem about artificial intelligence');
    logger.log(`Generated text: ${response.content}\n`);

    // 2. Chat with history
    logger.log('--- Chat with History ---');
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is machine learning?' },
    ];
    const chatResponse = await provider.chat(messages);
    logger.log(`Chat response: ${chatResponse.content}\n`);

    // 3. Text-to-Speech
    logger.log('--- Text-to-Speech ---');
    const audioBlob = await provider.speak('Hello! This is a demonstration of text to speech synthesis.');
    logger.log(`Generated audio file: ${audioBlob.size} bytes\n`);

    // 4. Speech-to-Text (requires audio file)
    logger.log('--- Speech-to-Text ---');
    logger.log('Note: STT functionality requires an audio file. This demonstrates the API structure.');
    logger.log('Example usage:');
    logger.log('  const transcription = await provider.listen(audioBlob);');
    logger.log('  logger.log(`Transcription: "${transcription}"`);

  } catch (error) {
    logger.error(`Error during execution: ${error.message}`);
    if (error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
  } finally {
    // Clean up resources
    await provider.dispose();
    logger.log('\n=== Example completed ===');
  }
}

main().catch(error => {
  logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});
