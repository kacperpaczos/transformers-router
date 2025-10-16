/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', device: 'wasm', dtype: 'q4', maxTokens: 40 }
});

const prompt = document.getElementById('prompt');
const btn = document.getElementById('complete-btn');
const out = document.getElementById('completion');

btn?.addEventListener('click', async () => {
  const p = prompt?.value || 'The quick brown fox';
  try {
    const text = await provider.complete(p);
    window.ui?.setOutputText?.(text);
  } catch (e) {
    window.ui?.setOutputText?.('Error: ' + (e?.message || String(e)));
  }
});


