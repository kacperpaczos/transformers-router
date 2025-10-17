/**
 * Voice Profile types and interfaces for TTS voice management
 */

// Voice gender types
export type VoiceGender = 'male' | 'female';

// Voice emotion types
export type VoiceEmotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'calm';

// Voice age types
export type VoiceAge = 'young' | 'adult' | 'senior';

// Voice style types
export type VoiceStyle = 'formal' | 'casual' | 'professional' | 'friendly';

// Voice parameters interface
export interface VoiceParameters {
  /** Voice pitch multiplier (0.5-2.0, default 1.0) */
  pitch?: number;
  /** Voice speed multiplier (0.5-2.0, default 1.0) */
  speed?: number;
  /** Voice emotion */
  emotion?: VoiceEmotion;
  /** Voice age category */
  age?: VoiceAge;
  /** Voice accent (e.g., 'us', 'uk', 'au') */
  accent?: string;
  /** Voice speaking style */
  style?: VoiceStyle;
}

// Main Voice Profile interface
export interface VoiceProfile {
  /** Unique identifier for the voice profile */
  id: string;
  /** Display name for the voice profile */
  name: string;
  /** Gender of the voice */
  gender: VoiceGender;
  /** Speaker embeddings for the TTS model */
  embeddings: Float32Array;
  /** Voice parameters and characteristics */
  parameters: VoiceParameters;
  /** Optional description of the voice profile */
  description?: string;
}

// Voice profile creation options
export interface VoiceProfileOptions {
  /** Unique identifier for the voice profile */
  id: string;
  /** Display name for the voice profile */
  name: string;
  /** Gender of the voice */
  gender: VoiceGender;
  /** Speaker embeddings for the TTS model */
  embeddings: Float32Array;
  /** Voice parameters and characteristics */
  parameters?: Partial<VoiceParameters>;
  /** Optional description of the voice profile */
  description?: string;
}
