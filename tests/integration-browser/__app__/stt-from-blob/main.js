/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'stt',
  config: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
});

const fileEl = document.getElementById('file');
const run = document.getElementById('run');
const out = document.getElementById('out');

run?.addEventListener('click', async () => {
  // @ts-ignore
  const file = fileEl?.files?.[0];
  if (!file) {
    out.textContent = 'Wybierz plik audio';
    return;
  }
  try {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const text = await provider.listen(blob);
    out.textContent = text || '(empty)';
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


