/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 60 }
});

const prompt = document.getElementById('prompt');
const btnStart = document.getElementById('start-stream');
const btnStop = document.getElementById('stop-stream');
const tokensEl = document.getElementById('tokens');

let stopRequested = false;

function reset() {
  tokensEl.textContent = '';
  stopRequested = false;
}

btnStart?.addEventListener('click', async () => {
  reset();
  const text = prompt?.value?.trim() || 'Tell me a short story about a robot.';
  try {
    const stream = await provider.stream(text, { maxTokens: 30 });
    for await (const token of stream) {
      if (stopRequested) break;
      tokensEl.textContent += token;
    }
  } catch (e) {
    console.error(e);
  }
});

btnStop?.addEventListener('click', () => {
  stopRequested = true;
});


