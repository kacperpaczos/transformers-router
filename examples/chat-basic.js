/**
 * Basic Chat Example with Transformers Router Library
 *
 * This example demonstrates basic chat functionality with the Transformers Router library,
 * including simple message exchange, chat with history, and token usage tracking.
 */

import { createAIProvider } from '../dist/index.js';

// Safe console logging for different environments
const logger = typeof console !== 'undefined' ? console : {
  log: () => {},
  error: () => {},
  warn: () => {}
};

async function main() {
  logger.log('=== Basic Chat Example ===\n');

  // Create AI provider with LLM configuration
  const provider = createAIProvider({
    llm: {
      model: 'onnx-community/Qwen2.5-0.5B-Instruct',
      dtype: 'q4',
      maxTokens: 100,
      temperature: 0.7,
    },
  });

  // Listen to progress events
  provider.on('progress', ({ modality, file, progress }) => {
    logger.log(`Loading ${modality}: ${file} (${progress}%)`);
  });

  provider.on('ready', ({ modality, model }) => {
    logger.log(`${modality} model ready: ${model}`);
  });

  try {
    // Simple chat interaction
    logger.log('\n--- Simple Chat Interaction ---');
    logger.log('User: Hello! Who are you?');
    const response1 = await provider.chat('Hello! Who are you?');
    logger.log(`AI: ${response1.content}`);

    logger.log('\nUser: What can you help me with?');
    const response2 = await provider.chat('What can you help me with?');
    logger.log(`AI: ${response2.content}`);

    // Chat with message history
    logger.log('\n--- Chat with Message History ---');
    const messages = [
      { role: 'system', content: 'You are a helpful coding assistant.' },
      { role: 'user', content: 'What is JavaScript?' },
    ];

    logger.log('System: You are a helpful coding assistant.');
    logger.log('User: What is JavaScript?');
    const response3 = await provider.chat(messages);
    logger.log(`AI: ${response3.content}`);

    // Display token usage information
    if (response3.usage) {
      logger.log(`\nToken usage: ${response3.usage.totalTokens} total tokens`);
      if (response3.usage.promptTokens) {
        logger.log(`  - Prompt tokens: ${response3.usage.promptTokens}`);
      }
      if (response3.usage.completionTokens) {
        logger.log(`  - Completion tokens: ${response3.usage.completionTokens}`);
      }
    }

  } catch (error) {
    logger.error(`Error during chat execution: ${error.message}`);
    if (error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
  } finally {
    // Clean up resources
    await provider.dispose();
    logger.log('\n=== Chat example completed ===');
  }
}

main().catch(error => {
  logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});

