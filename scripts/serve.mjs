#!/usr/bin/env node
/**
 * Local preview server for dist/. Rebuilds when src/, public/ or site.config.json change.
 *   npm run dev            (watch + rebuild)       PORT=4321 by default
 *   npm run preview        (serve the current build only)
 */
import http from 'node:http';
import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import path from 'node:path';
import { createGzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 4321;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

await build();

if (!process.argv.includes('--no-watch')) {
  // one build at a time; changes made during a build trigger a single follow-up build
  let timer;
  let running = false;
  let pending = false;
  const run = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      await build();
    } catch (e) {
      console.error(e);
    }
    running = false;
    if (pending) {
      pending = false;
      run();
    }
  };
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(run, 150);
  };
  for (const target of ['src', 'public', 'site.config.json']) {
    watch(path.join(ROOT, target), { recursive: true }, rebuild);
  }
}

// a file can vanish mid-request while dist/ is being rebuilt: end that response instead of crashing the server
const send = (res, file, options, gzip = false) => {
  const stream = createReadStream(file, options).on('error', () => res.destroy());
  (gzip ? stream.pipe(createGzip()) : stream).pipe(res);
};
// text files are gzipped, as GitHub Pages and most hosts do, so local performance audits are realistic
const COMPRESS = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.xml', '.txt']);

http
  .createServer((req, res) => {
    try {
      handle(req, res);
    } catch {
      if (!res.headersSent) res.writeHead(503, { 'Retry-After': '1' });
      res.end();
    }
  })
  .listen(PORT, () => console.log(`Preview: http://localhost:${PORT}`));

function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file)) {
    const notFound = path.join(DIST, '404.html');
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    if (existsSync(notFound)) send(res, notFound);
    else res.end('Not found');
    return;
  }
  const size = statSync(file).size;
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    // videos need range requests in Safari
    const start = Number(range[1] || 0);
    const end = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    send(res, file, { start, end });
    return;
  }
  if (COMPRESS.has(path.extname(file).toLowerCase()) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
    res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding', 'Cache-Control': 'no-cache' });
    send(res, file, undefined, true);
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Cache-Control': 'no-cache' });
  send(res, file);
}
