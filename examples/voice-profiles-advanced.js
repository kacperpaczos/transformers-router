/**
 * Advanced Voice Profiles Example
 *
 * Demonstrates the full capabilities of the voice profile system
 */

const { createAIProvider, voiceProfileRegistry } = require('../dist/index');

async function main() {
  console.log('🎭 Advanced Voice Profiles Example\n');

  // Create AI provider
  const provider = createAIProvider({
    tts: {
      model: 'Xenova/speecht5_tts',
      dtype: 'fp32',
    },
  });

  try {
    // Wait for TTS model to load
    console.log('Loading TTS model...');
    await provider.warmup('tts');

    // 1. Explore available voice profiles
    console.log('📋 Available Voice Profiles:');
    const allProfiles = voiceProfileRegistry.list();
    allProfiles.forEach(profile => {
      console.log(`  ${profile.id}: ${profile.name} (${profile.gender})`);
    });
    console.log('');

    // 2. Use predefined voice profiles
    console.log('🎤 Using Predefined Voice Profiles:');

    const scenarios = [
      { profile: 'male-formal', text: 'Good morning. I am pleased to present our quarterly report.' },
      { profile: 'male-friendly', text: 'Hey there! How are you doing today?' },
      { profile: 'female-formal', text: 'Ladies and gentlemen, thank you for your attention.' },
      { profile: 'female-friendly', text: 'Hi! I hope you\'re having a wonderful day!' },
    ];

    for (const scenario of scenarios) {
      console.log(`\nUsing ${scenario.profile}:`);
      console.log(`"${scenario.text}"`);

      const audio = await provider.speak(scenario.text, {
        voiceProfile: scenario.profile,
      });

      console.log(`✅ Generated: ${audio.size} bytes`);
    }

    // 3. Create custom voice profiles
    console.log('\n🛠️ Creating Custom Voice Profiles:');

    // Corporate executive voice
    voiceProfileRegistry.register({
      id: 'executive-male',
      name: 'Executive Male',
      gender: 'male',
      embeddings: new Float32Array(512).fill(0.45),
      parameters: {
        pitch: 0.85,
        speed: 0.9,
        emotion: 'neutral',
        age: 'adult',
        style: 'formal',
        accent: 'us',
      },
      description: 'Professional male voice for business presentations',
    });

    // Cheerful assistant voice
    voiceProfileRegistry.register({
      id: 'cheerful-assistant',
      name: 'Cheerful Assistant',
      gender: 'female',
      embeddings: new Float32Array(512).fill(0.75),
      parameters: {
        pitch: 1.15,
        speed: 1.1,
        emotion: 'happy',
        age: 'young',
        style: 'friendly',
        accent: 'us',
      },
      description: 'Warm and approachable female voice for customer service',
    });

    console.log('✅ Created custom voice profiles');

    // 4. Use custom profiles with parameter overrides
    console.log('\n🎛️ Using Custom Profiles with Overrides:');

    const customScenarios = [
      {
        profile: 'executive-male',
        text: 'Our company achieved record profits this quarter.',
        overrides: { speed: 0.8, pitch: 0.9, emotion: 'calm' }
      },
      {
        profile: 'cheerful-assistant',
        text: 'I\'m here to help you with anything you need!',
        overrides: { speed: 1.2, pitch: 1.1, emotion: 'happy' }
      },
    ];

    for (const scenario of customScenarios) {
      console.log(`\nUsing ${scenario.profile} with overrides:`);
      console.log(`"${scenario.text}"`);

      const audio = await provider.speak(scenario.text, {
        voiceProfile: scenario.profile,
        ...scenario.overrides,
      });

      console.log(`✅ Generated: ${audio.size} bytes`);
    }

    // 5. Voice profile management
    console.log('\n📊 Voice Profile Management:');
    console.log(`Total profiles: ${voiceProfileRegistry.size()}`);

    const maleProfiles = voiceProfileRegistry.listByGender('male');
    const femaleProfiles = voiceProfileRegistry.listByGender('female');

    console.log(`Male profiles: ${maleProfiles.length}`);
    maleProfiles.forEach(p => console.log(`  - ${p.name}`));

    console.log(`Female profiles: ${femaleProfiles.length}`);
    femaleProfiles.forEach(p => console.log(`  - ${p.name}`));

    // 6. Error handling
    console.log('\n⚠️ Error Handling:');
    try {
      const audio = await provider.speak('This should fallback to default.', {
        voiceProfile: 'non-existent-profile',
      });
      console.log(`✅ Graceful fallback: ${audio.size} bytes`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await provider.dispose();
    console.log('\n✅ Advanced Voice Profiles Example completed!');
  }
}

main();
