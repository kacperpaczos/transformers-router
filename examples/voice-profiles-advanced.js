/**
 * Advanced Voice Profiles Example
 *
 * This example demonstrates the comprehensive capabilities of the voice profile system,
 * including predefined profiles, custom profile creation, parameter overrides,
 * and proper error handling.
 */

const { createAIProvider, voiceProfileRegistry } = require('../dist/index');

// Safe console logging for different environments
const logger = typeof console !== 'undefined' ? console : {
  log: () => {},
  error: () => {},
  warn: () => {}
};

async function main() {
  logger.log('=== Advanced Voice Profiles Example ===\n');

  // Create AI provider
  const provider = createAIProvider({
    tts: {
      model: 'Xenova/speecht5_tts',
      dtype: 'fp32',
    },
  });

  try {
    // Wait for TTS model to load
    logger.log('Loading TTS model...');
    await provider.warmup('tts');
    logger.log('TTS model loaded successfully.\n');

    // 1. Explore available voice profiles
    logger.log('--- Available Voice Profiles ---');
    const allProfiles = voiceProfileRegistry.list();
    allProfiles.forEach(profile => {
      logger.log(`  ${profile.id}: ${profile.name} (${profile.gender})`);
    });
    logger.log('');

    // 2. Use predefined voice profiles
    logger.log('--- Using Predefined Voice Profiles ---');

    const scenarios = [
      { profile: 'male-formal', text: 'Good morning. I am pleased to present our quarterly report.' },
      { profile: 'male-friendly', text: 'Hello there! How are you doing today?' },
      { profile: 'female-formal', text: 'Ladies and gentlemen, thank you for your attention.' },
      { profile: 'female-friendly', text: 'Hello! I hope you are having a wonderful day.' },
    ];

    for (const scenario of scenarios) {
      logger.log(`\nTesting ${scenario.profile} profile:`);
      logger.log(`"${scenario.text}"`);

      const audio = await provider.speak(scenario.text, {
        voiceProfile: scenario.profile,
      });

      logger.log(`Generated audio file: ${audio.size} bytes`);
    }

    // 3. Create custom voice profiles
    logger.log('\n--- Creating Custom Voice Profiles ---');

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

    logger.log('Custom voice profiles created successfully');

    // 4. Use custom profiles with parameter overrides
    logger.log('\n--- Using Custom Profiles with Parameter Overrides ---');

    const customScenarios = [
      {
        profile: 'executive-male',
        text: 'Our company achieved record profits this quarter.',
        overrides: { speed: 0.8, pitch: 0.9, emotion: 'calm' }
      },
      {
        profile: 'cheerful-assistant',
        text: 'I am here to help you with anything you need.',
        overrides: { speed: 1.2, pitch: 1.1, emotion: 'happy' }
      },
    ];

    for (const scenario of customScenarios) {
      logger.log(`\nTesting ${scenario.profile} profile with parameter overrides:`);
      logger.log(`"${scenario.text}"`);

      const audio = await provider.speak(scenario.text, {
        voiceProfile: scenario.profile,
        ...scenario.overrides,
      });

      logger.log(`Generated audio file: ${audio.size} bytes`);
    }

    // 5. Voice profile management
    logger.log('\n--- Voice Profile Management ---');
    logger.log(`Total profiles registered: ${voiceProfileRegistry.size()}`);

    const maleProfiles = voiceProfileRegistry.listByGender('male');
    const femaleProfiles = voiceProfileRegistry.listByGender('female');

    logger.log(`Male voice profiles: ${maleProfiles.length}`);
    maleProfiles.forEach(p => logger.log(`  - ${p.name}`));

    logger.log(`Female voice profiles: ${femaleProfiles.length}`);
    femaleProfiles.forEach(p => logger.log(`  - ${p.name}`));

    // 6. Error handling
    logger.log('\n--- Error Handling ---');
    try {
      const audio = await provider.speak('This should fallback to default voice profile.', {
        voiceProfile: 'non-existent-profile',
      });
      logger.log(`Graceful fallback successful: ${audio.size} bytes`);
    } catch (error) {
      logger.log(`Error handling test: ${error.message}`);
    }

  } catch (error) {
    logger.error(`Error during execution: ${error.message}`);
    if (error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
  } finally {
    // Clean up resources
    await provider.dispose();
    logger.log('\n=== Advanced Voice Profiles Example completed ===');
  }
}

main().catch(error => {
  logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});
