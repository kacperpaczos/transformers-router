/**
 * OpenAI-Compatible API Example
 * Shows how to use the library with OpenAI-compatible interface
 */

import { createAIProvider, OpenAIAdapter } from '../dist/index.js';

async function main() {
  console.log('=== OpenAI-Compatible API Example ===\n');

  // Create AI provider
  const provider = createAIProvider({
    llm: {
      model: 'onnx-community/Qwen2.5-0.5B-Instruct',
      dtype: 'q4',
    },
  });

  // Wrap with OpenAI adapter
  const openai = new OpenAIAdapter(provider);

  try {
    console.log('Creating chat completion...');

    // Use OpenAI-compatible API
    const completion = await openai.createChatCompletion({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Explain quantum computing in one sentence.' },
      ],
      temperature: 0.7,
      max_tokens: 50,
    });

    console.log('\nResponse:');
    console.log('ID:', completion.id);
    console.log('Model:', completion.model);
    console.log('Message:', completion.choices[0].message.content);
    console.log('Finish reason:', completion.choices[0].finish_reason);
    console.log('Tokens used:', completion.usage.totalTokens);

    console.log('\n--- Text Completion Example ---\n');

    const textCompletion = await openai.createCompletion({
      prompt: 'Once upon a time in a distant land',
      max_tokens: 50,
      temperature: 0.8,
    });

    console.log('Generated text:', textCompletion.choices[0].text);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await provider.dispose();
  }
}

main();

