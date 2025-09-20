#!/usr/bin/env node

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const serveRoot = resolveServeRoot();
const port = parseInt(process.env.PORT || '5173', 10);
const host = process.env.HOST || '0.0.0.0';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function resolveServeRoot() {
  const argPath = process.argv[2];
  const absolute = argPath
    ? path.resolve(projectRoot, argPath)
    : projectRoot;
  if (!fs.existsSync(absolute)) {
    console.error(`提供先のディレクトリが見つかりません: ${absolute}`);
    process.exit(1);
  }
  return absolute;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function safeResolve(urlPath) {
  const normalized = path.posix.normalize(urlPath).replace(/^\/+/, '');
  const candidate = path.resolve(serveRoot, normalized);
  if (!candidate.startsWith(serveRoot)) {
    return null;
  }
  return candidate;
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const [urlPath] = req.url.split('?');
  const decoded = decodeURIComponent(urlPath);
  let filePath = safeResolve(decoded);

  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        const fallback = path.join(serveRoot, 'index.html');
        fs.readFile(fallback, (fallbackErr, fallbackData) => {
          if (fallbackErr) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': getMimeType(fallback) });
          res.end(fallbackData);
        });
        return;
      }

      res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
      res.end(data);
    });
  });
});

server.listen(port, host, () => {
  const relativeRoot = path.relative(projectRoot, serveRoot) || '.';
  console.log(`🚀  Serving ${relativeRoot} on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('\nサーバーを停止しました。');
    process.exit(0);
  });
});
