/* eslint-env browser */
/* global document */
import { initProviderWithUI, attachToolbar } from '../../__assets__/common.js';

attachToolbar();
const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', dtype: 'q4' }
});

const log = document.getElementById('log');
function add(msg) {
  log.textContent += `${new Date().toISOString()} ${msg}\n`;
}

provider.on('ready', ({ modality, model }) => add(`[ready] ${modality} ${model || ''}`));
provider.on('progress', ({ modality, status }) => add(`[progress] ${modality} ${status}`));
provider.on('error', ({ modality, error }) => add(`[error] ${modality} ${error?.message || error}`));

document.getElementById('btn-warmup')?.addEventListener('click', () => provider.warmup('llm'));
document.getElementById('btn-unload')?.addEventListener('click', () => provider.unload('llm'));
document.getElementById('btn-dispose')?.addEventListener('click', () => provider.dispose());

window.testReady = true;

