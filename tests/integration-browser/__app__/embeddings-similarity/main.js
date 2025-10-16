import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'embedding',
  config: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' }
});

const b = document.getElementById('compare-btn');
const t1 = document.getElementById('txt1');
const t2 = document.getElementById('txt2');
const out = document.getElementById('sim');
const dims = document.getElementById('dims');
b?.addEventListener('click', async () => {
  try {
    const e = await provider.embed([
      t1?.value || 'I love programming',
      t2?.value || 'Coding is fun'
    ]);
    const a = e[0];
    const b = e[1];
    const dot = a.reduce((s, v, i) => s + v * b[i], 0);
    const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    const sim = dot / (na * nb);
    out.textContent = sim.toFixed(4);
    if (dims) dims.textContent = String(a.length);
  } catch (e) {
    out.textContent = 'Error';
    console.error(e);
  }
});


