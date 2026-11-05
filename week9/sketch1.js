// This sketch renders a shape that is defined by the keypoints of the hand
// the pointer and thumb are linked to multiple vectors that define the shape

let handPose;
let video;
let hands = [];

let shapePoints = [];
let numPoints = 6

async function setup() {
    createCanvas(640, 480);
    angleMode(DEGREES);
    
    // Load the handPose model asynchronously
    handPose = await ml5.handPose();
    
    // Create the webcam video and hide it
    video = createCapture(VIDEO);
    video.size(640, 480);
    video.hide();
    
    // start detecting hands from the webcam video
    handPose.detectStart(video, gotHands);


    for (let i = 0; i < numPoints; i++) {
        shapePoints[i] = createVector(random(width * 0.75), random(height * 0.5));
    }

    // noStroke();
    noFill();


}

function draw() {

    // background(0, 10); // Use a semi-transparent background for a trailing effect
  // Draw the webcam video
    scale(-1, 1); // Flip the video horizontally
    translate(-width, 0);
    image(video, 0, 0, width, height);

    // Draw all the tracked hand points
    for (let i = 0; i < hands.length; i++) {
        let hand = hands[i];
        for (let j = 0; j < hand.keypoints.length; j++) {
            let keypoint = hand.keypoints[j];
            fill(0, 255, 0);

            if (j == 4 | j == 8 ) {
                shapePoints[j / 4] = createVector(keypoint.x, keypoint.y);
            }
            circle(keypoint.x, keypoint.y, 10);

        }
    } 

    noFill();
    stroke(255);
    strokeWeight(2);


    beginShape(); 
        for (let i = 0; i < numPoints; i++) {
            vertex(shapePoints[i].x, shapePoints[i].y);
        }
    endShape(CLOSE)
}

// Callback function for when handPose outputs data
function gotHands(results) {
  // save the output to the hands variable
  hands = results;
}
