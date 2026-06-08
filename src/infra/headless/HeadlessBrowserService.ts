import { Browser, BrowserContext, Page, ConsoleMessage } from 'playwright';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { createLogBus, ILogBus } from '../../core/logging/LogBus';

/**
 * Service responsible for managing the Headless Browser lifecycle.
 * Acts as a Singleton to ensure only one browser instance consumes resources.
 */
export class HeadlessBrowserService extends EventEmitter {
  private static instance: HeadlessBrowserService;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private isInitializing = false;
  private logger: ILogBus;

  private constructor() {
    super();
    this.logger = createLogBus('HeadlessBrowser');
  }

  public static getInstance(): HeadlessBrowserService {
    if (!HeadlessBrowserService.instance) {
      HeadlessBrowserService.instance = new HeadlessBrowserService();
    }
    return HeadlessBrowserService.instance;
  }

  /**
   * Preflight Check: Verifies if Playwright and Browsers are installed.
   * Uses `npx playwright --version` as a proxy check.
   * This is a "dry run" to prevent hard crashes during runtime.
   */
  public async checkCapabilities(): Promise<boolean> {
    return new Promise(resolve => {
      // We check for the 'playwright' package availability first
      try {
        require.resolve('playwright');
      } catch {
        this.logger.error(
          '❌ Playwright package not found. Please install it: npm install playwright'
        );
        resolve(false);
        return;
      }

      // Check if browsers are installed by running a version check
      const cmd = spawn('npx', ['playwright', '--version'], {
        stdio: 'ignore',
        shell: true,
      });

      cmd.on('close', code => {
        if (code !== 0) {
          this.logger.error(
            '❌ Playwright binary check failed. Please run: npx playwright install chromium'
          );
          resolve(false);
        } else {
          resolve(true);
        }
      });

      cmd.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Launches the browser if not already running.
   * Lazy-loads 'playwright' to avoid overhead if WebGPU is not used.
   */
  public async launch(): Promise<void> {
    if (this.browser) return;
    if (this.isInitializing) {
      // Simple wait-for-lock mechanism
      return new Promise(resolve => {
        const check = setInterval(() => {
          if (this.browser) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }

    this.isInitializing = true;

    try {
      this.logger.info('🚀 Launching Headless Browser (WebGPU Enabled)...');

      // Dynamic import to keep it optional

      const { chromium } = require('playwright');

      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--use-gl=angle',
          '--use-angle=gl-webgpu',
          '--enable-unsafe-webgpu', // Often needed in headless
          '--disable-vulkan-fallback-to-gl-for-testing',
        ],
      });

      this.context = await this.browser.newContext();

      this.logger.info('✅ Browser Launched');
    } catch (error) {
      this.logger.error('🔥 Failed to launch browser', { error });
      this.isInitializing = false;
      throw new Error(
        `Failed to launch Headless Browser: ${(error as Error).message}`
      );
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Creates a new isolated Page for an AIProvider.
   * Sets up Console Piping and Error Handling.
   */
  public async createPage(): Promise<Page> {
    if (!this.browser || !this.context) {
      throw new Error('Browser not running. Call launch() first.');
    }

    const page = await this.context.newPage();

    // 1. Pipe Console Logs
    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      const text = msg.text();

      if (type === 'error') this.logger.error(`[Page] ${text}`);
      else if (type === 'warning') this.logger.warn(`[Page] ${text}`);
      else this.logger.info(`[Page] ${text}`);
    });

    // 2. Handle Crashes
    page.on('crash', () => {
      this.logger.error('[Browser] ☠️ Page Crashed! (OOM or Internal Error)');
      this.emit('page-crash', page);
    });

    page.on('pageerror', err => {
      this.logger.error(`[Browser] Uncaught Exception: ${err.message}`, {
        stack: err.stack,
      });
    });

    return page;
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
    }
  }
}
