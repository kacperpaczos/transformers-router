/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 }
});

const check = document.getElementById('check');
const out = document.getElementById('out');

check?.addEventListener('click', () => {
  out.textContent = `isReady(llm) = ${provider.isReady('llm')}`;
});


