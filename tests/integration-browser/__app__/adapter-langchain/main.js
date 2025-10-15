/* eslint-env browser */

const { createAIProvider } = await import('/dist/index.js');
const { LangChainLLM } = await import('/dist/adapters/LangChainAdapter.js');

const run = document.getElementById('run');
const out = document.getElementById('out');

const provider = createAIProvider({ llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 10 } });
const llm = new LangChainLLM(provider, { temperature: 0.7, maxTokens: 10 });

window.testReady = true;

run?.addEventListener('click', async () => {
  try {
    await provider.warmup('llm');
    const text = await llm.call('Say hello');
    out.textContent = text;
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


