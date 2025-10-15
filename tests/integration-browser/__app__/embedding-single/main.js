/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'embedding',
  config: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' }
});

const input = document.getElementById('text');
const btn = document.getElementById('run');
const out = document.getElementById('out');

btn?.addEventListener('click', async () => {
  const text = input?.value || 'I love programming';
  try {
    const e = await provider.embed(text);
    const vec = e[0] || [];
    const preview = vec.slice(0, 8).map(v => v.toFixed(4)).join(', ');
    out.textContent = `dim: ${vec.length}\n[${preview}, ...]`;
  } catch (err) {
    out.textContent = 'Error: ' + (err?.message || String(err));
  }
});


