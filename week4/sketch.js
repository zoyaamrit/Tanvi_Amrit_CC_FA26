

// let wavesPerCanvas = 8; 
// let amplitude = 100
// let offset
// let yLoc 
// let speed = 0.1

function setup() {
    createCanvas(windowWidth, windowHeight)
    noFill()
    // fill(0, 0, 180)
    // stroke(0, 0, 200)
    // fill(0)
    strokeWeight(4)
    frameRate(24)
    background(255)

}

function draw() {

    // yLoc = mouseY
    // background(255, 255, 255, 100); 
    background(255)
    // sineWave()

    // stacked waves 
    // for (let i = 0; i < 10; i++) {
    //     sineWave(10, i*10, height-10*i, i*0.1)
    // }
    //  for (let i = 0; i < 10; i++) {
    //     sineWave(10, i*10, height+10*i, i*0.1)
    // }

    // STACK 
    // let diff = height/10
    // for (let i = 1; i <= 10; i++) {
    //     sineWave(i, i*10, i*diff, i*0.1)
    // }

    // cursor follow hexagon
    // nShape(mouseX, mouseY, 8, 3)

    noiseWave(10, 100, height/2, 0.05)
  
}

function sineWave(waves, amp, yLoc, speed) {
    push()
    translate(0, yLoc)
    stroke(100, 200, 250)

        let offset = frameCount * speed 

    beginShape()

    for (let i = 0; i < width; i++) {
        let mappedI = map(i, 0, width, 0, waves * TWO_PI)

        let y = sin(mappedI + offset) * amp

        vertex(i, y)
    }

    endShape()
    pop()


}


function nShape(xLoc, yLoc, numVertices, radius) {

    push()
    translate(xLoc, yLoc)

    beginShape()

    for (let i = 0; i < numVertices; i++) {
        let mappedI = map(i, 0, numVertices, 0, TWO_PI)

        let x = sin(mappedI) * radius 
        let y = cos(mappedI) * radius

       
        vertex(x, y)
    }

    endShape(CLOSE)


    pop()
}

// function mousePressed() {
//     let v = floor(random(3, 8))
//     let r = random(50, 100)

//     nShape(mouseX, mouseY, v, r)
// }


function noiseWave(density, amp, yLoc, speed) {

    let offset = frameCount + speed 
    push() 

    translate(0, yLoc)
    beginShape()

    for (let x = 0; x < width; x++) {
        let mappedX = map(x, 0, width, 0, density) +offset
    
        let y = noise(x) * amp 

        vertex(x, y)
    }

    endShape()
    pop()
}