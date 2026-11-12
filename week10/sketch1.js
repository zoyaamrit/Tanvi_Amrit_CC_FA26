let rate = 0 
let angle = 0 
const SPIN = 0.5

async function setup() {

    // load mp3 file and set it to loop

    sample = await loadSound("FrEliseWoo59.mp3");
    sample.loop(true);

    createCanvas(windowWidth, windowHeight);
    // textAlign(CENTER);
    // textWrap(WORD);
    textSize(10);
    noFill();

    // describe("a sketch that changes the playback rate of a soundfile");
}

function draw() {
           translate(width/2, height/2)


    background(180, 220, 180, 200);
    rate = map(mouseX, 0, width, 0, 3);
    sample.rate(rate);

    angle += rate * SPIN * (deltaTime/1000)

        stroke(0, 100, 0)

    wave_circ(200, 20, 50, angle)
    let rad = map(rate, 0, 3, 100, 250)

    stroke(100, 0, 0)
    wave_circ(rad, rad/2, 50, angle)



    //   if (!sample.isPlaying()) {
    //     text("click to play the sound, move your mouse to change the playback rate", 0, height/2, width);
    //   }
    //   else {
    //     text("Playback Rate: " + rate.toFixed(2), 0, height/2, width);
    //   }
}

function wave_circ(r, amp, freq, rotation) {
    waves = floor(TWO_PI * r / freq )
    push()
    rotate(rotation)

    // adapted from https://editor.p5js.org/wujiaq/sketches/dOXHWDNvh
    beginShape();
    for (let a = 0; a <= TWO_PI + 0.001; a += TWO_PI / 720) {
        const updated_r = r + sin(a * waves) * amp;
        vertex(cos(a) * updated_r, sin(a) * updated_r);
    }
    endShape(CLOSE);

    pop()
     
}


function mousePressed() {
    if(!sample.isPlaying()) {
        sample.play();
        rate = 1
        angle = 1
    }
    else {
         rate = 0
         angle = 0
        sample.stop();
       
    }
}