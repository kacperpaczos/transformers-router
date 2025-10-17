/* eslint-env browser */
/* global document, window */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'stt',
  config: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
});

const btn = document.getElementById('transcribe-btn');

const inputAudio = document.getElementById('input-audio');
btn?.addEventListener('click', async () => {
  try {
    const url = '/tests/fixtures/audio/hello-world-en.wav';
    if (inputAudio) inputAudio.src = url;
    const text = await provider.listen(url);
    window.ui?.setOutputText?.(text || '(empty)');
  } catch (e) {
    window.ui?.setOutputText?.('Error: ' + (e?.message || String(e)));
  }
});


