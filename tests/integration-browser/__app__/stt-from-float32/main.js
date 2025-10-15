/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'stt',
  config: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
});

const gen = document.getElementById('generate');
const run = document.getElementById('run');
const out = document.getElementById('out');

let sampleRate = 16000;
let data = null;

gen?.addEventListener('click', async () => {
  // Generuj prosty sygnał (sinus) 1s @ 440Hz
  const duration = 1.0;
  const length = Math.floor(sampleRate * duration);
  const arr = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.2;
  }
  data = arr;
  out.textContent = `Wygenerowano próbkę: ${length} próbek`;
});

run?.addEventListener('click', async () => {
  if (!data) {
    out.textContent = 'Najpierw wygeneruj sygnał';
    return;
  }
  try {
    const text = await provider.listen(data);
    out.textContent = text || '(empty)';
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


