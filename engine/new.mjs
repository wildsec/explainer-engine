// Scaffold a new film from a template (default: examples/last-programmers).
//   node engine/new.mjs <target dir> [--from examples/<name>]
// Copies script.json + film.{html,css,js}. Then edit script.json, run tts.py, and rebuild the choreography in film.js.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const i = args.indexOf('--from');
const from = path.resolve(root, i >= 0 ? args[i + 1] : 'examples/last-programmers');
const target = args.find((a, k) => !a.startsWith('--') && args[k - 1] !== '--from');
if (!target) { console.error('usage: node engine/new.mjs <target dir> [--from examples/<name>]'); process.exit(1); }
const dst = path.resolve(target);
if (existsSync(path.join(dst, 'film.html'))) { console.error(`${dst} already has a film.html — not overwriting`); process.exit(1); }
mkdirSync(dst, { recursive: true });
for (const f of ['script.json', 'film.html', 'film.css', 'film.js']) cpSync(path.join(from, f), path.join(dst, f));
const s = JSON.parse(readFileSync(path.join(dst, 'script.json'), 'utf8'));
s.title = path.basename(dst);
writeFileSync(path.join(dst, 'script.json'), JSON.stringify(s, null, 2) + '\n');
console.log(`new film in ${dst} (from ${path.relative(root, from)})
next:  edit script.json → python3 engine/tts.py ${target} → edit film.js → node engine/render.mjs ${target} --stills`);
