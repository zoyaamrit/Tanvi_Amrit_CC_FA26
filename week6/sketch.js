
let frames = []


async function setup() {

    createCanvas(windowWidth, windowHeight)
    frameRate(12)

    rectMode(CENTER)
    imageMode(CENTER)




    for (let i = 1; i < 11; i++) {
        frames[i-1] =  await loadImage("mydrawing/walk" + i +".jpg")
        
        print("walk" + i +".jpg")


    }

    // for (let i = 1; i < 15; i++) {
    //      frames[i-1] =  await loadImage("cartwheel/dude" + i +".jpg")

    // }


    //   for (let i = 1; i < 11; i++) {
    //     frames[i-1] =  await loadImage("walk_cycle_png_sequence/" + i +".png")
        
    //     // print("walk" + i +".jpg")


    // }

    noStroke()

}



let counter = 0
let xLoc = 0
let xV = 10
let dir = 1 
function draw() {



    background(255)

    // let img =  loadImage("walk1.jpg")
    // image(img, width/2, height/2)


    push()
       let currentFrame = frames[counter % frames.length]

    if(keyIsDown(RIGHT_ARROW)) {
        dir = 1
        counter++
        xLoc+=xV
    }
    
    if(keyIsDown(LEFT_ARROW)) {
        counter++
        xLoc-=xV
        dir = -1
    }


    translate(xLoc, height/2)

    scale(dir, 1)
    image(currentFrame, 0, 0)

    pop()

    fill(0)

            // print("dist to door: ", dist(xLoc, height/2, width/2, height/2))


        if (dist(xLoc, height/2, width/2, height/2) < 95) {
    window.location.href = '../index.html'  }

    rect(width/2, height/2, 100, 280)
 

    

}