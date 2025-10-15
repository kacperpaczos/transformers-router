/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 30 }
});

const sys = document.getElementById('system');
const user = document.getElementById('user');
const btn = document.getElementById('send');
const out = document.getElementById('out');

btn?.addEventListener('click', async () => {
  const systemPrompt = sys?.value || 'You are a helpful assistant.';
  const content = user?.value || 'What is 2+2?';
  try {
    const res = await provider.chat(content, { systemPrompt, maxTokens: 20 });
    out.textContent = res.content;
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


