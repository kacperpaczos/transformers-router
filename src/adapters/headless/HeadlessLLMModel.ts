import {
  ILLMModel,
  Message,
  ChatOptions,
  ChatResponse,
  CompletionOptions,
  ModelConfig,
} from '../../domain/models';
import { HeadlessBrowserService } from '../../infra/headless/HeadlessBrowserService';
import { Page } from 'playwright';
import {
  BridgeCommandType,
  BridgeEventType,
  LoadPayload,
  ChatPayload,
  TokenPayload,
  ErrorPayload,
  BridgeMessage,
} from '../../core/bridge/protocol';
import { createLogBus, ILogBus } from '../../core/logging/LogBus';
import { AsyncQueue } from '../../utils/AsyncQueue'; // Assuming this utility exists, or we implement a simple one.

/**
 * HeadlessLLMModel
 *
 * Adapts the Node.js `ILLMModel` interface to run inside a Headless Browser via WebGPU.
 * - Manages a Playwright `Page`.
 * - Sends JSON-RPC commands for Chat/Completions.
 * - Listens for Token events for Streaming.
 */
export class HeadlessLLMModel implements ILLMModel {
  public id: string;
  public provider = 'headless-webgpu';
  private page: Page | null = null;
  private logger: ILogBus;
  private isLoaded = false;
  private config: ModelConfig;
  private service: HeadlessBrowserService;

  // Streaming state
  private tokenQueue = new AsyncQueue<string>();
  private activeRequestId: string | null = null;

  constructor(config: ModelConfig) {
    this.id = config.id || 'headless-llm';
    this.config = config;
    this.logger = createLogBus(`HeadlessLLM:${this.id}`);
    this.service = HeadlessBrowserService.getInstance();
  }

  /**
   * Initialize the model in the browser.
   * 1. Ensure Browser is running.
   * 2. Create a specific Page.
   * 3. Inject Bridge Helpers.
   * 4. Load the compiled bundle (logic to be handled by a specific URI or content injection).
   * 5. Send CMD_LOAD.
   */
  async load(): Promise<void> {
    if (this.isLoaded) return;

    this.logger.info('Initializing Headless LLM Adapter...');

    // 1. Ensure Service is ready
    await this.service.launch();
    this.page = await this.service.createPage();

    // 2. Setup Bridge Listeners (Browser -> Node)
    // We expose a function `bridgeEmit` that the browser calls to send events up.
    await this.page.exposeFunction('bridgeEmit', (event: BridgeMessage) => {
      this.handleBridgeEvent(event);
    });

    // 3. Load LXRT Browser Runtime
    // Ideally this serves a local file or generic "runner" HTML.
    // For now we assume a simple HTML harness that loads our library.
    // TODO: Serve the actual distribution bundle.
    await this.page.goto('about:blank'); // Placeholder for actual loader

    // Inject the Client Logic (Simulated for this phase until Bundle is ready)
    // In production, this would be `await page.addScriptTag({ path: 'dist/browser.js' })`
    // Here we inject a stub to satisfy the protocol if the bundle isn't there yet.

    // 4. Send Load Command
    const loadPayload: LoadPayload = {
      modality: 'llm',
      modelKey: this.config.model as string, // Cast for now
      config: this.config as Record<string, unknown>,
      device: 'webgpu',
    };

    await this.sendCommand(BridgeCommandType.LOAD, loadPayload);
    this.isLoaded = true;
    this.logger.info('✅ Model loaded in Headless Browser');
  }

  private async sendCommand<T>(
    type: BridgeCommandType,
    payload: T
  ): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    const id = Date.now().toString(); // Simple ID
    const message: BridgeMessage<T> = {
      id,
      type,
      payload,
      timestamp: Date.now(),
    };

    // We evaluate a function in the browser that dispatches this to the internal handler
    await this.page.evaluate(msg => {
      // @ts-ignore - 'window.bridge' would be our internal global
      if (window.bridge) window.bridge.receive(msg);
      else console.warn('Bridge not ready in browser');
    }, message);
  }

  private handleBridgeEvent(event: BridgeMessage): void {
    switch (event.type) {
      case BridgeEventType.TOKEN: {
        const token = (event.payload as TokenPayload).text;
        this.tokenQueue.enqueue(token);
        break;
      }
      case BridgeEventType.DONE:
        this.tokenQueue.close();
        break;
      case BridgeEventType.ERROR: {
        const err = event.payload as ErrorPayload;
        this.logger.error(`[Bridge Error] ${err.message}`);
        this.tokenQueue.error(new Error(err.message));
        break;
      }
      case BridgeEventType.LOG:
        break;
    }
  }

  async chat(
    messages: Message[] | string,
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const textMessages =
      typeof messages === 'string'
        ? [{ role: 'user', content: messages }]
        : messages;

    // Collect stream
    const generator = this.stream(textMessages, options);
    let fullText = '';

    for await (const chunk of generator) {
      fullText += chunk;
    }

    return {
      role: 'assistant',
      content: fullText,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, // Metrics todo
    };
  }

  async complete(
    prompt: string,
    _options?: CompletionOptions
  ): Promise<string> {
    const response = await this.chat([{ role: 'user', content: prompt }]);
    return response.content;
  }

  async *stream(
    messages: Message[] | string,
    options?: ChatOptions
  ): AsyncGenerator<string> {
    if (!this.isLoaded) await this.load();

    const payload: ChatPayload = {
      messages:
        typeof messages === 'string'
          ? [{ role: 'user', content: messages }]
          : messages,
      maxTokens: options?.max_tokens,
      temperature: options?.temperature,
    };

    // Reset Queue
    this.tokenQueue = new AsyncQueue<string>();

    // Send Command
    await this.sendCommand(BridgeCommandType.CHAT, payload);

    // Yield from Queue
    while (true) {
      const token = await this.tokenQueue.dequeue();
      if (token === null) break;
      yield token;
    }
  }

  countTokens(text: string): number {
    return text.length / 4; // Crude approximation
  }

  getContextWindow(): number {
    return 4096; // Hardcoded for now
  }
}
