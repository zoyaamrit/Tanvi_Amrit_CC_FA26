// Webcam rendered as brightness-coloured scan lines (mirrored).

let video;
const STEP = 8; // sampling grid size in pixels

function setup() {
    createCanvas(windowWidth, windowHeight);
    pixelDensity(1);

    video = createCapture(VIDEO);
    video.size(windowWidth, windowHeight);
    video.hide();
}

function draw() {
    background(0, 50);
    if (!video) return;

    video.loadPixels();
    if (video.pixels.length === 0 || video.width === 0) return; // camera not ready yet

    // The camera may not deliver exactly the requested size, so scale video coords to canvas coords
    const sx = width / video.width;
    const sy = height / video.height;

    push();
    // mirror horizontally
    translate(width, 0);
    scale(-1, 1);

    strokeWeight(2);

    for (let y = 0; y < video.height; y += STEP) {
        // reset at the start of every row so rows don't join up
        let px = null;
        let py = null;

        for (let x = 0; x < video.width; x += STEP) {
            const index = (x + y * video.width) * 4;
            const r = video.pixels[index];
            const g = video.pixels[index + 1];
            const b = video.pixels[index + 2];
            const bright = (r + g + b) / 3;

            // Lines use stroke(), not fill()
            if (bright < 150) {
                stroke(0);
            } else if (bright > 200) {
                stroke(255);
            } else {
                stroke(50);
            }

            // Optional: only connect bright points (gaps in dark areas)
            // if (bright < 100) { px = null; continue; }

            const cx = x * sx;
            const cy = y * sy;
            if (px !== null) {
                line(px, py, cx, cy);
            }
            px = cx;
            py = cy;
        }
    }

    pop();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    video.size(windowWidth, windowHeight);
}