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
const formatEl = document.getElementById('format');
const meta = document.getElementById('meta');

btn?.addEventListener('click', async () => {
  try {
    const text = input?.value || 'Hello from Transformers Router';
    const fmt = formatEl?.value || 'wav';
    const blob = await provider.speak(text, { format: fmt });
    const url = URL.createObjectURL(blob);
    audio.src = url;
    meta.textContent = `${fmt} ${Math.round(blob.size/1024)}KB`;
    await audio.play().catch(() => {});
  } catch (e) {
    console.error(e);
  }
});


