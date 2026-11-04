// Serves app/ at / (the main build) and again at /test/ (the test build),
// mirroring how the deploy workflow lays out the site. The choose build is
// app/choose/, so it's at /choose/ and /test/choose/.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app');
const PORT = Number(process.env.PORT) || 4173;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // Like GitHub Pages: /test, /choose and /test/choose get a trailing slash.
  if (!p.endsWith('/') && !path.extname(p)) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  if (p.startsWith('/test/')) p = p.slice(5);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Serving http://localhost:${PORT}/ and /test/`));
