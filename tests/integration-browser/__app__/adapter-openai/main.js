/* eslint-env browser */

const { createAIProvider } = await import('/dist/index.js');
const { OpenAIAdapter } = await import('/dist/adapters/OpenAIAdapter.js');

const run = document.getElementById('run');
const out = document.getElementById('out');

const provider = createAIProvider({ llm: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', device: 'wasm', dtype: 'q4', maxTokens: 10 } });
const adapter = new OpenAIAdapter(provider);

window.testReady = true;

run?.addEventListener('click', async () => {
  try {
    await provider.warmup('llm');
    const r = await adapter.createChatCompletion({
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 10,
      temperature: 0.7,
    });
    out.textContent = JSON.stringify(r, null, 2);
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


