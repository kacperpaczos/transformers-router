import { initProviderWithUI } from '../../__assets__/common.js';

const { createAIProvider } = await import('/dist/index.js');
window.createAIProvider = createAIProvider;

await initProviderWithUI({
  modality: 'llm',
  config: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', dtype: 'q4', device: 'wasm', maxTokens: 20 }
});


