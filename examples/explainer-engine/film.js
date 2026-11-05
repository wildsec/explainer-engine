// "explainer-engine: a video written as code" — the engine explaining itself, in one continuous take:
//   the hook is typed into script.json → pull back: the name lands, HTML/CSS/JS tags drop on their words →
//   whip down to the voice: a waveform fills as George speaks, word timestamps pop up →
//   the waveform strip stretches into a filmstrip of real engine frames, the camera whips along it (motion blur) →
//   the last frames become the two looks → push through the terminal card → free / open source / git clone →
//   end card. Every event is anchored to a spoken word (out/timing.json).
import { clamp, lerp, prog, ease, spring, rng, loadTiming, camera, shake, camTransform, torn, captions, typedBy } from '/engine/lib.js';

const $ = s => document.querySelector(s);
const { T, B, W } = await loadTiming('out/timing.json');
const hk = B('hook'), wh = B('what'), vo = B('voice'), re = B('render'), lo = B('looks'), wr = B('where'), en = B('end');

// torn paper edges (looks like terminal switch them off with --torn: 0)
const tornOn = getComputedStyle(document.documentElement).getPropertyValue('--torn').trim() !== '0';
let sd = 3; if (tornOn) document.querySelectorAll('.paper, #back > *').forEach(el => torn(el, sd++, el.id === 'sheet' ? .7 : 1.8));

// ---------- strip: waveform (voice) that stretches into a filmstrip (render) ---------------
const STRIP = { x: 90, y: 1540, w: 900, h: 420 }, FRAME = 234, NF = 22, STRIP_LONG = NF * FRAME + 24;
const r = rng(5), bars = [];
for (let i = 0; i < 88; i++) {
  const el = document.createElement('i'); el.style.left = 18 + i * 9.9 + 'px'; $('#bars').append(el);
  bars.push({ el, h: 40 + Math.pow(r(), 1.6) * 150 * (.5 + .5 * Math.sin(i / 5)) + 10, x: i / 88 });
}
const frames = [];
for (let k = 0; k < NF; k++) {
  const el = document.createElement('i'), tile = k % 24;
  el.style.left = 24 + k * FRAME + 'px';
  el.style.backgroundPosition = `${-(tile % 8) * 210}px ${-Math.floor(tile / 8) * 373.3}px`;
  $('#frames').append(el); frames.push(el);
}
// word stamps on the waveform: a few spoken words with their real timestamps
const STAMP_WORDS = [['voice'], ['timestamp'], ['hear']];
const stamps = STAMP_WORDS.map(([w], i) => {
  const t = W('voice', w), el = document.createElement('div');
  el.className = 'paper ' + (i % 2 ? 'yellow' : 'sheet'); el.innerHTML = `${w}<small>${t.toFixed(2)} s</small>`;
  $('#stamps').append(el); if (tornOn) torn(el, 40 + i, 2.2);
  return { el, t, x: STRIP.x + 30 + ((t - vo.start) / (vo.end - vo.start)) * (STRIP.w - 120) };
});

// ---------- camera: [t, x, y, zoom, rot, ease] ----------------------------------------
const SY = STRIP.y + STRIP.h / 2;            // strip centre
const WHIP_TO = 4700, LOOK_X = 5800, LOOK_Y = 1830;
const cam = camera([
  [0, 470, 520, 1.7, 0],
  [hk.end + .1, 485, 520, 1.7, 0],
  [wh.start - .15, 485, 520, 1.7, 0],
  [wh.start + .75, 540, 640, 1.0, -1, ease.io5],             // pull back: the line is a script file
  [vo.start - .7, 540, 640, 1.0, -1],
  [vo.start + .1, 540, SY, 1.05, .8, ease.io5],               // whip down to the voice
  [re.start + .25, 540, SY, 1.05, .8],
  [W('render', 'motion') - .12, WHIP_TO, SY, 1.05, -1.2, ease.io5],  // whip along the filmstrip
  [lo.start - .35, WHIP_TO, SY, 1.05, -1.2],
  [lo.start + .45, LOOK_X, LOOK_Y, .95, 0, ease.io3],          // the last frames become the two looks
  [wr.start - .55, LOOK_X, LOOK_Y, .95, 0],
  [wr.start + .15, LOOK_X + 230, LOOK_Y - 60, 40, 0, ease.inExpo], // push through the terminal card
  [T.total + 1, LOOK_X + 230, LOOK_Y - 60, 40, 0],
]);
const tagTimes = [W('what', 'HTML'), W('what', 'CSS'), W('what', 'JavaScript')];
const IMPACTS = [W('what', 'explainer') + .1, ...tagTimes.map(t => t + .12), W('voice', 'lands') + .12, W('looks', 'Collage') + .1, W('looks', 'terminal') + .1];

const cap = captions($('#captions'), [wh, vo, re, lo], { per: 3 });
const typeHook = typedBy(hk.words, 'This video was\n      written as code." },');
const REPO = 'github.com/wildsec/explainer-engine';
const typeRepo = t => REPO.slice(0, Math.floor(clamp((t - W('where', 'GitHub')) / (wr.end - W('where', 'GitHub')) * REPO.length * 1.08, 0, REPO.length)));
const typeUrl = t => 'wildmann.org'.slice(0, Math.floor(clamp((t - (en.start + .1)) * 13, 0, 12)));
const blink = (t, until) => t < until || Math.floor(t * 2.2) % 2 === 0;
const land = (el, t0, t, { dy = -700, rot = -8, base = 0, z = .5, w = 13 } = {}) => {
  const p = spring(t - t0, z, w);
  el.style.opacity = t > t0 - .03 ? 1 : 0;
  el.style.transform = `translateY(${(1 - p) * dy}px) rotate(${(1 - clamp(p)) * rot + base}deg)`;
};

function seek(t) {
  const c = cam(t), sh = shake(t, IMPACTS);
  $('#world').style.transform = camTransform(c, t, sh, 1);
  $('#back').style.transform = camTransform(c, t, sh, .6);

  // hook typed into script.json
  $('#hook').textContent = typeHook(t);
  $('#cur1').style.visibility = t < wh.start + .5 && blink(t, hk.end) ? 'visible' : 'hidden';

  // name slaps onto the sheet, tags drop on their words
  land($('#name'), W('what', 'explainer'), t, { dy: -260, rot: 18, base: -6, z: .45, w: 16 });
  $('#name').style.scale = 1 + .5 * (1 - clamp(spring(t - W('what', 'explainer'), .45, 16)));
  ['#t0', '#t1', '#t2'].forEach((id, i) => land($(id), tagTimes[i], t, { rot: [-9, 7, -6][i], base: [-3, 2, -2][i] }));

  // voice: the strip fills like a waveform behind a playhead; word stamps pop at their real time
  const pv = clamp((t - vo.start) / (vo.end - vo.start));
  const toFilm = ease.io3(prog(t, re.start - .1, .9));            // waveform → filmstrip
  const strip = $('#strip').style;
  strip.left = STRIP.x + 'px'; strip.top = STRIP.y + 'px'; strip.height = STRIP.h + 'px';
  strip.width = lerp(STRIP.w, STRIP_LONG, toFilm) + 'px';
  strip.background = `color-mix(in srgb, var(--ink) ${toFilm * 100}%, var(--paper))`;
  strip.setProperty('--holes', toFilm);
  strip.opacity = clamp((t - (vo.start - .6)) / .3);
  for (const b of bars) {
    const on = ease.out3(clamp((pv - b.x) * 8));
    b.el.style.height = b.h * on * (1 - toFilm) + 'px';
    b.el.style.transform = `scaleY(1)`; b.el.style.marginBottom = -b.h * on * (1 - toFilm) / 2 + 'px';
    b.el.style.background = pv > b.x ? 'var(--ink)' : 'var(--soft)';
  }
  const ph = $('#playhead').style; ph.left = 18 + pv * (STRIP.w - 30) + 'px'; ph.opacity = (t > vo.start && t < vo.end + .3) ? 1 : 0;
  stamps.forEach((s, i) => { s.el.style.left = s.x - 40 + 'px'; land(s.el, s.t, t, { dy: -120, rot: 10, base: i % 2 ? 3 : -3, w: 18 });
    s.el.style.opacity *= 1 - prog(t, re.start, .3); });
  land($('#lands'), W('voice', 'lands'), t, { dy: -500, rot: -10, base: -2 });
  $('#lands').style.left = STRIP.x + 40 + 'px';
  $('#lands').style.opacity *= 1 - prog(t, re.start, .3);
  frames.forEach((f, k) => { f.style.opacity = ease.out3(prog(t, re.start + .2 + k * .03, .3)); });

  // render: scraps land on "motion", "continuous", "slides"
  for (const [id, w, x, rot] of [['#r1', W('render', 'motion'), WHIP_TO - 380, -3], ['#r2', W('render', 'continuous'), WHIP_TO - 330, 2], ['#r3', W('render', 'slides'), WHIP_TO + 20, -4]]) {
    const el = $(id); el.style.left = x + 'px'; land(el, w, t, { dy: -600, rot: rot * 3, base: rot });
    el.style.opacity *= 1 - prog(t, lo.start, .3);
  }

  // looks: the flag lands, then the two looks pop in on their names
  const fl = $('#flag'); fl.style.left = LOOK_X - 200 + 'px'; fl.style.top = 1310 + 'px'; land(fl, W('looks', 'flag'), t, { dy: -300, rot: 6, base: -2 });
  for (const [id, w, x, base] of [['#lc', W('looks', 'Collage'), LOOK_X - 460, -3], ['#lt', W('looks', 'terminal'), LOOK_X + 10, 3]]) {
    const el = $(id); el.style.left = x + 'px'; land(el, w, t, { dy: 900, rot: base * 4, base });
  }

  // where: the terminal card floods the screen; free / open source / MIT / git clone land on their words
  $('#flood').style.opacity = prog(t, wr.start - .08, .2);
  const out = ease.io3(prog(t, en.start - .3, .55));
  for (const [id, w, dir] of [['#free', W('where', 'free'), -1], ['#open', W('where', 'open'), 1], ['#mit', W('where', 'commercial'), -1], ['#repo', W('where', 'Find'), 1]]) {
    const p = spring(t - w, .55, 14), s = $(id).style;
    s.opacity = t > w - .02 ? 1 - out : 0;
    s.translate = `${(1 - p) * dir * 1100}px ${-out * 300}px`;
  }
  $('#repot').textContent = typeRepo(t);
  $('#cur2').style.visibility = t > W('where', 'Find') && t < en.start && blink(t, wr.end + .2) ? 'visible' : 'hidden';

  // end card
  const lp = spring(t - en.start, .45, 13), lg = $('#logo').style;
  lg.opacity = t > en.start ? 1 : 0;
  lg.transform = `translateY(${(1 - lp) * -700}px) rotate(${(1 - clamp(lp)) * 12}deg)`;
  $('#url').style.opacity = t > en.start + .05 ? 1 : 0;
  $('#urlt').textContent = typeUrl(t);
  $('#cur3').style.visibility = blink(t, en.start + 1.1) ? 'visible' : 'hidden';
  $('#tag').style.opacity = 1;
  [['tg1', W('end', 'Stay', 0)], ['tg2', W('end', 'Stay', 1)]].forEach(([id, w]) => {
    const p = ease.out3(prog(t, w - .05, .35)), s = $('#' + id).style;
    s.opacity = p; s.display = 'inline-block'; s.transform = `translateY(${(1 - p) * 24}px)`;
  });

  cap(t);
  $('#captions').style.opacity = t < wr.start - .1 ? 1 : 0;
}

window.DURATION = T.total;
window.seek = seek;
seek(+(new URLSearchParams(location.search).get('t') || 0));
window.READY = true;
