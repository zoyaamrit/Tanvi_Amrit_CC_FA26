let synth;
let delay;
let filter;
let reverb;
let reverbSend;   // how much reverb we hear (controlled by mouseY)
let reverbMeter;  // measures the loudness of the reverb only
let master;
let fft;

// the whole keyboard, laid out like the real thing (top row first)
// offset = how far each row is shifted to the right, in key widths
let rows = [
  { keys: "1234567890-=", offset: 0 },
  { keys: "qwertyuiop[]", offset: 0.5 },
  { keys: "asdfghjkl;'", offset: 0.75 },
  { keys: "zxcvbnm,./", offset: 1.25 },
];

// all keys in pitch order: bottom row = lowest notes, number row = highest
// each key is one semitone above the previous one (45 notes, C2 to G#5)
let letters = [];
let keysDown = [];
let noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// reverb settings
let reverbDecay = 4;  // seconds for the tail to die out (change with up/down arrows)
let reverbMix = 0.5;  // 0-1 (change with mouseY)

// reverb visuals
let ripples = [];     // one ripple per note played, fades over the decay time
let tailHistory = []; // the reverb's loudness over the last few seconds

let mid_h
let footer 

function setup() {
  createCanvas(windowWidth, windowHeight);
  mid_h = height/2
  footer = height - 150

  for (let r = rows.length - 1; r >= 0; r--) {
    for (let ch of rows[r].keys) {
      letters.push(ch);
    }
  }

  delay = new Tone.FeedbackDelay();
  delay.set({
    delayTime: 0.3,
    feedback: 0.4,
    wet: 0,
  });

  filter = new Tone.Filter();
  filter.set({
    type: "lowpass",
    frequency: 1000,
    Q: 1,
  });

  // reverb = thousands of tiny echoes blurred together, like a big room
  reverb = new Tone.Reverb({
    decay: reverbDecay, // seconds until the tail has faded out
    preDelay: 0.02,     // seconds of silence before the reverb starts
    wet: 1,             // 100% reverb here, we mix it with reverbSend instead
  });
  // reverb.set({
  //   decay: 4,       // 0.001 and up: length of the tail in seconds (changing it rebuilds the reverb)
  //   preDelay: 0.02, // seconds before the first reflection: bigger = bigger room
  //   wet: 0.5,       // 0-1: reverb vs. original sound
  // });

  reverbSend = new Tone.Gain(reverbMix);
  reverbMeter = new Tone.Meter({ smoothing: 0.6 });
  master = new Tone.Gain().toDestination();

  // the signal chain:
  // synth -> delay -> filter -> master             (dry sound)
  //                    filter -> reverb -> reverbSend -> master  (wet sound)
  delay.connect(filter);
  filter.connect(master);
  filter.connect(reverb);
  reverb.connect(reverbSend);
  reverbSend.connect(master);
  reverbSend.connect(reverbMeter);

  synth = new Tone.PolySynth();
  synth.volume.value = -10;
  synth.set({
    oscillator: { type: "fatsquare", count: 10, spread: 20 },
    envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 1.5 },
  });
  synth.connect(delay);

  // the FFT listens to the end of the chain (what we hear)
  fft = new Tone.FFT(2048);
  master.connect(fft);

  // if the window loses focus while a key is held, stop all notes
  window.addEventListener("blur", () => {
    synth.releaseAll();
    keysDown = [];
  });
}

function keyFreq(steps) {
  return (261.63 / 4) * pow(2, steps / 12); // starts at C2
}

function noteName(i) {
  return noteNames[i % 12] + (2 + floor(i / 12));
}

function draw() {
  background(30);


  // mouseX = filter cutoff, mouseY = reverb amount (top = lots, bottom = none)
  let cutoff = map(mouseX, 0, width, 100, 8000, true);
  filter.set({ frequency: cutoff });
  reverbMix = map(mouseY, 0, height, 1, 0, true);
  reverbSend.gain.rampTo(reverbMix, 0.05);

  // how loud the reverb is right now, in decibels
  let reverbLevel = reverbMeter.getValue();
  let reverbAmount = map(reverbLevel, -60, -6, 0, 1, true);

  drawRipples(mid_h, reverbAmount);
//   drawSpectrum(mid_h);he
//   drawTail(reverbLevel, footer);
//   drawInfo(cutoff, 0);h
}

// every note sends out rings, like a sound bouncing around a room.
// they live as long as the reverb decay, and glow with the real reverb level
function drawRipples(centerY, reverbAmount) {
  push();
  colorMode(HSB, 360, 100, 100, 1);
  noFill();

  let now = millis() / 1000;
  for (let r = ripples.length - 1; r >= 0; r--) {
    let rip = ripples[r];
    let age = now - rip.born;
    let life = age / reverbDecay; // 0 = just played, 1 = fully faded
    if (life > 1) {
      ripples.splice(r, 1);
      continue;
    }

    let x = map(rip.i, 0, letters.length - 1, 60, width he);
    let hue = (rip.i % 12) * 30;
    let alpha = pow(1 - life, 2) * (0.2 + 0.8 * reverbAmount) * reverbMix;

    // three rings = the first reflections spreading out
    for (let echo = 0; echo < 3; echo++) {
      let radius = (age * 120 + 10) * (1 - echo * 0.25);
      stroke(hue, 60, 100, alpha * (1 - echo * 0.25));
      strokeWeight(3 - echo);
      circle(x, centerY, radius * 2);
    }
  }
  pop();
}

function drawSpectrum(centerY) {
  // getValue() gives one number per band: how loud it is, in decibels
  // -100 = silent, 0 = as loud as it gets
  let values = fft.getValue();

  // only draw the lower eighth of the bands (0 to about 2750 Hz)
  let bands = values.length / 8;
  let barWidth = width / bands;

  push();
  noStroke();
  fill(120, 200, 255, 200);
  rectMode(CENTER);
  for (let i = 0; i < bands; i++) {
    let barHeight = map(values[i], -100, 0, 2, 300, true);
    rect(i * barWidth + barWidth / 2, centerY, barWidth, barHeight);
  }
  pop();
}

// a scrolling graph of the reverb's loudness:
// after you let go of a key you can watch the tail fade out
function drawTail(reverbLevel, top) {
  let plotH = 120;
  let bottom = top + plotH;
  let maxPoints = floor(width / 3);

  tailHistory.push(reverbLevel);
  if (tailHistory.length > maxPoints) {
    tailHistory.shift();
  }

  push();
  noStroke();
  fill(45);
  rect(0, top, width, plotH);

  fill(255, 170, 90, 150);
  stroke(255, 170, 90);
  strokeWeight(1.5);
  beginShape();
  vertex(0, bottom);
  for (let i = 0; i < tailHistory.length; i++) {
    let x = map(i, 0, maxPoints - 1, 0, width);
    let y = map(tailHistory[i], -70, 0, bottom, top, true);
    vertex(x, y);
  }
  vertex(map(tailHistory.length - 1, 0, maxPoints - 1, 0, width), bottom);
  endShape(CLOSE);

  noStroke();
  fill(200);
  textAlign(LEFT, TOP);
  textSize(12);
  let shown = isFinite(reverbLevel) ? nf(reverbLevel, 1, 1) + " dB" : "silent";
  text("reverb tail: " + shown, 10, top + 6);
  pop();
}

function drawInfo(cutoff, y) {
  push();
  noStroke();
  fill(200);
  textAlign(LEFT, TOP);
  textSize(12);
  text(
    "mouse X: filter " + round(cutoff) + " Hz   |   " +
    "mouse Y: reverb mix " + round(reverbMix * 100) + "%   |   " +
    "up/down arrows: reverb decay " + nf(reverbDecay, 1, 1) + " s",
    10, y + 8
  );
  pop();
}

function keyPressed(event) {
  Tone.start();

  // arrow keys change the length of the reverb tail
  if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
    let change = keyCode === UP_ARROW ? 0.5 : -0.5;
    reverbDecay = constrain(reverbDecay + change, 0.5, 12);
    reverb.decay = reverbDecay; // rebuilds the reverb, takes a moment
    return false;
  }

  let letter = event.key.toLowerCase();
  let i = letters.indexOf(letter);
  if (i !== -1 && !keysDown[i]) {
    keysDown[i] = true;
    synth.triggerAttack(keyFreq(i));
    ripples.push({ i: i, born: millis() / 1000 });
  }

  // stops keys like ' and / from triggering browser shortcuts
  return false;
}

function keyReleased(event) {
  let letter = event.key.toLowerCase();
  let i = letters.indexOf(letter);
  if (i !== -1 && keysDown[i]) {
    keysDown[i] = false;
    synth.triggerRelease(keyFreq(i));
  }
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}