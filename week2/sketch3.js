
let lav, yellow, pink, orange, blue, clrs;
let count = 0; 
let size = 20; 
function setup() {
    createCanvas(windowWidth, windowHeight); 
    

    lav = color(219, 192, 232); 
    yellow = color(247, 226, 137); 
    pink = color(234, 94, 134); 
    orange = color(247, 111, 84); 
    blue = color(37, 45, 69); 

    clrs = [yellow, pink, orange, blue, lav];

    noCursor();
    background(255); 
    text("click to change colour, double click to clear", 50, 50)
    strokeWeight(30)
}

function draw() {
    
    if (count == 5) {
        stroke(random(100, 200), random(0, 255), random(0, 10))
    } else {
        stroke(clrs[count]);}
    line(pmouseX, pmouseY, mouseX, mouseY);
}

function mousePressed() {

    count++
    count = count % 6
}


function doubleClicked() {
    background(255);
}
