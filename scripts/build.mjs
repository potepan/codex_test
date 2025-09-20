#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const rawBase = process.env.DEPLOY_BASE ?? './';
const base = normaliseBase(rawBase);

function normaliseBase(value) {
  if (!value) return './';
  if (value === './') return './';
  if (value === '/') return '/';
  return value.endsWith('/') ? value : `${value}/`;
}

function ensureEmptyDist() {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
}

function copyFile(relativePath) {
  const src = path.join(projectRoot, relativePath);
  if (!fs.existsSync(src)) {
    return;
  }
  const dest = path.join(distDir, relativePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirectory(relativePath) {
  const src = path.join(projectRoot, relativePath);
  if (!fs.existsSync(src)) {
    return;
  }
  fs.cpSync(src, path.join(distDir, relativePath), { recursive: true });
}

function transformIndexHtml() {
  const indexPath = path.join(projectRoot, 'index.html');
  let contents = fs.readFileSync(indexPath, 'utf8');

  contents = contents
    .replace(/href="\.\/styles\.css"/g, `href="${base}styles.css"`)
    .replace(/src="\.\/script\.js"/g, `src="${base}script.js"`);

  fs.writeFileSync(path.join(distDir, 'index.html'), contents);
}

function main() {
  console.log('🛠  Building Daydream Tasks…');
  ensureEmptyDist();
  transformIndexHtml();
  copyFile('styles.css');
  copyFile('script.js');

  const assetDirs = ['assets', 'public', 'images'];
  assetDirs.forEach(copyDirectory);

  console.log(`📦 Build complete. Output: ${path.relative(projectRoot, distDir)}`);
  if (base !== './') {
    console.log(`ℹ️  Asset base path set to ${base}`);
  }
}

try {
  main();
} catch (error) {
  console.error('\u001b[31mビルドに失敗しました:\u001b[0m', error.message);
  process.exitCode = 1;
}
