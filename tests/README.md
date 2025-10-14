# Tests

This directory contains both unit tests and integration tests for the transformers-router library.

## Test Structure

```
tests/
├── unit/                    # Unit tests (pure logic)
│   ├── *.test.ts           # Individual unit tests
│   └── ...
├── integration/             # Real integration tests
│   ├── *.integration.test.ts
│   ├── setup.ts            # Integration test setup
│   └── ...
├── e2e/                     # Browser E2E tests
│   ├── *.e2e.test.ts       # Playwright tests
│   ├── server.js           # Test server
│   └── README.md
├── fixtures/                # Test fixtures
│   ├── audio/              # WAV files for STT
│   └── expected-outputs.json
└── README.md               # This file
```

## Running Tests

### Unit Tests (Fast, with mocks)

```bash
npm run test:unit
```

Unit tests use mocks and are designed to be fast and reliable. They test individual components in isolation.

### Integration Tests (Real models, slow)

```bash
npm run test:integration
```

Integration tests actually load and test real Transformers.js models. They are much slower but provide confidence that the library works with real AI models.

⚠️ **Integration tests may take 5-15 minutes** and require internet connection to download models.

### E2E Tests (Browser, Playwright)

```bash
npm run test:e2e
```

End-to-end tests for Web Workers in real browser environment using Playwright.

⚠️ **Requires Playwright installation**: `npx playwright install chromium`

### All Tests

```bash
npm run test:all
```

Runs both unit and integration tests (E2E tests separate).

## Test Categories

### Unit Tests (`tests/unit/`)

- **AIProvider.test.ts** - Core AI provider functionality
- **ModelCache.test.ts** - Model caching logic
- **WorkerPool.test.ts** - Web Worker pool management
- **AIProviderWorker.test.ts** - Worker-based AI provider
- **LangChainAdapter.test.ts** - LangChain compatibility
- **useAIProvider.test.ts** - React hook
- **useChat.test.ts** - React chat hook

### Integration Tests (`tests/integration/`)

- **AIProvider.integration.test.ts** - Real model loading and generation
- **OpenAIAdapter.integration.test.ts** - OpenAI API compatibility with real models
- **LangChainAdapter.integration.test.ts** - LangChain integration with real models
- **Embeddings.integration.test.ts** - Text embeddings, similarity, semantic search
- **STT.integration.test.ts** - Speech-to-text (Whisper) with multi-language support
- **TTS.integration.test.ts** - Text-to-speech synthesis with roundtrip validation
- **Performance.integration.test.ts** - Concurrent requests, cache, memory, batch processing
- **Scenarios.integration.test.ts** - Real-world workflows (RAG, multi-turn, multimodal)
- **EdgeCases.integration.test.ts** - Error handling, boundary conditions, edge cases
- **Config.integration.test.ts** - Configuration options, dtype, device, model switching

### E2E Tests (`tests/e2e/`)

- **Workers.e2e.test.ts** - Web Workers in browser (non-blocking UI, worker pool, streaming)

## Writing Tests

### Unit Tests

Use mocks for external dependencies (Transformers.js, React, Vue). Focus on testing logic and component interactions.

```typescript
// Mock Transformers.js
jest.mock('@huggingface/transformers', () => ({
  pipeline: jest.fn().mockResolvedValue(mockPipeline),
}));
```

### Integration Tests

Use real Transformers.js with small, fast models. Test actual functionality.

```typescript
const provider = createAIProvider({
  llm: {
    model: 'Xenova/LaMini-Flan-T5-248M', // Small model for testing
    dtype: 'fp32',
  },
});
```

## Test Models

For integration tests, we use small, fast models that are suitable for testing:

### LLM Models
- `Xenova/LaMini-Flan-T5-248M` - Very small T5 model (~248M params)
- `Xenova/LaMini-Flan-T5-783M` - Small T5 model (~783M params)

### Embedding Models
- `Xenova/all-MiniLM-L6-v2` - Fast sentence embeddings

## Environment Setup

### For Integration Tests

Integration tests need:

1. **Internet connection** - To download models from HuggingFace
2. **Disk space** - Models are cached locally (~100MB+)
3. **Time** - First run downloads models, subsequent runs are faster

### Cache Location

Models are cached in `./.cache/test/` for integration tests to avoid conflicts with development cache.

## Debugging Tests

### Enable Debug Logging

```typescript
// In integration test setup
process.env.DEBUG = 'transformers-router:*';
```

### Run Single Test

```bash
npm run test:integration -- --testNamePattern="should load LLM model"
```

### Skip Slow Tests

Add `.skip` to slow tests:

```typescript
describe.skip('Slow integration tests', () => {
  // ...
});
```

## Performance Considerations

### Test Timeouts

Integration tests have 5-minute timeouts by default. Adjust in `jest.integration.config.js`:

```javascript
testTimeout: 300000, // 5 minutes
```

### Resource Cleanup

All tests should properly clean up resources:

```typescript
afterAll(async () => {
  await provider.dispose();
});
```

### Memory Usage

Integration tests with real models use significant memory. Run with:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run test:integration
```

## Contributing

When adding new features:

1. **Always add unit tests** for new components
2. **Add integration tests** if the feature involves real model interaction
3. **Update this README** if test structure changes
4. **Use descriptive test names** and organize by feature

## CI/CD

In CI environments:

- Run unit tests on every commit
- Run integration tests on main branch only (or manually)
- Cache model downloads between runs
- Use larger timeouts for CI environments
