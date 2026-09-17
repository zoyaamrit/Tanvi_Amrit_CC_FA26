let followerX = 0, followerY = 0; 
let mouseMoved = false; 
let drag = 0.1; 
let rectSize = 30;
let color; 

// splatter pattern with person 
function setup() {
  createCanvas(windowWidth, windowHeight);
  noCursor();
  
  
}

function draw() {

    
    let cornerRadius = 2; 
    rectMode(CENTER);
    rect(mouseX, mouseY, rectSize, rectSize, cornerRadius);

}


function mousePressed() {
    background(255);
}