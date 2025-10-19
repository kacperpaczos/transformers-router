#!/usr/bin/env node

/**
 * Simple script to fix back buttons in all apps
 * Changes links to buttons for consistency
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APPS_DIR = path.join(__dirname, '..', '__app__');

function fixBackButton(appName) {
  const appDir = path.join(APPS_DIR, appName);
  const indexPath = path.join(appDir, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    console.log(`⚠️  ${appName}: index.html not found`);
    return;
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Skip if already has button
  if (html.includes('← Back to Menu')) {
    console.log(`✅ ${appName}: already has back button`);
    return;
  }

  // Replace link with button
  const oldLink = /<a href="\/tests\/integration-browser\/__assets__\/index\.html">← Menu<\/a>/g;
  const newButton = '<button class="btn" onclick="window.location.href=\'/tests/integration-browser/__assets__/index.html\'">← Back to Menu</button>';
  
  if (oldLink.test(html)) {
    html = html.replace(oldLink, newButton);
    fs.writeFileSync(indexPath, html);
    console.log(`🔄 ${appName}: fixed back button`);
  } else {
    console.log(`⚠️  ${appName}: no back link found`);
  }
}

// Main execution
console.log('🚀 Fixing back buttons in all apps...\n');

const apps = fs.readdirSync(APPS_DIR)
  .filter(item => fs.statSync(path.join(APPS_DIR, item)).isDirectory())
  .sort();

apps.forEach(fixBackButton);

console.log(`\n✅ Fixed back buttons in ${apps.length} apps`);
