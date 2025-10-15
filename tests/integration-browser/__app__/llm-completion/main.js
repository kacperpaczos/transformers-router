/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 40 }
});

const prompt = document.getElementById('prompt');
const btn = document.getElementById('complete-btn');
const out = document.getElementById('completion');

btn?.addEventListener('click', async () => {
  const p = prompt?.value || 'The quick brown fox';
  try {
    const text = await provider.complete(p);
    out.textContent = text;
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


