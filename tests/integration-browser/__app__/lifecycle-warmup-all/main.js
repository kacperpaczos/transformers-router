/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 }
});

const statusesBtn = document.getElementById('statuses');
const out = document.getElementById('out');

statusesBtn?.addEventListener('click', () => {
  const statuses = provider.getAllStatuses();
  out.textContent = JSON.stringify(statuses, null, 2);
});


