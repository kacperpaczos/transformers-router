/**
 * Basic Usage Example - Getting Started with Transformers Router
 */

const { createAIProvider } = require('../dist/index');

async function main() {
  console.log('🚀 Transformers Router - Basic Example\n');

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
    console.log('Loading models...');
    await provider.warmup('llm');
    await provider.warmup('tts');
    await provider.warmup('stt');

    // 1. Simple text generation
    console.log('📝 Text Generation:');
    const response = await provider.chat('Write a short poem about AI');
    console.log(`AI: ${response.content}\n`);

    // 2. Chat with history
    console.log('💬 Chat with History:');
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is machine learning?' },
    ];
    const chatResponse = await provider.chat(messages);
    console.log(`AI: ${chatResponse.content}\n`);

    // 3. Text-to-Speech
    console.log('🔊 Text-to-Speech:');
    const audioBlob = await provider.speak('Hello! This is a test of text to speech synthesis.');
    console.log(`Generated audio: ${audioBlob.size} bytes\n`);

    // 4. Speech-to-Text (requires audio file)
    console.log('🎤 Speech-to-Text:');
    console.log('Note: STT requires an audio file. This is just a demo of the API.');
    // const transcription = await provider.listen(audioBlob);
    // console.log(`Transcription: "${transcription}"`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Clean up resources
    await provider.dispose();
    console.log('✅ Example completed');
  }
}

main();
