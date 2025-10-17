/* eslint-env browser */
/* global document */

const { createAIProvider } = await import('/dist/index.js');

const statusEl = document.querySelector('[data-testid="status"]');
const progressEl = document.querySelector('[data-testid="progress"]');
const fileEl = document.querySelector('[data-testid="file"]');
const barFill = document.querySelector('.progressbar__fill');
const runBtn = document.getElementById('run');
const out = document.getElementById('out');
const audio = document.getElementById('audio');

const provider = createAIProvider({
  stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' },
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
    const transcript = await provider.listen('/tests/fixtures/audio/hello-world-en.wav');
    const response = await provider.chat(`User said: ${transcript}. Reply briefly.`);
    const blob = await provider.speak(response.content);
    const url = URL.createObjectURL(blob);
    audio.src = url;
    out.textContent = `ASR: ${transcript}\nLLM: ${response.content}`;
    await audio.play().catch(() => {});
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


