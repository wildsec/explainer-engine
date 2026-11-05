// explainer-engine runtime: everything a film needs to be a pure function of time.
// A film imports this, builds its DOM once, and exposes window.seek(t). No timers, no CSS animations,
// so the renderer can step (and sub-step for motion blur) any frame exactly.

// ---------- math ------------------------------------------------------------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const prog = (t, a, d) => clamp((t - a) / d);
export const ease = {
  io3: x => x < .5 ? 4 * x ** 3 : 1 - Math.pow(-2 * x + 2, 3) / 2,
  io5: x => x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2,    // whip: slow-fast-slow
  out3: x => 1 - Math.pow(1 - x, 3),
  inExpo: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10),
};
/** damped spring step response (0 → 1 with overshoot); u = seconds since start */
export function spring(u, zeta = .55, w = 15) {
  if (u <= 0) return 0;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * u) * (Math.cos(wd * u) + (zeta * w / wd) * Math.sin(wd * u));
}
export function rng(seed = 1) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---------- timing (from tts.py) -------------------------------------------
/** load out/timing.json; B(id) = beat, W(id, word, nth) = start time of a spoken word in a beat */
export async function loadTiming(url = 'out/timing.json') {
  const T = await (await fetch(url)).json();
  const norm = s => s.toLowerCase().replace(/[^a-z0-9?]/g, '');
  const B = id => T.beats.find(b => b.id === id) || (() => { throw new Error('no beat ' + id); })();
  const W = (id, word, nth = 0) => {
    const hits = B(id).words.filter(w => norm(w.w).replace(/\?$/, '') === norm(word).replace(/\?$/, ''));
    if (!hits[nth]) throw new Error(`word "${word}" not in beat ${id}`);
    return hits[nth].start;
  };
  return { T, B, W };
}

// ---------- camera ------------------------------------------------------------
/** keys: [t, x, y, zoom, rotDeg, ease]; x/y = world point at screen centre. Repeat a key to hold dead still. */
export function camera(keys) {
  keys = [...keys].sort((a, b) => a[0] - b[0]);
  return t => {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1] || a;
    const p = b === a ? 0 : (b[5] || ease.io3)(clamp((t - a[0]) / (b[0] - a[0])));
    return { x: lerp(a[1], b[1], p), y: lerp(a[2], b[2], p), z: Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), p)),
      r: lerp(a[4], b[4], p), moving: t > a[0] && t < b[0] && (a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) };
  };
}
/** decaying camera shake from impact times */
export function shake(t, impacts, amp = 14) {
  let s = 0; for (const t0 of impacts) { const u = t - t0; if (u > 0 && u < .6) s += Math.exp(-u * 9) * Math.sin(u * 60); }
  return s * amp;
}
/** handheld float: drifts while the camera moves, (almost) dead still on rests */
export const handheld = (t, moving) => {
  const k = moving ? 1 : .12;
  return [k * (5 * Math.sin(t * 1.3) + 3 * Math.sin(t * 2.9 + 1)), k * (4 * Math.sin(t * 1.1 + 2) + 2 * Math.sin(t * 3.7))];
};
/** world transform for a camera state; depth < 1 = background layer (parallax) */
export function camTransform(c, t, sh = 0, depth = 1, W = 1080, H = 1920) {
  const [hx, hy] = handheld(t, c.moving);
  const z = Math.pow(c.z, depth);
  return `translate(${W / 2 + hx * depth}px, ${H / 2 + (hy + sh) * depth}px) rotate(${(c.r + sh * .05) * depth}deg) scale(${z}) translate(${-c.x * depth}px, ${-c.y * depth}px)`;
}

// ---------- collage helpers ---------------------------------------------------
/** torn-paper edge: random jagged polygon clip-path (deterministic per seed) */
export function torn(el, seed = 1, jag = 1.6, steps = 14) {
  const r = rng(seed * 7919 + 13), pts = [];
  const j = () => (r() * jag).toFixed(2);
  for (let i = 0; i <= steps; i++) pts.push(`${(i / steps * 100).toFixed(1)}% ${j()}%`);
  for (let i = 0; i <= steps; i++) pts.push(`${100 - j()}% ${(i / steps * 100).toFixed(1)}%`);
  for (let i = steps; i >= 0; i--) pts.push(`${(i / steps * 100).toFixed(1)}% ${100 - j()}%`);
  for (let i = steps; i >= 0; i--) pts.push(`${j()}% ${(i / steps * 100).toFixed(1)}%`);
  el.style.clipPath = `polygon(${pts.join(',')})`;
}

// ---------- captions ---------------------------------------------------------
/**
 * Cut-out word captions: pages of up to `per` words, the spoken word highlighted.
 * beats: timing beats to caption (skip beats whose words are already on screen).
 */
export function captions(host, beats, { per = 3, seed = 5 } = {}) {
  const r = rng(seed), pages = [];
  for (const b of beats) {
    const ws = b.words;
    for (let i = 0; i < ws.length; i += per) {
      let chunk = ws.slice(i, i + per);
      if (ws.length - (i + per) === 1) { chunk = ws.slice(i, i + per + 1); i++; }   // no lonely last word
      const el = document.createElement('div'); el.className = 'cap-page';
      const spans = chunk.map(w => {
        const s = document.createElement('span'); s.textContent = w.w.replace(/[",]/g, '');
        s.style.setProperty('--rot', ((r() - .5) * 6).toFixed(2) + 'deg'); el.append(s, ' '); return s;
      });
      host.append(el);
      pages.push({ el, spans, words: chunk, start: chunk[0].start, end: chunk.at(-1).end });
    }
  }
  pages.forEach((p, i) => { p.until = pages[i + 1] && pages[i + 1].start - p.end < .6 ? pages[i + 1].start : p.end + .35; });
  return t => {
    for (const p of pages) {
      const on = t >= p.start - .04 && t < p.until;
      p.el.style.display = on ? '' : 'none';
      if (!on) continue;
      const pop = spring(t - p.start + .04, .5, 18);
      p.el.style.transform = `translateY(${(1 - Math.min(pop, 1)) * 30}px) scale(${.9 + .1 * pop})`;
      p.spans.forEach((s, k) => {
        const w = p.words[k];
        s.classList.toggle('on', t >= w.start && (k === p.spans.length - 1 ? t < p.until : t < p.words[k + 1].start));
        s.style.opacity = t >= w.start - .05 ? 1 : .0;
      });
    }
  };
}

/** words typed in sync with speech: returns the visible prefix of `text` at time t */
export function typedBy(words, text) {
  // map each spoken word to a character position in text (in order, case-insensitive)
  const low = text.toLowerCase(); let pos = 0; const marks = [];
  for (const w of words) {
    const k = low.indexOf(w.w.toLowerCase().replace(/[^a-z0-9']/g, ''), pos);
    if (k >= 0) { pos = k + w.w.replace(/[^A-Za-z0-9']/g, '').length; marks.push([w.start, w.end, k, pos]); }
  }
  return t => {
    let n = 0;
    for (const [s, e, k, p] of marks) {
      if (t >= e) n = p; else if (t > s) { n = Math.round(lerp(k, p, (t - s) / (e - s))); break; } else { n = Math.max(n, k > 0 ? k : 0); break; }
    }
    if (marks.length && t >= marks.at(-1)[1]) n = text.length;
    return text.slice(0, n);
  };
}
