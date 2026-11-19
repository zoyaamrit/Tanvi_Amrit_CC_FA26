// Shadow Animals — p5.js + ml5.js handPose
// Make a shadow-puppet hand shape; the animal grows out of your hand in white ASCII lines.
// Once an animal appears it stays until you make a fist.
//
// How shapes are read
//  - 3D landmarks (metres, centred on the hand) for everything about the hand's own shape: how bent
//    each finger is, which fingertips touch, how far apart they are. These stay the same when the hand
//    turns or moves nearer / farther, and fingers that only overlap on screen are not read as touching.
//  - Screen positions for everything about direction on screen: crocodile (thumb below the fingers,
//    fingers roughly level), dog (thumb pointing up), and bird (two hands meeting at the thumbs —
//    each hand's 3D points are centred on that hand, so they cannot be compared across hands).
//  - Screen distances are divided by the palm's true length in pixels (from the 3D pose), so they
//    don't shrink when the hand tilts.

// ---------- tuning (distances are in palm lengths: wrist -> middle knuckle) ----------
const T = {
  enter: 0.5,        // score needed to start locking a shape
  lockMs: 350,       // how long a shape must hold before it locks in
  blend: 0.35,       // how fast scores follow the hand (lower = steadier, slower)
  soft: 0.12,        // leeway around every threshold below
  fistOn: 0.55,      // fist score that counts as a fist
  fistOff: 0.3,      // fist score that counts as released
  fistMs: 250,       // how long the fist must hold to reset
  cooldownMs: 500,   // pause after releasing the fist before a new shape can lock
  lostMs: 4000,      // no hand for this long also resets
  pinch: 0.5,        // thumb tip touching a fingertip (3D)
  straight: 0.35,    // curl below this = finger lifted (3D)
  folded: 0.5,       // curl above this = finger folded (3D)
  joined: 0.45,      // neighbouring fingertips together (3D)
  apart: 0.27,       // neighbouring fingertips separated (3D)
  dogGap: 0.4,       // dog: gap between middle and ring (3D)
  thumbOut: 0.62,    // thumb tip this far from the pointer knuckle = thumb out (3D)
  thumbIn: 0.6,      // snake: thumb tip this close to the palm (3D)
  below: 0.15,       // crocodile: thumb tip this far below the finger line (screen)
  level: 0.45,       // crocodile: fingers within ~63° of horizontal (screen)
  thumbUp: 0.1,      // dog: thumb tip this far above its base (screen)
  birdNear: 1.0,     // bird: thumbs this close to the other hand (screen)
  cut2D: 1.4, beta2D: 0.012,   // One Euro smoothing, screen pixels
  cut3D: 1.0, beta3D: 25       // One Euro smoothing, metres
};

const FINGERS = { index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20] };
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
               [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

const ART = {
  deer:      [" \\|/     \\|/", "  \\\\_____//", "  /  o o  \\", "  \\   ^   /", "   \\__v__/"],
  snake:     ["     ____", " ~<=( o  )__", "     \\__    \\", "   ____/    /", "  (________/"],
  bird:      ["\\\\\\       ///", " \\\\\\\\ _  ////", "  \\\\\\(o>///", "    \\(  )/", "      ^^"],
  dog:       ["  /\\____", " /  o   \\___", " \\         @)", "  \\___  ___/", "      \\U/"],
  rabbit:    ["  (\\ /)", "  ( V )", "  (o.o)", "  (> <)", " (\")_(\")"],
  swan:      ["      __", "    <(o )", "      ) /", " ____/ (", "(  ~~   )", " \\_____/", "~~~~~~~~~~"],
  crocodile: ["        ___  __", " ______/ o \\/  \\_____", "<VVVVVVV       _____/", " \\^^^^^^^_____/"],
  bull:      [" (\\       /)", "  \\\\_____//", "  /  o o  \\", "  \\  ___  /", "   \\(o.o)/"],
  turtle:    ["     _____", "   /\\_/\\_/\\  _", " _/_/\\_/\\_\\_/o)", "(__________/\"", "  U U   U U"],
  peacock:   [" @  @  @  @  @", "  \\ \\  |  / /", " @-\\ \\ | / /-@", "     ,(o>", "     (  )", "      \"\""]
};

let handPose, video;
let hands = [];                  // raw ml5 results
let H = [];                      // smoothed hands this frame (index 0 is "the" hand)
let filt = [];                   // smoothing state per hand slot
let birdScore = 0;
let current = null;              // locked animal
let shown = null, grow = 0;      // animal on screen + how far it has grown
let cand = null, candSince = 0;  // shape waiting to lock
let armed = true, fistSince = 0, cooldownUntil = 0, lastSeen = 0;
let showVideo = true, showHand = true, debug = false;
let GS = 13, STEP = 9;           // glyph size + spacing, set from the hand's size

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
  filt = [makeFilt(), makeFilt()];
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

  updateHands();
  detect();
  updateGrowth();

  if (showHand) H.forEach(drawHand);

  if (shown) {
    const g = 1 - pow(1 - grow, 3);
    noStroke();
    textAlign(CENTER, CENTER);
    if (shown === "bird") {
      if (H.length >= 2) {
        setGlyph((H[0].u + H[1].u) / 2);
        drawBird(H[0], H[1], g);
        drawSymbol(H[0].p.concat(H[1].p), (H[0].u + H[1].u) / 2, g);
      }
    } else if (H.length) {
      setGlyph(H[0].u);
      DRAW[shown](H[0], g);
      drawSymbol(H[0].p, H[0].u, g);
    }
  }

  setStatus(statusText());
  if (debug) drawDebug();
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

function drawHand(h) {
  const p = h.p;
  stroke(255, shown ? 60 : 130);
  strokeWeight(1);
  for (const [a, b] of BONES) line(p[a].x, p[a].y, p[b].x, p[b].y);
  noStroke();
  fill(255, shown ? 90 : 200);
  for (const q of p) circle(q.x, q.y, 3);
}

// ---------- smoothing ----------
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

function makeFilt() {
  return {
    f2: Array.from({ length: 42 }, () => new OneEuro(T.cut2D, T.beta2D)),
    f3: Array.from({ length: 63 }, () => new OneEuro(T.cut3D, T.beta3D)),
    scores: {}, fist: 0, last: null
  };
}

function updateHands() {
  const t = millis() / 1000;
  const list = hands.slice(0, 2);
  H = list.map((raw, i) => {
    let F = filt[i];
    const wrist = toScreen(raw.keypoints[0]);
    if (F.last && dist(wrist.x, wrist.y, F.last.p[0].x, F.last.p[0].y) > F.last.u * 3) F = filt[i] = makeFilt();   // jumped: start fresh
    const h = { p: [], w: [], u: 100, sgx: -1, sgy: 1, scores: F.scores, m: null };
    h.p = raw.keypoints.map((k, j) => {
      const q = toScreen(k);
      return { x: F.f2[j * 2].step(q.x, t), y: F.f2[j * 2 + 1].step(q.y, t) };
    });
    const has3 = raw.keypoints3D && raw.keypoints3D.length === 21;
    h.w = h.p.map((q, j) => {
      if (!has3) return [-q.x, q.y, 0];
      const k = raw.keypoints3D[j];
      return [F.f3[j * 3].step(k.x, t), F.f3[j * 3 + 1].step(k.y, t), F.f3[j * 3 + 2].step(k.z || 0, t)];
    });
    fitScale(h);
    F.last = h;
    return h;
  });
  for (let i = list.length; i < 2; i++) if (filt[i].last) filt[i] = makeFilt();
}

// fit the 3D hand onto the screen (weak perspective): pixels per 3D unit, and axis directions
function fitScale(h) {
  let mx = 0, my = 0, ax = 0, ay = 0;
  for (let i = 0; i < 21; i++) { mx += h.p[i].x; my += h.p[i].y; ax += h.w[i][0]; ay += h.w[i][1]; }
  mx /= 21; my /= 21; ax /= 21; ay /= 21;
  let nx = 0, ny = 0, den = 0;
  for (let i = 0; i < 21; i++) {
    const wx = h.w[i][0] - ax, wy = h.w[i][1] - ay;
    nx += (h.p[i].x - mx) * wx; ny += (h.p[i].y - my) * wy; den += wx * wx + wy * wy;
  }
  const s = den > 0 ? (Math.abs(nx) + Math.abs(ny)) / den : 1;
  h.sgx = nx < 0 ? -1 : 1;
  h.sgy = ny < 0 ? -1 : 1;
  h.u = Math.max(20, s * len3(h.w[0], h.w[9]));     // true palm length in pixels, whatever the tilt
}

// direction from landmark a to b using the 3D pose: screen angle + foreshortening factor
function aim(h, a, b) {
  const A = h.w[a], B = h.w[b];
  const L = len3(A, B) || 1;
  let x = h.sgx * (B[0] - A[0]) / L, y = h.sgy * (B[1] - A[1]) / L;
  let f = Math.hypot(x, y);
  if (f < 0.3) { const d = dir(h.p[a], h.p[b]); x = d.x; y = d.y; f = 0.35; } else { x /= f; y /= f; }
  return { x, y, a: Math.atan2(y, x), f: Math.max(0.35, f) };
}

// ---------- measurements ----------
function len3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function R(h, i, j) { return len3(h.w[i], h.w[j]) / (len3(h.w[0], h.w[9]) || 1); }

function angle3(u, v) {
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const m = Math.hypot(...u) * Math.hypot(...v) || 1;
  return Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180 / Math.PI;
}
function angleAt(h, a, b, c) { return angle3(sub3(h.w[a], h.w[b]), sub3(h.w[c], h.w[b])); }

// 0 = straight finger, 1 = fully folded
function curl(h, name) {
  const [mcp, pip, dip] = FINGERS[name];
  const bend = (180 - angleAt(h, 0, mcp, pip)) + (180 - angleAt(h, mcp, pip, dip));
  return Math.max(0, Math.min(1, (bend - 15) / 170));
}

function thumbCurl(h) {
  const bend = (180 - angleAt(h, 1, 2, 3)) + (180 - angleAt(h, 2, 3, 4));
  return Math.max(0, Math.min(1, (bend - 10) / 120));
}

function toPalm(h, i) {
  const c = [0, 1, 2].map((k) => (h.w[0][k] + h.w[5][k] + h.w[9][k] + h.w[13][k] + h.w[17][k]) / 5);
  return len3(h.w[i], c) / (len3(h.w[0], h.w[9]) || 1);
}

function measure(h) {
  const p = h.p, u = h.u;
  // screen: line along the fingers, and its normal pointing down the screen
  const d = dir(p[5], p[12]);
  let n = { x: -d.y, y: d.x };
  if (n.y < 0) n = { x: -n.x, y: -n.y };
  const m = {
    // 3D
    cI: curl(h, "index"), cM: curl(h, "middle"), cR: curl(h, "ring"), cP: curl(h, "pinky"), cT: thumbCurl(h),
    tI: R(h, 4, 8), tM: R(h, 4, 12), tR: R(h, 4, 16),              // thumb tip to fingertips
    im: R(h, 8, 12), mr: R(h, 12, 16), rp: R(h, 16, 20),           // gaps between neighbouring fingertips
    thumbOut: R(h, 4, 5),
    thumbPalm: Math.min(R(h, 4, 9), R(h, 4, 13), R(h, 4, 17), toPalm(h, 4)),
    thumbTuck: Math.min(R(h, 4, 6), R(h, 4, 7), R(h, 4, 10), R(h, 4, 11)),
    // screen
    below: ((p[4].x - p[5].x) * n.x + (p[4].y - p[5].y) * n.y) / u,
    level: Math.abs(d.x),
    thumbUp: (p[2].y - p[4].y) / u
  };
  m.avg = (m.cI + m.cM + m.cR + m.cP) / 4;
  return m;
}

// soft thresholds: 1 when clearly true, 0 when clearly false, a ramp of ±w in between
function lt(v, thr, w = T.soft) { return Math.max(0, Math.min(1, (thr + w - v) / (2 * w))); }
function gt(v, thr, w = T.soft) { return 1 - lt(v, thr, w); }

function scoreAll(m) {
  const s = T.straight, f = T.folded, j = T.joined;
  return {
    deer: Math.min(lt(m.tM, T.pinch), lt(m.tR, T.pinch + 0.08), lt(m.cI, s + 0.05), lt(m.cP, s + 0.1), gt(m.tI, 0.45)),
    peacock: Math.min(lt(m.tI, T.pinch), gt(m.tM, T.pinch), lt(m.cM, s + 0.05), lt(m.cR, s + 0.05), lt(m.cP, s + 0.1),
                      gt(Math.min(m.mr, m.rp), T.apart, 0.08)),
    swan: Math.min(lt(m.tI, T.pinch - 0.05), lt(m.tM, T.pinch), lt(m.tR, T.pinch + 0.08), lt(m.im, j), lt(m.mr, j + 0.05)),
    dog: Math.min(lt(m.im, j), lt(m.rp, j + 0.05), gt(m.mr, T.dogGap), gt(m.mr / (Math.max(m.im, m.rp) + 0.01), 1.4, 0.3),
                  gt(m.thumbOut, T.thumbOut - 0.05), gt(m.thumbUp, T.thumbUp, 0.2), lt(m.cM, 0.6), lt(m.cR, 0.6)),
    crocodile: Math.min(lt(m.cI, s + 0.05), lt(m.cM, s + 0.05), lt(m.cR, s + 0.05), lt(m.cP, s + 0.1),
                        lt(m.im, j), lt(m.mr, j), lt(m.rp, j + 0.05), gt(m.tI, 0.4, 0.1),
                        gt(m.below, T.below), gt(m.level, T.level, 0.15)),
    snake: Math.min(lt(m.thumbPalm, T.thumbIn), gt(m.avg, 0.08, 0.06), lt(m.avg, 0.7), gt(m.tM, 0.45)),
    rabbit: Math.min(lt(m.cI, s + 0.05), lt(m.cM, s + 0.05), gt(m.cR, f), gt(m.cP, f)),
    bull: Math.min(gt(m.cI, f), gt(m.cM, f), gt(m.cR, f), lt(m.cP, s + 0.1), gt(m.thumbOut, T.thumbOut), lt(m.cT, 0.5)),
    turtle: Math.min(gt(m.cI, f), gt(m.cM, f), gt(m.cR, f), gt(m.cP, f), gt(m.thumbOut, T.thumbOut + 0.03),
                     gt(m.thumbTuck, 0.5, 0.1), lt(m.cT, 0.45))
  };
}

// all four folded, thumb tucked over them or bent in (a thumb sticking out is the turtle)
function fistScore(m) {
  const f = T.folded;
  return Math.min(gt(m.cI, f), gt(m.cM, f), gt(m.cR, f), gt(m.cP, f), Math.max(lt(m.thumbTuck, 0.45, 0.1), gt(m.cT, 0.5)));
}

function openness(h) {
  const c = ["index", "middle", "ring", "pinky"].map((n) => curl(h, n)).sort((a, b) => a - b);
  return lt(c[2], 0.45);                                  // at least three fingers open
}

// ---------- locking: an animal stays until a fist ----------
function detect() {
  const now = millis();
  if (!H.length) {
    cand = null;
    if (current && now - lastSeen > T.lostMs) current = null;
    birdScore = 0;
    return;
  }
  lastSeen = now;

  let best = null, bs = 0, fist = 0;
  H.forEach((h, i) => {
    h.m = measure(h);
    const raw = scoreAll(h.m);
    for (const k in raw) h.scores[k] = lerp(h.scores[k] || 0, raw[k], T.blend);
    filt[i].fist = lerp(filt[i].fist, fistScore(h.m), T.blend);
    fist = max(fist, filt[i].fist);
  });
  for (const k in H[0].scores) if (H[0].scores[k] > bs) { bs = H[0].scores[k]; best = k; }   // one hand: the first

  // bird: two open hands meeting at the thumbs (screen distance, in palm lengths)
  let rawBird = 0;
  if (H.length >= 2) {
    const [a, b] = H;
    let near = Infinity;
    for (const i of [1, 2, 3, 4]) for (const k of [1, 2, 3, 4, 5]) {
      near = min(near, dist(a.p[i].x, a.p[i].y, b.p[k].x, b.p[k].y), dist(b.p[i].x, b.p[i].y, a.p[k].x, a.p[k].y));
    }
    rawBird = Math.min(lt(near / ((a.u + b.u) / 2), T.birdNear, 0.3), openness(a), openness(b));
  }
  birdScore = lerp(birdScore, rawBird, T.blend);
  if (birdScore > T.enter) { best = "bird"; bs = birdScore; }       // two hands win over one

  // fist resets, then the hand has to open before anything new can lock
  if (fist > T.fistOn) {
    if (!fistSince) fistSince = now;
    if (now - fistSince > T.fistMs) { current = null; cand = null; armed = false; cooldownUntil = now + T.cooldownMs; }
  } else {
    fistSince = 0;
    if (!armed && fist < T.fistOff && now > cooldownUntil) armed = true;
  }

  if (current || !armed) { cand = null; return; }
  if (best && bs > T.enter) {
    if (best !== cand) { cand = best; candSince = now; }
    else if (now - candSince > T.lockMs) { current = best; cand = null; }
  } else cand = null;
}

function updateGrowth() {
  if (shown !== current) {
    grow -= 0.07;
    if (grow <= 0) { grow = 0; shown = current; highlight(shown); }
  } else if (shown) {
    grow = min(1, grow + 0.018);
  }
}

function statusText() {
  if (!H.length) return current ? current + "  (hand lost)" : "show a hand to the camera";
  if (current) return current + "  ·  make a fist to reset";
  if (!armed) return "open your hand";
  if (cand) return cand + " ...";
  return "make a shape";
}

let lastStatus = "";
function setStatus(s) {
  if (s === lastStatus) return;
  lastStatus = s;
  const el = document.getElementById("status");
  if (el) el.textContent = s;
}
function highlight(name) {
  document.querySelectorAll("#legend li").forEach((li) => li.classList.toggle("on", li.dataset.g === name));
}

function drawDebug() {
  fill(255); noStroke(); textAlign(LEFT, TOP); textSize(12);
  if (!H.length || !H[0].m) { text("no hand", 18, 48); return; }
  const h = H[0];
  const lines = Object.entries(h.m).map(([k, v]) => k.padEnd(10) + v.toFixed(2));
  lines.push("");
  Object.entries(h.scores).sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([k, v]) => lines.push(k.padEnd(10) + v.toFixed(2)));
  lines.push("bird      " + birdScore.toFixed(2), "fist      " + filt[0].fist.toFixed(2), "", "locked    " + (current || "-"));
  text(lines.join("\n"), 18, 48);
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

function ringPts(cx, cy, rx, ry, rot = 0, from = 0, to = TWO_PI, n = 18) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const th = lerp(from, to, i / n), x = cos(th) * rx, y = sin(th) * ry;
    out.push({ x: cx + x * cos(rot) - y * sin(rot), y: cy + x * sin(rot) + y * cos(rot) });
  }
  return out;
}

// tapering, bending limb (horns); returns its end point
function limb(x, y, a, L, w0, w1, bend, t) {
  const l = [], r = [], n = 14;
  let cx = x, cy = y, ang = a;
  for (let i = 0; i <= n; i++) {
    const s = i / n, w = lerp(w0, w1, s);
    ang = a + bend * s;
    l.push({ x: cx - sin(ang) * w, y: cy + cos(ang) * w });
    r.push({ x: cx + sin(ang) * w, y: cy - cos(ang) * w });
    if (i < n) { cx += cos(ang) * L / n; cy += sin(ang) * L / n; }
  }
  asciiPath(l, t);
  asciiPath(r, t);
  return { x: cx, y: cy, a: ang };
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

function big(ch, x, y, size, alpha = 255) { push(); textSize(size); glyph(ch, x, y, alpha); pop(); }
function mid(a, b, t = 0.5) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }
function dir(a, b) { const l = dist(a.x, a.y, b.x, b.y) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; }
function avgPt(p, ids) { let x = 0, y = 0; for (const i of ids) { x += p[i].x; y += p[i].y; } return { x: x / ids.length, y: y / ids.length }; }
function stage(g, i, n) { return constrain(g * n - i, 0, 1); }   // i-th of n sequential growth stages

function motes(cx, cy, r, chars, g, count = 14) {
  for (let i = 0; i < count; i++) {
    const life = (frameCount * 0.006 + i / count) % 1;
    const a = i * 2.4 + noise(i) * 3;
    const x = cx + cos(a) * r * (0.3 + noise(i, 7)) + sin(frameCount * 0.02 + i) * 8;
    const y = cy + sin(a) * r * 0.5 - life * r * 1.4;
    glyph(chars[i % chars.length], x, y, 255 * g * sin(life * PI));
  }
}

function shout(word, from, f, u) {
  push();
  textSize(u * 0.3);
  const b = (frameCount * 0.03) % 1;
  glyph(word, from.x + f.x * u * (0.9 + b), from.y + f.y * u * (0.9 + b), 255 * (1 - b));
  pop();
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

function drawDeer(h, g) {
  const p = h.p, u = h.u;
  const out = Math.sign(p[20].x - p[8].x) || 1;
  for (const [tip, base, side] of [[8, 5, -out], [20, 17, out]]) {
    const d = aim(h, base, tip);
    antler(p[tip].x, p[tip].y, d.a, u * 0.95 * d.f, 0, g, side * (d.y < 0 ? 1 : -1));
  }
  const nose = mid(p[4], p[12]), eye = mid(p[5], p[9]);
  if (g > 0.15) big("o", eye.x, eye.y + u * 0.15, u * 0.3);
  if (g > 0.3) big("*", nose.x, nose.y, u * 0.35);
  motes(mid(p[8], p[20]).x, mid(p[8], p[20]).y - u, u * 2.2, [".", "+", "'", "*"], g);
}

// ---------- snake: the hand is the head, a body ripples down the arm ----------
function drawSnake(h, g) {
  const p = h.p, u = h.u;
  const d = aim(h, 9, 0);
  const n = { x: -d.y, y: d.x };
  const N = 46, left = [], right = [];
  for (let i = 0; i < N; i++) {
    const s = i * u * 0.2;
    const wave = sin(i * 0.42 - frameCount * 0.09) * u * 0.55 * min(1, i / 7);
    const w = u * 0.3 * (1 - i / N);
    const cx = p[0].x + d.x * s + n.x * wave, cy = p[0].y + d.y * s + n.y * wave;
    left.push({ x: cx + n.x * w, y: cy + n.y * w });
    right.push({ x: cx - n.x * w, y: cy - n.y * w });
    if (i % 3 === 1 && i / N < g) glyph(i % 2 ? "<" : ">", cx, cy, 150);
  }
  asciiPath(left, g);
  asciiPath(right, g);

  const f = aim(h, 9, 12);
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

// ---------- bird: two hands are wings, the locked thumbs are the head ----------
function drawBird(A, B, g) {
  const u = (A.u + B.u) / 2;
  const flap = sin(frameCount * 0.08);
  [A, B].forEach((h, k) => {
    for (const [b, t] of [[5, 8], [9, 12], [13, 16], [17, 20]]) {
      const d = aim(h, b, t);
      const a = d.a + flap * 0.08 * (k ? 1 : -1);
      const L = u * (1.3 + 0.15 * flap) * d.f;
      ray(h.p[t].x, h.p[t].y, a, L, g);
      for (const o of [-0.16, 0.16]) ray(h.p[t].x, h.p[t].y, a + o, L * 0.7, g);
    }
  });
  const th = mid(A.p[4], B.p[4]), wr = mid(A.p[0], B.p[0]);
  const up = dir(wr, th);
  const hd = { x: th.x + up.x * u * 0.45, y: th.y + up.y * u * 0.45 };
  asciiPath(ringPts(hd.x, hd.y, u * 0.32, u * 0.32), stage(g, 0, 2));
  if (g > 0.4) {
    big("o", hd.x + u * 0.08, hd.y - u * 0.05, u * 0.22);
    asciiPath([{ x: hd.x + u * 0.3, y: hd.y - u * 0.1 }, { x: hd.x + u * 0.75, y: hd.y + u * 0.04 }, { x: hd.x + u * 0.3, y: hd.y + u * 0.14 }], stage(g, 1, 2));
  }
  const down = atan2(-up.y, -up.x);
  for (const o of [-0.35, -0.12, 0.12, 0.35]) ray(wr.x, wr.y, down + o, u * 1.3 * g);
  motes(hd.x, hd.y - u, u * 3, ["v", "v", "~", "v"], g, 10);
}

// ---------- dog: thumb is the ear, the gap between fingers is the mouth ----------
function drawDog(h, g) {
  const p = h.p, u = h.u;
  const td = aim(h, 2, 4);
  const tn = { x: -td.y, y: td.x };
  asciiPath([
    { x: p[3].x + tn.x * u * 0.3, y: p[3].y + tn.y * u * 0.3 },
    { x: p[4].x + td.x * u * 0.75 * td.f, y: p[4].y + td.y * u * 0.75 * td.f },
    { x: p[3].x - tn.x * u * 0.3, y: p[3].y - tn.y * u * 0.3 }
  ], stage(g, 0, 3));

  const eye = mid(mid(p[5], p[9]), p[0], 0.12);
  if (g > 0.15) big("@", eye.x, eye.y, u * 0.3);
  const f = aim(h, 9, 12);
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

  if (R(h, 12, 16) > 0.85 && g > 0.5) shout("WOOF", mid(p[12], p[16]), f, u);
}

// ---------- rabbit: two lifted fingers are the ears ----------
function drawRabbit(h, g) {
  const p = h.p, u = h.u;
  [8, 12].forEach((tip, k) => {
    const d = aim(h, tip - 3, tip);
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
function drawSwan(h, g) {
  const p = h.p, u = h.u;
  const tip = mid(p[4], p[8]);
  const f = dir(p[5], tip);
  const n = { x: -f.y, y: f.x };
  asciiPath([
    { x: tip.x + n.x * u * 0.14, y: tip.y + n.y * u * 0.14 },
    { x: tip.x + f.x * u * 0.5, y: tip.y + f.y * u * 0.5 },
    { x: tip.x - n.x * u * 0.14, y: tip.y - n.y * u * 0.14 }
  ], stage(g, 0, 3));
  if (g > 0.1) big("o", p[6].x, p[6].y, u * 0.24);

  const d = aim(h, 9, 0);
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

// ---------- crocodile: flat fingers are the upper jaw, the thumb below is the lower jaw ----------
function drawCrocodile(h, g) {
  const p = h.p, u = h.u;
  const d = dir(p[5], p[8]);
  let n = { x: -d.y, y: d.x };                                      // points from the fingers into the mouth
  if ((p[4].x - p[5].x) * n.x + (p[4].y - p[5].y) * n.y < 0) n = { x: -n.x, y: -n.y };
  const off = (q, k) => ({ x: q.x + n.x * u * k, y: q.y + n.y * u * k });
  const up = (i) => -((p[i].x - p[5].x) * n.x + (p[i].y - p[5].y) * n.y);
  const along = (i) => (p[i].x - p[0].x) * d.x + (p[i].y - p[0].y) * d.y;
  const topK = [5, 9, 13, 17].reduce((a, b) => (up(b) > up(a) ? b : a));
  const topT = [8, 12, 16, 20].reduce((a, b) => (up(b) > up(a) ? b : a));
  const inT = [8, 12, 16, 20].reduce((a, b) => (up(b) < up(a) ? b : a));
  const front = p[[8, 12, 16, 20].reduce((a, b) => (along(b) > along(a) ? b : a))];
  const snout = { x: front.x + d.x * u * 0.25, y: front.y + d.y * u * 0.25 };

  // outlines
  asciiPath([off(p[0], -0.45), off(p[topK], -0.35), off(p[topT], -0.2), snout, off(p[inT], 0.1)], stage(g, 0, 3));
  const td = dir(p[2], p[4]);
  asciiPath([off(p[0], 0.3), off(p[2], 0.28), off(p[3], 0.24), off(p[4], 0.18), { x: p[4].x + td.x * u * 0.2, y: p[4].y + td.y * u * 0.2 }], stage(g, 0, 3));

  // teeth: upper row points down into the mouth, lower row points up
  const tt = stage(g, 1, 3);
  const inK = inT - 3;
  for (let i = 0; i < 8 * tt; i++) { const q = mid(p[inK], p[inT], i / 7); glyph("V", q.x + n.x * u * 0.14, q.y + n.y * u * 0.14); }
  for (let i = 0; i < 5 * tt; i++) { const q = mid(p[2], p[4], i / 4); glyph("A", q.x - n.x * u * 0.14, q.y - n.y * u * 0.14); }

  // eye bump, nostrils, ridges
  if (g > 0.6) {
    const e = mid(off(p[topK], -0.6), off(p[0], -0.6), 0.25);
    asciiPath(ringPts(e.x, e.y, u * 0.22, u * 0.22, atan2(-n.y, -n.x), -HALF_PI, HALF_PI, 8), stage(g, 2, 3));
    const blink = (frameCount % 200) < 6;
    big(blink ? "-" : "@", e.x - n.x * u * 0.05, e.y - n.y * u * 0.05, u * 0.24);
    glyph("o", snout.x - n.x * u * 0.2 - d.x * u * 0.1, snout.y - n.y * u * 0.2 - d.y * u * 0.1);
    for (let i = 0; i < 5; i++) { const q = mid(off(p[0], -0.55), off(p[topK], -0.45), i / 5); glyph("^", q.x, q.y); }
  }
  if (R(h, 4, 8) < 0.35 && g > 0.5) shout("SNAP", snout, d, u);
}

// ---------- bull: thumb and little finger are the horns ----------
function drawBull(h, g) {
  const p = h.p, u = h.u;
  const fwd = dir(p[0], p[9]);
  const fa = atan2(fwd.y, fwd.x);
  for (const [b, t] of [[2, 4], [17, 20]]) {
    const d = aim(h, b, t);
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
function drawTurtle(h, g) {
  const p = h.p, u = h.u;
  const c = avgPt(p, [0, 5, 9, 17]);
  const rot = atan2(p[9].y - p[0].y, p[9].x - p[0].x);
  const Rr = u * 0.85;
  asciiPath(ringPts(c.x, c.y, Rr, Rr * 0.8, rot, 0, TWO_PI, 22), stage(g, 0, 3));
  asciiPath(ringPts(c.x, c.y, Rr * 0.45, Rr * 0.36, rot, 0, TWO_PI, 6), stage(g, 1, 3));
  for (let i = 0; i < 6; i++) {
    const a = rot + i * TWO_PI / 6;
    asciiLine(c.x + cos(a) * Rr * 0.45, c.y + sin(a) * Rr * 0.4, c.x + cos(a) * Rr * 0.95, c.y + sin(a) * Rr * 0.78, stage(g, 1, 3));
  }
  const d = aim(h, 2, 4);
  const bob = sin(frameCount * 0.04) * u * 0.05;
  const hd = { x: p[4].x + d.x * (u * 0.25 + bob), y: p[4].y + d.y * (u * 0.25 + bob) };
  asciiPath(ringPts(hd.x, hd.y, u * 0.24, u * 0.2, d.a, 0, TWO_PI, 10), stage(g, 2, 3));
  if (g > 0.7) glyph(".", hd.x + d.x * u * 0.08, hd.y + d.y * u * 0.08 - u * 0.05);
  for (const o of [0.7, -0.7, 2.4, -2.4]) {
    const a = rot + o + sin(frameCount * 0.05 + o) * 0.12;
    ray(c.x + cos(a) * Rr * 0.9, c.y + sin(a) * Rr * 0.75, a, u * 0.35, stage(g, 2, 3), "U");
  }
  ray(c.x - cos(d.a) * Rr, c.y - sin(d.a) * Rr * 0.8, d.a + PI, u * 0.3, stage(g, 2, 3));
}

// ---------- peacock: the thumb–pointer ring is the head, the spread fingers fan into the tail ----------
function drawPeacock(h, g) {
  const p = h.p, u = h.u;
  const base = mid(p[0], p[9], 0.6);
  const ds = [[9, 12], [13, 16], [17, 20]].map(([b, t]) => aim(h, b, t));
  const ref = ds[1].a;
  const rel = (a) => atan2(sin(a - ref), cos(a - ref));
  let lo = rel(ds[0].a), hi = rel(ds[2].a);
  if (lo > hi) [lo, hi] = [hi, lo];
  const c = (lo + hi) / 2, spread = max(hi - lo, 0.7) * 0.9;
  const reach = dist(base.x, base.y, p[12].x, p[12].y) * 0.9;

  const N = 9;
  for (let i = 0; i < N; i++) {
    const s = i / (N - 1);
    const t = constrain(g * 1.6 - abs(s - 0.5) * 1.2, 0, 1);     // middle feathers first
    if (t <= 0) continue;
    const a = ref + c + (s - 0.5) * 2 * spread + sin(frameCount * 0.05 + i) * 0.03;
    const L = u * (1.15 + 0.35 * cos((s - 0.5) * PI));
    const sx = base.x + cos(a) * reach, sy = base.y + sin(a) * reach;
    ray(sx, sy, a, L, t);
    for (let k = 1; k <= 3; k++) {
      const qx = sx + cos(a) * L * t * k / 4, qy = sy + sin(a) * L * t * k / 4;
      ray(qx, qy, a + 0.6, u * 0.14);
      ray(qx, qy, a - 0.6, u * 0.14);
    }
    if (t >= 1) {
      const ex = sx + cos(a) * (L + u * 0.18), ey = sy + sin(a) * (L + u * 0.18);
      asciiPath(ringPts(ex, ey, u * 0.2, u * 0.15, a, 0, TWO_PI, 8), 1, ".");
      big("@", ex, ey, u * 0.24, 255 * (0.55 + 0.45 * sin(frameCount * 0.07 + i)));
    }
  }

  // head inside the ring
  const rc = avgPt(p, [3, 4, 6, 7]);
  const r = max(u * 0.15, dist(rc.x, rc.y, p[3].x, p[3].y) * 0.9);
  asciiPath(ringPts(rc.x, rc.y, r, r, 0, 0, TWO_PI, 14), stage(g, 0, 2));
  if (g > 0.2) big("o", rc.x, rc.y, u * 0.22);
  const out = dir(base, rc), pn = { x: -out.y, y: out.x };
  const edge = { x: rc.x + out.x * r, y: rc.y + out.y * r };
  asciiPath([
    { x: edge.x + pn.x * u * 0.1, y: edge.y + pn.y * u * 0.1 },
    { x: edge.x + out.x * u * 0.35, y: edge.y + out.y * u * 0.35 },
    { x: edge.x - pn.x * u * 0.1, y: edge.y - pn.y * u * 0.1 }
  ], stage(g, 1, 2));
  for (const o of [-0.4, 0, 0.4]) {                                // crest
    const a = -HALF_PI + o, t = stage(g, 1, 2);
    const bx = rc.x + cos(a) * r, by = rc.y + sin(a) * r;
    ray(bx, by, a, u * 0.3 * t, 1, ":");
    if (t >= 1) glyph("*", bx + cos(a) * u * 0.38, by + sin(a) * u * 0.38);
  }
}

const DRAW = {
  deer: drawDeer, snake: drawSnake, dog: drawDog, rabbit: drawRabbit, swan: drawSwan,
  crocodile: drawCrocodile, bull: drawBull, turtle: drawTurtle, peacock: drawPeacock
};

// ---------- the animal's symbol, typed out beside the hand ----------
function drawSymbol(p, u, g) {
  const art = ART[shown];
  const size = constrain(u * 0.16, 11, 18);
  push();
  textSize(size);
  textAlign(LEFT, TOP);
  const cw = textWidth("M"), lh = size * 1.15;
  const cols = Math.max(...art.map((r) => r.length));
  const bw = cw * cols;
  let minX = Infinity, maxX = -Infinity, minY = Infinity;
  for (const q of p) { minX = min(minX, q.x); maxX = max(maxX, q.x); minY = min(minY, q.y); }
  let x = maxX + u * 2;
  if (x + bw > width - 10) x = minX - u * 2 - bw;
  x = constrain(x, 10, max(10, width - bw - 10));
  const y = constrain(minY - u * 0.3, 60, max(60, height - lh * (art.length + 3)));

  let left = floor(art.length * cols * g);
  for (let r = 0; r < art.length && left > 0; r++) {
    for (let c = 0; c < cols && left > 0; c++, left--) {
      const ch = art[r][c];
      if (ch && ch !== " ") glyph(ch, x + c * cw, y + r * lh);
    }
  }
  if (g > 0.7) {
    fill(255, 255 * (g - 0.7) / 0.3);
    text(shown.split("").join(" "), x + cw, y + lh * (art.length + 0.8));
  }
  pop();
}