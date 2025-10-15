/* eslint-env browser */

const { createAIProvider } = await import('/dist/index.js');

const statusEl = document.querySelector('[data-testid="status"]');
const progressEl = document.querySelector('[data-testid="progress"]');
const barFill = document.querySelector('.progressbar__fill');
const out = document.getElementById('out');
const measureBtn = document.getElementById('measure');

const provider = createAIProvider({
  llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 20 }
});

function setProgress(num) {
  if (progressEl) progressEl.textContent = String(num ?? 0);
  if (barFill) barFill.style.width = `${Math.max(0, Math.min(100, Math.round(num ?? 0)))}%`;
}

provider.on('progress', ({ status, progress }) => {
  if (statusEl) statusEl.textContent = status;
  if (typeof progress === 'number') setProgress(progress);
});

window.testReady = true;

measureBtn?.addEventListener('click', async () => {
  const result = {};
  try {
    const t0 = performance.now();
    await provider.warmup('llm');
    result.warmupMs = Math.round(performance.now() - t0);

    const t1 = performance.now();
    const r = await provider.chat('Say hello');
    result.chatMs = Math.round(performance.now() - t1);
    result.contentLen = r.content.length;

    out.textContent = JSON.stringify(result, null, 2);
  } catch (e) {
    out.textContent = 'Error: ' + (e?.message || String(e));
  }
});


