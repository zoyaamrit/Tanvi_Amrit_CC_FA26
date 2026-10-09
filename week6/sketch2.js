class FLOWER{

    constructor(x, y, numP, pL, pW) {
        this.x = x 
        this.y = y 
        this.c = color(random(200), 100, random(200), 50)
        // this.c = color(255, random(10, 100))
        this.numPetals = numP
        this.petalLength = pL
        this.petalWidth = pW
        this.centerDiamter = 20
        this.xV = random(-2, 2)
        this.yV = random(-2, 2)

        this.rotations = 0
        this.rV = random(-5, 5)

    }

    move() {
        this.x += this.xV 
        this.y += this.yV 
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
        pop()

    }
}



let flower = {
    x:              500, 
    y:              500, 
    numPetals:      20,
    petalWidth:     20, 
    petalLength:    100, 
    centerDiamter:  50

}

flowers = []


function setup() {
    createCanvas(windowWidth, windowHeight)
    background(0)
    angleMode(DEGREES)
    frameRate(24)
    // push()
    noStroke()
    // fill(255, 221, 210)
    // translate(flower.x, flower.y)

    // let rotation = TWO_PI / flower.numPetals

    // for (let r = 0; r < flower.numPetals; r++) {
    //     push()
    //     rotate(rotation * r) 
    //     translate(flower.petalLength/2, 0)
    //     ellipse(0, 0, flower.petalLength, flower.petalWidth)
    //     pop()
    // }
    // pop()

    //  PRESET FLOWERS 
    // for (let i = 0; i < 15;  i++) {
    //     flowers[i] = new FLOWER(random(0, width), random(0, height), random(5, 25), random(10, 100), random(3, 10), 20)
    // }
}


function draw() {

    background(0)
    for (let i =0; i < flowers.length; i++) {
        // let d = map(mouseX, 0, width, -0.5, 0.5)
      

        if (flowers[i].x > width + 100|| flowers[i].y > height + 100 || 
            flowers[i].x < -100 || flowers[i].y < -100
            )  {
            flowers.splice(i, 1)
            print("flower ded oops, only ", flowers.length, " remaining")
        }
        flowers[i].move()
        flowers[i].drawFlower()
    }

    // for 

    
}

function mouseDragged() {
    flowers.push(new FLOWER(mouseX, mouseY, random(5, 25), random(10, 100), random(3, 10)))
}
function mousePressed() {
    flowers.push(new FLOWER(mouseX, mouseY, random(5, 25), random(10, 100), random(3, 10), 20))
}