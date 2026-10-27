

let pMapper; 
let quadMap, quadMap2, quadMap3, quadMap4;
let buf1, buf2, buf3, buf4; 

let worm; 
let wormBufs = []; 
let wormGif 


async function setup() {
    createCanvas(windowWidth, windowHeight, WEBGL)
    pMapper = createProjectionMapper(this);

    quadMap = pMapper.createQuadMap(400, 400, 20, 20);
    quadMap2 = pMapper.createQuadMap(300, 200, 20, 20);
    quadMap3 = pMapper.createQuadMap(300, 300, 20, 20);
    quadMap4 = pMapper.createQuadMap(300, 300, 20, 20);

    buf1 = createGraphics(400, 400)
    buf2 = createGraphics(400, 400)
    buf3 = createGraphics(400, 400)
    buf4 = createGraphics(400, 400)

    wormGif = await loadImage("worm.gif")

    wormBufs = [buf1, buf2, buf3, buf4];
    worm = new CHARACTER(wormBufs, wormGif)

}

function red_bg(pg) {
    pg.background(255, 0, 0)
    
}

function blue_bg(pg) {
    pg.background(0, 255, 0)
    
}

function green_bg(pg) {
    pg.background(0, 0, 255)
    
}

function another_bg(pg) {
    pg.background(10, 100, 50)
    
}

function keyPressed() {
  if (key === "c") pMapper.toggleCalibration();
  if (key === "s") pMapper.save("map.json");
  if (key === "l") pMapper.load("maps/map.json");
  if (key === "f") fullscreen(!fullscreen());


  // stop the arrow keys from scrolling the page
  if ([LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW].includes(keyCode)) {
    return false;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}



class CHARACTER  {
    constructor(buffers, img) {
        this.buffers = buffers
        this.img = img 
        this.index = 0
        this.speed = 4      // horizontal speed
        this.vSpeed = 0.01  // vertical speed
        this.dir = 1    
        this.yLim = 0.5

        // for cropping out blank pixels
        this.sx = 115;
        this.sy = 200;
        this.sw = 365;
        this.sh = 185;

        // draw size inside a buffer
        this.w = 180;
        this.h = this.w * (this.sh / this.sw);
        this.x = this.w / 2; 
    }

    get pg() {
        return this.buffers[this.index]
    }

    nextIndex() {
        return (this.index + 1) % this.buffers.length
    }
     
    prevIndex() {
        return (this.index - 1 + this.buffers.length) % this.buffers.length
    }

    update() {

        // determine motion
        if (keyIsDown(RIGHT_ARROW)) {
            this.x += this.speed;
            this.dir = 1;
        }
        if (keyIsDown(LEFT_ARROW)) {
            this.x -= this.speed;
            this.dir = -1;
        }
        
        if (keyIsDown(UP_ARROW)) this.yLim -= this.vSpeed;
        if (keyIsDown(DOWN_ARROW)) this.yLim += this.vSpeed;

        // constrain on y axis
        let margin = (this.h / 2) / this.pg.height;
        this.yLim = constrain(this.yLim, margin, 1 - margin);

        // pass worm to next page
        if (this.x > this.pg.width) {
            this.x -= this.pg.width;
            this.index = this.nextIndex();
        } else if (this.x < 0) {
            this.index = this.prevIndex();
            this.x += this.pg.width;
        }

    }


    display() {
        let pg = this.pg 
        let half = this.w / 2 

        this.drawBody(pg, this.x, this.yLim * pg.height)

        // OVERFLOW 
        // if (this.x + half > pg.width) {
        //     let next = this.buffers[this.nextIndex()];
        //     this.drawBody(next, this.x - pg.width, this.yRatio * next.height);
        // }
    }


    drawBody(pg, x, y) {
        pg.push()
        pg.translate(x, y)
        pg.scale(this.dir, 1)
        pg.imageMode(CENTER);
        pg.image(this.img, 0, 0, this.w, this.h,
                this.sx, this.sy, this.sw, this.sh
        )
        pg.pop()
    }

}

function draw() {
    background(0)

    red_bg(buf1)
    blue_bg(buf2)
    green_bg(buf3)
    another_bg(buf4)

    if (worm) {
        worm.update();
        worm.display();
    }


    quadMap.displayTexture(buf1);
    quadMap2.displayTexture(buf2);
    quadMap3.displayTexture(buf3);
    quadMap4.displayTexture(buf4);
}