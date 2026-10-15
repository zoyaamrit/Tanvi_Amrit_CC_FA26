// ── Responsive canvas ────────────────────────────────────────────────────────
// Fits the canvas to the browser window while preserving its aspect ratio.
// function adjustCanvas(id) {
//     let canvas = document.getElementById(id);
//     canvas.style.maxWidth   = "100vw";
//     canvas.style.maxHeight  = "100vh";
//     canvas.style.width      = "auto";
//     canvas.style.height     = "auto";
//     canvas.style.objectFit  = "contain";
// }

//////////////////////////////////////////////////
// The example really starts here

let palette = ["#2c695a", "#4ad6af", "#7facc6", "#4e93cc", "#f6684f", "#ffd300"]

function setup () {

    // p5.brush requires a WEBGL canvas.
    // let c = createCanvas(600, 600, WEBGL);
    // c.id("main");
    // adjustCanvas("main");
    createCanvas(windowWidth, windowHeight, WEBGL)
  
    brush.load();
  
    angleMode(DEGREES)
    background("#fffceb")

    // Scale brushes to adapt to canvas size
    brush.scaleBrushes(3.5)

    // Activate the flowfield we're going to use
    brush.field("seabed")
}

function draw() {

    frameRate(10)
    translate(-width/2,-height/2)

    // brush.box() returns an array with available brushes
    let available_brushes = brush.box();

    // Set the stroke to a random brush, color, and weight = 1
    brush.set(random(available_brushes), random(palette), 1)

    // Draw a random flowLine (x, y, length, direction)
    brush.flowLine(random(width), random(height), random(300,800), random(0,360))

    // Set the stroke to a random brush, color, and weight = 1
    brush.set(random(available_brushes), random(palette), 1)

    // Draw a random flowLine (x, y, length, direction)
    brush.flowLine(random(width), random(height), random(300,800), random(0,360))
  
}