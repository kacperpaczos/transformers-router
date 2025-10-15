/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'embedding',
  config: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' }
});

const query = document.getElementById('query');
const candidates = document.getElementById('candidates');
const btn = document.getElementById('run');
const out = document.getElementById('out');

btn?.addEventListener('click', async () => {
  const q = query?.value || 'programming';
  const list = (candidates?.value || '').split(/\r?\n/).filter(x => x.trim().length > 0);
  const texts = list.length ? list : ['I love programming', 'Coding is fun'];
  try {
    const r = await provider.findSimilar(q, texts);
    out.textContent = JSON.stringify(r, null, 2);
  } catch (err) {
    out.textContent = 'Error: ' + (err?.message || String(err));
  }
});


