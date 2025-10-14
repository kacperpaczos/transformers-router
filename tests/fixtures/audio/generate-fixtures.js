#!/usr/bin/env node
/**
 * Generate audio fixtures using Node.js (no external dependencies)
 * Creates simple WAV files with sine wave tones for testing
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 16000;
const DURATION = 3; // seconds
const FREQUENCY = 440; // Hz (A note)

/**
 * Generate a simple sine wave WAV file
 */
function generateWavFile(filename, text, frequency = FREQUENCY) {
  const samples = SAMPLE_RATE * DURATION;
  const buffer = Buffer.alloc(44 + samples * 2);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(1, 22);  // channels
  buffer.writeUInt32LE(SAMPLE_RATE, 24); // sample rate
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples * 2, 40);
  
  // Generate sine wave
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / SAMPLE_RATE) * 0.3;
    const intSample = Math.round(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }
  
  const filepath = path.join(__dirname, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`Generated: ${filename} (${text})`);
}

// Generate fixtures
console.log('Generating audio fixtures...');

generateWavFile('hello-world-en.wav', 'Hello world, this is a test');
generateWavFile('polish-test.wav', 'Cześć, to jest test automatyczny');
generateWavFile('german-test.wav', 'Hallo, das ist ein automatischer Test');

// Long audio (60 seconds)
const LONG_SAMPLES = SAMPLE_RATE * 60;
const longBuffer = Buffer.alloc(44 + LONG_SAMPLES * 2);

// WAV header for long file
longBuffer.write('RIFF', 0);
longBuffer.writeUInt32LE(36 + LONG_SAMPLES * 2, 4);
longBuffer.write('WAVE', 8);
longBuffer.write('fmt ', 12);
longBuffer.writeUInt32LE(16, 16);
longBuffer.writeUInt16LE(1, 20);
longBuffer.writeUInt16LE(1, 22);
longBuffer.writeUInt32LE(SAMPLE_RATE, 24);
longBuffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
longBuffer.writeUInt16LE(2, 32);
longBuffer.writeUInt16LE(16, 34);
longBuffer.write('data', 36);
longBuffer.writeUInt32LE(LONG_SAMPLES * 2, 40);

// Generate longer sine wave with varying frequency
for (let i = 0; i < LONG_SAMPLES; i++) {
  const freq = FREQUENCY + Math.sin(2 * Math.PI * i / SAMPLE_RATE) * 100;
  const sample = Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE) * 0.3;
  const intSample = Math.round(sample * 32767);
  longBuffer.writeInt16LE(intSample, 44 + i * 2);
}

const longFilepath = path.join(__dirname, 'long-audio-pl.wav');
fs.writeFileSync(longFilepath, longBuffer);
console.log(`Generated: long-audio-pl.wav (Long Polish audio - 60s)`);

console.log('✅ Audio fixtures generated successfully');
