/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 20 }
});

const prompt = document.getElementById('prompt');
const btn = document.getElementById('gen-btn');
const out = document.getElementById('out');

const temperatureEl = document.getElementById('temperature');
const topPEl = document.getElementById('topP');
const topKEl = document.getElementById('topK');
const maxTokensEl = document.getElementById('maxTokens');

btn?.addEventListener('click', async () => {
  const text = prompt?.value || 'The weather is';
  try {
    const options = {
      temperature: Number(temperatureEl?.value || 0.7),
      topP: Number(topPEl?.value || 0.9),
      topK: Number(topKEl?.value || 50),
      maxTokens: Number(maxTokensEl?.value || 20),
    };
    const res = await provider.chat(text, options);
    out.textContent = res.content;
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


