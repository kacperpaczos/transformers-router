import { initProviderWithUI } from '../../__assets__/common.js';

const { createAIProvider } = await import('/dist/index.js');
window.createAIProvider = createAIProvider;

await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', dtype: 'fp32', device: 'wasm', maxTokens: 20 }
});


