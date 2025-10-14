/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'stt',
  config: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
});

const btn = document.getElementById('transcribe-btn');
const out = document.getElementById('transcription');
btn?.addEventListener('click', async () => {
  try {
    const text = await provider.listen('/tests/fixtures/audio/hello-world-en.wav');
    out.textContent = text || '(empty)';
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


