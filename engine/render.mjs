// explainer-engine renderer: <project>/film.html → <project>/out/<name>.mp4 (1080×1920, narration muxed in).
//   node engine/render.mjs <project dir> [--stills] [--cover <s>] [--fps 30] [--blur 6] [--from s] [--to s] [--look terminal] [--name x]
// The film must expose window.seek(t), window.DURATION and set window.READY. Each output frame averages
// <blur> sub-frames over a 180° shutter (real motion blur); --blur 1 for fast drafts.
// A project can live anywhere: the film's folder is served at /, the engine at /engine/ and /node_modules/.
// puppeteer-core from this repo's node_modules (./setup.sh), system Chromium (CHROME=/path to override).
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const engineRoot = path.resolve(here, '..');                      // repo root (engine/, node_modules/)
const require = createRequire(path.join(engineRoot, 'package.json'));
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const proj = path.resolve(args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) || '.');
if (!existsSync(path.join(proj, 'film.html'))) { console.error(`no film.html in ${proj}`); process.exit(1); }
const FPS = +opt('fps', 30), K = +opt('blur', 6), look = opt('look', ''), name = opt('name', path.basename(proj) + (look ? '-' + look : ''));
const out = path.join(proj, 'out'); mkdirSync(out, { recursive: true });

// HTTP mounts: /engine/* and /node_modules/* from the engine, everything else from the project folder.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav' };
const mount = p => p.startsWith('/engine/') || p.startsWith('/node_modules/') ? [engineRoot, p] : [proj, p];
const server = http.createServer((req, res) => {
  const [base, p] = mount(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const f = path.join(base, p);
  if (!f.startsWith(base) || !existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }).end(readFileSync(f));
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/film.html${look ? '?look=' + look : ''}`;

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium',
  args: ['--no-sandbox', '--hide-scrollbars', '--font-render-hinting=none', '--force-color-profile=srgb', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => { console.error('pageerror:', e.message); process.exitCode = 1; });
await page.setViewport({ width: 1080, height: 1920 });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.READY === true', { timeout: 30000 });
const dur = await page.evaluate('window.DURATION');
const from = +opt('from', 0), to = Math.min(+opt('to', dur), dur);
const pipeTo = (argv) => spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', ...argv], { stdio: ['pipe', 'inherit', 'inherit'] });
const write = async (ff, buf) => { if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); };
const done = ff => { ff.stdin.end(); return new Promise(r => ff.on('close', r)); };

if (opt('cover')) {                                // one PNG still at time <s> (platform cover)
  await page.evaluate(t => window.seek(t), +opt('cover'));
  await page.screenshot({ path: path.join(out, name + '-cover.png'), type: 'png' });
  console.log('cover', path.join(out, name + '-cover.png'));
} else if (args.includes('--stills')) {                     // review sheet: 24 moments on one image
  const n = 24, ts = Array.from({ length: n }, (_, i) => +(from + (i + .5) * (to - from) / n).toFixed(2));
  const ff = pipeTo(['-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=270:480,tile=8x3', '-frames:v', '1', path.join(out, name + '-sheet.jpg')]);
  for (const t of ts) { await page.evaluate(t => window.seek(t), t); await write(ff, await page.screenshot({ type: 'jpeg', quality: 80 })); }
  await done(ff); console.log('sheet', path.join(out, name + '-sheet.jpg'), '\n', ts.join(' '));
} else {
  const silent = path.join(out, name + '.silent.mp4');
  const ff = pipeTo(['-framerate', String(FPS * K), '-c:v', 'mjpeg', '-i', '-',
    '-vf', (K > 1 ? `tmix=frames=${K},select='not(mod(n+1\\,${K}))',` : '') + `setpts=N/(${FPS}*TB)`, '-r', String(FPS),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', silent]);
  const n = Math.round((to - from) * FPS), shutter = .5 / FPS, t0 = Date.now();
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < K; k++) {
      const t = from + i / FPS + (K > 1 ? (k / (K - 1) - .5) * shutter : 0);
      await page.evaluate(t => window.seek(t), Math.max(0, t));
      await write(ff, await page.screenshot({ type: 'jpeg', quality: 92 }));
    }
    if (i % 150 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await done(ff);
  const wav = path.join(out, 'narration.wav'), mp4 = path.join(out, name + '.mp4');
  const mux = existsSync(wav)
    ? ['-i', silent, '-ss', String(from), '-t', String(to - from), '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest']
    : ['-i', silent, '-c', 'copy'];
  await new Promise(r => spawn('ffmpeg', ['-v', 'error', '-y', ...mux, '-movflags', '+faststart', mp4], { stdio: 'inherit' }).on('close', r));
  (await import('node:fs')).unlinkSync(silent);
  console.log('video', mp4);
}
await browser.close(); server.close();
