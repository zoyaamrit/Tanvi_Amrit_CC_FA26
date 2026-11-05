// This sketch renders each keypoint of the hand as a flower
// the flowers are drawn at the keypoint locations and rotate over time
// they are linked to the movement of the hand

class FLOWER{

    constructor(x, y, numP, pL, pW) {
        this.x = x 
        this.y = y 
        this.c = color(random(200), 100,random(200))
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



let handPose;
let video;
let hands = [];
let flowers = [];

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

  for (let i = 0; i < 50; i++) {
    let flower = new FLOWER(random(width), random(height), random(5, 8), random(10, 50), random(20, 30));
    flowers.push(flower);
  }
}

function draw() {

    // transparency
    background(0, 10); 

  // Draw the webcam video, flip horizontally 
    scale(-1, 1); 
    translate(-width, 0);
//   image(video, 0, 0, width, height);

  // Draw all the tracked hand points
    for (let i = 0; i < hands.length; i++) {
        let hand = hands[i];
        for (let j = 0; j < hand.keypoints.length; j++) {
            let keypoint = hand.keypoints[j];
            fill(0, 255, 0);
            noStroke();
            //   circle(keypoint.x, keypoint.y, 10);
            flowers[j].x = keypoint.x;
            flowers[j].y = keypoint.y;
            flowers[j].move();
            flowers[j].drawFlower();
        }
    } 
}

// Callback function for when handPose outputs data
function gotHands(results) {
  // save the output to the hands variable
  hands = results;
}
