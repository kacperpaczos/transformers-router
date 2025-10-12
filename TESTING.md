# Testing Strategy for Transformers Router

Complete testing documentation for the transformers-router library.

## Overview

Our testing strategy uses **3-tier approach**:
1. **Unit Tests** - Fast, isolated logic tests
2. **Integration Tests** - Real models, comprehensive functionality
3. **E2E Tests** - Browser-based, Web Workers validation

---

## Test Coverage Summary

### Current Stats
- **Unit Tests:** 2 files, 31 tests ✅
- **Integration Tests:** 9 files, ~150+ tests 🎯
- **E2E Tests:** 1 file, ~6 tests (Playwright) 🌐
- **Total:** ~190+ tests

### Coverage Goals
- Line coverage: >80%
- Branch coverage: >70%
- Function coverage: >90%

---

## Test Types

### 1. Unit Tests (`tests/unit/`)

**Purpose:** Test pure logic without external dependencies

**Files:**
- `router.test.ts` - Legacy router logic
- `ModelCache.test.ts` - LRU cache with TTL

**Characteristics:**
- ⚡ Fast (< 5 seconds total)
- 🎯 Isolated
- 🔄 No real models
- ✅ Run on every commit

**Run:** `npm run test:unit`

---

### 2. Integration Tests (`tests/integration/`)

**Purpose:** Test real AI models and full functionality

**Files:**

#### Core Functionality
- **AIProvider.integration.test.ts**
  - Model loading (warmup, progress, ready)
  - Chat (string, message array)
  - Completion
  - Streaming
  - Temperature/maxTokens
  - Resource management (unload, reload)
  - Multiple provider instances

- **Embeddings.integration.test.ts**
  - Single/multiple text embedding
  - Embedding consistency
  - Dimension validation
  - Cosine similarity
  - findSimilar semantic search
  - RAG use cases
  - Batch processing (100+ texts)

#### Speech
- **STT.integration.test.ts** (Whisper)
  - English transcription
  - Polish transcription
  - German transcription
  - Auto-detect language
  - Silence handling
  - Long audio (60s)
  - Timestamps support

- **TTS.integration.test.ts** (SpeechT5)
  - Basic synthesis
  - Long text synthesis
  - WAV format validation
  - Roundtrip test (TTS → STT)

#### Adapters
- **OpenAIAdapter.integration.test.ts**
  - createChatCompletion
  - createCompletion
  - createEmbeddings
  - Streaming (SSE format)
  - Response format compatibility

- **LangChainAdapter.integration.test.ts**
  - LangChainLLM (call, callMessages, stream)
  - LangChainEmbeddings (embedDocuments, embedQuery)
  - Semantic similarity
  - Multi-turn conversations

#### Advanced
- **Performance.integration.test.ts**
  - 10 concurrent chat requests
  - 50 concurrent embedding requests
  - Cache performance (second warmup faster)
  - Model switch speed
  - Memory leak detection (100 requests)
  - Large batch (1000 embeddings)

- **Scenarios.integration.test.ts**
  - Multi-turn conversation (10 turns)
  - RAG pipeline (semantic search + LLM context)
  - Large knowledge base search (100 documents)
  - Multimodal workflow (LLM + embeddings)
  - Streaming performance metrics

- **EdgeCases.integration.test.ts**
  - Invalid input (empty, null, undefined)
  - Invalid parameters (negative temperature, zero maxTokens)
  - Very long input (2000+ tokens)
  - Unicode characters
  - Special characters (newlines, HTML, code)
  - Model state management
  - Concurrent operations
  - Error recovery

- **Config.integration.test.ts**
  - Different dtype (fp32, q8)
  - Device configuration (cpu, default)
  - Model switching
  - Concurrent model loading
  - Config validation

**Characteristics:**
- 🐌 Slow (5-15 minutes first run)
- 🌐 Requires internet (downloads models)
- 💾 Uses cache (`.cache/test/`)
- 🎯 Real Transformers.js models
- ✅ Run before release

**Models Used:**
- LLM: `Xenova/distilgpt2` (small, fast)
- Embeddings: `Xenova/all-MiniLM-L6-v2`
- STT: `Xenova/whisper-tiny`
- TTS: `Xenova/speecht5_tts`

**Run:** `npm run test:integration`

---

### 3. E2E Tests (`tests/e2e/`)

**Purpose:** Test Web Workers in real browser environment

**Files:**
- **Workers.e2e.test.ts**
  - Page loads correctly
  - LLM executes in worker without blocking UI
  - Progress tracking from worker
  - Error handling in worker
  - Concurrent requests through worker pool
  - Token streaming from worker

**Characteristics:**
- 🌐 Requires browser (Chromium via Playwright)
- ⏱️ Medium speed (30s per test)
- 🎭 Real user interactions
- 🧵 Validates Web Worker functionality
- ✅ Run before browser-related releases

**Setup:**
```bash
npm install -D @playwright/test
npx playwright install chromium
```

**Run:** `npm run test:e2e`

---

## Test Fixtures

### Audio Files (`tests/fixtures/audio/`)

Required for STT tests:

1. **hello-world-en.wav** - "Hello world, this is a test" (EN)
2. **polish-test.wav** - "Cześć, to jest test automatyczny" (PL)
3. **german-test.wav** - "Hallo, das ist ein automatischer Test" (DE)
4. **long-audio-pl.wav** - 60s Polish speech
5. **sample.wav** - Silence placeholder (exists)

**Format:** 16kHz, mono, PCM 16-bit

**See:** `tests/fixtures/audio/README.md` for generation instructions

### Expected Outputs (`tests/fixtures/expected-outputs.json`)

Known correct outputs for regression testing:
- Transcriptions for each audio file
- Keywords to verify
- Languages

---

## Running Tests

### Quick Commands

```bash
# Unit only (fast)
npm run test:unit

# Integration only (slow, real models)
npm run test:integration

# E2E only (browser)
npm run test:e2e

# Unit + Integration
npm run test:all

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### First-time Setup

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Add real audio fixtures (see tests/fixtures/audio/README.md)
# Then run tests
npm run test:all
```

### CI/CD

```yaml
# .github/workflows/test.yml
- name: Run unit tests
  run: npm run test:unit

- name: Run integration tests (main branch only)
  if: github.ref == 'refs/heads/main'
  run: npm run test:integration

- name: Setup Playwright
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e
```

---

## Test Quality Metrics

### Coverage Targets
- ✅ Line coverage: >80%
- ✅ Branch coverage: >70%
- ✅ Function coverage: >90%

### Reliability Targets
- ✅ Model load success: 100%
- ✅ Inference success: >95%
- ✅ Error handling: 100%
- ✅ Memory leaks: 0
- ✅ Flaky tests: 0

---

## Debugging Tests

### Enable verbose logging
```bash
DEBUG=transformers-router:* npm run test:integration
```

### Run single test file
```bash
npx jest tests/integration/Embeddings.integration.test.ts
```

### Run single test
```bash
npx jest -t "should embed single text"
```

### Debug Playwright
```bash
npx playwright test --debug
```

---

## Known Issues and Workarounds

### 1. First run is slow
- **Issue:** Downloads models from HuggingFace (~5-15 min)
- **Solution:** Models cached in `.cache/test/`, subsequent runs faster

### 2. STT/TTS tests may fail
- **Issue:** Requires real audio fixtures
- **Solution:** Add audio files to `tests/fixtures/audio/` (see README)

### 3. Web Workers tests fail in Node.js
- **Issue:** import.meta.url not available
- **Solution:** Use Playwright E2E tests instead

### 4. Memory usage in CI
- **Issue:** Integration tests use significant memory
- **Solution:** Use `NODE_OPTIONS="--max-old-space-size=4096"`

---

## Contributing Tests

### Adding New Integration Test

1. Create file: `tests/integration/YourFeature.integration.test.ts`
2. Use real models (no mocks!)
3. Add to test categories in `tests/README.md`
4. Ensure proper cleanup in `afterAll`

### Adding New E2E Test

1. Create test page in `examples/` or `tests/e2e/fixtures/`
2. Create test: `tests/e2e/YourFeature.e2e.test.ts`
3. Use Playwright API
4. Test in browser environment

### Adding New Fixture

1. Add file to `tests/fixtures/`
2. Update `expected-outputs.json`
3. Document in fixture README
4. Reference in tests

---

## Test Maintenance

### Weekly
- Review flaky tests
- Update model versions if needed
- Check coverage reports

### Before Release
- Run full test suite: `npm run test:all && npm run test:e2e`
- Verify coverage >80%
- Check no memory leaks
- Validate all fixtures present

### After Breaking Changes
- Update integration tests
- Regenerate expected outputs
- Update fixture documentation

