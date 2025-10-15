/* eslint-env browser */

const { createAIProvider } = await import('/dist/index.js');

const out = document.getElementById('out');

const provider = createAIProvider({
  llm: { model: 'Xenova/does-not-exist-12345', device: 'wasm', dtype: 'fp32', maxTokens: 10 }
});

window.testReady = true;

(async () => {
  try {
    await provider.warmup('llm');
    out.textContent = 'Unexpected success';
  } catch (e) {
    out.textContent = 'Caught error: ' + (e?.message || String(e));
  }
})();


