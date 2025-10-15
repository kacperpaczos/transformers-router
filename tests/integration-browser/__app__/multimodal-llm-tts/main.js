/* eslint-env browser */
/* global document */

const { createAIProvider } = await import('/dist/index.js');

const statusEl = document.querySelector('[data-testid="status"]');
const progressEl = document.querySelector('[data-testid="progress"]');
const fileEl = document.querySelector('[data-testid="file"]');
const barFill = document.querySelector('.progressbar__fill');
const runBtn = document.getElementById('run');
const promptEl = document.getElementById('prompt');
const audio = document.getElementById('audio');

const provider = createAIProvider({
  llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 40 },
  tts: { model: 'Xenova/speecht5_tts', device: 'wasm', dtype: 'fp32' },
});

function setProgress(num) {
  if (progressEl) progressEl.textContent = String(num ?? 0);
  if (barFill) barFill.style.width = `${Math.max(0, Math.min(100, Math.round(num ?? 0)))}%`;
}

provider.on('progress', ({ status, file, progress }) => {
  if (statusEl) statusEl.textContent = status;
  if (typeof progress === 'number') setProgress(progress);
  if (file && fileEl) fileEl.textContent = file;
});

provider.on('ready', () => {
  if (statusEl) statusEl.textContent = 'ready';
  setProgress(100);
});

provider.on('error', ({ error }) => {
  if (statusEl) statusEl.textContent = 'error';
  console.error(error);
});

window.testReady = true;

runBtn?.addEventListener('click', async () => {
  try {
    await provider.warmup();
    const prompt = promptEl?.value || 'Say hello from Transformers Router.';
    const r = await provider.chat(prompt, { maxTokens: 30 });
    const blob = await provider.speak(r.content);
    const url = URL.createObjectURL(blob);
    audio.src = url;
    await audio.play().catch(() => {});
  } catch (e) {
    console.error(e);
  }
});


