/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'embedding',
  config: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' }
});

const text = document.getElementById('text');
const btn = document.getElementById('run');
const out = document.getElementById('out');

function getPooling() {
  const radios = document.querySelectorAll('input[name="pooling"]');
  for (const r of radios) {
    // @ts-ignore
    if (r.checked) return r.value;
  }
  return 'mean';
}

btn?.addEventListener('click', async () => {
  const t = text?.value || 'I love programming';
  const pooling = getPooling();
  const normalize = document.getElementById('normalize')?.checked;
  try {
    const e = await provider.embed(t, { pooling, normalize });
    const vec = e[0] || [];
    out.textContent = `pooling: ${pooling}, normalize: ${!!normalize}, dim: ${vec.length}`;
  } catch (err) {
    out.textContent = 'Error: ' + (err?.message || String(err));
  }
});


