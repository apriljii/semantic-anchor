#!/usr/bin/env node
/**
 * Static preview server for public/index.html (+ docs, spec)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function resolveFile(urlPath) {
  if (urlPath === '/') return path.join(PUBLIC, 'index.html');
  if (urlPath.startsWith('/docs/')) return path.join(ROOT, urlPath.slice(1));
  if (urlPath.startsWith('/spec/')) return path.join(ROOT, urlPath.slice(1));
  return path.join(PUBLIC, urlPath.slice(1));
}

function isSafe(filePath) {
  const normalized = path.normalize(filePath);
  return normalized.startsWith(PUBLIC) || normalized.startsWith(path.join(ROOT, 'docs')) ||
    normalized.startsWith(path.join(ROOT, 'spec'));
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = resolveFile(urlPath);

  if (!isSafe(filePath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      res.end(err.code === 'ENOENT' ? 'Not Found' : 'Internal Server Error');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  process.stdout.write(
    `\n  SemanticAnchor preview\n` +
    `    landing      → http://localhost:${PORT}\n` +
    `    architecture → http://localhost:${PORT}/architecture.html\n\n`
  );
});
