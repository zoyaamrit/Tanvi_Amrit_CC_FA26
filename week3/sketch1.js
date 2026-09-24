
let v = 1; 
let t = 0; 
let limit = 100; 
let center_w, center_h
let size = 20;

function setup() {

    createCanvas(windowWidth, windowHeight)
    ellipseMode(CENTER)

    center_w = width / 2
    center_h = height / 2
    noFill()
    stroke(255)


}


function draw() {

    background(0)

    for (let i = 0; i < 4; i++) {
        let x = (i * limit) + center_w
        let y = (i * limit) + center_h
        push()
        translate(x, y)
        if (i % 2 == 0) {
            makeTri(t)
        } else {
            makeTri(-t)
        }
        pop()
    }

    for (let i = 0; i < 4; i++) {
        let x = -1 * (i * limit) + center_w
        let y = -1 * (i * limit) + center_h
        push()
        translate(x, y)
        if (i % 2 == 0) {
            makeTri(t)
        } else {
            makeTri(-t)
        }
        pop()
    }



    updateV()
}

function updateV() {
    
    if (t == limit || t == -limit) {
        v *= -1 
    } 
    t += v
}

function makeTri(move) {


    ellipse(0, 0, size)

    push()
    line(0, 0, 0, move)

    translate(0, move)
    ellipse(0, 0, size)
    pop()

    
    push()
    line(0, 0, move, 0)

    translate(move, 0)
    ellipse(0, 0, size)
    pop()


}

