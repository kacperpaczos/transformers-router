/* eslint-env browser */

const { createAIProvider } = await import('/dist/index.js');

const runBtn = document.getElementById('run');
const out = document.getElementById('out');

const provider = createAIProvider({
  llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 }
});

window.testReady = true;

runBtn?.addEventListener('click', async () => {
  const result = {};
  try {
    const t0 = performance.now();
    await provider.warmup('llm');
    result.firstLoadMs = Math.round(performance.now() - t0);

    const t1 = performance.now();
    await provider.warmup('llm');
    result.secondLoadMs = Math.round(performance.now() - t1);

    out.textContent = JSON.stringify(result, null, 2);
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


