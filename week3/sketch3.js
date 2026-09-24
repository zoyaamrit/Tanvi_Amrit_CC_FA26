let r = 0;

let w, h;
let numRects = 30;

function setup() {
    createCanvas(windowWidth, windowHeight);

    w = width / numRects;
    h = height / numRects;

    rectMode(CENTER);
    noStroke()
}
function draw() {

    translate(w / 2, h / 2);

    for (let x = 0; x < numRects; x++) {

        for (let y = 0; y < numRects; y++) {

            let d = dist(mouseX, mouseY, w * x, h * y);

            d = map(d, 0, 1000, 0, 0.6);
            d = constrain(d, 0, 0.25);

            let t = r + d * 5; 
            
            let n = 150
            // radian math, modify each colour slightly
            let red   = n + n * sin(t);
            let green = n + n * sin(t + 2); 
            let blue  = n + n * sin(t + 3);

            fill(red, green, blue);

                push();
                translate(w * x, h * y);
                rect(0, 0, w, h);
                pop();
        }
    }

    r += 0.03;
}