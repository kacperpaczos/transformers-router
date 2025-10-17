/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', device: 'wasm', dtype: 'q4', maxTokens: 20 }
});

const input = document.getElementById('input');
const sendEmpty = document.getElementById('send-empty');
const sendLong = document.getElementById('send-long');
const out = document.getElementById('out');

sendEmpty?.addEventListener('click', async () => {
  try {
    const res = await provider.chat('');
    out.textContent = res.content || '(empty)';
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});

sendLong?.addEventListener('click', async () => {
  try {
    const longText = (input?.value || 'A').repeat(300);
    const res = await provider.chat(longText, { maxTokens: 10 });
    out.textContent = res.content;
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


