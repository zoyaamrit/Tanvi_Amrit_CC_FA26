// D Minor Pentatonic Scale
// let notes = [293.66, 349.23, 392.00, 440.00, 523.25, 586];
//uncomment the line below to use note names instead of frequencies
notes = ['D6', 'F6', 'G5', 'A5', 'C6', 'D4'];
// notes = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'];
let originX = 0 
let originY = 0

let bg 




function setup() {
  createCanvas(windowWidth, windowHeight);
  bg = color(0, 0, 128, 10);
  background(bg);
  stroke(255)
  strokeWeight(2)
  textAlign(CENTER);
  textSize(13);
  // text('click and drag mouse around', width/2, 150);

  osc = new p5.Oscillator("square");
  //create an envelope to control the amplitude of the oscillator
  env = new p5.Envelope(0.03, 0.01, 0.7, 0.2);
  delay = new p5.Delay(0.12, 0.7);
  
  osc.disconnect();
  osc.connect(env);
  env.disconnect();
  env.connect(delay);

  describe('A grey sketch that demonstrates how to play a D Minor Pentatonic scale.');
}

function mousePressed() {
  // text('move the mouse left to right to change notes', width/2, 150);
  osc.start();
  //trigger the attack, or onset, of the envelope to start the sound
  env.triggerAttack();
  // circle(mouseX, mouseY, 15)
  originX = mouseX
  originY = mouseY
}

function mouseReleased() {
  //trigger the release of the envelope to stop the sound
  env.triggerRelease();
} 

function mouseDragged()   {
  line(originX, originY, mouseX, mouseY)
  line(pmouseX, pmouseY, mouseX, mouseY)
  fill(255, 100)
  // triangle(originX, originY, pmouseX, pmouseY, mouseX, mouseY)
}
function draw() {
  background(bg);
  //map the mouseX position to the pentatonic scale and constrain the range to the length of the notes array
  scaleDegree = constrain(floor(map(mouseX, 0, width, 0, notes.length - 1)), 0, notes.length - 1); 
  osc.freq(notes[scaleDegree], 0.025)
  // if (mouseIsPressed) {
  //   background(0, 255, 255);
  //   if (typeof notes[scaleDegree] === 'string') {
  //     text('you are playing note: ' + notes[scaleDegree], width/2, 150);
  //   }
  //   else {
  //     text('you are playing note: ' + notes[scaleDegree] + ' Hz', width/2, 150);
  //   }
  // }
  // else {
  //   text('click and move the mouse left to right to change notes', width/2, 150);
  // }
  
}