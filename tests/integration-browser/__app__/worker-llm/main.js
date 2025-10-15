/* eslint-env browser */
/* global document */

const statusEl = document.getElementById('status');
const warmupBtn = document.getElementById('warmup');
const chatBtn = document.getElementById('chat');
const promptEl = document.getElementById('prompt');
const out = document.getElementById('out');

window.testReady = true;

(async () => {
  const { createAIProviderWorker } = await import('/dist/workers/AIProviderWorker.js');
  const worker = createAIProviderWorker({ llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 20 } });

  warmupBtn?.addEventListener('click', async () => {
    statusEl.textContent = 'loading';
    await worker.warmup();
    statusEl.textContent = worker.isReady() ? 'ready' : 'idle';
  });

  chatBtn?.addEventListener('click', async () => {
    try {
      const prompt = promptEl?.value || 'Hello from worker';
      const res = await worker.chat(prompt);
      out.textContent = res.content;
    } catch (e) {
      out.textContent = 'Error: ' + (e?.message || String(e));
    }
  });
})();


