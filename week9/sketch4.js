// This sketch detects if hands are pinching, 
// moves the points of a shape to the location of the thumb
// all the vertex points of the shape are flowers
// the vertex creates a window through which the webcam video is visible

let handPose;
let video;
let hands = [];

let shapePoints = [];
let numPoints = 6;

let distance = Infinity; 

let flowers = [];
class FLOWER {

    constructor(x, y, numP, pL, pW) {
        this.x = x;
        this.y = y;
        this.c = color(random(190, 255), random(50, 120), random(10, 40));
        this.numPetals = numP;
        this.petalLength = pL;
        this.petalWidth = pW;
        this.centerDiamter = 10;

        this.rotations = 0;
        this.rV = random(-5, 5);
    }

    move() {
        this.rotations += this.rV;
    }

    drawFlower() {
        push();
        noStroke();
        fill(this.c);
        translate(this.x, this.y);
        rotate(this.rotations);

        let rotation = 360 / this.numPetals;

        for (let r = 0; r < this.numPetals; r++) {
            push();
            rotate(rotation * r);
            translate(this.petalLength / 2, 0);
            ellipse(0, 0, this.petalLength, this.petalWidth);
            pop();
        }
        fill(255, 100);
        ellipse(0, 0, this.centerDiamter, this.centerDiamter);

        pop();
    }
}


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
        let flower = new FLOWER(random(width), random(height), random(5, 8), random(15, 30), random(10, 15));
        flowers.push(flower);
    }
}


function draw() {


    // background(255, 255, 255, 10)


    if (!video) return;

    // mirror
    scale(-1, 1);
    translate(-width, 0);
    image(video, 0, 0, width, height);
    fill(0, 200);
    rect(0, 0, width, height);

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

    image(video, 0, 0, width, height);

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
        flowers[i].x = shapePoints[i].x;
        flowers[i].y = shapePoints[i].y;
        flowers[i].move();
        flowers[i].drawFlower();
    }
}

// Callback function for when handPose outputs data
function gotHands(results) {
    // save the output to the hands variable
    hands = results;
}