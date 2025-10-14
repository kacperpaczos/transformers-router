# transformers-router

> Local AI infrastructure for agent frameworks - Transformers.js wrapper with LLM, TTS, STT support

A powerful TypeScript wrapper for [Transformers.js](https://huggingface.co/docs/transformers.js) that provides a unified interface for running AI models locally in your applications. Perfect for building AI agents, chatbots, and multimodal applications without relying on external APIs.

## Features

- 🤖 **LLM Support** - Text generation and chat with local language models
- 🔊 **Speech Synthesis (TTS)** - Convert text to speech
- 🎤 **Speech Recognition (STT)** - Transcribe audio with Whisper
- 🔍 **Embeddings** - Generate text embeddings for RAG and semantic search
- 🔄 **OpenAI-Compatible** - Drop-in replacement for OpenAI API
- 📦 **Model Caching** - Automatic model management and caching
- 📊 **Progress Tracking** - Monitor model download and loading
- 💪 **TypeScript First** - Full type safety and IntelliSense support
- 🌐 **Universal** - Works in Node.js and browsers

## Installation

```bash
npm install transformers-router @huggingface/transformers
```

## Quick Start

```typescript
import { createAIProvider } from 'transformers-router';

// Create AI provider with LLM
const provider = createAIProvider({
  llm: {
    model: 'onnx-community/Qwen2.5-0.5B-Instruct',
    dtype: 'q4'
  }
});

// Chat with the model
const response = await provider.chat('Hello! How are you?');
console.log(response.content);
```

## API Reference

### AIProvider

The main class for interacting with AI models.

#### Configuration

```typescript
interface AIProviderConfig {
  llm?: {
    model: string;              // HuggingFace model ID
    dtype?: 'fp32' | 'fp16' | 'q8' | 'q4';
    device?: 'cpu' | 'gpu' | 'webgpu';
    maxTokens?: number;
    temperature?: number;
  };
  tts?: {
    model: string;
    dtype?: 'fp32' | 'fp16';
    // ...
  };
  stt?: {
    model: string;
    language?: string;
    // ...
  };
  embedding?: {
    model: string;
    normalize?: boolean;
    // ...
  };
}
```

#### LLM Methods

**chat(messages, options?)**

Chat with the LLM model.

```typescript
// Simple message
const response = await provider.chat('What is AI?');

// With message history
const response = await provider.chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Explain quantum computing' }
], {
  maxTokens: 100,
  temperature: 0.7
});

console.log(response.content);
console.log(response.usage); // Token usage info
```

**complete(prompt, options?)**

Simple text completion.

```typescript
const text = await provider.complete('Once upon a time', {
  maxTokens: 50,
  temperature: 0.8
});
```

**stream(messages, options?)**

Stream responses token by token.

```typescript
for await (const token of provider.stream('Tell me a story')) {
  process.stdout.write(token);
}
```

#### Speech Methods

**speak(text, options?)**

Text-to-speech synthesis.

```typescript
const audioBlob = await provider.speak('Hello, world!');
const audio = new Audio(URL.createObjectURL(audioBlob));
audio.play();
```

**listen(audio, options?)**

Speech-to-text transcription.

```typescript
// From URL
const text = await provider.listen('https://example.com/audio.wav');

// From Blob
const text = await provider.listen(audioBlob);

// With options
const text = await provider.listen(audioBlob, {
  language: 'en',
  task: 'transcribe'
});
```

#### Embedding Methods

**embed(text, options?)**

Generate embeddings for text(s).

```typescript
// Single text
const embeddings = await provider.embed('Hello world');

// Multiple texts
const embeddings = await provider.embed([
  'First text',
  'Second text',
  'Third text'
]);
```

**similarity(text1, text2)**

Calculate cosine similarity between two texts.

```typescript
const score = await provider.similarity(
  'I love programming',
  'Coding is fun'
);
console.log(`Similarity: ${(score * 100).toFixed(2)}%`);
```

**findSimilar(query, texts, options?)**

Find most similar text from a list.

```typescript
const texts = [
  'The cat sits on the mat',
  'A dog plays in the park',
  'The feline rests on the carpet'
];

const result = await provider.findSimilar('A cat on a rug', texts);
console.log(result.text);       // Most similar text
console.log(result.similarity);  // Similarity score
console.log(result.index);       // Index in array
```

#### Lifecycle Methods

**warmup(modality?)**

Pre-load models to avoid delays on first use.

```typescript
// Warmup all configured models
await provider.warmup();

// Warmup specific modality
await provider.warmup('llm');
```

**unload(modality?)**

Free model resources.

```typescript
// Unload specific model
await provider.unload('llm');

// Unload all models
await provider.unload();
```

**isReady(modality)**

Check if a model is loaded.

```typescript
if (provider.isReady('llm')) {
  console.log('LLM is ready!');
}
```

**dispose()**

Cleanup and dispose all resources.

```typescript
await provider.dispose();
```

#### Event Methods

**on(event, callback)**

Listen to events.

```typescript
// Progress tracking
provider.on('progress', ({ modality, file, progress }) => {
  console.log(`Loading ${modality}: ${file} (${progress}%)`);
});

// Ready notification
provider.on('ready', ({ modality, model }) => {
  console.log(`${modality} ready: ${model}`);
});

// Error handling
provider.on('error', ({ modality, error }) => {
  console.error(`Error in ${modality}:`, error);
});
```

### OpenAI Adapter

For compatibility with OpenAI-based frameworks.

```typescript
import { createAIProvider, OpenAIAdapter } from 'transformers-router';

const provider = createAIProvider({
  llm: { model: 'onnx-community/Qwen2.5-0.5B-Instruct' }
});

const openai = new OpenAIAdapter(provider);

// OpenAI-compatible API
const completion = await openai.createChatCompletion({
  messages: [{ role: 'user', content: 'Hello!' }],
  temperature: 0.7,
  max_tokens: 100
});

console.log(completion.choices[0].message.content);
```

## Examples

### Basic Chat

```typescript
import { createAIProvider } from 'transformers-router';

const provider = createAIProvider({
  llm: {
    model: 'onnx-community/Qwen2.5-0.5B-Instruct',
    dtype: 'q4'
  }
});

const response = await provider.chat('What is JavaScript?');
console.log(response.content);
```

### Agent with RAG

```typescript
import { createAIProvider } from 'transformers-router';

const provider = createAIProvider({
  llm: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', dtype: 'q4' },
  embedding: { model: 'Xenova/all-MiniLM-L6-v2' }
});

// Index documents
const documents = [
  'JavaScript is a programming language.',
  'Python is great for data science.',
  'Rust is a systems programming language.'
];

// Find relevant document
const query = 'Tell me about web programming';
const relevant = await provider.findSimilar(query, documents);

// Use in chat
const response = await provider.chat(
  `Based on: "${relevant.text}"\n\nAnswer: ${query}`
);
```

### Multimodal Application

```typescript
const provider = createAIProvider({
  llm: { model: 'onnx-community/Qwen2.5-0.5B-Instruct' },
  tts: { model: 'Xenova/speecht5_tts' },
  stt: { model: 'Xenova/whisper-tiny' }
});

// Voice conversation
const audioInput = await getAudioFromMicrophone();
const userText = await provider.listen(audioInput);
const response = await provider.chat(userText);
const audioOutput = await provider.speak(response.content);

playAudio(audioOutput);
```

### Integration with Agent Framework

```typescript
import { createAIProvider, OpenAIAdapter } from 'transformers-router';

const provider = createAIProvider({
  llm: { model: 'onnx-community/Qwen2.5-0.5B-Instruct' }
});

// Use with any framework that supports OpenAI API
const agent = new Agent({
  llm: new OpenAIAdapter(provider),
  tools: [calculatorTool, searchTool]
});

await agent.run('Calculate 15 * 23');
```

## Supported Models

### LLM (Text Generation)

- `onnx-community/Qwen2.5-0.5B-Instruct` - Fast, lightweight
- `onnx-community/Qwen2.5-Coder-0.5B-Instruct` - Coding specialist
- `Xenova/LaMini-Flan-T5-783M` - Versatile model

### Embeddings

- `Xenova/all-MiniLM-L6-v2` - Fast embeddings
- `Xenova/all-mpnet-base-v2` - High quality

### Speech

- TTS: `Xenova/speecht5_tts`
- STT: `Xenova/whisper-tiny`, `Xenova/whisper-base`

[See all models on HuggingFace](https://huggingface.co/models?library=transformers.js)

## Phase 2 Features (NEW!)

### Web Workers Support

Run models in Web Workers for non-blocking, performant AI:

```typescript
import { createAIProviderWorker } from 'transformers-router';

// Create worker-based provider
const provider = createAIProviderWorker({
  llm: {
    model: 'onnx-community/Qwen2.5-0.5B-Instruct',
    dtype: 'q4'
  }
});

// Same API, but runs in Web Worker (non-blocking!)
const response = await provider.chat('Hello!');

// Check worker pool stats
const stats = provider.getStats();
console.log(`Workers: ${stats.total}, Busy: ${stats.busy}`);
```

Benefits:
- Non-blocking UI - AI processing doesn't freeze the browser
- Better performance - utilizes multiple CPU cores
- Automatic worker pool management
- Same API as main thread provider

### React Hooks

Easy integration with React applications:

```tsx
import { useAIProvider, useChat } from 'transformers-router/react';

function ChatComponent() {
  const { provider, isReady, isLoading, progress } = useAIProvider({
    llm: {
      model: 'onnx-community/Qwen2.5-0.5B-Instruct',
      dtype: 'q4'
    },
    autoLoad: true // Auto-load on mount
  });

  const { messages, send, isLoading: isSending } = useChat(provider, {
    initialMessages: [
      { role: 'system', content: 'You are a helpful assistant.' }
    ]
  });

  return (
    <div>
      {isLoading && <div>Loading model: {progress?.progress}%</div>}
      {messages.map((msg, i) => (
        <div key={i}>{msg.content}</div>
      ))}
      <button onClick={() => send('Hello')} disabled={!isReady || isSending}>
        Send
      </button>
    </div>
  );
}
```

Available hooks:
- `useAIProvider` - Manage AI provider lifecycle
- `useChat` - Chat conversations with history

### Vue Composables

Seamless Vue 3 integration:

```vue
<script setup lang="ts">
import { useAIProvider, useChat } from 'transformers-router/vue';

const { provider, isReady, isLoading, progress } = useAIProvider({
  llm: {
    model: 'onnx-community/Qwen2.5-0.5B-Instruct',
    dtype: 'q4'
  },
  autoLoad: true
});

const { messages, send, isLoading: isSending } = useChat(provider, {
  initialMessages: [
    { role: 'system', content: 'You are a helpful assistant.' }
  ]
});
</script>

<template>
  <div>
    <div v-if="isLoading">Loading: {{ progress?.progress }}%</div>
    <div v-for="(msg, i) in messages" :key="i">
      {{ msg.content }}
    </div>
    <button @click="() => send('Hello')" :disabled="!isReady || isSending">
      Send
    </button>
  </div>
</template>
```

Available composables:
- `useAIProvider` - Manage AI provider lifecycle
- `useChat` - Chat conversations with history

### LangChain Adapter

Full compatibility with LangChain.js:

```typescript
import { createAIProvider, createLangChainLLM, createLangChainEmbeddings } from 'transformers-router';

const provider = createAIProvider({
  llm: { model: 'onnx-community/Qwen2.5-0.5B-Instruct' },
  embedding: { model: 'Xenova/all-MiniLM-L6-v2' }
});

// LangChain-compatible LLM
const llm = createLangChainLLM(provider, {
  temperature: 0.7,
  maxTokens: 256
});

// Use with LangChain
const response = await llm.call('Hello!');

// LangChain-compatible Embeddings
const embeddings = createLangChainEmbeddings(provider);
const vectors = await embeddings.embedDocuments(['text 1', 'text 2']);
```

Use with LangChain chains, agents, and tools:

```typescript
import { PromptTemplate } from 'langchain/prompts';
import { LLMChain } from 'langchain/chains';

const prompt = PromptTemplate.fromTemplate('Tell me about {topic}');
const chain = new LLMChain({ llm, prompt });

const result = await chain.call({ topic: 'AI' });
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run specific test suites
npm run test:unit              # Fast unit tests (Jest)
npm run test:integration       # Integration tests in browser (Playwright)
npm run test:e2e              # End-to-end tests (Playwright)
npm run test:all              # All tests

# Debug tests
npm run test:integration:ui    # Visual test runner
npm run test:integration:headed # With visible browser
npm run test:watch            # Watch mode for unit tests

# Run examples
node examples/chat-basic.js
node examples/multimodal.js
node examples/agent-integration.js
```

## Testing

This project uses a comprehensive 3-tier testing strategy:

### 🧪 **Unit Tests** (Jest + Node.js)
- **Location:** `tests/unit/`
- **Purpose:** Fast, isolated logic tests
- **Run:** `npm run test:unit`
- **Characteristics:** No real AI models, <5 seconds

### 🌐 **Integration Tests** (Playwright + Browser)
- **Location:** `tests/integration-browser/`
- **Purpose:** Real AI models in browser environment
- **Run:** `npm run test:integration`
- **Why browser?** 
  - ✅ Solves ONNX Runtime Float32Array errors
  - ✅ Native AudioContext for STT
  - ✅ WebAssembly backend (onnxruntime-web)
  - ✅ Production-like environment

#### Build required for browser tests

Browserowe testy integracyjne ładują bibliotekę poprzez ESM import z pliku `dist/index.js`:

```html
<script type="module">
  const { createAIProvider } = await import('/dist/index.js');
  // ...
</script>
```

Dlatego przed uruchomieniem tych testów należy wykonać build, aby katalog `dist/` był aktualny:

```bash
npm run build
ls -la dist/
```

Serwer testowy uruchamiany przez Playwright'a serwuje stronę `tests/integration-browser/test-page.html`, która importuje `dist/index.js`. Jeśli build nie zostanie wykonany, import w przeglądarce zakończy się błędem.

#### Ręczne uruchomienie serwera przeglądarkowego (bez Playwright)

Jeśli chcesz lokalnie zobaczyć UI ładowania i progres modelu:

```bash
# 1) Zbuduj bibliotekę
npm run build

# 2) Uruchom serwer ESM dla stron przeglądarkowych
npm run serve:browser
```

Następnie otwórz w przeglądarce adres:

```
http://localhost:3001/tests/integration-browser/__assets__/index.html
```

Na stronie zobaczysz panel statusu. Kliknij przycisk Start (data-testid="start-warmup") i obserwuj pola status/progress/file. Możesz też wywołać ręcznie w konsoli przeglądarki:

```js
window.startWarmup()
```

Diagnozowanie białej strony:
- Sprawdź, czy `dist/index.js` istnieje (po buildzie) – `ls -la dist/index.js`
- Sprawdź w zakładce Network, czy `/dist/index.js` zwraca 200
- Upewnij się, że serwer działa – `curl -I http://localhost:3001/`
- Jeśli port zajęty – ubij stary proces: `pkill -f "tests/integration-browser/server.js"` i uruchom serwer ponownie

#### Index stron testowych (browser test pages)

Przeglądarkowe testy mają teraz indeks stron z UI i paskiem progresu ładowania modelu:

- Index: `http://localhost:3001/` → `tests/integration-browser/__assets__/index.html`
- Strony (ESM apps): `tests/integration-browser/__app__/*/index.html`
- Wspólne assety: `tests/integration-browser/__assets__/common.css`, `common.js`

Dodanie nowej aplikacji testowej (ESM):

1. Utwórz katalog `tests/integration-browser/__app__/your-app/`
2. Dodaj `index.html` z import mapą i `<script type="module" src="./main.js"></script>`
3. W `main.js` zaimportuj `../__assets__/common.js` i wywołaj `initProviderWithUI`
4. Dodaj link w `__assets__/index.html` z `data-test-link`

Automatyczny test przeglądarkowy iterujący strony:
- Plik: `tests/integration-browser/Pages.browser.test.ts`
- Działanie: wchodzi na index, zbiera linki i dla każdej strony sprawdza przejście statusu `downloading/loading` → `ready` oraz progres 100%

### 🎭 **E2E Tests** (Playwright + Browser)
- **Location:** `tests/e2e/`
- **Purpose:** Full user workflows with Web Workers
- **Run:** `npm run test:e2e`

### 🚀 **Quick Testing Commands**

```bash
# Run all tests
npm run test:all

# Run specific test suites
npm run test:unit              # Fast unit tests
npm run test:integration       # Browser integration tests
npm run test:e2e              # End-to-end tests

# Debug and development
npm run test:integration:ui    # Visual test runner (recommended)
npm run test:integration:headed # With visible browser
npm run test:watch            # Watch mode for unit tests

# Run specific tests
npm run test:integration -- --grep "should load LLM model"
npm run test:unit -- --testNamePattern="should cache models"
```

### 🔧 **Test Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Playwright    │    │   Browser        │    │   AI Models     │
│   (Node.js)     │◄──►│   (Chromium)     │◄──►│   (Transformers)│
│                 │    │                  │    │                 │
│ - Test logic    │    │ - WebAssembly    │    │ - GPT-2/Xenova  │
│ - Assertions    │    │ - AudioContext   │    │ - Whisper       │
│ - Page control  │    │ - WebGL          │    │ - SpeechT5      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 📊 **Test Coverage**

Coverage and suite sizes (example values, update via CI):
- Unit Tests: 31 tests ✅
- Integration Tests: ~80+ tests (Browser-based)
- E2E Tests: ~6 tests (Web Workers)

### 🐛 **Debugging Tests**

1. **Visual Debugging:**
   ```bash
   npm run test:integration:ui
   ```
   - Step-through debugging
   - Browser DevTools access
   - Real-time console logs

2. **Browser Debugging:**
   ```bash
   npm run test:integration:headed
   ```
   - See what happens in browser
   - Manual DevTools inspection

3. **Trace Analysis:**
   ```bash
   npm run test:integration -- --trace=on
   npx playwright show-trace test-results/trace.zip
   ```

### ⚠️ **Important Notes**

- **Integration tests** require internet connection (model downloads)
- **Test timeouts** are set to 5 minutes (model loading)
- **Browser tests** run sequentially for stability
- **Models are cached** between test runs
 - **Build required for browser tests**: upewnij się, że `dist/` istnieje i jest aktualny (`npm run build`)

### 🔧 **Troubleshooting**

#### **Common Issues:**

1. **Tests timeout or hang:**
   ```bash
   # Check if integration server is running
   curl http://localhost:3001/
   
   # Restart server if needed
   pkill -f "node tests/integration-browser/server.js"
   node tests/integration-browser/server.js &
   ```

2. **Browser tests fail to load:**
   ```bash
   # Ensure project is built
   npm run build
   
   # Check if dist files exist
   ls -la dist/
   ```

3. **Port 3001 zajęty (EADDRINUSE) podczas integracji w przeglądarce):**
   ```bash
   # Zwolnij poprzedni serwer testowy
   pkill -f "node tests/integration-browser/server.js"
   # Uruchom test ponownie
   npm run test:integration
   ```

3. **Model loading errors:**
   ```bash
   # Clear model cache
   rm -rf ~/.cache/huggingface/
   
   # Check internet connection
   curl https://huggingface.co/
   ```

4. **Playwright browser issues:**
   ```bash
   # Reinstall browsers
   npx playwright install chromium
   
   # Update Playwright
   npm update @playwright/test
   ```

#### **Performance Optimization:**

```bash
# Run tests in parallel (faster but less stable)
npm run test:integration -- --workers=4

# Skip slow tests during development
npm run test:integration -- --grep "should handle long audio" --invert

# Use cached models (faster subsequent runs)
# Models are automatically cached in ~/.cache/huggingface/
```

### 🚀 **CI/CD Integration**

#### **GitHub Actions Example:**

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      
      # Unit tests (fast)
      - run: npm run test:unit
      
      # Integration tests (with retries)
      - run: npm run test:integration -- --retries=2
      
      # E2E tests (optional, slower)
      - run: npm run test:e2e -- --retries=1
```

#### **Local Development Workflow:**

```bash
# 1. Quick feedback loop
npm run test:unit -- --watch

# 2. Test specific functionality
npm run test:integration -- --grep "LLM"

# 3. Full test suite before commit
npm run test:all

# 4. Debug failing tests
npm run test:integration:ui
```

## Performance Tips

1. **Use quantization** - `dtype: 'q4'` reduces model size by ~75%
2. **Warmup models** - Call `warmup()` during app initialization
3. **Cache models** - Models are automatically cached after first load
4. **WebGPU** - Use `device: 'webgpu'` in browsers for GPU acceleration

## Migration from 1.x

The legacy `TransformersRouter` is still available for backward compatibility:

```typescript
import { TransformersRouter } from 'transformers-router';

const router = new TransformersRouter();
router.addRoute('/hello', (name) => `Hello, ${name}!`);
const result = await router.execute('/hello', 'World');
```

However, we recommend migrating to the new `AIProvider` API.

## Roadmap

### Phase 1 (Completed ✅)
- [x] Core model management
- [x] LLM support (chat, completion, streaming)
- [x] TTS/STT support
- [x] Embeddings with semantic search
- [x] OpenAI adapter
- [x] Progress tracking
- [x] Model caching

### Phase 2 (Completed ✅)
- [x] Web Workers support
- [x] Worker pool management
- [x] React hooks
- [x] Vue composables
- [x] LangChain adapter
- [x] Comprehensive testing suite
- [x] Browser-based integration tests
- [x] E2E testing with Playwright

### Phase 3 (Planned)
- [ ] Advanced streaming (token-by-token to UI)
- [ ] Batch processing
- [ ] Model quantization on-the-fly
- [ ] Vision models support
- [ ] Audio models (music generation)
- [ ] Fine-tuning support
- [ ] Model compression utilities

## License

MIT © Kacper Paczos

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Links

- [GitHub Repository](https://github.com/kacperpaczos/transformers-router)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [HuggingFace Models](https://huggingface.co/models?library=transformers.js)
