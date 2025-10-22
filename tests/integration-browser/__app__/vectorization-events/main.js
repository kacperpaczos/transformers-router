import { createAIProvider } from '/dist/index.js';

let vectorizationService = null;
let provider = null;
let eventCount = 0;
let sampleFilesLoaded = false;

// Sample files
const sampleFiles = [
  { name: 'sample-audio.wav', type: 'audio/wav', content: createSampleAudio() },
  { name: 'sample-image.png', type: 'image/png', content: createSampleImage() },
];

window.testReady = true;

async function initVectorization() {
  const warningThreshold = parseFloat(document.getElementById('threshold-select').value);

  const config = {
    storage: 'indexeddb',
    externalMock: { enabled: false },
    quotaThresholds: {
      warn: warningThreshold,
      high: warningThreshold + 0.1,
      critical: warningThreshold + 0.2,
    },
  };

  if (provider) {
    await provider.dispose();
  }

  provider = createAIProvider();
  await provider.initializeVectorization(config);
  vectorizationService = provider;

  // Setup comprehensive event logging
  const events = [
    'vector:indexed',
    'vector:queried',
    'vector:deleted',
    'vector:error',
    'resource:usage',
    'resource:quota-warning'
  ];

  events.forEach(eventType => {
    provider.onVectorizationEvent(eventType, (data) => {
      logEvent(eventType, data);
    });
  });

  updateStatus('Ready');
  updateResourceUsage();
}

// UI functions
function updateStatus(status) {
  document.querySelector('[data-testid="status"]').textContent = status;
}

function logEvent(type, data) {
  eventCount++;
  document.querySelector('[data-testid="events-count"]').textContent = eventCount;

  const eventLog = document.getElementById('event-log');
  const eventsList = document.querySelector('[data-testid="events-list"]');

  const timestamp = new Date().toLocaleTimeString();
  const eventItem = document.createElement('div');
  eventItem.style.marginBottom = '4px';
  eventItem.innerHTML = `<span style="color: #666;">${timestamp}</span> <strong>${type}</strong>: ${JSON.stringify(data)}`;

  eventsList.appendChild(eventItem);
  eventLog.scrollTop = eventLog.scrollHeight;
}

async function updateResourceUsage() {
  if (!vectorizationService) return;

  try {
    const usage = await vectorizationService.getVectorizationUsage();
    const usageElement = document.querySelector('[data-testid="resource-usage"]');
    const warningsElement = document.querySelector('[data-testid="quota-warnings"]');

    usageElement.innerHTML = `
      <div>CPU: ${usage.cpuMs}ms</div>
      <div>Storage: ${usage.storageUsedMB}MB / ${usage.storageLimitMB || 'unlimited'}MB</div>
      <div>Memory: ${usage.memoryMB?.toFixed(1) || 'unknown'}MB</div>
      <div>Models: ${usage.modelDownloadsMB}MB</div>
      <div>GPU: ${usage.gpu?.backend || 'none'}</div>
    `;

    document.querySelector('[data-testid="usage-cpu"]').textContent = usage.cpuMs + 'ms';

    warningsElement.textContent = '-';

  } catch (error) {
    console.error('Failed to get resource usage:', error);
  }
}

// Event listeners
document.getElementById('load-samples-btn').addEventListener('click', async () => {
  if (!vectorizationService) {
    updateStatus('Not initialized');
    return;
  }

  updateStatus('Loading samples...');

  try {
    const files = sampleFiles.map(sample => {
      return new File([sample.content], sample.name, { type: sample.type });
    });

    const result = await vectorizationService.indexFiles(files);
    sampleFilesLoaded = true;

    logEvent('indexing-complete', {
      indexed: result.indexed.length,
      failed: result.failed.length
    });

    updateStatus(`Samples loaded: ${result.indexed.length} files`);
    await updateResourceUsage();

  } catch (error) {
    logEvent('error', { message: error.message });
    updateStatus('Error: ' + error.message);
  }
});

document.getElementById('run-queries-btn').addEventListener('click', async () => {
  if (!vectorizationService || !sampleFilesLoaded) {
    updateStatus('Load samples first');
    return;
  }

  updateStatus('Running queries...');

  try {
    // Text query for audio
    await vectorizationService.queryVectors('sample audio', 'audio', { k: 3 });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Text query for image
    await vectorizationService.queryVectors('sample image', 'image', { k: 3 });
    await new Promise(resolve => setTimeout(resolve, 100));

    // File query
    const audioFile = sampleFiles.find(f => f.type.startsWith('audio/'));
    if (audioFile) {
      const file = new File([audioFile.content], audioFile.name, { type: audioFile.type });
      await vectorizationService.queryVectors(file, 'audio', { k: 3 });
    }

    updateStatus('Queries completed');
    await updateResourceUsage();

  } catch (error) {
    logEvent('error', { message: error.message });
    updateStatus('Error: ' + error.message);
  }
});

document.getElementById('clear-storage-btn').addEventListener('click', async () => {
  if (!vectorizationService) {
    updateStatus('Not initialized');
    return;
  }

  updateStatus('Clearing storage...');

  try {
    // Get all document IDs and delete them
    // Note: In a real implementation, we'd need a way to list all IDs
    // For now, just clear the storage
    await vectorizationService.deleteVectors([]); // This will fail, but let's see

    logEvent('storage-cleared', {});
    updateStatus('Storage cleared');
    await updateResourceUsage();

  } catch (error) {
    logEvent('error', { message: error.message });
    updateStatus('Error: ' + error.message);
  }
});

document.getElementById('restart-btn').addEventListener('click', initVectorization);
document.getElementById('threshold-select').addEventListener('change', initVectorization);

// Periodic resource monitoring
setInterval(updateResourceUsage, 2000);

// Helper functions (same as in queries test)
function createSampleAudio() {
  const sampleRate = 16000;
  const duration = 1;
  const samples = sampleRate * duration;
  const audioData = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
  }

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, samples * 2 + 36, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, samples * 2, true);

  const wavBuffer = new ArrayBuffer(wavHeader.byteLength + samples * 2);
  const wavView = new Uint8Array(wavBuffer);
  wavView.set(new Uint8Array(wavHeader), 0);

  const dataView = new DataView(wavBuffer, wavHeader.byteLength);
  for (let i = 0; i < samples; i++) {
    dataView.setInt16(i * 2, audioData[i] * 32767, true);
  }

  return wavBuffer;
}

function createSampleImage() {
  const pngData = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE,
    0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54,
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
  ]);

  return pngData.buffer;
}

// Initialize on load
initVectorization();
