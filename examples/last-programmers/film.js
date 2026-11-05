// "We might be the last programmers who ever lived": collage look, one continuous take.
// Every event is anchored to the narration (out/timing.json from engine/tts.py):
//   hook typed word by word → pull back: the hook is line 1 of an editor → AI lines turn red ("More and more…")
//   → the lines fly into the 46 % bar → the bar becomes the timeline → whip to 1843, cards land on their years
//   → push through the red 20?? card → verdict + two scraps → cursor types wildmann.org, slogan on "Stay…".
import { clamp, lerp, prog, ease, spring, rng, loadTiming, camera, shake, camTransform, torn, captions, typedBy } from '/engine/lib.js';

const $ = s => document.querySelector(s);
const { T, B, W: Wd } = await loadTiming('out/timing.json');
const hk = B('hook'), ed = B('editor'), br = B('bar'), tl = B('timeline'), vd = B('verdict'), en = B('end');

// ---------- torn edges on every paper piece -----------------------------------
let sd = 1; const tornOn = getComputedStyle(document.documentElement).getPropertyValue('--torn').trim() !== '0';
if (tornOn) document.querySelectorAll('.paper, #back > *').forEach(el => torn(el, sd++, el.id === 'editor' ? .7 : 1.8));

// ---------- code lines (46 strips, 21 written by AI = 45.7 % → 46 %) ------------
const N = 46, AI = 21, r = rng(11);
const order = [...Array(N).keys()].sort(() => r() - .5), aiSet = new Set(order.slice(0, AI));
const L = []; let indent = 0;
for (let i = 0; i < N; i++) {
  if (r() < .25) indent = Math.min(3, indent + 1); else if (r() < .25) indent = Math.max(0, indent - 1);
  const el = document.createElement('i'); $('#lines').append(el);
  L.push({ el, ai: aiSet.has(i), x0: 150 + indent * 44, y0: 700 + i * 18.4, w0: 110 + r() * (540 - indent * 44) });
}
const aiL = L.filter(l => l.ai), huL = L.filter(l => !l.ai);
const lightFrom = Wd('editor', 'More'), lightTo = ed.end - .2;
aiL.forEach((l, k) => { l.lightAt = lerp(lightFrom, lightTo, k / (AI - 1)); });
[...aiL, ...huL].forEach((l, k) => { l.slot = k; });
const BAR = { x: 140, y: 920, w: 800, h: 44 };

// ---------- timeline cards ----------------------------------------------------------
const CARDS = [
  { id: 'c0', m: 'm0', x: -2400, drop: Math.max(Wd('timeline', 'Ada'), tl.start + 1.1), rot: -9 },
  { id: 'c1', m: 'm1', x: -1300, drop: Wd('timeline', 'FORTRAN'), rot: 7 },
  { id: 'c2', m: 'm2', x: 540, drop: Wd('timeline', '2021'), rot: -6 },
  { id: 'c3', m: 'm3', x: 1900, drop: Wd('timeline', 'next'), rot: 10 },
];

// ---------- camera: [t, x, y, zoom, rot, ease] ---------------------------------
const Y = 760, Z = 1.3;
const cam = camera([
  [0, 378, 557, 2.1, 0],
  [hk.end + .1, 395, 557, 2.1, 0],
  [ed.start - .15, 395, 557, 2.1, 0],
  [ed.start + .85, 540, 900, 1.08, -1.2, ease.io5],            // pull back: just one line of an editor
  [br.start + .2, 540, 890, 1.08, -1.2],
  [br.start + 1.5, 540, 900, 1.15, 0],                          // settle on the bar
  [tl.start + .25, 540, 900, 1.15, 0],
  [CARDS[0].drop - .15, -2400, Y, Z, 1.5, ease.io5],            // whip back to 1843
  [CARDS[1].drop - .75, -2400, Y, Z, 1.5],
  [CARDS[1].drop - .05, -1300, Y, Z, -1],
  [CARDS[2].drop - .75, -1300, Y, Z, -1],
  [CARDS[2].drop - .05, 540, Y, Z, .8],
  [CARDS[3].drop - .8, 540, Y, Z, .8],
  [CARDS[3].drop - .05, 1900, Y, Z, 0],
  [vd.start - .95, 1900, Y, Z, 0],
  [vd.start - .05, 1900, 700, 40, 0, ease.inExpo],             // push through the red card
  [T.total + 1, 1900, 700, 40, 0],
]);
const IMPACTS = CARDS.map(c => c.drop + .13);

// ---------- captions (not on beats whose words are already big on screen) ----------
const cap = captions($('#captions'), [ed, br, tl, vd], { per: 3 });
const hookText = '// we might be the\n// last programmers\n// who ever lived.';
const typeHook = typedBy(hk.words, hookText);
const typeUrl = t => 'wildmann.org'.slice(0, Math.floor(clamp((t - (en.start + .1)) * 13, 0, 12)));

function seek(t) {
  const c = cam(t), sh = shake(t, IMPACTS);
  $('#world').style.transform = camTransform(c, t, sh, 1);
  $('#back').style.transform = camTransform(c, t, sh, .6);
  const inFilm = t < vd.start;

  // hook: typed in sync with George
  $('#hook').textContent = typeHook(t);
  $('#cur1').style.visibility = t < ed.start + .6 && (t < hk.end || Math.floor(t * 2.2) % 2 === 0) ? 'visible' : 'hidden';

  // editor → bar
  const col = ease.io3(prog(t, br.start + .2, .9));
  const e = $('#editor').style;
  e.left = lerp(90, BAR.x - 8, col) + 'px'; e.top = lerp(360, BAR.y - 8, col) + 'px';
  e.width = lerp(900, BAR.w + 16, col) + 'px'; e.height = lerp(1200, BAR.h + 16, col) + 'px';
  e.opacity = 1 - prog(t, br.start + 1.0, .3);
  document.querySelectorAll('.ehead, .hook, #tape0').forEach(x => { x.style.opacity = 1 - prog(t, br.start, .3); });
  const sw = BAR.w / N;
  for (const l of L) {
    const lit = l.ai ? ease.out3(prog(t, l.lightAt, .25)) : 0;
    const p = clamp(spring(t - (br.start + .05 + l.slot * .017), .7, 13), 0, 1.15), pc = clamp(p);
    Object.assign(l.el.style, {
      left: lerp(l.x0, BAR.x + l.slot * sw, p) + 'px', top: lerp(l.y0, BAR.y, p) - Math.sin(Math.PI * pc) * 160 + 'px',
      width: lerp(l.w0, sw + .7, pc) + 'px', height: lerp(9, BAR.h, pc) + 'px',
      transform: `rotate(${Math.sin(Math.PI * pc) * (l.ai ? -20 : 20)}deg)`,
      background: l.ai ? `color-mix(in srgb, var(--red) ${lit * 100}%, var(--ink))` : (pc > .5 ? 'var(--ink)' : ''),
      opacity: (l.ai ? 1 : lerp(.85, .9, pc)) * (1 - prog(t, tl.start + .1, .25)),
    });
  }
  // counter chip → becomes the big 46 % on "forty-six"
  const lit = aiL.filter(l => t >= l.lightAt).length;
  $('#num').textContent = Math.round(lit / N * 100) + '%';
  const chip = $('#chip'), cp = spring(t - (lightFrom - .15), .55, 14), fly = ease.io3(prog(t, Wd('bar', 'forty-six') - .55, .7));
  const k = $('#chipk'); k.style.maxWidth = (1 - fly) * 260 + 'px'; k.style.opacity = 1 - fly; k.style.padding = fly > .95 ? '0' : '';
  chip.style.gap = (1 - fly) * 16 + 'px';
  chip.style.opacity = clamp(cp * 2) * (1 - prog(t, tl.start, .25));
  chip.style.left = lerp(600, 540 - chip.offsetWidth / 2, fly) + 'px'; chip.style.top = lerp(240, 640, fly) + 'px';
  chip.style.transform = `rotate(${lerp(-3, -4, fly)}deg) scale(${lerp(.6 + .4 * Math.min(cp, 1.1), 3.4, fly)})`;
  const nb = ease.out3(prog(t, Wd('bar', 'Copilot') - .1, .45));
  $('#note').style.opacity = nb * (1 - prog(t, tl.start, .25));
  $('#note').style.transform = `rotate(-1.2deg) translateY(${(1 - nb) * 60}px)`;

  // timeline: the bar thins into a line that draws out both ways; cards land on their spoken year
  const ln = ease.io3(prog(t, tl.start, .9));
  const sl = lerp(3200 + 140, 3200 - 2750, ln), sr = lerp(3200 + 940, 3200 + 1900, ln);
  Object.assign($('#tl .solid').style, { left: sl + 'px', width: sr - sl + 'px' });
  $('#tl').style.opacity = t > tl.start ? 1 : 0;
  Object.assign($('#tl .dash').style, { left: 3200 + 1900 + 'px', width: 1200 * ease.io3(prog(t, CARDS[3].drop + .2, .8)) + 'px' });
  for (const cd of CARDS) {
    const u = t - cd.drop, p = spring(u, .5, 13), el = $('#' + cd.id);
    el.style.left = cd.x - 310 + 'px'; el.style.top = 960 - 70 - 400 + 'px';
    el.style.opacity = u > -.05 ? 1 : 0;
    el.style.transform = `translateY(${(1 - p) * -800}px) rotate(${(1 - clamp(p)) * cd.rot + cd.rot * .12}deg)`;
    const m = $('#' + cd.m), mp = spring(u + .1, .45, 16);
    m.style.left = cd.x - 20 + 'px'; m.style.top = 960 - 15 + 'px';
    m.style.transform = `rotate(45deg) scale(${clamp(mp, 0, 1.4)})`; m.style.opacity = u > -.1 ? 1 : 0;
  }

  // verdict: the red card floods the screen
  $('#flood').style.opacity = prog(t, vd.start - .3, .25);
  const vp = spring(t - Wd('verdict', 'Partly'), .55, 12), out = ease.io3(prog(t, en.start - .35, .6));
  const v = $('#verdict').style; v.opacity = clamp(vp * 2) * (1 - out);
  v.transform = `translateY(${(1 - vp) * 90 - out * 200}px) scale(${1 - out * .3})`;
  for (const [id, w, dir] of [['s1', Wd('verdict', 'Machines'), -1], ['s2', Wd('verdict', 'someone'), 1]]) {
    const p = spring(t - w, .6, 13), s = $('#' + id).style;
    s.opacity = t > w - .02 ? 1 : 0;
    s.transform = `translateX(${(1 - p) * dir * 1100 + out * dir * 1300}px) rotate(${(dir < 0 ? -3 : 2) + (1 - clamp(p)) * dir * 8}deg)`;
  }

  // end card: logo drops, cursor types the URL, the slogan lands on the spoken words
  const lp = spring(t - en.start, .45, 13), lg = $('#logo').style;
  lg.opacity = t > en.start ? 1 : 0;
  lg.transform = `translateY(${(1 - lp) * -700}px) rotate(${(1 - clamp(lp)) * 12}deg)`;
  const u = $('#url'); u.style.opacity = t > en.start + .05 ? 1 : 0;
  $('#urlt').textContent = typeUrl(t);
  $('#cur2').style.visibility = (t < en.start + 1.1 || Math.floor(t * 2.2) % 2 === 0) ? 'visible' : 'hidden';
  $('#tag').style.opacity = 1;
  [['tg1', Wd('end', 'Stay', 0)], ['tg2', Wd('end', 'Stay', 1)]].forEach(([id, w]) => {
    const p = ease.out3(prog(t, w - .05, .35)); const s = $('#' + id).style;
    s.opacity = p; s.display = 'inline-block'; s.transform = `translateY(${(1 - p) * 24}px)`;
  });

  cap(t);
  $('#captions').style.opacity = inFilm || t < en.start - .3 ? 1 : 0;
}

window.DURATION = T.total;
window.seek = seek;
seek(+(new URLSearchParams(location.search).get('t') || 0));
window.READY = true;
