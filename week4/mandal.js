
const THICK = 0, THIN = 1, DOTS = 2, WAVE = 3, TRIANGLES = 4, SPIKES = 5;

let rings = [];


let numRings 
let innerRadius 
let maxRadius 
let spacing 

function setup() {
    createCanvas(windowWidth, windowHeight);
    generate();

    numRings = floor (random(9, 16)) // get a certain number of rings 
    maxRadius = width * 0.4 
    innerRadius = width * 0.1

    spacing = (maxRadius - innerRadius) / numRings
}


function generate() {


  let order = [];
  while (order.length < numRings) {
    let batch = shuffle([THICK, THIN, DOTS, WAVE, TRIANGLES, SPIKES]);
    if (order.length && batch[0] === order[order.length - 1]) batch.reverse();
    order = order.concat(batch);
  }

  for (let i = 0; i < numRings; i++) {
    const r = innerR + (i + 0.5) * spacing;
    const circumference = TWO_PI * r;
    rings.push({
      type: order[i],
      r,
      band: spacing,
      col: color(random(pal)),
      // how many repeating elements fit around the ring
      count: max(6, floor(circumference / (spacing * random(0.8, 1.3)))),
      angle: random(TWO_PI),
      speed: random([-1, 1]) * random(0.0005, 0.002)
    });
  }
  rings.centerCol = color(random(pal));
}

function draw() {
  background(bgColor);
  translate(width / 2, height / 2);

  // centre jewel
  noStroke();
  fill(rings.centerCol);
  circle(0, 0, width * 0.05);

  for (const ring of rings) {
    push();
    rotate(ring.angle);
    drawRing(ring);
    pop();
    ring.angle += ring.speed;
  }
}

function drawRing(ring) {
  const { r, band, col, count } = ring;

  switch (ring.type) {
    case THICK:
      noFill();
      stroke(col);
      strokeWeight(band * 0.45);
      circle(0, 0, r * 2);
      break;

    case THIN:
      noFill();
      stroke(col);
      strokeWeight(max(1, band * 0.05));
      circle(0, 0, r * 2);
      break;

    case DOTS: {
      const d = min(band * 0.6, (TWO_PI * r / count) * 0.75);
      noFill();
      stroke(col);
      strokeWeight(max(1, band * 0.06));
      for (let i = 0; i < count; i++) {
        const a = (TWO_PI / count) * i;
        circle(cos(a) * r, sin(a) * r, d);
      }
      break;
    }

    case WAVE: {
      const amp = band * 0.3;
      const waves = max(6, floor(count / 1.5));
      noFill();
      stroke(col);
      strokeWeight(max(1.2, band * 0.07));
      beginShape();
      for (let a = 0; a <= TWO_PI + 0.001; a += TWO_PI / 720) {
        const rr = r + sin(a * waves) * amp;
        vertex(cos(a) * rr, sin(a) * rr);
      }
      endShape(CLOSE);
      break;
    }

    case TRIANGLES: {
      const h = band * 0.75;
      const halfW = min(band * 0.4, (PI * r / count) * 0.9);
      noStroke();
      fill(col);
      for (let i = 0; i < count; i++) {
        push();
        rotate((TWO_PI / count) * i);
        // point outward: base on the inner side, apex on the outer side
        triangle(r - h / 2, -halfW, r - h / 2, halfW, r + h / 2, 0);
        pop();
      }
      break;
    }

    case SPIKES: {
      const spikes = count * 2;
      const halfW = (PI * r / spikes) * 0.35;
      noStroke();
      fill(col);
      for (let i = 0; i < spikes; i++) {
        const long = i % 2 === 0;
        const len = band * (long ? 0.9 : 0.5);
        push();
        rotate((TWO_PI / spikes) * i);
        triangle(r - band * 0.45, -halfW, r - band * 0.45, halfW, r - band * 0.45 + len, 0);
        pop();
      }
      break;
    }
  }
}

function mousePressed() {
  generate();
}

function keyPressed() {
  if (key === "s" || key === "S") saveCanvas("mandala", "png");
}

function windowResized() {
  const s = canvasSize();
  resizeCanvas(s, s);
  generate();
}
