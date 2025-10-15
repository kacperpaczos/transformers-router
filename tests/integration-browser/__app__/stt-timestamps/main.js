/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'stt',
  config: { model: 'Xenova/whisper-tiny', device: 'wasm', dtype: 'fp32' }
});

const run = document.getElementById('run');
const out = document.getElementById('out');

run?.addEventListener('click', async () => {
  try {
    const text = await provider.listen('/tests/fixtures/audio/hello-world-en.wav', { timestamps: true });
    out.textContent = text || '(empty)';
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


