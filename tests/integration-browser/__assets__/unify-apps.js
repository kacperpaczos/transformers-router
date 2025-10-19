#!/usr/bin/env node

/**
 * Script to unify all browser integration test apps
 * Adds standardized header with back button and status bar to all apps
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APPS_DIR = path.join(__dirname, '..', '__app__');

// App titles mapping
const APP_TITLES = {
  'provider': 'Provider API Host',
  'config-update': 'Config Update',
  'config-multiple-modalities': 'Multiple Modalities Config',
  'events-progress': 'Events Progress Testing',
  'events-error': 'Events Error Testing', 
  'events-lifecycle': 'Events Lifecycle Testing',
  'react-use-provider': 'React Use Provider',
  'react-use-chat': 'React Use Chat',
  'react-chat-app': 'React Chat App',
  'react-lifecycle': 'React Lifecycle',
  'vue-use-provider': 'Vue Use Provider',
  'vue-use-chat': 'Vue Use Chat',
  'vue-chat-app': 'Vue Chat App',
  'vue-lifecycle': 'Vue Lifecycle',
  'multimodal-stt-llm': 'Multimodal STT + LLM',
  'multimodal-llm-tts': 'Multimodal LLM + TTS',
  'multimodal-full': 'Full Multimodal',
  'performance-metrics': 'Performance Metrics',
  'performance-concurrent': 'Performance Concurrent',
  'performance-cache': 'Performance Cache',
  'error-invalid-config': 'Invalid Config Error',
  'error-model-not-found': 'Model Not Found Error',
  'error-network': 'Network Error',
  'error-invalid-input': 'Invalid Input Error',
  'worker-llm': 'Worker LLM',
  'adapter-openai': 'OpenAI Adapter',
  'adapter-langchain': 'LangChain Adapter'
};

function getAppTitle(appName) {
  return APP_TITLES[appName] || appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function hasBackButton(html) {
  return html.includes('← Back to Menu') || html.includes('← Menu');
}

function hasStandardizedStatusBar(html) {
  return html.includes('<!-- Standardized Status Bar -->');
}

function unifyApp(appName) {
  const appDir = path.join(APPS_DIR, appName);
  const indexPath = path.join(appDir, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    console.log(`⚠️  ${appName}: index.html not found`);
    return;
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Skip if already unified
  if (hasBackButton(html) && hasStandardizedStatusBar(html)) {
    console.log(`✅ ${appName}: already unified`);
    return;
  }

  const title = getAppTitle(appName);
  
  // Extract existing content between <body> and </body>
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  if (!bodyMatch) {
    console.log(`⚠️  ${appName}: no body tag found`);
    return;
  }

  let bodyContent = bodyMatch[1];
  
  // Remove existing header if present
  bodyContent = bodyContent.replace(/<div class="header-nav"[^>]*>[\s\S]*?<\/div>/g, '');
  
  // Remove existing status rows if they're not standardized
  if (!hasStandardizedStatusBar(html)) {
    bodyContent = bodyContent.replace(/<div class="status-row"[^>]*>[\s\S]*?<\/div>/g, '');
    bodyContent = bodyContent.replace(/<div class="progressbar"[^>]*>[\s\S]*?<\/div>/g, '');
  }

  // Create new unified HTML
  const newHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
  <link rel="stylesheet" href="/tests/integration-browser/__assets__/common.css">
  <script type="importmap">
    {
      "imports": {
        "@huggingface/transformers": "/node_modules/@huggingface/transformers/dist/transformers.min.js",
        "onnxruntime-web": "/node_modules/onnxruntime-web/dist/ort.min.js"
      }
    }
  </script>
</head>
<body>
  <!-- Standardized Header with Back Button -->
  <div class="header-nav" style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
    <button class="btn" onclick="window.location.href='/tests/integration-browser/__assets__/index.html'">← Back to Menu</button>
    <h2 style="margin:0;">${title}</h2>
  </div>

  <!-- Standardized Status Bar -->
  <div class="status-row">
    <div data-testid="status">idle</div>
    <div data-testid="file">-</div>
    <div data-testid="progress">0</div>
  </div>
  <div class="progressbar">
    <div class="progressbar__fill"></div>
  </div>

  <!-- App Content -->
  <div id="root" class="panel">
${bodyContent.trim()}
  </div>

  <script type="module" src="./main.js"></script>
</body>
</html>`;

  fs.writeFileSync(indexPath, newHtml);
  console.log(`🔄 ${appName}: unified`);
}

// Main execution
console.log('🚀 Unifying browser integration test apps...\n');

const apps = fs.readdirSync(APPS_DIR)
  .filter(item => fs.statSync(path.join(APPS_DIR, item)).isDirectory())
  .sort();

apps.forEach(unifyApp);

console.log(`\n✅ Unified ${apps.length} apps`);
