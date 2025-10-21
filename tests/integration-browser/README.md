### Uruchamianie nowych suite kategorii

- Wszystkie suity: `npx playwright test --config=playwright.integration.config.ts`
- Tylko LLM: `npx playwright test --config=playwright.integration.config.ts --grep @llm`
- Tylko STT: `npx playwright test --config=playwright.integration.config.ts --grep @stt`
- Tylko TTS: `npx playwright test --config=playwright.integration.config.ts --grep @tts`
- Tylko Embeddings: `npx playwright test --config=playwright.integration.config.ts --grep @embeddings`
