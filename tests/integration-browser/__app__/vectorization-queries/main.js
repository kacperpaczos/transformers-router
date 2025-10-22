import { createAIProvider } from '/dist/index.js';

let vectorizationService = null;
let provider = null;

// Sample files for testing
const sampleFiles = [
  { name: 'sample-audio.wav', type: 'audio/wav', content: createSampleAudio() },
  { name: 'sample-image.png', type: 'image/png', content: createSampleImage() },
];

window.testReady = true;

async function initVectorization() {
  const config = {
    storage: 'indexeddb',
    externalMock: { enabled: false },
    quotaThresholds: {
      warn: 0.7,
      high: 0.85,
      critical: 0.95,
    },
  };

  if (provider) {
    await provider.dispose();
  }

  provider = createAIProvider();
  await provider.initializeVectorization(config);
  vectorizationService = provider;

  // Setup event listeners
  provider.onVectorizationEvent('vector:queried', (data) => {
    console.log('Query executed:', data);
    updateStatus('Query executed: ' + data.k + ' results');
  });

  provider.onVectorizationEvent('vector:error', (data) => {
    console.error('Query error:', data);
    updateStatus('Error: ' + data.error);
  });

  updateStatus('Ready');
}

// UI functions
function updateStatus(status) {
  document.querySelector('[data-testid="status"]').textContent = status;
}

function updateQueryResults(results, queryTime) {
  document.querySelector('[data-testid="results-count"]').textContent = results.ids.length;
  document.querySelector('[data-testid="query-time"]').textContent = queryTime + 'ms';
  document.querySelector('[data-testid="similarity-scores"]').textContent =
    results.scores.map((score, i) => `${i + 1}: ${score.toFixed(3)}`).join(', ');
  document.querySelector('[data-testid="result-ids"]').textContent = results.ids.join(', ');
}

// Event listeners
document.getElementById('query-btn').addEventListener('click', async () => {
  if (!vectorizationService) {
    updateStatus('Not initialized');
    return;
  }

  const queryInput = document.getElementById('query-input').value.trim();
  const queryFileInput = document.getElementById('query-file');
  const modality = document.getElementById('modality-select').value;
  const k = parseInt(document.getElementById('k-input').value);

  let query;
  if (queryInput) {
    query = queryInput;
  } else if (queryFileInput.files.length > 0) {
    query = queryFileInput.files[0];
  } else {
    updateStatus('Enter query text or select file');
    return;
  }

  updateStatus('Querying...');

  try {
    const startTime = performance.now();
    const result = await vectorizationService.queryVectors(query, modality, { k });
    const queryTime = performance.now() - startTime;

    console.log('Query result:', result);
    updateQueryResults(result, Math.round(queryTime));
    updateStatus(`Query completed: ${result.ids.length} results`);

  } catch (error) {
    console.error('Query failed:', error);
    updateStatus('Error: ' + error.message);
  }
});

document.getElementById('load-sample-btn').addEventListener('click', async () => {
  if (!vectorizationService) {
    updateStatus('Not initialized');
    return;
  }

  updateStatus('Loading samples...');

  try {
    // Create sample files and index them
    const files = sampleFiles.map(sample => {
      return new File([sample.content], sample.name, { type: sample.type });
    });

    const result = await vectorizationService.indexFiles(files);
    document.querySelector('[data-testid="loaded-files"]').textContent =
      `Loaded: ${result.indexed.length}, Failed: ${result.failed.length}`;

    updateStatus(`Samples loaded: ${result.indexed.length} files`);
  } catch (error) {
    console.error('Failed to load samples:', error);
    updateStatus('Error loading samples: ' + error.message);
  }
});

// Helper functions to create sample data
function createSampleAudio() {
  // Create a simple WAV file
  const sampleRate = 16000;
  const duration = 1; // 1 second
  const samples = sampleRate * duration;
  const audioData = new Float32Array(samples);

  // Generate sine wave at 440Hz
  for (let i = 0; i < samples; i++) {
    audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
  }

  // Create WAV header
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, samples * 2 + 36, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, samples * 2, true);

  const wavBuffer = new ArrayBuffer(wavHeader.byteLength + samples * 2);
  const wavView = new Uint8Array(wavBuffer);
  wavView.set(new Uint8Array(wavHeader), 0);

  // Convert Float32 to Int16
  const dataView = new DataView(wavBuffer, wavHeader.byteLength);
  for (let i = 0; i < samples; i++) {
    dataView.setInt16(i * 2, audioData[i] * 32767, true);
  }

  return wavBuffer;
}

function createSampleImage() {
  // Create a simple 1x1 pixel PNG
  const pngData = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, // Color type
    0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82, // IEND
  ]);

  return pngData.buffer;
}

// Initialize on load
initVectorization();
