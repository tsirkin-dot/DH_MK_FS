// DocHub demo — static server with a PIN gate.
// PIN comes from env DEMO_PIN (default 8080). After a correct PIN the browser gets a signed
// cookie valid for 24 hours, so the PIN is asked at most once a day per browser.
// No dependencies: `node server.js`. Railway sets PORT.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const PIN = String(process.env.DEMO_PIN || '8080');
const SECRET = process.env.DEMO_SECRET || crypto.createHash('sha256').update('dh-demo|' + PIN).digest('hex');
const TTL = 24 * 60 * 60; // seconds
const COOKIE = 'dh_demo';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
};

function sign(exp) { return crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex'); }
function safeEq(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function authed(req) {
  const v = cookies(req)[COOKIE]; if (!v) return false;
  const [exp, sig] = v.split('.');
  return Number(exp) > Date.now() / 1000 && safeEq(sig || '', sign(exp));
}

// 10 wrong PINs per IP per 15 minutes
const tries = new Map();
function ip(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
function limited(req) {
  const k = ip(req); const now = Date.now(); const t = (tries.get(k) || []).filter((x) => now - x < 15 * 60 * 1000);
  tries.set(k, t); return t.length >= 10;
}
function fail(req) { const k = ip(req); tries.set(k, (tries.get(k) || []).concat(Date.now())); }

function loginPage(res, next, msg, code) {
  const n = String(next || '/').replace(/[^\w\-./?=&#%]/g, '');
  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>DocHub · демо плану</title><style>
:root{--ink:#14213d;--ink2:#4a5568;--line:#dfe5f2;--blue:#2f6bff}*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f3f6fb;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:var(--ink);padding:16px}
.card{width:100%;max-width:380px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:28px 26px;box-shadow:0 10px 30px rgba(20,33,61,.06)}
.k{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--blue)}h1{margin:6px 0 4px;font-size:22px}
p{margin:0 0 18px;color:var(--ink2);font-size:14px}input{width:100%;font:inherit;font-size:22px;letter-spacing:.35em;text-align:center;padding:12px;border:1px solid #cfd8e8;border-radius:10px}
input:focus{outline:2px solid var(--blue);border-color:transparent}button{width:100%;margin-top:12px;padding:12px;font:inherit;font-weight:700;color:#fff;background:var(--ink);border:0;border-radius:10px;cursor:pointer}
.err{margin:12px 0 0;color:#c92a4a;font-size:14px}.fine{margin:16px 0 0;font-size:12px;color:#8a94a6}</style></head><body>
<form class="card" method="post" action="/__login"><span class="k">DocHub · internal</span><h1>Демо плану росту</h1>
<p>Введіть PIN, щоб відкрити демо. Доступ зберігається в цьому браузері на 24 години.<br><span lang="en">Enter the PIN to open the demo. Access is kept in this browser for 24 hours.</span></p>
<input name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" autofocus aria-label="PIN" required>
<input type="hidden" name="next" value="${n}"><button type="submit">Відкрити · Open</button>
${msg ? `<p class="err">${msg}</p>` : ''}<p class="fine">Внутрішня презентація, не чинний сайт DocHub.</p></form></body></html>`;
  res.writeHead(code || 200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  res.end(html);
}

function serveFile(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  const base = path.basename(file);
  if (!file.startsWith(ROOT + path.sep) || rel.split('/').some((s) => s.startsWith('.')) || base === 'server.js' || base === 'package.json') {
    res.writeHead(404); return res.end('Not found');
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'private, no-cache' : 'private, max-age=3600',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer((req, res) => {
  const url = req.url || '/';
  if (url === '/robots.txt') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('User-agent: *\nDisallow: /\n'); }
  if (url.startsWith('/__login') && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2000) req.destroy(); });
    req.on('end', () => {
      const f = new URLSearchParams(body); const next = f.get('next') || '/';
      if (limited(req)) return loginPage(res, next, 'Забагато спроб. Спробуйте за 15 хвилин.', 429);
      if (!safeEq(String(f.get('pin') || '').trim(), PIN)) { fail(req); return loginPage(res, next, 'Невірний PIN.', 401); }
      const exp = Math.floor(Date.now() / 1000) + TTL;
      const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
      const dest = next.startsWith('/') && !next.startsWith('//') ? next : '/';
      res.writeHead(303, { 'Set-Cookie': `${COOKIE}=${exp}.${sign(exp)}; Max-Age=${TTL}; Path=/; HttpOnly; SameSite=Lax${secure}`, Location: dest, 'Cache-Control': 'no-store' });
      return res.end();
    });
    return;
  }
  if (url.startsWith('/__logout')) {
    res.writeHead(303, { 'Set-Cookie': `${COOKIE}=; Max-Age=0; Path=/`, Location: '/' }); return res.end();
  }
  if (!authed(req)) return loginPage(res, url);
  serveFile(req, res, url);
}).listen(PORT, () => console.log(`DocHub demo on :${PORT} (PIN gate, 24h cookie)`));
