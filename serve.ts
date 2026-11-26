// AEROLITH — tiny static server for local playtesting (Node 22 stdlib
// only: http + fs). Serves files from game/ on port 8080 and refuses
// any path that escapes that directory.

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gameRoot = resolve(join(here, 'game'));
const PORT = 8080;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

const server = createServer((req, res) => {
  const rawPath = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  const rel = normalize(rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, ''));
  const filePath = resolve(join(gameRoot, rel));
  // Reject anything outside game/ (including ".." escapes).
  if (filePath !== gameRoot && !filePath.startsWith(gameRoot + sep)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden\n');
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found\n');
    return;
  }
  const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  res.end(readFileSync(filePath));
});

server.listen(PORT, () => {
  console.log('AEROLITH serving game/ on http://localhost:' + PORT + '/');
});
