p5.disableFriendlyErrors = true;
let bDoExportSvg = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noFill();
  stroke(0);
  noLoop(); // draw once; regenerate on demand
}

function keyPressed() {
  if (key == 's') { bDoExportSvg = true; redraw(); }       // export current design
  if (key == ' ') { randomSeed(millis()); redraw(); }      // new design
}

let seed = 1;

function draw() {
  if (bDoExportSvg) beginRecordSvg("myOutput.svg");

  background(255);
  translate(width / 2, height / 2);

  let r = 50; 
  let numrings = random(5, 15)
  for (let i = 0; i < numrings; i++) {
        if (r <= height/2.5) {
            print(r); print(height); 
            // break;
                    const type = floor(random(0, 5));      
        const h = floor(random(3, 30)); 
        r += generate(type, r, h);    
        }

  }

  if (bDoExportSvg) {
    endRecordSvg();
    bDoExportSvg = false;
  }
}

function generate(num, r, h) {
  switch (num) {
    case 0:
        make_circle(r);
        return h;
    case 1: {
        const size = random(3, 7);
        dots(r + size / 2, size, h + size);
        return size + h;
    }
    case 2: {
        const amp = random(2, 12);
        wave_circ(r + amp, amp, h);
        return amp * 2 + h;
    }
    case 3: {
        const th = random(2, 5);
        tri_circ(r + th, th, random(2, 5), max(h / 2, 2));
        return th * 2 + h;
    }
    case 4:
        spikes(r + h, h, random(2, 8));
        return h * 2 + 4;
  }
}

function make_circle(r) {
    circle(0, 0, r * 2);
}

function dots(r, size, spacing) {

    const count = floor(TWO_PI * r / spacing);
    for (let i = 0; i < count; i++) {
        const a = (TWO_PI / count) * i;
        circle(cos(a) * r, sin(a) * r, size);
    }
}

function wave_circ(r, amp, wavelength) {
    const waves = floor(TWO_PI * r / wavelength);
    beginShape();
    for (let a = 0; a < TWO_PI; a += TWO_PI / 720) {
        const updated_r = r + sin(a * waves) * amp;
        vertex(cos(a) * updated_r, sin(a) * updated_r);
    }
    endShape(CLOSE);
}

function tri_circ(r, h, w, spacing) {
    const count = floor(TWO_PI * r / spacing);
    for (let i = 0; i < count; i++) {
        push();
        rotate((TWO_PI / count) * i);
        // traingle takes x, y, of 3 points
        triangle(r - h, -w, r - h, w, r + h, 0);
        pop();
    }
}

function spikes(r, h, spacing) {
    const count = round(TWO_PI * r / spacing);

    for (let i = 0; i < count; i++) {
        push();
        rotate((TWO_PI / count) * i);
        line(r - h, 0, r + h, 0);
        pop();
    }
}
