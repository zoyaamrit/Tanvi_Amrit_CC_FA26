// Shadow Animals — p5.js + ml5.js handPose
// Make a shadow-puppet hand shape; the animal grows out of your hand in white ASCII lines.
//
// Tracking notes
//  - every hand is a persistent "track" (matched frame to frame by position), so two hands never swap
//  - 2D and 3D landmarks are smoothed with One Euro filters (steady when still, quick when moving)
//  - shapes are recognised only from the 3D landmarks (joint angles + distances in palm lengths),
//    so they do not depend on how the hand is rotated or how far it is from the camera
//  - each shape gets a soft 0..1 score that is blended over time, with separate enter / exit levels
//  - drawing size comes from the true 3D palm length, and directions from the 3D finger directions,
//    so the animal keeps its size when the hand tilts and foreshortens when a finger points at you

// ---------- tuning (distances are in palm lengths: wrist -> middle knuckle) ----------
const T = {
  enter: 0.55,       // score needed for a shape to appear
  exit: 0.3,         // score below which the current shape lets go
  blend: 0.3,        // how fast scores follow the hand (lower = steadier, slower)
  soft: 0.08,        // softness of every threshold below
  pinch: 0.5,        // thumb tip touching a fingertip
  straight: 0.32,    // curl below this = finger lifted
  folded: 0.55,      // curl above this = finger folded
  joined: 0.42,      // neighbouring fingertips together
  dogGap: 0.45,      // dog: gap between middle and ring
  thumbOut: 0.6,     // thumb tip this far from the pointer knuckle = thumb out
  thumbIn: 0.58,     // snake: thumb tip this close to the palm
  splay: 35,         // lotus: degrees between pointer and little finger
  cut2D: 1.4, beta2D: 0.012,   // One Euro filter, screen pixels
  cut3D: 1.0, beta3D: 25,      // One Euro filter, metres
  keepFrames: 20     // frames a lost hand is held before its track is dropped
};

const FINGERS = { index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20] };
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
               [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

const ART = {
  deer:      [" \\|/     \\|/", "  \\\\_____//", "  /  o o  \\", "  \\   ^   /", "   \\__v__/"],
  snake:     ["     ____", " ~<=( o  )__", "     \\__    \\", "   ____/    /", "  (________/"],
  lotus:     ["      .", "    ./|\\.", "  (\\ \\|/ /)", "   \\\\_|_//", " ~~~~~~~~~~~"],
  bird:      ["\\\\\\       ///", " \\\\\\\\ _  ////", "  \\\\\\(o>///", "    \\(  )/", "      ^^"],
  dog:       ["  /\\____", " /  o   \\___", " \\         @)", "  \\___  ___/", "      \\U/"],
  rabbit:    ["  (\\ /)", "  ( V )", "  (o.o)", "  (> <)", " (\")_(\")"],
  swan:      ["      __", "    <(o )", "      ) /", " ____/ (", "(  ~~   )", " \\_____/", "~~~~~~~~~~"],
  crocodile: ["        ___  __", " ______/ o \\/  \\_____", "<VVVVVVV       _____/", " \\^^^^^^^_____/"],
  bull:      [" (\\       /)", "  \\\\_____//", "  /  o o  \\", "  \\  ___  /", "   \\(o.o)/"],
  turtle:    ["     _____", "   /\\_/\\_/\\  _", " _/_/\\_/\\_\\_/o)", "(__________/\"", "  U U   U U"],
};

let handPose, video;
let hands = [];
let tracks = [];
let birdScore = 0, birdPair = null;
let current = null, target = null, grow = 0;
let activeTrack = null;
let showVideo = true, showHand = true, debug = false;
let lastDebug = "";
let GS = 13, STEP = 9;           // glyph size + spacing, set per hand from its distance

function preload() {
  handPose = ml5.handPose({ maxHands: 2 });
}

function setup() {
  createCanvas(windowWidth, windowHeight).parent("stage");
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  handPose.detectStart(video, (r) => { hands = r; });
  textFont("Courier New");
  setStatus("show a hand to the camera");
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

function keyPressed() {
  if (key === "v") showVideo = !showVideo;
  if (key === "h") showHand = !showHand;
  if (key === "d") debug = !debug;
}

// ---------- main loop ----------
function draw() {
  background(0);
  if (showVideo) drawVideo();

  updateTracks();
  pick();
  updateState();

  if (showHand) tracks.forEach(drawHand);

  if (current) {
    const g = 1 - pow(1 - grow, 3);
    noStroke();
    textAlign(CENTER, CENTER);
    if (current === "bird") {
      if (birdPair && tracks.includes(birdPair[0]) && tracks.includes(birdPair[1])) {
        const u = (birdPair[0].u + birdPair[1].u) / 2;
        setGlyph(u);
        drawBird(birdPair[0], birdPair[1], g);
        drawSymbol(birdPair[0].p.concat(birdPair[1].p), u, g);
      }
    } else if (activeTrack && tracks.includes(activeTrack)) {
      setGlyph(activeTrack.u);
      DRAW[current](activeTrack, g);
      drawSymbol(activeTrack.p, activeTrack.u, g);
    }
  }

  if (debug) {
    fill(255); noStroke(); textAlign(LEFT, TOP); textSize(12); textWidth(2);
    text(lastDebug, 18, 48);
  }
}

function setGlyph(u) {
  GS = constrain(u * 0.12, 9, 20);
  STEP = GS * 0.72;
  textSize(GS);
}

function drawVideo() {
  const m = videoMap();
  push();
  translate(width, 0);
  scale(-1, 1);
  tint(255, 55);
  image(video, m.ox, m.oy, video.width * m.s, video.height * m.s);
  pop();
}

function videoMap() {
  const s = max(width / video.width, height / video.height);
  return { s, ox: (width - video.width * s) / 2, oy: (height - video.height * s) / 2 };
}

function toScreen(k) {
  const m = videoMap();
  return { x: width - (k.x * m.s + m.ox), y: k.y * m.s + m.oy };
}

function drawHand(tr) {
  const p = tr.p;
  const fade = tr.miss ? 0.4 : 1;
  stroke(255, (current ? 60 : 130) * fade);
  strokeWeight(1);
  for (const [a, b] of BONES) line(p[a].x, p[a].y, p[b].x, p[b].y);
  noStroke();
  fill(255, (current ? 90 : 200) * fade);
  for (const q of p) circle(q.x, q.y, 3);
}

// ---------- tracking ----------
class OneEuro {
  constructor(minCut, beta) { this.minCut = minCut; this.beta = beta; this.x = null; this.dx = 0; this.t = 0; }
  step(x, t) {
    if (this.x === null) { this.x = x; this.t = t; return x; }
    const dt = Math.max(1 / 120, t - this.t);
    this.t = t;
    const alpha = (cut) => 1 / (1 + 1 / (TWO_PI * cut * dt));
    this.dx += alpha(1) * ((x - this.x) / dt - this.dx);
    this.x += alpha(this.minCut + this.beta * Math.abs(this.dx)) * (x - this.x);
    return this.x;
  }
}

function makeTrack() {
  return {
    f2: Array.from({ length: 42 }, () => new OneEuro(T.cut2D, T.beta2D)),
    f3: Array.from({ length: 63 }, () => new OneEuro(T.cut3D, T.beta3D)),
    p: [], w: [], u: 100, sgx: -1, sgy: 1, miss: 0, scores: {}, side: null
  };
}

function updateTracks() {
  const t = millis() / 1000;
  const free = new Set(tracks);
  for (const h of hands) {
    const wrist = toScreen(h.keypoints[0]);
    let best = null, bd = Infinity;
    for (const tr of free) {
      let d = dist(wrist.x, wrist.y, tr.p[0].x, tr.p[0].y);
      if (tr.side && h.handedness && tr.side !== h.handedness) d += tr.u;   // prefer the same hand
      if (d < bd) { bd = d; best = tr; }
    }
    if (best && bd > best.u * 4) best = null;
    if (best) free.delete(best); else { best = makeTrack(); tracks.push(best); }
    feedTrack(best, h, t);
  }
  for (const tr of free) tr.miss++;
  tracks = tracks.filter((tr) => tr.miss <= T.keepFrames);
}

function feedTrack(tr, h, t) {
  tr.miss = 0;
  tr.side = h.handedness || null;
  tr.p = h.keypoints.map((k, i) => {
    const q = toScreen(k);
    return { x: tr.f2[i * 2].step(q.x, t), y: tr.f2[i * 2 + 1].step(q.y, t) };
  });
  const has3 = h.keypoints3D && h.keypoints3D.length === 21;
  tr.w = tr.p.map((q, i) => {
    if (!has3) return [-q.x, q.y, 0];
    const k = h.keypoints3D[i];
    return [tr.f3[i * 3].step(k.x, t), tr.f3[i * 3 + 1].step(k.y, t), tr.f3[i * 3 + 2].step(k.z || 0, t)];
  });

  // fit the 3D hand onto the screen (weak perspective): pixels per 3D unit, and axis directions
  let mx = 0, my = 0, ax = 0, ay = 0;
  for (let i = 0; i < 21; i++) { mx += tr.p[i].x; my += tr.p[i].y; ax += tr.w[i][0]; ay += tr.w[i][1]; }
  mx /= 21; my /= 21; ax /= 21; ay /= 21;
  let nx = 0, ny = 0, den = 0;
  for (let i = 0; i < 21; i++) {
    const wx = tr.w[i][0] - ax, wy = tr.w[i][1] - ay;
    nx += (tr.p[i].x - mx) * wx; ny += (tr.p[i].y - my) * wy; den += wx * wx + wy * wy;
  }
  const s = den > 0 ? (Math.abs(nx) + Math.abs(ny)) / den : 1;
  tr.sgx = nx < 0 ? -1 : 1;
  tr.sgy = ny < 0 ? -1 : 1;
  tr.u = Math.max(20, s * len3(tr.w[0], tr.w[9]));     // true palm length in pixels, whatever the tilt
}

// direction from landmark a to b using the 3D pose: screen angle + foreshortening factor
function aim(tr, a, b) {
  const A = tr.w[a], B = tr.w[b];
  const L = len3(A, B) || 1;
  let x = tr.sgx * (B[0] - A[0]) / L, y = tr.sgy * (B[1] - A[1]) / L;
  let f = Math.hypot(x, y);
  if (f < 0.3) { const d = dir(tr.p[a], tr.p[b]); x = d.x; y = d.y; f = 0.35; } else { x /= f; y /= f; }
  return { x, y, a: Math.atan2(y, x), f: Math.max(0.35, f) };
}

// ---------- gesture measurement (3D, rotation and distance independent) ----------
function len3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function R(tr, i, j) { return len3(tr.w[i], tr.w[j]) / (len3(tr.w[0], tr.w[9]) || 1); }

function angle3(u, v) {
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const m = Math.hypot(...u) * Math.hypot(...v) || 1;
  return Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180 / Math.PI;
}
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function angleAt(tr, a, b, c) { return angle3(sub3(tr.w[a], tr.w[b]), sub3(tr.w[c], tr.w[b])); }

// 0 = straight finger, 1 = fully folded
function curl(tr, name) {
  const [mcp, pip, dip] = FINGERS[name];
  const bend = (180 - angleAt(tr, 0, mcp, pip)) + (180 - angleAt(tr, mcp, pip, dip));
  return Math.max(0, Math.min(1, (bend - 15) / 170));
}

function measure(tr) {
  const m = {
    cI: curl(tr, "index"), cM: curl(tr, "middle"), cR: curl(tr, "ring"), cP: curl(tr, "pinky"),
    tI: R(tr, 4, 8), tM: R(tr, 4, 12), tR: R(tr, 4, 16),      // thumb tip to fingertips
    im: R(tr, 8, 12), mr: R(tr, 12, 16), rp: R(tr, 16, 20),   // gaps between neighbouring fingertips
    thumbOut: R(tr, 4, 5),
    thumbPalm: Math.min(R(tr, 4, 9), R(tr, 4, 13)),
    splay: angle3(sub3(tr.w[8], tr.w[5]), sub3(tr.w[20], tr.w[17]))
  };
  m.avg = (m.cI + m.cM + m.cR + m.cP) / 4;
  return m;
}

// soft thresholds: 1 when clearly true, 0 when clearly false
function lt(v, thr, w = T.soft) { return Math.max(0, Math.min(1, (thr + w - v) / (2 * w))); }
function gt(v, thr, w = T.soft) { return 1 - lt(v, thr, w); }

function scoreAll(m) {
  const s = T.straight, f = T.folded, j = T.joined;
  return {
    deer: Math.min(lt(m.tM, T.pinch), lt(m.tR, T.pinch + 0.06), lt(m.cI, s), lt(m.cP, s + 0.06), gt(m.tI, 0.5)),
    swan: Math.min(lt(m.tI, T.pinch - 0.08), lt(m.tM, T.pinch - 0.05), lt(m.im, j), lt(m.mr, j + 0.04), lt(m.rp, j + 0.08), lt(m.avg, 0.7)),
    dog: Math.min(lt(m.im, j), lt(m.rp, j + 0.05), gt(m.mr, T.dogGap), gt(m.mr / (Math.max(m.im, m.rp) + 0.01), 1.5, 0.25),
                  gt(m.thumbOut, T.thumbOut), lt(m.cM, 0.5), lt(m.cR, 0.5)),
    lotus: Math.min(lt(m.cI, s), lt(m.cM, s), lt(m.cR, s), lt(m.cP, s + 0.05), gt(m.thumbOut, T.thumbOut + 0.1),
                    gt(m.splay, T.splay, 8), gt(Math.min(m.im, m.mr, m.rp), 0.3)),
    crocodile: Math.min(lt(m.cI, s), lt(m.cM, s), lt(m.cR, s), lt(m.cP, s + 0.05), lt(m.im, j - 0.04), lt(m.mr, j - 0.04),
                        lt(m.rp, j), gt(m.tI, 0.5), gt(m.thumbPalm, T.thumbIn + 0.04)),
    snake: Math.min(lt(m.thumbPalm, T.thumbIn), gt(m.avg, 0.1, 0.04), lt(m.avg, 0.62), gt(m.tM, 0.55)),
    rabbit: Math.min(lt(m.cI, s), lt(m.cM, s), gt(m.cR, f), gt(m.cP, f)),
    bull: Math.min(gt(m.cI, f), gt(m.cM, f), gt(m.cR, f), lt(m.cP, s + 0.05), gt(m.thumbOut, T.thumbOut)),
    turtle: Math.min(gt(m.cI, f), gt(m.cM, f), gt(m.cR, f), gt(m.cP, f), gt(m.thumbOut, T.thumbOut)),
  };
}

function openness(tr) {
  const c = ["index", "middle", "ring", "pinky"].map((f) => curl(tr, f)).sort((a, b) => a - b);
  return lt(c[2], 0.42);                                  // at least three fingers open
}

function pick() {
  let best = null, bs = 0, bt = null;
  const live = tracks.filter((tr) => tr.miss === 0);

  for (const tr of live) {
    const raw = scoreAll(measure(tr));
    for (const k in raw) {
      tr.scores[k] = lerp(tr.scores[k] || 0, raw[k], T.blend);
      if (tr.scores[k] > bs) { bs = tr.scores[k]; best = k; bt = tr; }
    }
  }

  // bird needs both hands: open, with the thumbs close together
  let rawBird = 0;
  if (live.length >= 2) {
    const [a, b] = live;
    let near = Infinity;
    for (const i of [1, 2, 3, 4]) for (const j of [1, 2, 3, 4]) near = min(near, dist(a.p[i].x, a.p[i].y, b.p[j].x, b.p[j].y));
    rawBird = Math.min(lt(near / ((a.u + b.u) / 2), 0.9, 0.2), openness(a), openness(b));
    if (rawBird > 0.3) birdPair = [a, b];
  }
  if (live.length >= 2 || tracks.length < 2) birdScore = lerp(birdScore, rawBird, T.blend);
  if (birdScore > T.enter) { bs = birdScore + 1; best = "bird"; bt = null; }   // two hands win over one

  const cur = !target ? 0 : target === "bird" ? birdScore
            : (activeTrack && tracks.includes(activeTrack) ? activeTrack.scores[target] || 0 : 0);
  const challenger = best !== target && bs > T.enter && bs > cur + 0.2;
  if (target && cur > T.exit && !challenger) { /* hold on to the current shape */ }
  else if (bs > T.enter) { target = best; activeTrack = bt; }
  else if (cur <= T.exit) target = null;

  if (debug) {
    const tr = live[0];
    lastDebug = !tr ? "no hand" :
      Object.entries(measure(tr)).map(([k, v]) => k.padEnd(10) + v.toFixed(2)).join("\n") + "\n\n" +
      Object.entries(tr.scores).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k.padEnd(10) + v.toFixed(2)).join("\n") +
      "\nbird      " + birdScore.toFixed(2) + "\n\n-> " + (current || "none");
  }
}

function updateState() {
  if (current !== target) {
    grow -= 0.08;
    if (grow <= 0) { grow = 0; current = target; highlight(current); }
  } else if (current) {
    grow = min(1, grow + 0.018);
  }
  if (frameCount % 15 === 0) setStatus(!tracks.length ? "show a hand to the camera" : current ? current : "make a shape");
}

function setStatus(s) { const el = document.getElementById("status"); if (el) el.textContent = s; }
function highlight(name) {
  document.querySelectorAll("#legend li").forEach((li) => li.classList.toggle("on", li.dataset.g === name));
}

// ---------- ASCII line toolkit ----------
function glyphFor(dx, dy) {
  const a = ((Math.atan2(dy, dx) % PI) + PI) % PI;
  return ["-", "\\", "|", "/"][Math.round(a / QUARTER_PI) % 4];
}

function glyph(ch, x, y, alpha = 255) {
  fill(255, alpha * (0.65 + 0.35 * noise(x * 0.03, y * 0.03, frameCount * 0.04)));
  text(ch, x, y);
}

function asciiLine(x1, y1, x2, y2, t = 1, ch) {
  const len = dist(x1, y1, x2, y2);
  const n = max(1, floor(len / STEP));
  const c = ch || glyphFor(x2 - x1, y2 - y1);
  const m = floor(n * constrain(t, 0, 1));
  for (let i = 0; i <= m; i++) glyph(c, lerp(x1, x2, i / n), lerp(y1, y2, i / n));
}

function asciiPath(pts, t = 1, ch) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  let budget = total * constrain(t, 0, 1);
  for (let i = 1; i < pts.length && budget > 0; i++) {
    const a = pts[i - 1], b = pts[i];
    const l = dist(a.x, a.y, b.x, b.y) || 1;
    asciiLine(a.x, a.y, b.x, b.y, min(1, budget / l), ch);
    budget -= l;
  }
}

function ray(x, y, a, L, t = 1, ch) { asciiLine(x, y, x + cos(a) * L, y + sin(a) * L, t, ch); }

// closed (or partial) ellipse as a list of points
function ringPts(cx, cy, rx, ry, rot = 0, from = 0, to = TWO_PI, n = 18) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const th = lerp(from, to, i / n), x = cos(th) * rx, y = sin(th) * ry;
    out.push({ x: cx + x * cos(rot) - y * sin(rot), y: cy + x * sin(rot) + y * cos(rot) });
  }
  return out;
}

// tapering, bending limb (horn, trunk, tusk); returns its end point
function limb(x, y, a, L, w0, w1, bend, t, marks) {
  const l = [], r = [], n = 14;
  let cx = x, cy = y, ang = a;
  for (let i = 0; i <= n; i++) {
    const s = i / n, w = lerp(w0, w1, s);
    ang = a + bend * s;
    l.push({ x: cx - sin(ang) * w, y: cy + cos(ang) * w });
    r.push({ x: cx + sin(ang) * w, y: cy - cos(ang) * w });
    if (marks && i % 2 === 1 && s < t) glyph(marks, cx, cy, 140);
    if (i < n) { cx += cos(ang) * L / n; cy += sin(ang) * L / n; }
  }
  asciiPath(l, t);
  asciiPath(r, t);
  return { x: cx, y: cy, a: ang };
}

// rippling body that trails from the wrist down the forearm (snake, crocodile tail)
function trail(tr, g, N, amp, width, marks) {
  const p = tr.p, u = tr.u;
  const d = aim(tr, 9, 0);
  const n = { x: -d.y, y: d.x };
  const left = [], right = [];
  for (let i = 0; i < N; i++) {
    const s = i * u * 0.2;
    const wave = sin(i * 0.42 - frameCount * 0.09) * u * amp * min(1, i / 7);
    const w = u * width * (1 - i / N);
    const cx = p[0].x + d.x * s + n.x * wave, cy = p[0].y + d.y * s + n.y * wave;
    left.push({ x: cx + n.x * w, y: cy + n.y * w });
    right.push({ x: cx - n.x * w, y: cy - n.y * w });
    if (i % 3 === 1 && i / N < g) glyph(marks[i % marks.length], cx, cy, 150);
  }
  asciiPath(left, g);
  asciiPath(right, g);
}

function big(ch, x, y, size) { push(); textSize(size); glyph(ch, x, y); pop(); }
function mid(a, b, t = 0.5) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }
function dir(a, b) { const l = dist(a.x, a.y, b.x, b.y) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; }
function stage(g, i, n) { return constrain(g * n - i, 0, 1); }   // i-th of n sequential growth stages

// drifting specks around a point
function motes(cx, cy, r, chars, g, count = 14) {
  for (let i = 0; i < count; i++) {
    const life = (frameCount * 0.006 + i / count) % 1;
    const a = i * 2.4 + noise(i) * 3;
    const x = cx + cos(a) * r * (0.3 + noise(i, 7)) + sin(frameCount * 0.02 + i) * 8;
    const y = cy + sin(a) * r * 0.5 - life * r * 1.4;
    glyph(chars[i % chars.length], x, y, 255 * g * sin(life * PI));
  }
}

function petal(x, y, a, L, W, t) {
  if (t <= 0 || L < 4) return;
  const l = [], r = [];
  for (let i = 0; i <= 10; i++) {
    const s = i / 10, along = s * L, w = pow(sin(PI * s), 0.8) * W;
    l.push({ x: x + cos(a) * along - sin(a) * w, y: y + sin(a) * along + cos(a) * w });
    r.push({ x: x + cos(a) * along + sin(a) * w, y: y + sin(a) * along - cos(a) * w });
  }
  asciiPath(l, t);
  asciiPath(r, t);
  ray(x, y, a, L * 0.6 * t, 1, ".");
}

// ---------- deer: antlers branch out of the two lifted fingers ----------
function antler(x, y, a, len, depth, g, side) {
  if (depth > 4) return;
  const t = stage(g, depth, 5);
  if (t <= 0) return;
  a += sin(frameCount * 0.02 + depth) * 0.03;
  const ex = x + cos(a) * len * t, ey = y + sin(a) * len * t;
  asciiLine(x, y, ex, ey);
  antler(ex, ey, a + side * 0.18, len * 0.72, depth + 1, g, side);
  antler(ex, ey, a - side * 0.75, len * 0.5, depth + 1, g, -side);
}

function drawDeer(tr, g) {
  const p = tr.p, u = tr.u;
  const out = Math.sign(p[20].x - p[8].x) || 1;
  for (const [tip, base, side] of [[8, 5, -out], [20, 17, out]]) {
    const d = aim(tr, base, tip);
    antler(p[tip].x, p[tip].y, d.a, u * 0.95 * d.f, 0, g, side * (d.y < 0 ? 1 : -1));
  }
  const nose = mid(p[4], p[12]), eye = mid(p[5], p[9]);
  // if (g > 0.15) big("o", eye.x, eye.y + u * 0.15, u * 0.3);
  if (g > 0.3) big("*", nose.x, nose.y, u * 0.35);
  motes(mid(p[8], p[20]).x, mid(p[8], p[20]).y - u, u * 2.2, [".", "+", "'", "*"], g);
}

// ---------- snake: the hand is the head, a body ripples down the arm ----------
function drawSnake(tr, g) {
  const p = tr.p, u = tr.u;
  trail(tr, g, 46, 0.55, 0.3, ["<", ">"]);
  const f = aim(tr, 9, 12);
  const flick = max(0, sin(frameCount * 0.12)) * g;
  const L = u * 0.7 * flick * f.f;
  const tx = p[12].x + f.x * L, ty = p[12].y + f.y * L;
  if (flick > 0.05) {
    asciiLine(p[12].x, p[12].y, tx, ty);
    ray(tx, ty, f.a + 0.5, u * 0.28);
    ray(tx, ty, f.a - 0.5, u * 0.28);
  }
  const eye = mid(p[5], p[6]);
  if (g > 0.1) big("@", eye.x, eye.y, u * 0.28);
  if (g > 0.5) for (let i = 0; i < 4; i++) glyph("s", tx + f.x * (20 + i * 16), ty + f.y * (20 + i * 16) + sin(frameCount * 0.1 + i) * 5, 200 * flick);
}

// ---------- lotus: a petal opens from every fingertip ----------
function drawLotus(tr, g) {
  const p = tr.p, u = tr.u;
  const tips = [[2, 4], [5, 8], [9, 12], [13, 16], [17, 20]];
  const breathe = 1 + sin(frameCount * 0.03) * 0.05;
  for (const [b, t] of tips) {
    const d = aim(tr, b, t);
    petal(p[t].x, p[t].y, d.a, u * 1.25 * breathe * d.f, u * 0.32, stage(g, 0, 2));
  }
  const c = mid(p[0], p[9], 0.6);
  for (let i = 0; i < tips.length - 1; i++) {
    const m = mid(p[tips[i][1]], p[tips[i + 1][1]]);
    const d = dir(c, m);
    petal(m.x, m.y, atan2(d.y, d.x), u * 0.8 * breathe, u * 0.22, stage(g, 1, 2));
  }
  for (let i = 0; i < 9; i++) {
    const a = i * TWO_PI / 9 + frameCount * 0.01;
    glyph(i % 2 ? "*" : ":", c.x + cos(a) * u * 0.25, c.y + sin(a) * u * 0.25, 255 * g);
  }
  for (let row = 0; row < 3; row++) {
    const w = u * (1.6 + row * 0.9) * g;
    const y = p[0].y + u * (0.5 + row * 0.35);
    const x = p[0].x + sin(frameCount * 0.03 + row) * 10;
    asciiLine(x - w, y, x + w, y, 1, row % 2 ? "~" : "-");
  }
}

// ---------- bird: two hands are wings, the locked thumbs are the head ----------
function drawBird(A, B, g) {
  const u = (A.u + B.u) / 2;
  const flap = sin(frameCount * 0.08);
  [A, B].forEach((tr, k) => {
    for (const [b, t] of [[5, 8], [9, 12], [13, 16], [17, 20]]) {
      const d = aim(tr, b, t);
      const a = d.a + flap * 0.08 * (k ? 1 : -1);
      const L = u * (1.3 + 0.15 * flap) * d.f;
      ray(tr.p[t].x, tr.p[t].y, a, L, g);
      for (const o of [-0.16, 0.16]) ray(tr.p[t].x, tr.p[t].y, a + o, L * 0.7, g);
    }
  });
  const th = mid(A.p[4], B.p[4]), wr = mid(A.p[0], B.p[0]);
  const up = dir(wr, th);
  const h = { x: th.x + up.x * u * 0.45, y: th.y + up.y * u * 0.45 };
  asciiPath(ringPts(h.x, h.y, u * 0.32, u * 0.32), stage(g, 0, 2));
  if (g > 0.4) {
    big("o", h.x + u * 0.08, h.y - u * 0.05, u * 0.22);
    asciiPath([{ x: h.x + u * 0.3, y: h.y - u * 0.1 }, { x: h.x + u * 0.75, y: h.y + u * 0.04 }, { x: h.x + u * 0.3, y: h.y + u * 0.14 }], stage(g, 1, 2));
  }
  const down = atan2(-up.y, -up.x);
  for (const o of [-0.35, -0.12, 0.12, 0.35]) ray(wr.x, wr.y, down + o, u * 1.3 * g);
  motes(h.x, h.y - u, u * 3, ["v", "v", "~", "v"], g, 10);
}

// ---------- dog: thumb is the ear, the gap between fingers is the mouth ----------
function drawDog(tr, g) {
  const p = tr.p, u = tr.u;
  const td = aim(tr, 2, 4);
  const tn = { x: -td.y, y: td.x };
  asciiPath([
    { x: p[3].x + tn.x * u * 0.3, y: p[3].y + tn.y * u * 0.3 },
    { x: p[4].x + td.x * u * 0.75 * td.f, y: p[4].y + td.y * u * 0.75 * td.f },
    { x: p[3].x - tn.x * u * 0.3, y: p[3].y - tn.y * u * 0.3 }
  ], stage(g, 0, 3));

  const eye = mid(mid(p[5], p[9]), p[0], 0.12);
  if (g > 0.15) big("@", eye.x, eye.y, u * 0.3);
  const f = aim(tr, 9, 12);
  const nose = mid(p[8], p[12]);
  if (g > 0.3) big("O", nose.x + f.x * u * 0.15, nose.y + f.y * u * 0.15, u * 0.4);

  const wb = mid(p[7], p[11]);
  for (const sgn of [-1, 1]) for (const o of [-0.3, 0, 0.3]) ray(wb.x, wb.y, f.a + sgn * HALF_PI + o, u * 0.55, stage(g, 1, 3));

  const m0 = mid(p[11], p[15]);
  const jaw = dir(p[12], p[16]);
  const wob = sin(frameCount * 0.15) * u * 0.06;
  const tongue = [];
  for (let i = 0; i <= 8; i++) {
    const s = i / 8, k = u * 0.35 * s * s + wob * s;
    tongue.push({ x: m0.x + f.x * u * 0.7 * s + jaw.x * k, y: m0.y + f.y * u * 0.7 * s + jaw.y * k });
  }
  asciiPath(tongue, stage(g, 2, 3), "U");

  const wd = dir(p[5], p[17]);
  asciiLine(p[0].x - wd.x * u * 0.5, p[0].y - wd.y * u * 0.5, p[0].x + wd.x * u * 0.5, p[0].y + wd.y * u * 0.5, g, "=");
  if (g > 0.6) glyph("o", p[0].x - f.x * u * 0.2, p[0].y - f.y * u * 0.2);

  if (R(tr, 12, 16) > 0.85 && g > 0.5) shout("WOOF", mid(p[12], p[16]), f, u);
}

function shout(word, from, f, u) {
  push();
  textSize(u * 0.3);
  const b = (frameCount * 0.03) % 1;
  glyph(word, from.x + f.x * u * (0.9 + b), from.y + f.y * u * (0.9 + b), 255 * (1 - b));
  pop();
}

// ---------- rabbit: two lifted fingers are the ears ----------
function drawRabbit(tr, g) {
  const p = tr.p, u = tr.u;
  [8, 12].forEach((tip, k) => {
    const d = aim(tr, tip - 3, tip);
    const twitch = sin(frameCount * 0.05 + k * 2) > 0.92 ? 0.12 : 0;
    petal(p[tip].x, p[tip].y, d.a + (k ? 1 : -1) * twitch, u * 1.4 * d.f, u * 0.22, stage(g, 0, 2));
  });
  const eye = mid(mid(p[5], p[9]), p[0], 0.25);
  if (g > 0.2) big("o", eye.x, eye.y, u * 0.28);
  const nose = p[4];
  if (g > 0.4) {
    big("Y", nose.x, nose.y, u * 0.3);
    const f = dir(p[0], p[9]);
    const a = atan2(f.y, f.x);
    for (const sgn of [-1, 1]) for (const o of [-0.25, 0, 0.25]) ray(nose.x, nose.y, a + sgn * HALF_PI + o, u * 0.5, stage(g, 1, 2));
  }
  const back = dir(p[9], p[0]);
  const tail = { x: p[0].x + back.x * u * 0.35, y: p[0].y + back.y * u * 0.35 };
  asciiPath(ringPts(tail.x, tail.y, u * 0.22, u * 0.22, 0, 0, TWO_PI, 10), g, "*");
  motes(p[9].x, p[9].y, u * 2, [".", "'", "."], g, 8);
}

// ---------- swan: pinched fingers are the beak, the arm is the neck ----------
function drawSwan(tr, g) {
  const p = tr.p, u = tr.u;
  const tip = mid(p[4], p[8]);
  const f = dir(p[5], tip);
  const n = { x: -f.y, y: f.x };
  asciiPath([
    { x: tip.x + n.x * u * 0.14, y: tip.y + n.y * u * 0.14 },
    { x: tip.x + f.x * u * 0.5, y: tip.y + f.y * u * 0.5 },
    { x: tip.x - n.x * u * 0.14, y: tip.y - n.y * u * 0.14 }
  ], stage(g, 0, 3));
  if (g > 0.1) big("o", p[6].x, p[6].y, u * 0.24);

  // neck curves down the forearm into a body
  const d = aim(tr, 9, 0);
  let m = { x: -d.y, y: d.x };
  if (m.y < 0) m = { x: -m.x, y: -m.y };
  const neckA = [], neckB = [];
  let end = p[0];
  for (let i = 0; i <= 16; i++) {
    const s = i / 16, bow = sin(s * PI) * u * 0.45;
    end = { x: p[0].x + d.x * u * 2.2 * s - m.x * bow, y: p[0].y + d.y * u * 2.2 * s - m.y * bow };
    neckA.push({ x: end.x + m.x * u * 0.16, y: end.y + m.y * u * 0.16 });
    neckB.push({ x: end.x - m.x * u * 0.16, y: end.y - m.y * u * 0.16 });
  }
  asciiPath(neckA, stage(g, 0, 3));
  asciiPath(neckB, stage(g, 0, 3));
  const B = { x: end.x + d.x * u * 0.7, y: end.y + u * 0.35 };
  asciiPath(ringPts(B.x, B.y, u * 1.1, u * 0.55), stage(g, 1, 3));
  for (let i = 0; i < 4; i++) {
    const lift = sin(frameCount * 0.04 + i) * 0.05;
    asciiPath(ringPts(B.x + u * 0.1 * i, B.y - u * 0.1, u * (0.9 - i * 0.15), u * (0.75 - i * 0.12), -0.5 + lift, PI, PI * 1.7, 8), stage(g, 2, 3));
  }
  for (let row = 0; row < 3; row++) {
    const w = u * (1.6 + row * 0.7) * g, y = B.y + u * (0.6 + row * 0.3);
    const x = B.x + sin(frameCount * 0.03 + row) * 10;
    asciiLine(x - w, y, x + w, y, 1, row % 2 ? "-" : "~");
  }
}

// ---------- crocodile: flat fingers are the top jaw, the thumb is the bottom ----------
function drawCrocodile(tr, g) {
  const p = tr.p, u = tr.u;
  const jaw = dir(p[8], p[4]);
  const n = 9;
  for (let i = 0; i < n * stage(g, 0, 2); i++) {
    const q = mid(p[5], p[8], i / (n - 1));
    glyph("V", q.x + jaw.x * u * 0.14, q.y + jaw.y * u * 0.14);
    if (i < 6) { const r = mid(p[2], p[4], i / 5); glyph("A", r.x - jaw.x * u * 0.14, r.y - jaw.y * u * 0.14); }
  }
  const eye = { x: p[9].x - jaw.x * u * 0.35, y: p[9].y - jaw.y * u * 0.35 };
  asciiPath(ringPts(eye.x, eye.y, u * 0.2, u * 0.2, 0, 0, TWO_PI, 10), stage(g, 0, 2));
  if (g > 0.2) big("@", eye.x, eye.y, u * 0.2);
  if (g > 0.3) glyph("o", p[12].x - jaw.x * u * 0.15, p[12].y - jaw.y * u * 0.15);
  // ridged back along the little-finger edge, then the tail
  for (let i = 0; i < 6 * g; i++) { const q = mid(p[17], p[0], i / 5); glyph("^", q.x - jaw.x * u * 0.3, q.y - jaw.y * u * 0.3); }
  trail(tr, stage(g, 1, 2), 34, 0.4, 0.34, ["^", "A"]);
  if (R(tr, 4, 8) < 0.45 && g > 0.5) shout("SNAP", p[8], aim(tr, 5, 8), u);
}

// ---------- bull: thumb and little finger are the horns ----------
function drawBull(tr, g) {
  const p = tr.p, u = tr.u;
  const fwd = dir(p[0], p[9]);
  const fa = atan2(fwd.y, fwd.x);
  for (const [b, t] of [[2, 4], [17, 20]]) {
    const d = aim(tr, b, t);
    let turn = fa - d.a;
    turn = atan2(sin(turn), cos(turn));
    limb(p[t].x, p[t].y, d.a, u * 1.3 * d.f, u * 0.17, u * 0.02, Math.sign(turn || 1) * 1.2, stage(g, 0, 2));
  }
  const e1 = mid(p[5], p[9]), e2 = mid(p[13], p[17]);
  if (g > 0.2) { big("o", e1.x, e1.y, u * 0.26); big("o", e2.x, e2.y, u * 0.26); }
  const nose = mid(p[10], p[14]);
  const nz = { x: nose.x + fwd.x * u * 0.25, y: nose.y + fwd.y * u * 0.25 };
  asciiPath(ringPts(nz.x, nz.y, u * 0.2, u * 0.2, 0, 0, TWO_PI, 10), stage(g, 1, 2), "o");
  if (g > 0.5) {
    const snort = max(0, sin(frameCount * 0.06));
    for (const sgn of [-1, 1]) for (let i = 1; i < 4; i++) {
      glyph("~", nz.x + fwd.x * u * 0.3 * i * snort + sgn * -fwd.y * u * 0.15 * i, nz.y + fwd.y * u * 0.3 * i * snort + sgn * fwd.x * u * 0.15 * i, 220 * snort);
    }
  }
}

// ---------- turtle: the fist is the shell, the thumb is the head ----------
function drawTurtle(tr, g) {
  const p = tr.p, u = tr.u;
  const c = { x: (p[0].x + p[5].x + p[17].x + p[9].x) / 4, y: (p[0].y + p[5].y + p[17].y + p[9].y) / 4 };
  const rot = atan2(p[9].y - p[0].y, p[9].x - p[0].x);
  const Rr = u * 0.85;
  asciiPath(ringPts(c.x, c.y, Rr, Rr * 0.8, rot, 0, TWO_PI, 22), stage(g, 0, 3));
  asciiPath(ringPts(c.x, c.y, Rr * 0.45, Rr * 0.36, rot, 0, TWO_PI, 6), stage(g, 1, 3));
  for (let i = 0; i < 6; i++) {
    const a = rot + i * TWO_PI / 6;
    asciiLine(c.x + cos(a) * Rr * 0.45, c.y + sin(a) * Rr * 0.4, c.x + cos(a) * Rr * 0.95, c.y + sin(a) * Rr * 0.78, stage(g, 1, 3));
  }
  // head on the thumb
  const d = aim(tr, 2, 4);
  const bob = sin(frameCount * 0.04) * u * 0.05;
  const h = { x: p[4].x + d.x * (u * 0.25 + bob), y: p[4].y + d.y * (u * 0.25 + bob) };
  asciiPath(ringPts(h.x, h.y, u * 0.24, u * 0.2, d.a, 0, TWO_PI, 10), stage(g, 2, 3));
  if (g > 0.7) glyph(".", h.x + d.x * u * 0.08, h.y + d.y * u * 0.08 - u * 0.05);
  // legs + tail
  for (const o of [0.7, -0.7, 2.4, -2.4]) {
    const a = rot + o + sin(frameCount * 0.05 + o) * 0.12;
    ray(c.x + cos(a) * Rr * 0.9, c.y + sin(a) * Rr * 0.75, a, u * 0.35, stage(g, 2, 3), "U");
  }
  ray(c.x - cos(d.a) * Rr, c.y - sin(d.a) * Rr * 0.8, d.a + PI, u * 0.3, stage(g, 2, 3));
}

const DRAW = {
  deer: drawDeer, snake: drawSnake, lotus: drawLotus, dog: drawDog, rabbit: drawRabbit, swan: drawSwan,
  crocodile: drawCrocodile, bull: drawBull, turtle: drawTurtle
};

// ---------- the animal's symbol, typed out beside the hand ----------
function drawSymbol(p, u, g) {
  // const art = ART[current];
  const size = constrain(u * 0.16, 11, 18);
  push();
  textSize(size);
  textAlign(LEFT, TOP);
  const cw = textWidth("M"), lh = size * 1.15;
  // const cols = Math.max(...art.map((r) => r.length));
  const bw = cw * 10;
  let minX = Infinity, maxX = -Infinity, minY = Infinity;
  for (const q of p) { minX = min(minX, q.x); maxX = max(maxX, q.x); minY = min(minY, q.y); }
  let x = maxX + u * 2;
  if (x + bw > width - 10) x = minX - u * 2 - bw;
  x = constrain(x, 10, max(10, width - bw - 10));
  const y = constrain(minY - u * 0.3, 60, max(60, height - lh ));

  // // let shown = floor(art.length * cols * g);
  // for (let r = 0; r < art.length && shown > 0; r++) {
  //   for (let c = 0; c < cols && shown > 0; c++, shown--) {
  //     // const ch = art[r][c];
  //     if (ch && ch !== " ") glyph(ch, x + c * cw, y + r * lh);
  //   }
  // }
  if (g > 0.7) {
    fill(255, 255 * (g - 0.7) / 0.3);
    text(current.split("").join(" "), x + cw, y + lh);
  }
  pop();
}