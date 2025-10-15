/* eslint-env browser */

const { createAIProvider } = await import('/dist/index.js');

const out = document.getElementById('out');

// Simulate network error by pointing to a model with resources blocked or bad path
const provider = createAIProvider({
  stt: { model: 'Xenova/whisper-tiny.en', device: 'wasm', dtype: 'fp32' }
});

window.testReady = true;

(async () => {
  try {
    // Try to load an audio from a non-existing URL
    const text = await provider.listen('/tests/fixtures/audio/does-not-exist.wav');
    out.textContent = 'Unexpected success: ' + text;
  } catch (e) {
    out.textContent = 'Caught error: ' + (e?.message || String(e));
  }
})();


