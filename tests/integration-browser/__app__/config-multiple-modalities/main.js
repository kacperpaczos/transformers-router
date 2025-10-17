/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const { createAIProvider } = await import('/dist/index.js');
const provider = createAIProvider({
  llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 },
  stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' },
  tts: { model: 'Xenova/speecht5_tts', device: 'wasm', dtype: 'fp32' },
  embedding: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' },
});

window.testReady = true;

const out = document.getElementById('out');

provider.on('ready', () => {
  out.textContent = JSON.stringify(provider.getAllStatuses(), null, 2);
});

await provider.warmup();


