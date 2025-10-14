/* eslint-env node */
/* eslint-disable no-undef */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const ROOT_DIR = path.join(__dirname, '../..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.map': 'application/json',
  '.wav': 'audio/wav',
  '.onnx': 'application/octet-stream',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  console.log('[server] request:', req.method, urlPath);
  let filePath;
  if (urlPath === '/' || urlPath === '') {
    // Strona startowa
    filePath = path.join(__dirname, '__assets__/index.html');
  } else {
    // Usuń wiodący '/'
    const safeRel = urlPath.replace(/^\/+/, '');
    filePath = path.join(ROOT_DIR, safeRel);
  }

  // Normalizuj i zabezpiecz przed wyjściem poza ROOT_DIR
  filePath = path.normalize(filePath);
  console.log('[server] resolved path:', filePath);

  // Security check
  if (!filePath.startsWith(ROOT_DIR) && !filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Fallback dla importów ESM bez rozszerzeń (np. '/dist/core/AIProvider')
  let candidatePath = filePath;
  if (!fs.existsSync(candidatePath)) {
    const ext = path.extname(candidatePath);
    if (!ext) {
      // Spróbuj dodać .js
      const withJs = candidatePath + '.js';
      if (fs.existsSync(withJs)) {
        candidatePath = withJs;
        console.log('[server] fallback to .js:', candidatePath);
      } else {
        // Spróbuj index.js dla katalogów
        const asIndex = path.join(candidatePath, 'index.js');
        if (fs.existsSync(asIndex)) {
          candidatePath = asIndex;
          console.log('[server] fallback to index.js:', candidatePath);
        }
      }
    }
  }

  fs.readFile(candidatePath, (err, data) => {
    if (err) {
      console.log('[server] 404 Not Found:', candidatePath);
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(candidatePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cache-Control': 'no-cache',
    });
    console.log('[server] 200 OK:', candidatePath, '->', mimeType);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Integration test server running at http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));


