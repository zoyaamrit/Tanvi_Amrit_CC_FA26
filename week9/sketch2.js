// This sketch detects if hands are pinching, and if so, moves the points of a shape to the location of the thumb

let handPose;
let video;
let hands = [];

let shapePoints = [];
let numPoints = 6

let distance 

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
    // noFill();


}



function draw() {

    try {


    // background(0, 10); // Use a semi-transparent background for a trailing effect
  // Draw the webcam video
    scale(-1, 1); // Flip the video horizontally
    translate(-width, 0);
    image(video, 0, 0, width, height);
        // if (hands.length > 0) {return;}hand


    // Draw all the tracked hand points

    for (let i = 0; i < hands.length; i++) {
        let hand = hands[i];

        // for (let j = 0; j < hand.keypoints.length; j++) {
        //     let keypoint = hand.keypoints[j];
        //     fill(0, 255, 0);
        //     noStroke();

        //     // if (j == 4 | j == 8 ) {
        //     //     fill(255, 0, 0);
        //     // }
        //     // circle(keypoint.x, keypoint.y, 5);



        // }
        // update drawing settings
        // noFill();
        // stroke(255);
        // strokeWeight(2);

        // line(hand.keypoints[4].x, hand.keypoints[4].y, hand.keypoints[8].x, hand.keypoints[8].y);
        
        distance = dist(hand.keypoints[4].x, hand.keypoints[4].y, hand.keypoints[8].x, hand.keypoints[8].y);
        // print(dist(hand.keypoints[4].x, hand.keypoints[4].y, hand.keypoints[8].x, hand.keypoints[8].y));
    
    
        
    } 

    // THIS CODE BLOCK MODIFIES THE COLOUR OF THE SHAPE BASED 
    // ON THE DISTANCE BETWEEN THE INDEX FINGER AND THUMB
        // if (distance <= 12) {
        //     fill(255, 0, 0);
        // } else {
        //     fill(0, 100, 255);
        // }
        noStroke();

        fill(255, 100)
        // stroke(0)


    for (let i = 0; i < numPoints; i++) {

        if (distance <= 12) {
            print("fingers pinched")
            if (dist(hands[0].keypoints[4].x, hands[0].keypoints[4].y, shapePoints[i].x, shapePoints[i].y) < 30 ) {
                // lerp(shapePoints[i], createVector(hands[0].keypoints[4].x, hands[0].keypoints[4].y), 0.1)
                shapePoints[i] = createVector(hands[0].keypoints[4].x, hands[0].keypoints[4].y);
                print("moving point")

            }
        }
   

    }

    beginShape(); 
        for (let i = 0; i < numPoints; i++) {
            vertex(shapePoints[i].x, shapePoints[i].y);
            ellipse(shapePoints[i].x, shapePoints[i].y, 10, 10);

        }
    endShape(CLOSE)

     } catch (error) {
        print("error")
    }
}

// Callback function for when handPose outputs data
function gotHands(results) {
  // save the output to the hands variable
  hands = results;
}
