#!/bin/bash
# Automated audio fixture generation
# Requires: espeak, ffmpeg

set -e

AUDIO_DIR="$(dirname "$0")"
SAMPLE_RATE=16000

echo "Generating audio fixtures..."

# English
espeak "Hello world, this is a test" --stdout | \
  ffmpeg -y -i - -ar $SAMPLE_RATE -ac 1 "$AUDIO_DIR/hello-world-en.wav" \
  -loglevel error

# Polish
espeak -v pl "Cześć, to jest test automatyczny" --stdout | \
  ffmpeg -y -i - -ar $SAMPLE_RATE -ac 1 "$AUDIO_DIR/polish-test.wav" \
  -loglevel error

# German
espeak -v de "Hallo, das ist ein automatischer Test" --stdout | \
  ffmpeg -y -i - -ar $SAMPLE_RATE -ac 1 "$AUDIO_DIR/german-test.wav" \
  -loglevel error

# Long Polish (repeat text to get ~60s)
TEXT="To jest długi test audio. "
LONG_TEXT=$(printf "$TEXT%.0s" {1..50})
espeak -v pl "$LONG_TEXT" --stdout | \
  ffmpeg -y -i - -ar $SAMPLE_RATE -ac 1 "$AUDIO_DIR/long-audio-pl.wav" \
  -loglevel error

echo "✅ Audio fixtures generated successfully"
