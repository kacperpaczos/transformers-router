import { createAIProvider } from '/dist/index.js';

let vectorizationService = null;
let provider = null;

window.testReady = true;

// Initialize vectorization service when page loads
async function initVectorization() {
  const storageType = document.getElementById('storage-select').value;
  const useMock = document.getElementById('mock-select').value === 'true';

  const config = {
    storage: storageType,
    externalMock: useMock ? {
      enabled: true,
      latencyMs: 100,
      errorRate: 0.1,
    } : { enabled: false },
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
  provider.onVectorizationEvent('vector:indexed', (data) => {
    console.log('Files indexed:', data);
    updateStatus('Files indexed: ' + data.count);
  });

  provider.onVectorizationEvent('vector:error', (data) => {
    console.error('Vectorization error:', data);
    updateStatus('Error: ' + data.error);
  });

  provider.onVectorizationEvent('resource:quota-warning', (data) => {
    console.warn('Quota warning:', data);
    updateStatus('Quota warning: ' + data.level);
  });

  updateStatus('Ready');
}

// UI functions
function updateStatus(status) {
  document.querySelector('[data-testid="status"]').textContent = status;
}

function updateProgress(progress) {
  document.querySelector('[data-testid="progress"]').textContent = Math.round(progress * 100) + '%';
  document.querySelector('.progressbar__fill').style.width = (progress * 100) + '%';
}

function updateResults(results) {
  document.querySelector('[data-testid="indexed-files"]').textContent = results.indexed.join(', ') || 'None';
  document.querySelector('[data-testid="failed-files"]').textContent = results.failed.join(', ') || 'None';
  document.querySelector('[data-testid="total-time"]').textContent = results.totalTime + 'ms';
}

// Event listeners
document.getElementById('index-btn').addEventListener('click', async () => {
  if (!vectorizationService) {
    updateStatus('Not initialized');
    return;
  }

  const fileInput = document.getElementById('file-input');
  const files = Array.from(fileInput.files);

  if (files.length === 0) {
    updateStatus('No files selected');
    return;
  }

  updateStatus('Indexing...');
  updateProgress(0);

  try {
    const startTime = performance.now();

    // Index files
    const result = await vectorizationService.indexFiles(files);
    const totalTime = performance.now() - startTime;

    // Get usage snapshot
    const usage = await vectorizationService.getVectorizationUsage();
    console.log('Resource usage:', usage);

    updateResults({
      indexed: result.indexed,
      failed: result.failed,
      totalTime: Math.round(totalTime),
    });

    document.querySelector('[data-testid="files-count"]').textContent = result.indexed.length;

    updateStatus(`Completed: ${result.indexed.length} indexed, ${result.failed.length} failed`);
    updateProgress(1);

  } catch (error) {
    console.error('Indexing failed:', error);
    updateStatus('Error: ' + error.message);
    updateProgress(0);
  }
});

document.getElementById('storage-select').addEventListener('change', initVectorization);
document.getElementById('mock-select').addEventListener('change', initVectorization);

// Initialize on load
initVectorization();
