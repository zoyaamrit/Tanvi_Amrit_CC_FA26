/* ASCII Strings
   - webcam drawn as ASCII art
   - three strings spanning the canvas, plucked by index fingertips (ml5 handPose) or the mouse
   - a looper: record a first pass, then overdub layers on top
*/

// ---------- settings ----------
const RAMP = " .,:;i1tfLCG08@";           // dark -> bright
const FONT_SIZE = 12;
const FRETS = [0, 3, 5, 7, 10, 12, 15, 17]; // semitones above the open string, left -> right
const STRINGS = [
  { name: "D", freq: 293.66, col: [255, 180, 84] },
  { name: "A", freq: 220.0,  col: [240, 120, 90] },
  { name: "E", freq: 164.81, col: [120, 200, 190] },
];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const RETRIGGER_MS = 90;                   // ignore jitter re-plucks of one string

// ---------- state ----------
let video, pg, handPose;
let hands = [];
let modelReady = false, detecting = false;
let charW = 7, rowH = FONT_SIZE, cols = 0, rows = 0;
let pointers = {};                         // id -> {x, y, f}
let labels = [];                           // floating note names

let ctx, master;                           // Web Audio
const pluckCache = {};

const loop = {
  state: "idle",                           // idle | armed | recording | playing | overdub | stopped
  events: [],                              // {t, s, fret, vel, layer}
  len: 0, start: 0, recStart: 0,
  scheduledUntil: 0, layer: 0,
};

const $ = (id) => document.getElementById(id);

// ---------- setup ----------
function setup() {
  const c = createCanvas(windowWidth, windowHeight);
  c.parent("stage");
  textFont("monospace");
  layout();

  video = createCapture(VIDEO);
  video.hide();
  video.elt.setAttribute("playsinline", "");

  if (typeof ml5 !== "undefined") {
    try {
      handPose = ml5.handPose({ maxHands: 2 }, () => (modelReady = true));
    } catch (e) {
      console.warn("handPose failed to load", e);
    }
  }

  for (const s of STRINGS) Object.assign(s, { amp: 0, px: 0.5, phase: 0, last: 0 });

  $("startBtn").addEventListener("click", startAudio);
  $("recBtn").addEventListener("click", toggleRec);
  $("playBtn").addEventListener("click", togglePlay);
  $("undoBtn").addEventListener("click", undoLayer);
  $("clearBtn").addEventListener("click", clearLoop);
}

function layout() {
  textSize(FONT_SIZE);
  charW = textWidth("M");
  rowH = FONT_SIZE;
  cols = ceil(width / charW);
  rows = ceil(height / rowH);
  pg = createGraphics(cols, rows);
  pg.pixelDensity(1);
  STRINGS.forEach((s, i) => (s.y = height * (0.26 + i * 0.2)));
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layout();
}

// ---------- draw ----------
function draw() {
  background(11, 12, 10);

  const vw = video.elt.videoWidth, vh = video.elt.videoHeight;
  const camOn = vw > 0 && vh > 0;

  if (camOn) {
    if (modelReady && !detecting) {
      handPose.detectStart(video, (r) => (hands = r));
      detecting = true;
    }
    drawAscii(vw, vh);
    trackHands(vw, vh);
  }

  drawStrings();
  drawPointers();
  drawLabels();
  runLoop();
  updateHud(camOn);
}

// The video is mirrored and cover-fitted to the canvas, sampled one pixel per character.
function coverFit(vw, vh) {
  const s = max(width / vw, height / vh);
  return { s, ox: (vw * s - width) / 2, oy: (vh * s - height) / 2 };
}

function drawAscii(vw, vh) {
  const { s, ox, oy } = coverFit(vw, vh);
  const kx = cols / width, ky = rows / height;
  pg.push();
  pg.translate(cols, 0);
  pg.scale(-1, 1);
  pg.image(video, -ox * kx, -oy * ky, vw * s * kx, vh * s * ky);
  pg.pop();
  pg.loadPixels();

  noStroke();
  fill(200, 150, 80);
  textSize(FONT_SIZE);
  textAlign(LEFT, TOP);
  const px = pg.pixels, n = RAMP.length - 1;
  for (let r = 0; r < rows; r++) {
    let line = "";
    let i = r * cols * 4;
    for (let c = 0; c < cols; c++, i += 4) {
      let b = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      b = constrain((b - 0.08) * 1.25, 0, 1);       // a little contrast
      line += RAMP[(b * n) | 0];
    }
    text(line, 0, r * rowH);
  }
}

// ---------- plucking ----------
function trackHands(vw, vh) {
  const { s, ox, oy } = coverFit(vw, vh);
  hands.forEach((hand, i) => {
    const tip = hand.keypoints && hand.keypoints[8]; // index fingertip
    if (!tip) return;
    const id = "hand-" + (hand.handedness || i);
    let x = width - (tip.x * s - ox);                // mirrored
    let y = tip.y * s - oy;
    const p = pointers[id];
    if (p && frameCount - p.f < 5) {                 // smooth out tracking jitter
      x = lerp(p.x, x, 0.65);
      y = lerp(p.y, y, 0.65);
    }
    movePointer(id, x, y);
  });
}

// A pluck happens when a pointer crosses a string between two frames.
function movePointer(id, x, y) {
  const p = pointers[id];
  if (p && frameCount - p.f < 5) {
    for (let i = 0; i < STRINGS.length; i++) {
      const sy = STRINGS[i].y;
      if ((p.y - sy) * (y - sy) < 0) {
        const k = (sy - p.y) / (y - p.y);
        const cx = lerp(p.x, x, k);
        const vel = constrain(0.35 + abs(y - p.y) / 90, 0.35, 1);
        pluck(i, cx / width, vel);
      }
    }
  }
  pointers[id] = { x, y, f: frameCount };
}

function mouseMoved()   { movePointer("mouse", mouseX, mouseY); }
function mouseDragged() { movePointer("mouse", mouseX, mouseY); }
function touchStarted() { delete pointers.mouse; }
function touchMoved()   { movePointer("mouse", mouseX, mouseY); return false; }

function pluck(i, px, vel) {
  const s = STRINGS[i];
  const t = millis();
  if (t - s.last < RETRIGGER_MS) return;
  s.last = t;
  px = constrain(px, 0.001, 0.999);
  const fret = min(FRETS.length - 1, floor(px * FRETS.length));
  playNote(i, fret, vel);
  ring(i, px, vel, fret);
  record(i, fret, vel);
}

function ring(i, px, vel, fret) {
  const s = STRINGS[i];
  s.amp = 10 + vel * 26;
  s.px = px;
  labels.push({ txt: noteName(i, fret), x: px * width, y: s.y - 18, life: 1, col: s.col });
}

function noteName(i, fret) {
  const midi = Math.round(69 + 12 * Math.log2(STRINGS[i].freq / 440)) + FRETS[fret];
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

// ---------- drawing the strings ----------
function drawStrings() {
  for (const s of STRINGS) {
    // fret boundaries
    stroke(243, 234, 215, 70);
    strokeWeight(1);
    for (let f = 1; f < FRETS.length; f++) {
      const x = (f / FRETS.length) * width;
      line(x, s.y - 7, x, s.y + 7);
    }

    s.phase += 1.9;
    const a = s.amp;
    const live = a > 0.4;
    stroke(live ? color(s.col[0], s.col[1], s.col[2]) : color(243, 234, 215));
    strokeWeight(live ? 2.5 : 1.5);
    noFill();
    beginShape();
    for (let x = 0; x <= width + 8; x += 8) {
      const u = min(x / width, 1);
      // triangle peaked where the string was plucked, pinned at both ends
      const env = u < s.px ? u / s.px : (1 - u) / (1 - s.px);
      const wob = cos(s.phase) * 0.8 + cos(s.phase * 2.1 + u * 9) * 0.2;
      vertex(x, s.y + a * env * wob);
    }
    endShape();
    s.amp *= 0.95;

    noStroke();
    fill(243, 234, 215, 150);
    textSize(11);
    textAlign(LEFT, BOTTOM);
    text(s.name, 8, s.y - 6);
  }
}

function drawPointers() {
  noFill();
  strokeWeight(2);
  for (const id in pointers) {
    const p = pointers[id];
    if (id === "mouse" || frameCount - p.f > 5) continue;
    stroke(243, 234, 215);
    circle(p.x, p.y, 22);
    stroke(255, 180, 84);
    circle(p.x, p.y, 6);
  }
}

function drawLabels() {
  noStroke();
  textSize(15);
  textAlign(CENTER, BOTTOM);
  for (const l of labels) {
    fill(l.col[0], l.col[1], l.col[2], 255 * l.life);
    text(l.txt, l.x, l.y - (1 - l.life) * 24);
    l.life -= 0.025;
  }
  labels = labels.filter((l) => l.life > 0);
}

// ---------- sound: Karplus-Strong plucked string ----------
function startAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 5200;
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(lp).connect(comp).connect(ctx.destination);
  }
  ctx.resume();
  $("start").classList.add("hidden");
}

function pluckBuffer(freq) {
  const key = freq.toFixed(2);
  if (pluckCache[key]) return pluckCache[key];
  const sr = ctx.sampleRate;
  const N = max(2, round(sr / freq - 0.5));          // delay line length
  const ring = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) {                      // burst of softened noise
    prev = 0.5 * prev + 0.5 * (Math.random() * 2 - 1);
    ring[i] = prev;
  }
  const len = Math.floor(sr * 3);
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const nxt = (idx + 1) % N;
    out[i] = ring[idx];
    ring[idx] = 0.997 * 0.5 * (ring[idx] + ring[nxt]);
    idx = nxt;
  }
  // the loop's true period is N + 0.5 samples; correct the pitch on playback
  const entry = { buf, rate: (freq * (N + 0.5)) / sr };
  pluckCache[key] = entry;
  return entry;
}

function playNote(i, fret, vel, when) {
  if (!ctx) return;
  const freq = STRINGS[i].freq * Math.pow(2, FRETS[fret] / 12);
  const { buf, rate } = pluckBuffer(freq);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = 0.9 * vel;
  src.connect(g).connect(master);
  src.start(when || 0);
}

// ---------- looper ----------
function record(s, fret, vel) {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (loop.state === "armed") {                      // the first pluck starts the clock
    loop.state = "recording";
    loop.recStart = now;
  }
  if (loop.state === "recording") {
    loop.events.push({ t: now - loop.recStart, s, fret, vel, layer: 1 });
  } else if (loop.state === "overdub") {
    const t = (((now - loop.start) % loop.len) + loop.len) % loop.len;
    loop.events.push({ t, s, fret, vel, layer: loop.layer });
  }
}

function toggleRec() {
  if (!ctx) return;
  const now = ctx.currentTime;
  switch (loop.state) {
    case "idle":
      loop.events = [];
      loop.layer = 1;
      loop.state = "armed";
      break;
    case "armed":
      loop.state = "idle";
      break;
    case "recording":
      loop.len = max(0.25, now - loop.recStart);
      startPlayback();
      break;
    case "stopped":
      startPlayback();                               // falls through into an overdub
    case "playing":
      loop.layer++;
      loop.state = "overdub";
      break;
    case "overdub":
      closeLayer();
      loop.state = "playing";
      break;
  }
}

function closeLayer() {
  if (!loop.events.some((e) => e.layer === loop.layer)) loop.layer--; // nothing was added
}

function startPlayback() {
  loop.start = ctx.currentTime;
  loop.scheduledUntil = loop.start;
  loop.state = "playing";
}

function togglePlay() {
  if (!ctx) return;
  if (loop.state === "recording") return toggleRec();
  if (loop.state === "overdub") closeLayer();
  if (loop.state === "playing" || loop.state === "overdub") loop.state = "stopped";
  else if (loop.state === "stopped") startPlayback();
}

function undoLayer() {
  if (!loop.len || loop.state === "recording") return;
  loop.events = loop.events.filter((e) => e.layer !== loop.layer);
  loop.layer--;
  if (loop.state === "overdub") loop.state = "playing";
  if (!loop.events.length) clearLoop();
}

function clearLoop() {
  loop.state = "idle";
  loop.events = [];
  loop.len = 0;
  loop.layer = 0;
}

// Schedule loop notes slightly ahead on the audio clock so timing stays tight
// even when the frame rate wobbles.
function runLoop() {
  if (!ctx || (loop.state !== "playing" && loop.state !== "overdub")) return;
  const now = ctx.currentTime;
  const from = max(loop.scheduledUntil, now);
  const to = now + 0.15;
  if (to <= from) return;
  const pass = Math.floor((from - loop.start) / loop.len);
  for (const e of loop.events) {
    for (let k = pass; k <= pass + 1; k++) {
      const t = loop.start + k * loop.len + e.t;
      if (t >= from && t < to) {
        playNote(e.s, e.fret, e.vel, t);
        setTimeout(() => ring(e.s, (e.fret + 0.5) / FRETS.length, e.vel, e.fret), (t - now) * 1000);
      }
    }
  }
  loop.scheduledUntil = to;
}

// ---------- HUD ----------
function updateHud(camOn) {
  const st = loop.state;
  const rec = $("recBtn"), play = $("playBtn"), fill = $("fill");
  const live = st === "armed" || st === "recording" || st === "overdub";
  rec.classList.toggle("live", live);
  fill.classList.toggle("live", live);
  rec.textContent =
    st === "idle" ? "Record" :
    st === "armed" ? "Cancel" :
    st === "recording" ? "Close loop" :
    st === "overdub" ? "End overdub" : "Overdub";
  play.textContent = st === "stopped" ? "Play" : "Stop";
  play.disabled = st === "idle" || st === "armed";
  $("undoBtn").disabled = !loop.len || st === "recording";
  $("clearBtn").disabled = st === "idle";

  let msg = "No loop yet";
  let frac = 0;
  const now = ctx ? ctx.currentTime : 0;
  if (st === "armed") msg = "Armed: recording starts on your first pluck";
  else if (st === "recording") {
    const el = now - loop.recStart;
    msg = "Recording " + el.toFixed(1) + "s";
    frac = (el % 4) / 4;
  } else if (loop.len) {
    if (st !== "stopped") frac = (((now - loop.start) % loop.len) + loop.len) % loop.len / loop.len;
    const info = loop.len.toFixed(1) + "s loop, " + loop.layer + (loop.layer === 1 ? " layer" : " layers");
    msg = (st === "overdub" ? "Overdubbing: " : st === "stopped" ? "Stopped: " : "Playing: ") + info;
  }
  $("status").textContent = msg;
  fill.style.width = (frac * 100).toFixed(1) + "%";

  $("tracker").textContent =
    !camOn ? "no camera: mouse only" :
    typeof ml5 === "undefined" || !handPose ? "hand tracking unavailable: mouse only" :
    !modelReady ? "loading hand tracking..." :
    hands.length ? "tracking " + hands.length + (hands.length === 1 ? " hand" : " hands") : "show a hand to the camera";
}

function keyPressed() {
  if (document.activeElement && document.activeElement.tagName === "BUTTON") document.activeElement.blur();
  if (key === "r" || key === "R") toggleRec();
  else if (key === " ") { togglePlay(); return false; }
  else if (key === "u" || key === "U") undoLayer();
  else if (key === "c" || key === "C") clearLoop();
}