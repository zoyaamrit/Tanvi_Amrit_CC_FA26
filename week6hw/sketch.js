// adopted from p5.brush — Live Tutorial Sketch
//   4 · Watercolor — brush.fill(), fillBleed(), fillTexture()
// some of the comments are from the demo code

const palette = ["#7b4800", "#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"];

let buildings = [];

// ── Setup ─────────────────────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  angleMode(DEGREES);

  // brush.load() initialises the library on the current canvas.
  // Must be called after createCanvas().
  brush.load();

  // Multiplies weight and scatter of every built-in brush.
  brush.scaleBrushes(3.5);

  background("#fffceb");
  // frameRate(30);
}

// ── Draw loop ─────────────────────────────────────────────────────────────────
function draw() {
  // WEBGL puts (0,0) at the centre; shift it back to the top-left
  // so mouseX / mouseY line up with what we draw.
  translate(-width / 2, -height / 2);


  for (const b of buildings) {
    if (!b.drawn) {
      b.show();
      b.drawn = true;
    }
  }
}

// ── Building ──────────────────────────────────────────────────────────────────
class Building {
  constructor(x, y, w, h, rotation) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.rotation = rotation;

    this.color   = random(palette);
    this.opacity = random(60, 110);
    this.bleed   = random(0.1, 0.55);
    this.drawn   = false;
  }

  show() {
    push();
    translate(this.x, this.y);
    rotate(this.rotation);

    brush.set("marker", "#e0b411", 1.1);

    // Watercolour fill for the next shape (opacity is 0–255).
    brush.fill(this.color, this.opacity);
    // How far colour bleeds past the edge (0–1).
    brush.fillBleed(this.bleed);
    // Paper grain and darker border (both 0–1).
    brush.fillTexture(0.4, 0.4);

    // Draw upward from the base so the rotation pivots at the ground.
    brush.rect(-this.w / 2, -this.h, this.w, this.h);
    pop();
  }
}

// each click makes buildng row at mouseY 
function mousePressed() {
  addRow(mouseY);

      // buildings.push(new Building(mouseX, mouseY, random(60, 100), random(50, 150), random(-3,3)));

}

function addRow(groundY) {
  let x = random(0, 10);

  while (x < width + 40) {
    const w = random(60, 100);
    const h = random(50, 200);
    const rotation = random(-3, 3);

    buildings.push(new Building(x + w / 2, groundY, w, h, rotation));

    x += w + random(4, 20);
  }
}
