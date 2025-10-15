/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 }
});

const log = document.getElementById('log');

function append(text) {
  log.textContent += text + '\n';
}

provider.on('progress', ({ modality, status, file, progress }) => {
  append(`[progress] ${modality} ${status} ${file || ''} ${progress ?? ''}`);
});

provider.on('ready', ({ modality, model }) => {
  append(`[ready] ${modality} ${model}`);
});

provider.on('error', ({ modality, error }) => {
  append(`[error] ${modality} ${error?.message || String(error)}`);
});


