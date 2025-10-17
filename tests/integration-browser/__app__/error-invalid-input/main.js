/* eslint-env browser */

const { createAIProvider } = await import('/dist/index.js');

const out = document.getElementById('out');

const provider = createAIProvider({
  llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 10 }
});

window.testReady = true;

(async () => {
  try {
    await provider.warmup('llm');
    const r = await provider.chat('   '); // invalid empty-like input
    out.textContent = 'Unexpected success: ' + r.content;
  } catch (e) {
    out.textContent = 'Caught error: ' + (e?.message || String(e));
  }
})();


