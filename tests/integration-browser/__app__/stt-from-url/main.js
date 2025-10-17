/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'stt',
  config: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
});

const urlEl = document.getElementById('url');
const run = document.getElementById('run');
const out = document.getElementById('out');

run?.addEventListener('click', async () => {
  const url = urlEl?.value || '/tests/fixtures/audio/hello-world-en.wav';
  try {
    const text = await provider.listen(url);
    out.textContent = text || '(empty)';
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


