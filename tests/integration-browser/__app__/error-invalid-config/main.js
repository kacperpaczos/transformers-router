/* eslint-env browser */

const { createAIProvider } = await import('/dist/index.js');

const out = document.getElementById('out');

const provider = createAIProvider({
  llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 10 }
});

window.testReady = true;

(async () => {
  try {
    // Apply an invalid configuration (negative maxTokens)
    await provider.updateConfig({ llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: -5 } });
    // Try to use chat with invalid config
    const r = await provider.chat('Test invalid config');
    out.textContent = 'Unexpected success: ' + r.content;
  } catch (e) {
    out.textContent = 'Caught error: ' + (e?.message || String(e));
  }
})();


