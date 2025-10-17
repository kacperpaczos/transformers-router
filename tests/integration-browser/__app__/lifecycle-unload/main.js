/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 }
});

const unloadBtn = document.getElementById('unload');
const reloadBtn = document.getElementById('reload');
const checkBtn = document.getElementById('check');
const out = document.getElementById('out');

unloadBtn?.addEventListener('click', async () => {
  await provider.unload('llm');
  out.textContent = 'unloaded';
});

reloadBtn?.addEventListener('click', async () => {
  await provider.warmup('llm');
  out.textContent = 'reloaded';
});

checkBtn?.addEventListener('click', () => {
  out.textContent = `isReady(llm) = ${provider.isReady('llm')}`;
});
