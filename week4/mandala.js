
p5.disableFriendlyErrors = true; // keep warnings quiet
let bDoExportSvg = false; 

function keyPressed(){
  if (key == 's'){ 
    bDoExportSvg = true; 
  }
}


function setup() {
    createCanvas(windowWidth, windowHeight)
    // background(255)
    noFill()
    stroke(0)


}

function draw() {
    background(255)

    if (bDoExportSvg){
    beginRecordSvg("myOutput.svg");
  }




    translate(width/2, height/2)

    spikes(210, 10, 10)
    spikes(120, 5,2)
    tri_circ(80, 20, 2, 10)
    tri_circ(140, 3, 3, 10)

    make_circle(50, 2)
    // make_circle(55, 1)
    make_circle(65, 1)
    dots(40, 5, 10)
    dots(130, 3, 15)

    wave_circ(50, 5, 5)
    wave_circ(170, 15, 30)

    // tri_circ(80, 5, 5, 20)
    // wave_circ(200, 5, 20)
    // strokeWidth(5)
    dots(250, 6, 15)
    spikes(280, 15, 5)


    // make_circle(130, 10)



  if (bDoExportSvg){
    endRecordSvg();
    bDoExportSvg = false;
  }


}


function make_circle(r, thickness) {

    strokeWeight(thickness)
    circle(0, 0, r)
}

function dots(r, size, freq) {
    circumference = TWO_PI * r 
    count = circumference / freq 
    for (let i = 1; i < count; i++) {
        const a = (TWO_PI / count) * i
        circle(cos(a) * r, sin(a) * r, size)
    }
}


function wave_circ(r, amp, freq) {
    circumference = TWO_PI * r 
    waves = circumference / freq 

    // adapted from https://editor.p5js.org/wujiaq/sketches/dOXHWDNvh
    beginShape();
    for (let a = 0; a <= TWO_PI + 0.001; a += TWO_PI / 720) {
        const updated_r = r + sin(a * waves) * amp;
        vertex(cos(a) * updated_r, sin(a) * updated_r);
    }
    endShape(CLOSE);
     
}

function tri_circ(r, h, w, freq, fill) {


    count = TWO_PI * r  / freq 

    for (let i = 0; i < count; i++) {
        push()
        rotate((TWO_PI / count) * i)
        // triangle takes x,y of 3 points
        triangle(r - h, -w, r - h, w, r + h, 0);
        pop()
    }

}

function spikes(r, h, freq) {
  let count = round(TWO_PI * r / freq);

  for (let i = 0; i < count; i++) {
    push();
    rotate((TWO_PI / count) * i);
    line(r - h , 0, r + h, 0);
    pop();
  }
}



