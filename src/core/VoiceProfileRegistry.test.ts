/**
 * Unit tests for VoiceProfileRegistry
 */

import {
  VoiceProfileRegistry,
  voiceProfileRegistry,
} from './VoiceProfileRegistry';
import type { VoiceProfileOptions } from './VoiceProfile';

describe('VoiceProfileRegistry', () => {
  let registry: VoiceProfileRegistry;

  beforeEach(() => {
    registry = new VoiceProfileRegistry();
  });

  describe('Default Profiles', () => {
    it('should initialize with default profiles', () => {
      expect(registry.size()).toBe(6);

      const profiles = registry.list();
      expect(profiles).toHaveLength(6);

      // Check that we have both male and female profiles
      const maleProfiles = registry.listByGender('male');
      const femaleProfiles = registry.listByGender('female');

      expect(maleProfiles).toHaveLength(3);
      expect(femaleProfiles).toHaveLength(3);
    });

    it('should have predefined profile IDs', () => {
      const expectedIds = [
        'male-neutral',
        'male-formal',
        'male-friendly',
        'female-neutral',
        'female-formal',
        'female-friendly',
      ];

      expectedIds.forEach(id => {
        expect(registry.has(id)).toBe(true);
        expect(registry.get(id)).toBeDefined();
      });
    });

    it('should have correct gender distribution', () => {
      const maleProfiles = registry.listByGender('male');
      const femaleProfiles = registry.listByGender('female');

      maleProfiles.forEach(profile => {
        expect(profile.gender).toBe('male');
      });

      femaleProfiles.forEach(profile => {
        expect(profile.gender).toBe('female');
      });
    });
  });

  describe('Profile Registration', () => {
    it('should register a new profile', () => {
      const customProfile: VoiceProfileOptions = {
        id: 'custom-voice',
        name: 'Custom Voice',
        gender: 'male',
        embeddings: new Float32Array(512).fill(0.3),
        parameters: {
          pitch: 1.2,
          speed: 0.8,
          emotion: 'happy',
          style: 'casual',
        },
        description: 'A custom test voice',
      };

      registry.register(customProfile);

      expect(registry.has('custom-voice')).toBe(true);
      expect(registry.size()).toBe(7);

      const retrieved = registry.get('custom-voice');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Custom Voice');
      expect(retrieved?.gender).toBe('male');
      expect(retrieved?.parameters.pitch).toBe(1.2);
    });

    it('should override existing profile with same ID', () => {
      const originalSize = registry.size();

      const newProfile: VoiceProfileOptions = {
        id: 'male-neutral', // Override existing
        name: 'New Male Neutral',
        gender: 'male',
        embeddings: new Float32Array(512).fill(0.1),
        parameters: {
          pitch: 0.5,
          emotion: 'sad',
        },
      };

      registry.register(newProfile);

      expect(registry.size()).toBe(originalSize); // Size should not change

      const retrieved = registry.get('male-neutral');
      expect(retrieved?.name).toBe('New Male Neutral');
      expect(retrieved?.parameters.pitch).toBe(0.5);
    });

    it('should set default parameters for new profile', () => {
      const minimalProfile: VoiceProfileOptions = {
        id: 'minimal-voice',
        name: 'Minimal Voice',
        gender: 'female',
        embeddings: new Float32Array(512).fill(0.5),
      };

      registry.register(minimalProfile);

      const retrieved = registry.get('minimal-voice');
      expect(retrieved?.parameters.pitch).toBe(1.0);
      expect(retrieved?.parameters.speed).toBe(1.0);
      expect(retrieved?.parameters.emotion).toBe('neutral');
      expect(retrieved?.parameters.age).toBe('adult');
    });
  });

  describe('Profile Retrieval', () => {
    it('should get profile by ID', () => {
      const profile = registry.get('male-formal');

      expect(profile).toBeDefined();
      expect(profile?.id).toBe('male-formal');
      expect(profile?.name).toBe('Male Formal');
      expect(profile?.gender).toBe('male');
    });

    it('should return undefined for non-existent profile', () => {
      const profile = registry.get('non-existent');
      expect(profile).toBeUndefined();
    });

    it('should check if profile exists', () => {
      expect(registry.has('male-neutral')).toBe(true);
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('Profile Listing', () => {
    it('should list all profiles', () => {
      const profiles = registry.list();
      expect(profiles).toHaveLength(6);
      expect(profiles.every(p => p.id && p.name && p.gender)).toBe(true);
    });

    it('should filter profiles by gender', () => {
      const maleProfiles = registry.listByGender('male');
      const femaleProfiles = registry.listByGender('female');

      expect(maleProfiles).toHaveLength(3);
      expect(femaleProfiles).toHaveLength(3);

      maleProfiles.forEach(p => expect(p.gender).toBe('male'));
      femaleProfiles.forEach(p => expect(p.gender).toBe('female'));
    });
  });

  describe('Profile Management', () => {
    it('should remove profile', () => {
      const originalSize = registry.size();

      registry.remove('male-neutral');

      expect(registry.has('male-neutral')).toBe(false);
      expect(registry.size()).toBe(originalSize - 1);
    });

    it('should clear all profiles and reinitialize defaults', () => {
      // Add a custom profile first
      registry.register({
        id: 'custom',
        name: 'Custom',
        gender: 'male',
        embeddings: new Float32Array(512).fill(0.1),
      });

      expect(registry.size()).toBe(7);

      registry.clear();

      expect(registry.size()).toBe(6); // Back to default count
      expect(registry.has('custom')).toBe(false);
      expect(registry.has('male-neutral')).toBe(true);
    });

    it('should return correct size', () => {
      expect(registry.size()).toBe(6);

      registry.register({
        id: 'test',
        name: 'Test',
        gender: 'female',
        embeddings: new Float32Array(512).fill(0.1),
      });

      expect(registry.size()).toBe(7);
    });
  });

  describe('Profile Properties', () => {
    it('should have correct embeddings structure', () => {
      const profile = registry.get('male-neutral');
      expect(profile?.embeddings).toBeInstanceOf(Float32Array);
      expect(profile?.embeddings.length).toBe(512);
    });

    it('should have valid parameter ranges', () => {
      const profiles = registry.list();

      profiles.forEach(profile => {
        expect(profile.parameters.pitch).toBeGreaterThan(0);
        expect(profile.parameters.speed).toBeGreaterThan(0);
        expect(['male', 'female']).toContain(profile.gender);
        expect(['neutral', 'happy', 'sad', 'angry', 'calm']).toContain(
          profile.parameters.emotion
        );
        expect(['young', 'adult', 'senior']).toContain(profile.parameters.age);
      });
    });
  });
});

describe('voiceProfileRegistry singleton', () => {
  it('should be a singleton instance', () => {
    expect(voiceProfileRegistry).toBeInstanceOf(VoiceProfileRegistry);
    expect(voiceProfileRegistry.size()).toBe(6);
  });

  it('should maintain state across imports', () => {
    // This test ensures the singleton works correctly
    expect(voiceProfileRegistry.has('male-neutral')).toBe(true);
    expect(voiceProfileRegistry.get('male-formal')?.name).toBe('Male Formal');
  });
});
