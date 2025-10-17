/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'tts',
  config: { model: 'Xenova/speecht5_tts', device: 'wasm', dtype: 'fp32' }
});

const input = document.getElementById('tts-text');
const btn = document.getElementById('speak-btn');
const audio = document.getElementById('audio');

btn?.addEventListener('click', async () => {
  try {
    const text = input?.value || 'Hello — world! 😀🚀✨';
    const blob = await provider.speak(text);
    const url = URL.createObjectURL(blob);
    audio.src = url;
    await audio.play().catch(() => {});
  } catch (e) {
    console.error(e);
  }
});


