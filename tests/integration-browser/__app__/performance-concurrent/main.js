/* eslint-env browser */

const { createAIProvider } = await import('/dist/index.js');

const runBtn = document.getElementById('run');
const out = document.getElementById('out');

const provider = createAIProvider({
  llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 10 }
});

window.testReady = true;

runBtn?.addEventListener('click', async () => {
  const result = {};
  try {
    await provider.warmup('llm');
    const t0 = performance.now();
    const [r1, r2, r3] = await Promise.all([
      provider.chat('One'),
      provider.chat('Two'),
      provider.chat('Three')
    ]);
    result.concurrentMs = Math.round(performance.now() - t0);
    result.lengths = [r1.content.length, r2.content.length, r3.content.length];
    out.textContent = JSON.stringify(result, null, 2);
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


