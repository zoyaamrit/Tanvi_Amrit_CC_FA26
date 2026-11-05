// This sketch detects if hands are pinching, 
// moves the points of a shape to the location of the thumb
// all the vertex points of the shape are flowers 

let handPose;
let video;
let hands = [];

let shapePoints = [];
let numPoints = 6

let distance 

let flowers = []
class FLOWER{

    constructor(x, y, numP, pL, pW) {
        this.x = x 
        this.y = y 
        this.c = color(random(190, 255), random(50, 120), random(10, 40))
        // this.c = color(255, random(10, 100))
        this.numPetals = numP
        this.petalLength = pL
        this.petalWidth = pW
        this.centerDiamter = 10
        // this.xV = random(-2, 2)
        // this.yV = random(-2, 2)

        this.rotations = 0
        this.rV = random(-5, 5)

    }

    move() {
        // this.x += this.xV 
        // this.y += this.yV 
        this.rotations += this.rV 
    }

    drawFlower() {

        push()
       
        fill(this.c)
        translate(this.x, this.y)
        rotate(this.rotations)

        let rotation = 360 / this.numPetals

        for (let r = 0; r < this.numPetals; r++) {
            push()
            rotate(rotation * r) 
            translate(this.petalLength/2, 0)
            ellipse(0, 0, this.petalLength, this.petalWidth)
            pop()
        }
        fill(255, 100)
        ellipse(0, 0, this.centerDiamter, this.centerDiamter)


        pop()

    }
}


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
        let flower = new FLOWER(random(width), random(height), random(5, 8), random(10, 30), random(10, 15));
        flowers.push(flower);
    }

            noStroke();


}



function draw() {

    
    // background(0, 10); // Use a semi-transparent background for a trailing effect
  // Draw the webcam video
    scale(-1, 1); // Flip the video horizontally
    translate(-width, 0);
    image(video, 0, 0, width, height);
        // if (hands.length > 0) {return;}hand


    // Draw all the tracked hand points
    if (hands.length > 0) {

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
}


    beginShape(); 
        for (let i = 0; i < numPoints; i++) {
            vertex(shapePoints[i].x, shapePoints[i].y);
        }
    endShape(CLOSE)

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
