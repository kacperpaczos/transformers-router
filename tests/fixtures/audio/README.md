# Audio Fixtures for STT Integration Tests

This directory contains audio files for testing Speech-to-Text (Whisper) functionality.

## Required Fixtures

### English
- **hello-world-en.wav** - "Hello world, this is a test"
  - Duration: ~5 seconds
  - Sample rate: 16000 Hz (recommended for Whisper)
  - Channels: mono
  - Format: PCM 16-bit

### Polish
- **polish-test.wav** - "Cześć, to jest test automatyczny"
  - Duration: ~5 seconds
  - Sample rate: 16000 Hz
  - Channels: mono
  - Format: PCM 16-bit

### German
- **german-test.wav** - "Hallo, das ist ein automatischer Test"
  - Duration: ~5 seconds
  - Sample rate: 16000 Hz
  - Channels: mono
  - Format: PCM 16-bit

### Long Audio
- **long-audio-pl.wav** - Long Polish speech (~60 seconds)
  - Can be any Polish speech content
  - Sample rate: 16000 Hz
  - Channels: mono

### Edge Cases
- **sample.wav** - Pure silence (already exists as placeholder)
- **noise.wav** - Background noise without speech (optional)

## How to Create Fixtures

### Option 1: Record your own voice

Using `ffmpeg` to record:
```bash
# Record 5 seconds of audio from microphone
ffmpeg -f alsa -i default -t 5 -ar 16000 -ac 1 hello-world-en.wav
```

Using `sox`:
```bash
# Record 5 seconds
rec -r 16000 -c 1 hello-world-en.wav trim 0 5
```

### Option 2: Text-to-Speech generation (for placeholder)

Using Google TTS (gTTS):
```bash
pip install gtts
python << EOF
from gtts import gTTS
tts = gTTS('Hello world, this is a test', lang='en')
tts.save('hello-world-en-temp.mp3')
EOF

# Convert to WAV with correct format
ffmpeg -i hello-world-en-temp.mp3 -ar 16000 -ac 1 hello-world-en.wav
```

Using espeak:
```bash
espeak "Hello world, this is a test" --stdout | \
  ffmpeg -i - -ar 16000 -ac 1 hello-world-en.wav
```

### Option 3: Download from datasets

You can use audio from public datasets like:
- LibriSpeech (English)
- Common Voice (multiple languages)
- VoxPopuli (multilingual)

**Remember to convert to correct format:**
```bash
ffmpeg -i input.mp3 -ar 16000 -ac 1 output.wav
```

## Verification

After creating files, verify format:
```bash
# Check file info
ffmpeg -i hello-world-en.wav

# Should show:
# - Sample rate: 16000 Hz
# - Channels: 1 (mono)
# - Format: pcm_s16le
```

## File Format Specification

All WAV files should be:
- **Sample Rate:** 16000 Hz (16 kHz)
- **Channels:** 1 (mono)
- **Bit Depth:** 16-bit PCM
- **Encoding:** PCM signed 16-bit little-endian

## Current Status

- ✅ `sample.wav` - Silence placeholder (exists)
- ❌ `hello-world-en.wav` - **NEEDS TO BE ADDED**
- ❌ `polish-test.wav` - **NEEDS TO BE ADDED**
- ❌ `german-test.wav` - **NEEDS TO BE ADDED**
- ❌ `long-audio-pl.wav` - **NEEDS TO BE ADDED**

## Testing Without Real Fixtures

Tests will gracefully skip if audio files are missing:
```
⚠️ Skipping: hello-world-en.wav not found. Please add real audio fixture.
```

The silence test (`sample.wav`) will always run.

## Contributing

When adding new audio fixtures:
1. Record or generate the audio
2. Convert to 16kHz mono WAV
3. Update `expected-outputs.json` with transcription and keywords
4. Test with `npm run test:integration`

