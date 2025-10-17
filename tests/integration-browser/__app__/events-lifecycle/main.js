/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 }
});

const unloadBtn = document.getElementById('unload');
const log = document.getElementById('log');

function append(text) {
  log.textContent += text + '\n';
}

provider.on('ready', ({ modality, model }) => append(`[ready] ${modality} ${model}`));
provider.on('unload', ({ modality }) => append(`[unload] ${modality}`));
provider.on('progress', ({ modality, status }) => append(`[progress] ${modality} ${status}`));
provider.on('error', ({ modality, error }) => append(`[error] ${modality} ${error?.message || String(error)}`));

unloadBtn?.addEventListener('click', async () => {
  await provider.unload('llm');
});


