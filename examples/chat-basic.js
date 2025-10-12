/**
 * Basic Chat Example with Transformers Router
 */

const { createAIProvider } = require('../dist/index');

async function main() {
  console.log('🤖 Basic Chat Example\n');

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
    console.log(`Loading ${modality}: ${file} (${progress}%)`);
  });

  provider.on('ready', ({ modality, model }) => {
    console.log(`✅ ${modality} ready: ${model}\n`);
  });

  try {
    console.log('User: Hello! Who are you?');
    const response1 = await provider.chat('Hello! Who are you?');
    console.log(`AI: ${response1.content}\n`);

    console.log('User: What can you help me with?');
    const response2 = await provider.chat('What can you help me with?');
    console.log(`AI: ${response2.content}\n`);

    // Chat with message history
    console.log('--- Chat with history ---');
    const messages = [
      { role: 'system', content: 'You are a helpful coding assistant.' },
      { role: 'user', content: 'What is JavaScript?' },
    ];

    console.log('User: What is JavaScript?');
    const response3 = await provider.chat(messages);
    console.log(`AI: ${response3.content}\n`);

    console.log(`Token usage: ${response3.usage?.totalTokens} tokens`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await provider.dispose();
  }
}

main();

