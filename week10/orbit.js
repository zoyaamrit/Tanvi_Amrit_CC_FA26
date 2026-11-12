let video;
let poseNet;
let poses = [];
let particles = [];
let flowField = [];

// Grid settings
const GRID_RESOLUTION = 30; 
let cols, rows;

// Flow field settings
const SCALE = 0.1;
let SPEED = 2;
const VARIATION = 8000;
const ARROW_SIZE = 10;

// Particle settings
const MAX_PARTICLES = 10000;


// DESERT 
// var colors = ['#DB7F67', '#DBBEA1', '#A37B73', '#3F292B', '#D34F73'];

// BLUE
// var colors2 = ['#1B3B6F', '#065A82', '#1C7293', '#21295C', '#9EB3C2', '#CFD2CD'];

// GRAY
// var colors = ["#FBFBF2", "#E5E6E4", "#CFD2CD", "#A6A2A2", "#847577"]

// PINKISH
 // var colors2 = [#32cbffff, #00a5e0ff, #89a1efff, #ef9cdaff, #fecef1ff]


var colors = ["#32cbffff", "#00a5e0ff", "#89a1efff", "#ef9cdaff", "#fecef1ff", "#FBFBF2", "#E5E6E4", "#CFD2CD", "#A6A2A2", "#847577", '#1B3B6F', '#065A82', '#1C7293', '#21295C', '#9EB3C2', '#CFD2CD', '#DB7F67', '#DBBEA1', '#A37B73', '#3F292B', '#D34F73']


class Particle {
  constructor(x, y) {
    this.pos = createVector(x || random(width), y || random(height));
    this.life = random(50, 1000);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = 2;
    this.color = color(random(colors));
    this.weight = random(5);
  }
  
  follow(flowField) {
    let x = floor(this.pos.x / GRID_RESOLUTION);
    let y = floor(this.pos.y / GRID_RESOLUTION);

    
    x = constrain(x, 0, cols - 1);
    y = constrain(y, 0, rows - 1);
    let index = x + y * cols;
    
    let force = flowField[index];
    if (force) {
      this.applyForce(force);
    }
  }
  
  applyForce(force) {
    this.acc.add(force);
  }
  
  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.life--;
  }

  orbitWrists(wrists) {
    if (wrists.length === 0) return; 
    
    for (let wrist of wrists) {
      if (!wrist) continue; 
      
      let toWrist = p5.Vector.sub(wrist, this.pos);
      let distance = toWrist.mag();
      if (distance > 300) continue;
      
      if (distance < 100) {
        this.color = color(random(colors));
      }
      
      let tangent = createVector(-toWrist.y, toWrist.x);
      tangent.normalize();
      
      let strength = 100 / (distance * 0.1);
      tangent.mult(strength);
      
      this.applyForce(tangent);
      
      let slightAttract = toWrist.copy().normalize().mult(0.01);
      this.applyForce(slightAttract);
    }
  }
  

  
  draw() {
    stroke(this.color);
    strokeWeight(this.weight);
    point(this.pos.x, this.pos.y);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  // background(250);
  
  video = createCapture(VIDEO);
  video.size(width, height);
  
  poseNet = ml5.poseNet(video, modelReady);
  poseNet.on('pose', function(results) {
    poses = results;
  });
  
  video.hide();
  
  cols = ceil(width / GRID_RESOLUTION);
  rows = ceil(height / GRID_RESOLUTION);
  noiseDetail(4, 0.5);
  initFlowField();
  
  //  initial particles
  for (let i = 0; i < 5000; i++) {
    particles.push(new Particle());
  }
  
  frameRate(24);
}

function modelReady() {
  select('#status').html('Model Loaded');
}

function initFlowField() {
  flowField = new Array(cols * rows);
  
  let yoff = 0;
  for (let y = 0; y < rows; y++) {
    let xoff = 0;
    for (let x = 0; x < cols; x++) {
      let angle = noise(xoff, yoff, frameCount / VARIATION) * TWO_PI * 2;
      let v = p5.Vector.fromAngle(angle);
      v.setMag(SPEED);
      
      let index = x + y * cols;
      flowField[index] = v;
      
      xoff += SCALE;
    }
    yoff += SCALE;
  }
}

function draw() {
  // video as background
  // image(video, 0, 0, width, height);
  // background (0, 0, 0, 50);

  // normal background
  background(240, 240, 240); 
  background(0)
  noStroke();
  
  let wristPositions = [];
  
  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i].pose;
    
    // Find left and right wrists
    let leftWrist = pose.keypoints.find(keypoint => keypoint.part === 'leftWrist');
    let rightWrist = pose.keypoints.find(keypoint => keypoint.part === 'rightWrist');
    
    if (leftWrist && leftWrist.score > 0.2) {
      wristPositions.push(createVector(leftWrist.position.x, leftWrist.position.y - 100));
      
      fill(255, 0, 0);
      noStroke();
      ellipse(leftWrist.position.x, leftWrist.position.y - 100, 10, 10);
    }
    
    if (rightWrist && rightWrist.score > 0.2) {
      wristPositions.push(createVector(rightWrist.position.x, rightWrist.position.y - 100));
      
      fill(0);
      noStroke();
      ellipse(rightWrist.position.x, rightWrist.position.y - 100, 10, 10);
    }
  }
  

  for (let i = 0; i < MAX_PARTICLES - particles.length; i++) {
    particles.push(new Particle());
  }
  
  for (let i = particles.length - 1; i >= 0; i--) {
    let particle = particles[i];
    
    particle.follow(flowField);
    particle.orbitWrists(wristPositions); 
    particle.update();
    particle.draw();
    
    // Remove dead particles
    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }
}


function updateFlowField() {

  zoff = frameCount + 0.01;

  let yoff = 0;
  for (let y = 0; y < rows; y++) {
    let xoff = 0;
    for (let x = 0; x < cols; x++) {
      let angle = noise(xoff, yoff, zoff) * TWO_PI * 2;
      let v = p5.Vector.fromAngle(angle);
      v.setMag(SPEED);
 
      let index = x + y * cols;
      flowField[index] = v;
      xoff += SCALE;
    }
    yoff += SCALE;
  }
  
}

function keyPressed() {
  if (key === ' ') {
      updateFlowField();

  }
}