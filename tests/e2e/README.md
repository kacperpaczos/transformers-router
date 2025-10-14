# E2E Tests for Web Workers

End-to-end tests for browser-based functionality using Playwright.

## What We Test

### Web Workers
- Non-blocking AI inference in background threads
- UI responsiveness during long-running model operations
- Worker pool management (multiple workers)
- Progress tracking from workers
- Error propagation from workers to main thread
- Streaming tokens from workers

### React Hooks (future)
- useAIProvider lifecycle
- useChat state management
- Real-time updates

### Vue Composables (future)
- Reactive state management
- Composable lifecycle

## Setup

### Install Playwright

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### Run E2E Tests

```bash
# Run tests (headless)
npm run test:e2e

# Run with browser visible
npm run test:e2e:headed

# Run specific test
npx playwright test Workers.e2e.test.ts
```

## How It Works

### 1. Test Server
`tests/e2e/server.js` serves the examples directory on localhost:3000

### 2. Playwright Tests
Tests navigate to example pages and interact with them:
- Click buttons
- Fill inputs
- Check outputs
- Verify UI responsiveness
- Monitor console logs

### 3. Worker-specific Tests
- `worker-chat.html` - Example chat page using Web Workers
- Tests verify:
  - Workers initialize correctly
  - Inference doesn't block UI thread
  - Progress events work
  - Multiple concurrent requests handled

## Test Pages

### worker-chat.html
Full-featured chat interface using AIProviderWorker:
- Warmup button
- Message input
- Send button
- Progress display
- Error display
- Chat history

## Browser Requirements

E2E tests run in:
- Chromium (default)
- Firefox (optional, add to playwright.config.ts)
- WebKit (optional, add to playwright.config.ts)

## Debugging

### View test results
```bash
npx playwright show-report
```

### Debug mode
```bash
npx playwright test --debug
```

### Screenshots on failure
Screenshots automatically saved to `test-results/` on failure.

## CI/CD

In CI environments:
```yaml
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e
```

## Known Limitations

- Web Workers require bundling (Vite, Webpack) in production
- `import.meta.url` not available in Node.js tests
- E2E tests are slower than integration tests (~30s per test)
- Require real browser environment

## Adding New E2E Tests

1. Create test page in `examples/` or `tests/e2e/fixtures/`
2. Add test file in `tests/e2e/`
3. Use Playwright API to interact with page
4. Verify functionality

Example:
```typescript
test('my new test', async ({ page }) => {
  await page.goto('/my-test-page.html');
  await page.click('#button');
  await expect(page.locator('#result')).toContainText('success');
});
```

