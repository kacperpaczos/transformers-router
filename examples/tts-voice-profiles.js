/**
 * TTS Voice Profiles Example
 * 
 * This example demonstrates how to use voice profiles with the TTS system.
 * It shows both predefined profiles and custom profile creation.
 */

import { createAIProvider, voiceProfileRegistry } from 'transformers-router';

async function voiceProfilesExample() {
  console.log('🎤 TTS Voice Profiles Example\n');

  // Create AI provider with TTS configuration
  const provider = createAIProvider({
    tts: {
      model: 'Xenova/speecht5_tts',
      dtype: 'fp32',
      device: 'cpu',
    },
  });

  try {
    // Warm up the TTS model
    console.log('Loading TTS model...');
    await provider.warmup('tts');
    console.log('✅ TTS model loaded\n');

    // 1. List available voice profiles
    console.log('📋 Available Voice Profiles:');
    const allProfiles = voiceProfileRegistry.list();
    allProfiles.forEach(profile => {
      console.log(`  - ${profile.id}: ${profile.name} (${profile.gender}, ${profile.parameters.style})`);
    });
    console.log('');

    // 2. Use predefined male voice profiles
    console.log('👨 Male Voice Profiles:');
    
    const maleProfiles = voiceProfileRegistry.listByGender('male');
    for (const profile of maleProfiles) {
      console.log(`  Using ${profile.name}...`);
      const audio = await provider.speak(`Hello, I'm using the ${profile.name} voice profile.`, {
        voiceProfile: profile.id,
      });
      console.log(`  ✅ Generated audio: ${audio.size} bytes`);
    }
    console.log('');

    // 3. Use predefined female voice profiles
    console.log('👩 Female Voice Profiles:');
    
    const femaleProfiles = voiceProfileRegistry.listByGender('female');
    for (const profile of femaleProfiles) {
      console.log(`  Using ${profile.name}...`);
      const audio = await provider.speak(`Hello, I'm using the ${profile.name} voice profile.`, {
        voiceProfile: profile.id,
      });
      console.log(`  ✅ Generated audio: ${audio.size} bytes`);
    }
    console.log('');

    // 4. Override voice profile parameters
    console.log('🎛️ Parameter Override Example:');
    const audio1 = await provider.speak('This is a slow, low-pitched voice.', {
      voiceProfile: 'male-neutral',
      speed: 0.7,
      pitch: 0.8,
      emotion: 'calm',
    });
    console.log(`  ✅ Slow voice: ${audio1.size} bytes`);

    const audio2 = await provider.speak('This is a fast, high-pitched voice.', {
      voiceProfile: 'female-neutral',
      speed: 1.3,
      pitch: 1.2,
      emotion: 'happy',
    });
    console.log(`  ✅ Fast voice: ${audio2.size} bytes`);
    console.log('');

    // 5. Create and use custom voice profiles
    console.log('🛠️ Custom Voice Profiles:');

    // Create a custom male voice
    voiceProfileRegistry.register({
      id: 'custom-male-deep',
      name: 'Custom Deep Male Voice',
      gender: 'male',
      embeddings: new Float32Array(512).fill(0.3), // Lower values for deeper voice
      parameters: {
        pitch: 0.7,
        speed: 0.9,
        emotion: 'neutral',
        age: 'senior',
        style: 'professional',
        accent: 'us',
      },
      description: 'A custom deep male voice for professional presentations',
    });

    // Create a custom female voice
    voiceProfileRegistry.register({
      id: 'custom-female-cheerful',
      name: 'Custom Cheerful Female Voice',
      gender: 'female',
      embeddings: new Float32Array(512).fill(0.8), // Higher values for brighter voice
      parameters: {
        pitch: 1.3,
        speed: 1.1,
        emotion: 'happy',
        age: 'young',
        style: 'friendly',
        accent: 'us',
      },
      description: 'A custom cheerful female voice for customer service',
    });

    // Use custom voices
    const customAudio1 = await provider.speak('Welcome to our professional presentation.', {
      voiceProfile: 'custom-male-deep',
    });
    console.log(`  ✅ Custom deep male voice: ${customAudio1.size} bytes`);

    const customAudio2 = await provider.speak('Hello! How can I help you today?', {
      voiceProfile: 'custom-female-cheerful',
    });
    console.log(`  ✅ Custom cheerful female voice: ${customAudio2.size} bytes`);
    console.log('');

    // 6. Voice profile management
    console.log('📊 Voice Profile Management:');
    console.log(`  Total profiles: ${voiceProfileRegistry.size()}`);
    console.log(`  Male profiles: ${voiceProfileRegistry.listByGender('male').length}`);
    console.log(`  Female profiles: ${voiceProfileRegistry.listByGender('female').length}`);
    
    // Check if specific profiles exist
    console.log(`  Has 'male-formal': ${voiceProfileRegistry.has('male-formal')}`);
    console.log(`  Has 'custom-male-deep': ${voiceProfileRegistry.has('custom-male-deep')}`);
    console.log(`  Has 'non-existent': ${voiceProfileRegistry.has('non-existent')}`);
    console.log('');

    // 7. Error handling
    console.log('⚠️ Error Handling:');
    try {
      const audio = await provider.speak('This should fallback to default voice.', {
        voiceProfile: 'non-existent-profile',
      });
      console.log(`  ✅ Graceful fallback: ${audio.size} bytes`);
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    console.log('');

    console.log('🎉 Voice Profiles Example completed successfully!');

  } catch (error) {
    console.error('❌ Error in voice profiles example:', error);
  } finally {
    // Clean up
    await provider.dispose();
  }
}

// Run the example
if (typeof window !== 'undefined') {
  // Browser environment
  window.addEventListener('load', voiceProfilesExample);
} else {
  // Node.js environment
  voiceProfilesExample().catch(console.error);
}
