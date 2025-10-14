/**
 * E2E tests for Web Workers in browser environment
 */

import { test, expect } from '@playwright/test';

test.describe('Web Workers E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log(`Browser: ${msg.text()}`));
    
    // Navigate to worker test page
    await page.goto('/');
  });

  test('should load worker-based chat page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('🚀 Chat z Web Workers');
    await expect(page.locator('#userInput')).toBeVisible();
    await expect(page.locator('#sendBtn')).toBeVisible();
  });

  test('should execute LLM in worker without blocking UI', async ({ page }) => {
    // Add a click counter button to test UI responsiveness
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.id = 'test-button';
      button.textContent = 'Click me';
      let clicks = 0;
      button.onclick = () => {
        clicks++;
        const counter = document.getElementById('clicks') || document.createElement('div');
        counter.id = 'clicks';
        counter.textContent = clicks.toString();
        if (!document.getElementById('clicks')) {
          document.body.appendChild(counter);
        }
      };
      document.body.appendChild(button);
    });

    // Start long-running inference in worker
    await page.fill('#userInput', 'Write a story about space');
    await page.click('#sendBtn');

    // While inference is running, UI should remain responsive
    // Click button 10 times rapidly
    for (let i = 0; i < 10; i++) {
      await page.click('#test-button');
      await page.waitForTimeout(50);
    }

    // Check counter updated (UI wasn't blocked)
    await expect(page.locator('#clicks')).toHaveText('10');

    // Wait for inference to complete
    await expect(page.locator('#output')).not.toBeEmpty({ timeout: 60000 });

    console.log('✅ UI remained responsive during worker inference');
  });

  test('should track progress from worker', async ({ page }) => {
    // Listen for progress events
    const progressEvents: string[] = [];
    
    await page.exposeFunction('onProgress', (event: string) => {
      progressEvents.push(event);
    });

    await page.evaluate(() => {
      // Hook into progress events
      (window as any).onProgressEvent = (event: any) => {
        (window as any).onProgress(JSON.stringify(event));
      };
    });

    // Trigger warmup
    await page.click('#warmup-btn');

    // Wait for ready
    await page.waitForFunction(() => 
      (window as any).isReady === true, 
      { timeout: 120000 }
    );

    // Should have received progress events
    expect(progressEvents.length).toBeGreaterThan(0);
    
    console.log(`✅ Received ${progressEvents.length} progress events from worker`);
  });

  test('should handle worker errors gracefully', async ({ page }) => {
    // Try to use before warmup
    await page.fill('#userInput', 'test message');
    await page.click('#sendBtn');

    // Should show error message in chat
    await expect(page.locator('.message.assistant')).toContainText('Błąd', { timeout: 5000 });
    
    const errorMessage = await page.locator('.message.assistant .message-content').last().textContent();
    expect(errorMessage).toContain('Błąd');

    console.log(`✅ Error handled: "${errorMessage}"`);
  });

  test('should handle multiple concurrent requests through worker pool', async ({ page }) => {
    // Warmup first
    await page.click('#warmup-btn');
    await page.waitForFunction(() => 
      (window as any).isReady === true, 
      { timeout: 120000 }
    );

    // Send 5 messages concurrently
    const messages = ['Message 1', 'Message 2', 'Message 3', 'Message 4', 'Message 5'];
    
    for (const msg of messages) {
      await page.fill('#userInput', msg);
      await page.click('#sendBtn');
      await page.waitForTimeout(100);
    }

    // Wait for all responses (should appear in chat)
    await page.waitForFunction(() => {
      const messages = document.querySelectorAll('.message');
      return messages.length >= 10; // 5 user + 5 assistant
    }, { timeout: 120000 });

    const messageCount = await page.locator('.message').count();
    expect(messageCount).toBeGreaterThanOrEqual(10);

    console.log(`✅ Handled ${messages.length} concurrent requests through worker pool`);
  });

  test('should stream tokens from worker progressively', async ({ page }) => {
    await page.click('#warmup-btn');
    await page.waitForFunction(() => 
      (window as any).isReady === true, 
      { timeout: 120000 }
    );

    // Enable streaming mode
    await page.check('#streaming-mode');

    // Send message
    await page.fill('#userInput', 'Count to 10');
    await page.click('#sendBtn');

    // Watch tokens appear progressively
    let previousLength = 0;
    let progressiveUpdates = 0;

    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      
      const currentText = await page.locator('#output').textContent() || '';
      
      if (currentText.length > previousLength) {
        progressiveUpdates++;
        previousLength = currentText.length;
      }

      if (currentText.includes('[DONE]') || currentText.length > 100) {
        break;
      }
    }

    // Should have seen progressive updates (streaming works)
    expect(progressiveUpdates).toBeGreaterThan(1);
    
    console.log(`✅ Streaming: ${progressiveUpdates} progressive updates`);
  });
});

