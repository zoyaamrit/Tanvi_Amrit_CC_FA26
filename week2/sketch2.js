let followerX = 0, followerY = 0; 
let mouseMoved = false; 
let drag = 0.1; 
let headsize = 15, bodysize = 30; 

function setup() {
  createCanvas(windowWidth, windowHeight);
  noCursor();
}

function draw() {
  background(255);
  
  let leaderX = mouseX; 
  let leaderY = mouseY; 
  
  mouseMoved = (mouseX != pmouseX) || (mouseY != pmouseY); 
  
  followerX += (leaderX - followerX) * drag;
  followerY += ((leaderY + 25) - followerY) * drag;
  
  if (mouseMoved) {
    fill(0);
    noStroke();
    ellipse(followerX, followerY, bodysize, bodysize);
  } else {
    fill(0);
    noStroke();
    let rectSize = bodysize;
    let cornerRadius = 2; 
    rectMode(CENTER);
    rect(followerX, followerY, rectSize, rectSize, cornerRadius);
  }

  
  fill(0);
  noStroke();
  ellipse(mouseX, mouseY, headsize, headsize);
}

