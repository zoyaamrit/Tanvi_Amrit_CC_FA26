class Circle {

    constructor(x, y, s, c) {
        this.position = new p5.Vector(x, y)
        this.size = s
        let vx = random(4.0, 6.0)
        let vy = random(1.0, 3.0)
        this.velocity = new p5.Vector(vx, vy)
        this.c = c
    }

    drawCirc(){
        fill(color(this.c))
        ellipse(this.position.x, this.position.y, this.size, this.size)
    }

    move() {
        this.position.add(this.velocity)
    }


    checkEdges() {
        let r = this.size / 2;

        if (this.position.x + r > width || this.position.x - r < 0) {
            this.velocity.x *= -1;
        }
        if (this.position.y + r > height || this.position.y - r < 0) {
            this.velocity.y *= -1;
        }
    }
}

let c1, c2 
let collision = 0;
let isActive = false; 


function setup() {
    createCanvas(windowWidth, windowHeight);
    c1 = new Circle(random(0, width), random(0, height), 200, '0353a4');
    c2 = new Circle(random(0, width), random(0, height), 200, 'd0f4de');

noStroke()
}

function draw() {

    background(255);
    
    // determine position
    c1.move();
    c2.move();
    c1.checkEdges();
    c2.checkEdges();
    
    // confirm shape
    checkCollision()

    // draw
    c1.drawCirc();
    c2.drawCirc();
}

function checkCollision() {
    let d = dist(c1.position.x, c1.position.y, c2.position.x, c2.position.y)
    // touching if distance is less than width of object 
    let touching = d <= (c1.size);


    // determine if its the first collision or not 
    if (touching && !isActive && collision < 6) {
        collision++ 
             c1.c = color(random(255), random(255), random(255))
            c2.c = color(random(255), random(255), random(255))
    }

    isActive = touching;
    
}
