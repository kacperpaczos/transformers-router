/**
 * Voice Profile Registry for managing TTS voice profiles
 */

import type {
  VoiceProfile,
  VoiceProfileOptions,
  VoiceGender,
} from './VoiceProfile';

/**
 * Registry for managing voice profiles
 */
export class VoiceProfileRegistry {
  private profiles: Map<string, VoiceProfile> = new Map();

  constructor() {
    this.initializeDefaultProfiles();
  }

  /**
   * Register a new voice profile
   */
  register(profile: VoiceProfileOptions): void {
    const voiceProfile: VoiceProfile = {
      id: profile.id,
      name: profile.name,
      gender: profile.gender,
      embeddings: profile.embeddings,
      parameters: {
        pitch: 1.0,
        speed: 1.0,
        emotion: 'neutral',
        age: 'adult',
        ...profile.parameters,
      },
      description: profile.description,
    };

    this.profiles.set(profile.id, voiceProfile);
  }

  /**
   * Get a voice profile by ID
   */
  get(id: string): VoiceProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Check if a voice profile exists
   */
  has(id: string): boolean {
    return this.profiles.has(id);
  }

  /**
   * Remove a voice profile
   */
  remove(id: string): void {
    this.profiles.delete(id);
  }

  /**
   * Get all voice profiles
   */
  list(): VoiceProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get voice profiles filtered by gender
   */
  listByGender(gender: VoiceGender): VoiceProfile[] {
    return this.list().filter(profile => profile.gender === gender);
  }

  /**
   * Clear all voice profiles (except defaults)
   */
  clear(): void {
    this.profiles.clear();
    this.initializeDefaultProfiles();
  }

  /**
   * Get the number of registered profiles
   */
  size(): number {
    return this.profiles.size;
  }

  /**
   * Initialize default voice profiles
   */
  private initializeDefaultProfiles(): void {
    // Male profiles
    this.register({
      id: 'male-neutral',
      name: 'Male Neutral',
      gender: 'male',
      embeddings: new Float32Array(512).fill(0.5),
      parameters: {
        pitch: 1.0,
        speed: 1.0,
        emotion: 'neutral',
        age: 'adult',
        style: 'professional',
      },
      description: 'Neutral male voice with professional tone',
    });

    this.register({
      id: 'male-formal',
      name: 'Male Formal',
      gender: 'male',
      embeddings: this.createCustomEmbeddings(0.4, 0.6),
      parameters: {
        pitch: 0.9,
        speed: 0.95,
        emotion: 'neutral',
        age: 'adult',
        style: 'formal',
      },
      description: 'Formal male voice with lower pitch and slower pace',
    });

    this.register({
      id: 'male-friendly',
      name: 'Male Friendly',
      gender: 'male',
      embeddings: this.createCustomEmbeddings(0.6, 0.4),
      parameters: {
        pitch: 1.1,
        speed: 1.05,
        emotion: 'happy',
        age: 'adult',
        style: 'friendly',
      },
      description: 'Friendly male voice with higher pitch and cheerful tone',
    });

    // Female profiles
    this.register({
      id: 'female-neutral',
      name: 'Female Neutral',
      gender: 'female',
      embeddings: new Float32Array(512).fill(0.7),
      parameters: {
        pitch: 1.0,
        speed: 1.0,
        emotion: 'neutral',
        age: 'adult',
        style: 'professional',
      },
      description: 'Neutral female voice with professional tone',
    });

    this.register({
      id: 'female-formal',
      name: 'Female Formal',
      gender: 'female',
      embeddings: this.createCustomEmbeddings(0.6, 0.8),
      parameters: {
        pitch: 0.95,
        speed: 0.9,
        emotion: 'neutral',
        age: 'adult',
        style: 'formal',
      },
      description: 'Formal female voice with controlled pace and tone',
    });

    this.register({
      id: 'female-friendly',
      name: 'Female Friendly',
      gender: 'female',
      embeddings: this.createCustomEmbeddings(0.8, 0.6),
      parameters: {
        pitch: 1.05,
        speed: 1.1,
        emotion: 'happy',
        age: 'adult',
        style: 'friendly',
      },
      description: 'Friendly female voice with warm and approachable tone',
    });
  }

  /**
   * Create custom embeddings with variation
   */
  private createCustomEmbeddings(
    baseValue: number,
    variation: number
  ): Float32Array {
    const embeddings = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      // Add some variation to make embeddings more realistic
      const variationFactor = (Math.sin(i * 0.1) * 0.1 + 1) * variation;
      embeddings[i] = baseValue + (Math.random() - 0.5) * variationFactor;
    }
    return embeddings;
  }
}

// Singleton instance
export const voiceProfileRegistry = new VoiceProfileRegistry();
