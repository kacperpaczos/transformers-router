import { Page } from '@playwright/test';

type Modality = 'llm' | 'stt' | 'tts' | 'embedding';

export async function navigateAndWaitReady(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => (window as any).testReady === true);
}

export async function ensureProvider(page: Page, modality: Modality, config: Record<string, any>): Promise<void> {
  await page.evaluate(
    async ({ modality, config }) => {
      // Ensure provider is initialized once per suite
      if (!(window as any).__provider) {
        const { createAIProvider } = (window as any);
        (window as any).__provider = createAIProvider(config);
      }
      const provider = (window as any).__provider;
      // Warmup only once per modality
      (window as any).__warmed ||= {};
      if (!(window as any).__warmed[modality]) {
        await provider.warmup(modality);
        (window as any).__warmed[modality] = true;
      }

      // Expose minimal app API used by tests
      const app: any = (window as any).app || ((window as any).app = {});
      app.ready = true;
      app.dispose = async () => provider.dispose();

      if (modality === 'llm') {
        app.runPrompt = async (text: string, options?: any) => provider.chat(text, options);
        app.chat = async (input: any, options?: any) => provider.chat(input, options);
        app.runStream = async (text: string, options?: any) => {
          const tokens: string[] = [];
          const stream = await provider.stream(text, options);
          for await (const t of stream) tokens.push(String(t));
          return tokens;
        };
      }

      if (modality === 'stt') {
        app.transcribe = async (audio: any, options?: any) => provider.transcribe(audio, options);
        app.listen = async (audio: any, options?: any) => provider.listen(audio, options);
      }

      if (modality === 'tts') {
        app.speak = async (text: string, options?: any) => provider.speak(text, options);
      }

      if (modality === 'embedding') {
        app.embed = async (input: any, options?: any) => provider.embed(input, options);
      }
    },
    { modality, config }
  );
}


