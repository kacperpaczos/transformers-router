/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const { createAIProvider } = await import('/dist/index.js');
const provider = createAIProvider({
  llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 },
  stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' },
  tts: { model: 'Xenova/speecht5_tts', device: 'wasm', dtype: 'fp32' },
  embedding: { model: 'Xenova/all-MiniLM-L6-v2', device: 'wasm', dtype: 'fp32' },
});

window.testReady = true;

const out = document.getElementById('out');
const overall = document.getElementById('overall-status');

const ui = {
  llm: {
    status: document.getElementById('status-llm'),
    file: document.getElementById('file-llm'),
    progress: document.getElementById('progress-llm'),
    bar: document.getElementById('bar-llm'),
  },
  tts: {
    status: document.getElementById('status-tts'),
    file: document.getElementById('file-tts'),
    progress: document.getElementById('progress-tts'),
    bar: document.getElementById('bar-tts'),
  },
  stt: {
    status: document.getElementById('status-stt'),
    file: document.getElementById('file-stt'),
    progress: document.getElementById('progress-stt'),
    bar: document.getElementById('bar-stt'),
  },
  embedding: {
    status: document.getElementById('status-embedding'),
    file: document.getElementById('file-embedding'),
    progress: document.getElementById('progress-embedding'),
    bar: document.getElementById('bar-embedding'),
  },
};

function setProgress(modality, num) {
  const v = Math.max(0, Math.min(100, Math.round(num ?? 0)));
  ui[modality].progress.textContent = String(v);
  ui[modality].bar.style.width = v + '%';
}

provider.on('progress', ({ modality, status, file, progress }) => {
  if (overall) overall.textContent = status;
  if (!ui[modality]) return;
  if (ui[modality].status) ui[modality].status.textContent = status || 'idle';
  if (typeof progress === 'number') setProgress(modality, progress);
  if (file && ui[modality].file) ui[modality].file.textContent = file;
});

provider.on('ready', () => {
  out.textContent = JSON.stringify(provider.getAllStatuses(), null, 2);
});

document.querySelector('[data-testid="start-warmup"]')?.addEventListener('click', async () => {
  overall.textContent = 'starting...';
  await provider.warmup();
});


