class Rectangle {
  constructor(x, y, w, h){
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h
    this.collide = false;
    this.off = false; 
  }
  
  drawRect(col){
    if (this.collide || this.off){
        fill(color(col));
        this.off = true
    } else {
        fill(255);

    }
    rect(this.x, this.y, this.w, this.h)
  }
  
  collided(cx, cy, cr){
    let closeX = cx; let closeY = cy;

    if (cx > this.x + this.w) {
      closeX = this.x + this.w;
    } else if (cx < this.x) {
      closeX = this.x;
    }
    
    if (cy > this.y + this.h) {
      closeY = this.y + this.h;
    } else if (cy < this.y){
      closeY = this.y;
    }
    
    let distX = cx - closeX;
    let distY = cy - closeY;
    let distance = sqrt((distX * distX) + (distY * distY))
  
    if (distance <= cr){
      this.collide = true;
    } else {
      this.collide = false;
    }
  }
}

let rectangles = [];
let cr = 10;
let cols; let rows;
let size = 40;
let running = true; 

//  used AI to get hex codes for a blue colour palette
let hex = [
  "144272","205295","2c74b3","5885af","8bb8e8","a7c5eb","c8d9ea",
  "003049","023e7d","0466c8","0353a4","023047","219ebc","8ecae6",
  "126782","468faf","61a5c2","89c2d9","a9d6e5","012a4a","013a63",
  "01497c","014f86","2a6f97","2c7da0","468faf","61a5c2","d0f4de"
];
function setup() {
  createCanvas(windowWidth, windowHeight);
  cols = width/size;
  rows = height/size;
  for (let i=0; i<cols; i++){
    rectangles[i] = [];
    for (let j=0; j<rows; j++){
      rectangles[i][j] = new Rectangle(i*size, j*size, size, size);
    }
  }
  stroke(240)
  print(hex.length)
  frameRate(12)
  
}

function draw() {
  for (let i=0; i<cols; i++){
    for (let j=0; j<rows; j++){
      rectangles[i][j].collided(mouseX, mouseY, cr);
      rectangles[i][j].drawRect(random(hex));
    }
  }
}

function mousePressed() {
    if (running) {
        noLoop();
    } else {
        loop();
    }

    running = !running;
}