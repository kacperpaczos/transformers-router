/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', device: 'wasm', dtype: 'q4', maxTokens: 10 }
});

const modelEl = document.getElementById('model');
const apply = document.getElementById('apply');
const out = document.getElementById('out');

apply?.addEventListener('click', async () => {
  try {
    const model = modelEl?.value || 'onnx-community/Qwen2.5-0.5B-Instruct';
    await provider.updateConfig({ llm: { model, device: 'wasm', dtype: 'q4', maxTokens: 10 } });
    out.textContent = JSON.stringify(provider.getConfig(), null, 2);
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


