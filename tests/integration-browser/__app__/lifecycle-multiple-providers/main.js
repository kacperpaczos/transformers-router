/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const base = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 10 }
});

let p1 = null;
let p2 = null;
const spawn = document.getElementById('spawn');
const chat = document.getElementById('chat');
const dispose = document.getElementById('dispose');
const out = document.getElementById('out');

spawn?.addEventListener('click', async () => {
  const { createAIProvider } = await import('/dist/index.js');
  p1 = createAIProvider({ llm: base.getConfig().llm });
  p2 = createAIProvider({ llm: base.getConfig().llm });
  await Promise.all([p1.warmup('llm'), p2.warmup('llm')]);
  out.textContent = 'spawned & warmed up';
});

chat?.addEventListener('click', async () => {
  if (!p1 || !p2) { out.textContent = 'spawn first'; return; }
  const [r1, r2] = await Promise.all([
    p1.chat('Hello from provider 1'),
    p2.chat('Hello from provider 2')
  ]);
  out.textContent = `p1: ${r1.content}\n---\np2: ${r2.content}`;
});

dispose?.addEventListener('click', async () => {
  await Promise.all([p1?.dispose?.(), p2?.dispose?.()]);
  out.textContent = 'disposed';
});


