import { test, expect } from '@playwright/test';

test.describe('Chat Applications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/integration-browser/__assets__/index.html');
  });

  test('simple-chat: should load model and enable chat', async ({ page }) => {
    // Navigate to simple chat
    await page.click('text=simple-chat');
    await page.waitForLoadState('networkidle');

    // Check initial state
    await expect(page.locator('#message-input')).toBeDisabled();
    await expect(page.locator('#send-button')).toBeDisabled();
    await expect(page.locator('#load-model')).toBeEnabled();

    // Load model
    await page.click('#load-model');
    await expect(page.locator('#load-model')).toHaveText('Loading...');

    // Wait for model to load (this might take a while)
    await page.waitForSelector('#load-model:has-text("Model Ready")', { timeout: 60000 });

    // Check that chat is now enabled
    await expect(page.locator('#message-input')).toBeEnabled();
    await expect(page.locator('#send-button')).toBeEnabled();

    // Verify status
    await expect(page.locator('[data-testid="status"]')).toHaveText('ready');
  });

  test('simple-chat: should send and receive messages', async ({ page }) => {
    // Navigate to simple chat
    await page.click('text=simple-chat');
    await page.waitForLoadState('networkidle');

    // Load model
    await page.click('#load-model');
    await page.waitForSelector('#load-model:has-text("Model Ready")', { timeout: 60000 });

    // Send a message
    await page.fill('#message-input', 'Hello, how are you?');
    await page.click('#send-button');

    // Check that input is cleared
    await expect(page.locator('#message-input')).toHaveValue('');

    // Wait for response (should appear as AI message)
    await page.waitForSelector('.ai-message:not(:has-text("Model loaded!")):not(:has-text("..."))', { timeout: 30000 });

    // Verify conversation flow
    const messages = page.locator('.message');
    await expect(messages).toHaveCount(3); // Welcome + Model loaded + User message + AI response

    // Check that we have both user and AI messages
    await expect(page.locator('.user-message')).toContainText('Hello, how are you?');
    await expect(page.locator('.ai-message').last()).not.toHaveText('...');
  });

  test('simple-chat: should maintain conversation history', async ({ page }) => {
    // Navigate to simple chat
    await page.click('text=simple-chat');
    await page.waitForLoadState('networkidle');

    // Load model
    await page.click('#load-model');
    await page.waitForSelector('#load-model:has-text("Model Ready")', { timeout: 60000 });

    // Send first message
    await page.fill('#message-input', 'What is 2+2?');
    await page.click('#send-button');
    await page.waitForSelector('.ai-message:not(:has-text("Model loaded!")):not(:has-text("..."))', { timeout: 30000 });

    // Send second message that references the first
    await page.fill('#message-input', 'And what about 3+3?');
    await page.click('#send-button');
    await page.waitForSelector('.ai-message:not(:has-text("Model loaded!")):not(:has-text("..."))', { timeout: 30000 });

    // Verify we have multiple messages
    const messages = page.locator('.message');
    await expect(messages).toHaveCount(5); // Welcome + Model loaded + 2 user messages + 2 AI responses

    // Check conversation history
    await expect(page.locator('.user-message').first()).toContainText('What is 2+2?');
    await expect(page.locator('.user-message').last()).toContainText('And what about 3+3?');
  });

  test('simple-chat: should clear conversation', async ({ page }) => {
    // Navigate to simple chat
    await page.click('text=simple-chat');
    await page.waitForLoadState('networkidle');

    // Load model
    await page.click('#load-model');
    await page.waitForSelector('#load-model:has-text("Model Ready")', { timeout: 60000 });

    // Send a message to create conversation
    await page.fill('#message-input', 'Test message');
    await page.click('#send-button');
    await page.waitForSelector('.ai-message:not(:has-text("Model loaded!")):not(:has-text("..."))', { timeout: 30000 });

    // Clear chat
    await page.click('#clear-chat');

    // Verify chat is cleared
    const messages = page.locator('.message');
    await expect(messages).toHaveCount(1);
    await expect(messages.first()).toContainText('Chat cleared');
  });

  test('chat-conversation: should load with advanced controls', async ({ page }) => {
    // Navigate to advanced chat
    await page.click('text=chat-conversation');
    await page.waitForLoadState('networkidle');

    // Check that advanced controls are present
    await expect(page.locator('#model-select')).toBeVisible();
    await expect(page.locator('#max-tokens')).toBeVisible();
    await expect(page.locator('#temperature')).toBeVisible();

    // Check initial state
    await expect(page.locator('#message-input')).toBeDisabled();
    await expect(page.locator('#send-button')).toBeDisabled();

    // Check model options
    const modelSelect = page.locator('#model-select');
    await expect(modelSelect.locator('option[value="Xenova/gpt2"]')).toBeVisible();
    await expect(modelSelect.locator('option[value="onnx-community/Qwen2.5-0.5B-Instruct"]')).toBeVisible();
  });

  test('chat-conversation: should change model settings', async ({ page }) => {
    // Navigate to advanced chat
    await page.click('text=chat-conversation');
    await page.waitForLoadState('networkidle');

    // Change model settings
    await page.selectOption('#model-select', 'Xenova/gpt2');
    await page.fill('#max-tokens', '25');
    await page.fill('#temperature', '0.9');

    // Verify settings are applied
    await expect(page.locator('#model-select')).toHaveValue('Xenova/gpt2');
    await expect(page.locator('#max-tokens')).toHaveValue('25');
    await expect(page.locator('#temperature')).toHaveValue('0.9');
  });
});
