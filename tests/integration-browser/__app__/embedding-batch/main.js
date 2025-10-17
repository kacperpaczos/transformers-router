/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'embedding',
  config: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' }
});

const list = document.getElementById('list');
const btn = document.getElementById('run');
const out = document.getElementById('out');

btn?.addEventListener('click', async () => {
  const lines = (list?.value || '').split(/\r?\n/).filter(x => x.trim().length > 0);
  const texts = lines.length ? lines : ['I love programming', 'Coding is fun'];
  try {
    const e = await provider.embed(texts);
    const dims = e[0]?.length || 0;
    out.textContent = `items: ${e.length}, dim: ${dims}`;
  } catch (err) {
    out.textContent = 'Error: ' + (err?.message || String(err));
  }
});


