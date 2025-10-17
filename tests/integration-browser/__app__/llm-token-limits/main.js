/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', device: 'wasm', dtype: 'q4', maxTokens: 20 }
});

const prompt = document.getElementById('prompt');
const compare = document.getElementById('compare');
const outA = document.getElementById('outA');
const outB = document.getElementById('outB');
const maxA = document.getElementById('maxA');
const maxB = document.getElementById('maxB');

compare?.addEventListener('click', async () => {
  const text = prompt?.value || 'Write a short poem about the sea';
  try {
    const [r1, r2] = await Promise.all([
      provider.chat(text, { maxTokens: Number(maxA?.value || 5) }),
      provider.chat(text, { maxTokens: Number(maxB?.value || 20) }),
    ]);
    outA.textContent = r1.content;
    outB.textContent = r2.content;
  } catch (e) {
    outA.textContent = 'Error: ' + (e?.message || String(e));
    outB.textContent = 'Error: ' + (e?.message || String(e));
  }
});


