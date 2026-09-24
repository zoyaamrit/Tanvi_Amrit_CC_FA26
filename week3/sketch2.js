// default positions for body parts 
// assuming center is [0, 0]

const DEFAULT = {

    head:   [0, -200], 
    neck:   [0, -150], 
    chest:  [0, -100], 
    pelvis: [0, 0], 

    shoulderL:  [-50, -120], 
    shoulderR:  [50, -120], 

    elbowL: [-75, -50],
    elbowR: [75, -50], 

    handL: [-85, 15], 
    handR: [85, 15], 

    hipL: [-25, 30], 
    hipR: [25, 30], 

    kneeL: [-35, 110], 
    kneeR: [35, 110], 

    footL: [-38, 200], 
    footR: [38, 200]
}

// bones + connection points in the body 
const LIMBS = [
    ['head', 'neck'],  
    ['neck', 'chest'],
    ['chest', 'pelvis'], 

    ['neck', 'shoulderL'], 
    ['neck', 'shoulderR'], 

    ['shoulderL', 'elbowL'], 
    ['elbowL', 'handL'],
    ['shoulderR', 'elbowR'], 
    ['elbowR', 'handR'], 

    ['pelvis', 'hipL'], 
    ['pelvis', 'hipR'], 

    ['hipL', 'kneeL'], 
    ['hipR', 'kneeR'], 
    ['kneeL', 'footL'], 
    ['kneeR', 'footR']
]

// keep some structure to puppet 
const BRACES  = [
    ['shoulderL', 'shoulderR'], 
    ['hipL', 'hipR'], 
    ['shoulderL', 'chest'], 
    ['shoulderR', 'chest'], 
    ['chest', 'hipL'], 
    ['chest', 'hipR'], 
    ['head', 'chest'], 
    ['shoulderL', 'hipL'], 
    ['shoulderR', 'hipR']
]
const DAMPING = 0.8 
const RESET_VALUE = 0.02 
const CONNECTION = 0.05 
const ECHO = 0.5 

let joints = {};
let constraints = [];
let jumps = {};              
let dragged = null;
let hovered = null;

function defaultPosition(name) {
    // add x value to center width and y value to center height 
    return [width / 2 + DEFAULT[name][0], height / 2 + DEFAULT[name][1]];
}

function addConstraint(a, b, brace) {
    // store the distance between each body part pair - so each limb construct
    // brace specifies how 'stiff' the connection is 
    const [ax, ay] = DEFAULT[a], [bx, by] = DEFAULT[b]
    constraints.push({ a, b, len: dist(ax, ay, bx, by), brace })
}


function setup() {
    createCanvas(windowWidth, windowHeight)

    for (const name in DEFAULT) {
        // go through each default position and refit to the canvas size 
        const [x, y] = defaultPosition(name);        
        // create joints, bind a default xy and pxy to represent motion
        joints[name] = { name, x, y, px: x, py: y };
    }


    // build constraints using the limbs and braces 
    for (const [a, b] of LIMBS) addConstraint(a, b, 0.5)
    for (const [a, b] of BRACES) addConstraint(a, b, 0.25)

    noStroke()

    limb_dist();
}

// determine distance between each limb to impact how much a single movement
// affects the interconnected parts
function limb_dist() {
    const adjacent = {}
 
    for (const l in DEFAULT) adjacent[l] = []; 
    // for each limb, add a as connect to b and b as connected to a in 
    // the adjacency list 
    for (const [a, b] of LIMBS) { adjacent[a].push(b); adjacent[b].push(a); }
 
    for (const init in DEFAULT) {
        // first limb is 0 away 
        jumps[init] = { [init]: 0}; 
        const queue = [init]
        while (queue.length) {
            // check if each limb is connected to this limb
            const cur = queue.shift() // move to next body part 
            for (const n of adjacent[cur]) {
                if (jumps[init][n] === undefined) //termination logic
                {   // neighbor is one step further than the current body part
                    jumps[init][n] = jumps[init][cur] + 1
                    queue.push(n)
                }
            }
        }
    }
 
}
const PALETTE = {
    paper: "#fff",
    midlight: "#9BB1FF",
    light: "#BFD7FF",
    mid: "#788BFF",
    dark:"#5465FF"
    
};


function draw() {
    background(PALETTE.paper)
    move()
    drawBody()
    updateCursor()
    
}


function move() {

    for (const name in joints) {
        // get curr joint
        const j = joints[name]
        if (j == dragged) continue;
        
        // xy velocity is distance between default and current position 
        // facture in damping for speed of motion
        const vx = (j.x - j.px) * DAMPING
        const vy = (j.y - j.py) * DAMPING

        // upadte current x positioning 
        j.px = j.x; j.py = j.y; 
        
        const [rx, ry] = defaultPosition(name);
        j.x += vx + (rx - j.x) * RESET_VALUE;
        j.y += vy + (ry - j.y) * RESET_VALUE;

    }

    // the dragged join follows cursor movement 
    if (dragged) {
        // change in dist
        const dx = mouseX - dragged.x;
        const dy = mouseY - dragged.y;

        // calculate updated position for each limb 
        // based on connection to the moving limb 
        for (const name in joints) {
            const j = joints[name];
            if (j === dragged) continue;
            const k = CONNECTION * pow(ECHO, jumps[dragged.name][name] - 1);
            j.x += dx * k;
            j.y += dy * k;
        }

        //update positins
        dragged.px = dragged.x; dragged.py = dragged.y;
        dragged.x = mouseX; dragged.y = mouseY;
    }

    for (let i = 0; i < 5; i++) {
        for (const c of constraints) {

            const a = joints[c.a], b = joints[c.b]
            const dx = b.x - a.x, dy = b.y - a.y
            const d = max(sqrt(dx * dx + dy * dy), 0.0001);
            const target = c.len;

            const diff = ((d - target) / d) * c.brace
            const aFixed = a == dragged, bFixed = b == dragged
            if (aFixed && bFixed) continue; 

            const wa = aFixed ? 0 : bFixed ? 1 : 0.5;
            const wb = bFixed ? 0 : aFixed ? 1 : 0.5;
            a.x += dx * diff * wa * 2; a.y += dy * diff * wa * 2;
            b.x -= dx * diff * wb * 2; b.y -= dy * diff * wb * 2;




        }
    }


}


function limbRect(a, b, w, col) {
    const len = dist(a.x, a.y, b.x, b.y)
    push()
    translate(a.x, a.y)
    // looked up how to rotate from point a to b 
    rotate(atan2(b.y - a.y, b.x - a.x))

    fill(col)
    rect(-w/2, -w/2, len+w, w)
    pop()

}

function drawHead(neck, head) {
    // rotate from head to neck + 90 deg to put in center 
    let ang = atan2(head.y - neck.y, head.x - neck.x) + PI/2

    push()
    translate(head.x, head.y)
    rotate(ang)
    fill(PALETTE.dark)
    ellipse(0, -14, 60, 60)
    pop()
}


function drawHand(elbow, hand) {
    push()
    translate(hand.x, hand.y)
    rotate(atan2(hand.y - elbow.y, hand.x - elbow.x))
    fill(PALETTE.dark)
    rect(0, -10, 15, 15)
    pop()
}

function drawFoot(knee, foot) {
    push()
    translate(foot.x, foot.y)
    rotate(atan2(foot.y - knee.y, foot.x - knee.x))
    fill(PALETTE.dark)
    ellipse(0, 0, 20, 20)
    pop()
}


function nearestJoint(x, y) {
    let closest = null
    let distance = 25
    for (const n in joints) {
        const j = joints[n]
        const d = dist(x, y, j.x, j.y)
        if (d < distance) {
            distance = d
            closest = j 
        }
    }

    return closest
}

function drawBody() {
    const J = joints; 

    // left leg
    limbRect(J.hipL, J.kneeL, 20, PALETTE.mid)
    limbRect(J.kneeL, J.footL, 15, PALETTE.mid)
    // right leg
    limbRect(J.hipR, J.kneeR, 20, PALETTE.midlight)
    limbRect(J.kneeR, J.footR, 15, PALETTE.midlight)

    // feet 
    drawFoot(J.kneeL, J.footL)
    drawFoot(J.kneeR, J.footR)

    fill(PALETTE.light)
    // using 4 points to make a rectangle 
    // using quad function 
    quad(   J.shoulderL.x, J.shoulderL.y, 
            J.shoulderR.x, J.shoulderR.y, 
            J.hipR.x, J.hipR.y, 
            J.hipL.x, J.hipL.y
    )

    limbRect(J.neck, J.head, 10, PALETTE.light)
    drawHead(J.neck, J.head)

    limbRect(J.shoulderL, J.elbowL, 15, PALETTE.midlight)
    limbRect(J.shoulderR, J.elbowR, 15, PALETTE.mid)
    limbRect(J.elbowL, J.handL, 12, PALETTE.midlight)
    limbRect(J.elbowR, J.handR, 12, PALETTE.mid)
    drawHand(J.elbowL, J.handL)
    drawHand(J.elbowR, J.handR)


}

function updateCursor() {
  hovered = nearestJoint(mouseX, mouseY);
  cursor(hovered ? 'grab' : ARROW);
}


function mousePressed() {
  dragged = nearestJoint(mouseX, mouseY);
}

function mouseReleased() {
  dragged = null;
}