let xLoc = []
let yLoc = []
let numSeg = 50

function setup() {
    createCanvas(windowWidth, windowHeight)

    for(let i = 0; i < numSeg; i++) {
        xLoc[i] = width/2
        yLoc[i] = height/2 

    }
    
    print(xLoc, yLoc)
    stroke(255)
  
}
let counter = 0
function draw() {
    background(0)
    noFill()
    // noStroke()
    stroke(255)
    // strokeWidth(3)

    // MOTION LOCKED TO MOUSE 
    xLoc[numSeg - 1] = mouseX
    yLoc[numSeg - 1] = mouseY


    // MOTION LOCKED TO NOISE 
    // xLoc[numSeg - 1] = width *  noise(counter)
    // yLoc[numSeg - 1] = height * noise(counter+10)

    for (let i = 0; i < numSeg -1 ; i++) {
        
        xLoc[i] = xLoc[i+1]
        yLoc[i] = yLoc[i+1]

        // line(x )
        let diameter = 200*sin(map(i, 0, numSeg-1, 0, PI))
        let r = diameter
        let g = 200 - 2*diameter 
        let b = 200*cos(map(i, 0, numSeg-1, 0, PI))

        // stroke(r, g, b)

        ellipse(xLoc[i], yLoc[i], diameter)
    }

    counter++

}