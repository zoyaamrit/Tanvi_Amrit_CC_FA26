// This sketch detects if hands are pinching, 
// moves the points of a shape to the location of the thumb
// all the vertex points of the shape are flowers
// the vertex creates a window through which the webcam video is visible

let handPose;
let video;
let hands = [];

let shapePoints = [];
let numPoints = 4;

let distance = Infinity; 

async function setup() {
    createCanvas(640, 480);
    angleMode(DEGREES);

    handPose = await ml5.handPose();

    video = createCapture(VIDEO);
    video.size(640, 480);
    video.hide();

    handPose.detectStart(video, gotHands);

    for (let i = 0; i < numPoints; i++) {
        shapePoints[i] = createVector(random(width * 0.75), random(height * 0.5));
    }

    rectMode(CENTER);
    pixelDensity(1);
}


function draw() {


    // background(255, 255, 255, 10)


    if (!video) return;

    // mirror
    scale(-1, 1);
    translate(-width, 0);
    image(video, 0, 0, width, height);
    fill(0, 200);
    // rect(0, 0, width, height);

    if (hands.length > 0) {
        let hand = hands[0];
        distance = dist(hand.keypoints[4].x, hand.keypoints[4].y, hand.keypoints[8].x, hand.keypoints[8].y)
    } else {
        distance = Infinity; 
    }

    if (distance <= 12) {
        let thumb = hands[0].keypoints[4];
        for (let i = 0; i < numPoints; i++) {
            if (dist(thumb.x, thumb.y, shapePoints[i].x, shapePoints[i].y) < 30) {
                shapePoints[i] = createVector(thumb.x, thumb.y);
            }
        }
    }

    // put video into a drawing context
    // to clip shape to video

    drawingContext.save();
    drawingContext.beginPath();

    drawingContext.moveTo(shapePoints[0].x, shapePoints[0].y);

    for (let i = 1; i < numPoints; i++) {
        drawingContext.lineTo(shapePoints[i].x, shapePoints[i].y);
    }

    drawingContext.closePath();
    drawingContext.clip();

    // image(video, 0, 0, width, height);

    background(0); 
    video.loadPixels();

    if (video.pixels.length > 0) {
        noStroke(); 
        let step = 8;
        for (let y = 0; y < video.height; y += step) {
            for (let x = 0; x < video.width; x += step) {
                // compute index directly from x, y
                let index = (x + y * video.width) * 4;
                let r = video.pixels[index];
                let g = video.pixels[index + 1];
                let b = video.pixels[index + 2];

                let bright = (r + g + b) / 3;
                if (bright < 100) continue;   

                fill(bright);
                let s = bright / 255 * step; 

                // if ((x / step + y / step) % 2 == 0) {
                    rect(x, y, s, s);
                // } else {
                    // ellipse(x, y, s, s);
                // }
            }
        }
    }
    

    drawingContext.restore();       


    noFill();
    stroke(255, 150);
    strokeWeight(2);
    beginShape();
    for (let i = 0; i < numPoints; i++) {
        vertex(shapePoints[i].x, shapePoints[i].y);
    }
    endShape(CLOSE);

    for (let i = 0; i < numPoints; i++) {
        fill(255, 0, 0, 150);
        noStroke();
        ellipse(shapePoints[i].x, shapePoints[i].y, 10, 10);
    }
}

// Callback function for when handPose outputs data
function gotHands(results) {
    // save the output to the hands variable
    hands = results;
}