export async function initProviderWithUI({ modality = 'llm', config }) {
  const statusEl = document.querySelector('[data-testid="status"]');
  const progressEl = document.querySelector('[data-testid="progress"]');
  const fileEl = document.querySelector('[data-testid="file"]');
  const barFill = document.querySelector('.progressbar__fill');
  const startBtn = document.querySelector('[data-testid="start-warmup"]');

  const { createAIProvider } = await import('/dist/index.js');
  const providerConfig = {};
  if (modality === 'llm') providerConfig.llm = config;
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


