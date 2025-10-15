/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'stt',
  config: { model: 'Xenova/whisper-tiny', device: 'wasm', dtype: 'fp32' }
});

const lang = document.getElementById('lang');
const run = document.getElementById('run');
const out = document.getElementById('out');

const files = {
  en: '/tests/fixtures/audio/hello-world-en.wav',
  de: '/tests/fixtures/audio/german-test.wav',
  pl: '/tests/fixtures/audio/polish-test.wav',
};

run?.addEventListener('click', async () => {
  const l = lang?.value || 'en';
  try {
    const text = await provider.listen(files[l] || files.en, { language: l });
    out.textContent = text || '(empty)';
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


