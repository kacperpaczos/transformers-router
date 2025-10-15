/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 }
});

const disposeBtn = document.getElementById('dispose');
const checkBtn = document.getElementById('check');
const out = document.getElementById('out');

disposeBtn?.addEventListener('click', async () => {
  await provider.dispose();
  out.textContent = 'disposed';
});

checkBtn?.addEventListener('click', () => {
  out.textContent = `isReady(llm) = ${provider.isReady('llm')}`;
});


