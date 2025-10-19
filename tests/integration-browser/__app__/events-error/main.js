/* eslint-env browser */
/* global document */
import { initProviderWithUI, attachToolbar } from '../../__assets__/common.js';

// Intentionally invalid model to trigger error events
attachToolbar();
const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'nonexistent/model-xyz', dtype: 'q4' }
});

const log = document.getElementById('log');
function add(msg) {
  log.textContent += `${new Date().toISOString()} ${msg}\n`;
}

provider.on('progress', ({ modality, status, file, progress }) => {
  add(`[progress] ${modality} ${status}${file ? ` ${file}` : ''}${typeof progress === 'number' ? ` ${progress}%` : ''}`);
});

provider.on('ready', ({ modality, model }) => {
  add(`[ready] ${modality} ${model || ''}`);
});

provider.on('error', ({ modality, error }) => {
  add(`[error] ${modality} ${error?.message || error}`);
});

window.testReady = true;

