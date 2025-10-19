export function attachToolbar() {
  const root = document.getElementById('root');
  if (!root) return;

  // Avoid duplicate toolbar
  if (root.querySelector('.toolbar')) return;

  const bar = document.createElement('div');
  bar.className = 'toolbar';
  bar.style.display = 'flex';
  bar.style.gap = '8px';
  bar.style.marginBottom = '8px';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn';
  backBtn.textContent = 'Back';
  backBtn.addEventListener('click', () => {
    window.location.href = '/tests/integration-browser/__assets__/index.html';
  });

  const reloadBtn = document.createElement('button');
  reloadBtn.className = 'btn';
  reloadBtn.textContent = 'Reload';
  reloadBtn.addEventListener('click', () => window.location.reload());

  bar.appendChild(backBtn);
  bar.appendChild(reloadBtn);
  root.insertBefore(bar, root.firstChild);
}

function ensureUIHelpers() {
  if (!window.ui) {
    window.ui = {};
  }

  // Render text into a standard output area
  window.ui.setOutputText = (text) => {
    const el = document.querySelector('[data-testid="llm-output"], [data-testid="stt-text"], #transcription');
    if (el) el.textContent = text ?? '';
  };

  // Render audio blob into standard audio element and expose size
  window.ui.setOutputAudio = (blob) => {
    const audio = document.querySelector('[data-testid="tts-audio"], audio#audio');
    if (audio && blob instanceof Blob) {
      const url = URL.createObjectURL(blob);
      // @ts-ignore
      audio.src = url;
    }
    const sizeEl = document.querySelector('[data-testid="tts-size"]');
    if (sizeEl && blob instanceof Blob) {
      sizeEl.textContent = String(blob.size);
    }
  };
}

export async function initProviderWithUI({ modality = 'llm', config }) {
  attachToolbar();
  ensureUIHelpers();
  const statusEl = document.querySelector('[data-testid="status"]');
  const progressEl = document.querySelector('[data-testid="progress"]');
  const fileEl = document.querySelector('[data-testid="file"]');
  const barFill = document.querySelector('.progressbar__fill');
  const startBtn = document.querySelector('[data-testid="start-warmup"]');

  const { createAIProvider } = await import('/dist/index.js');
  const providerConfig = {};
  // Ustaw domyślne skalowanie/quantization dla LLM, jeśli nie podano
  if (modality === 'llm') providerConfig.llm = { dtype: 'q4', ...(config || {}) };
  if (modality === 'stt') providerConfig.stt = config;
  if (modality === 'tts') providerConfig.tts = config;
  if (modality === 'embedding') providerConfig.embedding = config;
  const provider = createAIProvider(providerConfig);

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

  window.startWarmup = () => provider.warmup(modality);
  if (startBtn) startBtn.addEventListener('click', () => window.startWarmup());

  // Eksponuj statusy dla Playwright/DevTools
  window.getStatus = (m) => provider.getStatus(m || modality);
  window.getAllStatuses = () => provider.getAllStatuses();

  window.testReady = true;
  return provider;
}


