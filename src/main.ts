import { fromEvent, interval, merge } from "rxjs";
import { map, filter, scan } from "rxjs/operators";
import { visitLexicalEnvironment } from "typescript";

type Key = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "Space" | "ArrowDown";
type Event = "keydown" | "keyup";

function main() {
  /**
   * Inside this function you will use the classes and functions from rx.js
   * to add visuals to the svg element in pong.html, animate them, and make them interactive.
   *
   * Study and complete the tasks in observable examples first to get ideas.
   *
   * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
   *
   * You will be marked on your functional programming style
   * as well as the functionality that you implement.
   *
   * Document your code!
   */

  /**
   * This is the view for your game to add and update your game elements.
   */
  const Constants = {
    CanvasSize: 600,
    StartCarWidth: 80,
    StartCarHeight: 40,
    StartLogWidth: 200,
    StartLogHeight: 40,
    StartCarsCount: 3,
    StartLogsCount: 4,
    StartTurtleRadius: 25,
    StartTurtleCount: 12,
    StartTime: 0,
  } as const;

  // our game has the following view element types:
  type ViewType = "frog" | "car" | "log" | "turtle"|"fly";
  type Direction = "forward" | "backward" | "left" | "right";

  // Two types of game state transitions
  class Tick {
    constructor(public readonly elapsed: number) {}
  }
  class Move {
    constructor(public readonly direction: Direction) {}
  }
//The observable filter all other unnecessary keyboard events, leaving only arrow up,down, left and right

  const gameClock = interval(10).pipe(map((elapsed) => new Tick(elapsed))),
    keyObservable = <T>(e: Event, k: Key, result: () => T) =>
      fromEvent<KeyboardEvent>(document, e).pipe(
        filter(({ code }) => code === k),
        filter(({ repeat }) => !repeat),
        map(result)
      ),
    //For each keydown event, a class Move is created inform the model to update the position
    moveLeft = keyObservable("keydown", "ArrowLeft", () => new Move("left")),
    moveRight = keyObservable("keydown", "ArrowRight", () => new Move("right")),
    moveForward = keyObservable("keydown","ArrowUp",() => new Move("forward")),
    moveBackward = keyObservable("keydown","ArrowDown",() => new Move("backward"));

  type Rectangle = Readonly<{ pos: Vec; width: number; height: number }>;
  type Circle = Readonly<{ pos: Vec; radius: number }>;

  type ObjectId = Readonly<{ id: string; createTime: number }>;
  interface IBody extends Rectangle, Circle, ObjectId {
    viewType: ViewType;
    vel: Vec;
    acc: Vec;
    score: number;
  }

  // Every object that participates in physics is a Body
  type Body = Readonly<IBody>;

  // Game state
  type State = Readonly<{
    time: number;
    frog: Body;
    bullets: ReadonlyArray<Body>;
    car: ReadonlyArray<Body>;
    log: ReadonlyArray<Body>;
    turtle: ReadonlyArray<Body>;
    gameOver: boolean;
    score: number;
    highscore: number;
    area1: number;
    area2: number;
    area3: number;
    area4: number;
    counter: number;
    lives: number;
    level:number;
  }>;

 
  const createRectangle =
      (viewType: ViewType) =>
      (oid: ObjectId) =>
      (rect: Rectangle) =>
      (vel: Vec) =>
        <Body>{
          ...oid,
          ...rect,
          vel: vel,
          acc: Vec.Zero,

          id: viewType + oid.id,
          viewType: viewType,
        },
    createCircle =
      (viewType: ViewType) => (oid: ObjectId) => (circ: Circle) => (vel: Vec) =>
        <Body>{
          ...oid,
          ...circ,
          vel: vel,
          acc: Vec.Zero,
          id: viewType + oid.id,
          viewType: viewType,
          score: 0,
          width: 0,
          height: 0,
        },
    createCar = createRectangle("car"),
    createLog = createRectangle("log"),
    createTurtle = createCircle("turtle");

  function createFrog(): Body {
    return {
      id: "frog",
      viewType: "frog",
      pos: new Vec(300, 570),
      vel: Vec.Zero,
      acc: Vec.Zero,
      width: 20,
      height: 40,
      createTime: 0,
      score: 0,
      radius: 0,
    };
  }
  /**
  *  Here is the declaration of all of the position of each element inside array row and column
  *  to be created
  */
  const row = [0, 200, 400],
    column = [490, 430, 370],
    logColumn = [250, 130, 250, 130],
    logRow = [0, 50, 400, 450],
    turtleRow = [0, 20, 60, 80, 120, 140, 300, 320, 360, 380, 420, 440],
    turtleColumn = [90, 210, 90, 210, 90, 210, 90, 210, 90, 210, 90, 210];
    //i%2 is used to decide which direction in a row should a car moves to
  const initialCarsDirections = [...Array(Constants.StartCarsCount)].map(
      (_, i) => (i % 2 === 0 ? new Vec(0.8, 0) : new Vec(-1, 0))
    ),
    initialLogsDirections = [...Array(Constants.StartLogsCount)].map((_, i) =>
      i % 2 === 0 ? new Vec(1, 0) : new Vec(0.8, 0)
    ),
    initialTurtleDirections = [...Array(Constants.StartTurtleCount)].map(
      (_, i) => (i % 2 === 0 ? new Vec(-1, 0) : new Vec(-0.8, 0))
    ),
    //a curried function is used to parse in the data required to create Cars, logs and turtle
    startCars = [...Array(Constants.StartCarsCount)].map((_, i) =>
      createCar({ id: String(i), createTime: Constants.StartTime })({
        pos: new Vec(row[i], column[i]),
        width: Constants.StartCarWidth,
        height: Constants.StartCarHeight,
      })(initialCarsDirections[i])
    ),
    startLogs = [...Array(Constants.StartLogsCount)].map((_, i) =>
      createLog({ id: String(i), createTime: Constants.StartTime })({
        pos: new Vec(logRow[i], logColumn[i]),
        width: Constants.StartLogWidth,
        height: Constants.StartLogHeight,
      })(initialLogsDirections[i])
    ),
    startTurtle = [...Array(Constants.StartTurtleCount)].map((_, i) =>
      createTurtle({ id: String(i), createTime: Constants.StartTime })({
        pos: new Vec(turtleRow[i], turtleColumn[i]),
        radius: Constants.StartTurtleRadius,
      })(initialTurtleDirections[i])
    ),

    //I initialise the start state of the game here
    initialState: State = {
      time: 0,
      frog: createFrog(),
      bullets: [],
      car: startCars,
      log: startLogs,
      turtle: startTurtle,
      gameOver: false,
      score: 0,
      area1: 0,
      area2: 0,
      area3: 0,
      area4: 0,
      counter: 0,
      highscore: 0,
      lives: 3,
      level:1
    },
    // wrap a positions around edges of the screen
    torusWrap = ({ x, y }: Vec) => {
      const s = Constants.CanvasSize,
        wrap = (v: number) => (v < 0 ? v + s : v > s ? v - s : v);

      return new Vec(wrap(x), wrap(y));
    },
    // wrap a positions around edges of the screen for log (plank)
    logWrap = ({ x, y }: Vec) => {
      const s = Constants.CanvasSize,
        wrap = (v: number) =>
          v < -Constants.StartLogWidth
            ? v + s + Constants.StartLogWidth
            : v > s
            ? v - s - Constants.StartLogWidth
            : v;

      return new Vec(wrap(x), y);
    },
    // all movement comes through here
    moveBody = (o: Body) =>
      <Body>{
        ...o,
        pos: torusWrap(o.pos.add(o.vel)),
        vel:o.vel.add(o.acc),
      },
    // all movement of log
    moveLog = (o: Body) =>
      <Body>{
        ...o,
        pos: logWrap(o.pos.add(o.vel)),
        vel: o.vel.add(o.acc),
      },

  /**
  *  To handle collisions of frog and also update the score and also restart the game
  *  Basically the main game logic is implemented here
  *  All the games logic include:
  *  1. Game Over when frog ran out of lives (initially 3)
  *  2. Frog die when collided with car or water
  *  3. Frog can stay on plank or turtle (while turtle is not submerged in water)
  *  4. All turtle will submerge in water together at a interval of time
  *  5. Player Scores when frog enter the designated target area
  *  6. After the designated spot is filled, player wont get score by landing at that target again,
  *     instead player will have to fill all the other target area to get score at the target area again
  * 
  */
    implementGameLogic = (s: State) => {
      const bodiesCollided = ([a, b]: [Body, Body]) =>
          a.pos.x <= b.pos.x + b.width &&
          a.pos.x >= b.pos.x &&
          a.pos.y <= b.pos.y + b.height &&
          a.pos.y >= b.pos.y,
        bodiesCollidedTurtle = ([a, b]: [Body, Body]) =>
          a.pos.sub(b.pos).len() < a.radius + 10 + b.radius + 10,
          //check if the frog collided with the car
        carCollided =
          s.car.filter((r) => bodiesCollided([s.frog, r])).length > 0,
          //check if the frog collided with the log
        logCollided =
          s.frog.pos.y < 300 && s.frog.pos.y > 50
            ? s.log.filter((r) => bodiesCollided([s.frog, r])).length > 0
            : true,
        notOnLog = !logCollided,
        //check if the frog collided with turtle
        turtleCollided =
          s.frog.pos.y < 300 && s.frog.pos.y > 50
            ? s.turtle.filter((r) => bodiesCollidedTurtle([s.frog, r])).length >
              0
            : true,
      
        notOnTurtle = !turtleCollided,
        //boolean to determine wheter the frog is inside target area
        area1 = s.frog.pos.area1(),
        area2 = s.frog.pos.area2(),
        area3 = s.frog.pos.area3(),
        area4 = s.frog.pos.area4(),
        scorePoint =
          (s.area1 == 0 && area1) ||
          (s.area2 == 0 && area2) ||
          (s.area3 == 0 && area3) ||
          (s.area4 == 0 && area4),
        //frog cannot enter the grass zone at scoring area
        restrictedArea =
          s.frog.pos.y <= 50 && s.frog.pos.y >= 0
            ? !s.frog.pos.area1() &&
              !s.frog.pos.area2() &&
              !s.frog.pos.area3() &&
              !s.frog.pos.area4()
            : false,
        //boolean to determine if all of the target aarea is filled
        completeArea = s.area1 > 0 && s.area2 > 0 && s.area3 > 0 && s.area4 > 0
        
          //All the state is updated here by creating a copy of the old state and update the value
          //by creating a new state to maintain the purity of the function

      return <State>{
        ...s,
        frog:
          scorePoint ||
          carCollided ||
          (notOnLog && notOnTurtle) ||
          restrictedArea
            ? {
                ...s.frog,
                pos: new Vec(300, 570),
              }
            : s.frog,
        gameOver: s.lives <= 0,
        area1: completeArea || s.gameOver ? 0 : area1 ? s.area1 + 1 : s.area1,
        area2:
          completeArea || s.gameOver || restrictedArea
            ? 0
            : area2
            ? s.area2 + 1
            : s.area2,
        area3:
          completeArea || s.gameOver || restrictedArea
            ? 0
            : area3
            ? s.area3 + 1
            : s.area3,
        area4:
          completeArea || s.gameOver || restrictedArea
            ? 0
            : area4
            ? s.area4 + 1
            : s.area4,
        score: s.lives <= 0 ? 0 : scorePoint ? s.score + 1 : s.score,
        highscore: Math.max(s.highscore, s.score),
        counter: s.counter + 1,
        lives: s.gameOver
          ? 3
          : carCollided || (notOnLog && notOnTurtle) || restrictedArea
          ? s.lives - 1
          : s.lives,
        level:completeArea?s.level+1:s.level


      };
    },



    //s.car.map(increaseSpeed)
    
    // interval tick: bodies move
    tick = (s: State, elapsed: number) => {
          

      return implementGameLogic({
        ...s,
        frog: moveBody(s.frog),
        car: s.car.map(moveBody),
        log: s.log.map(moveLog),
        turtle: s.turtle.map(moveBody),
        time: elapsed,
      });
    },
    // state transducer
    reduceState = (s: State, e: Move | Tick) =>
      e instanceof Move
        ? {
            ...s,
            frog: {
              ...s.frog,
              pos:
                e.direction == "right"
                  ? new Vec(40 + s.frog.pos.x, s.frog.pos.y)
                  : e.direction == "left"
                  ? new Vec(-40 + s.frog.pos.x, s.frog.pos.y)
                  : e.direction == "forward"
                  ? new Vec(s.frog.pos.x, -60 + s.frog.pos.y)
                  : new Vec(s.frog.pos.x, 60 + s.frog.pos.y),
            },
          }
        : tick(s, e.elapsed);

  // main game stream
  const subscription = merge(
    gameClock,
    moveLeft,
    moveRight,
    moveForward,
    moveBackward
  )
    .pipe(scan(reduceState, initialState))
    .subscribe(updateView);

  // Update the svg scene.
  // This is the only impure function in this program
  // After all of the attibutes of each object is declared and updated in previous function,
  // the updateView will create a new object or update the object view based on the state given
  function updateView(s: State) {
    const svg = document.getElementById("svgCanvas")!,
      Score = document.getElementById("score"),
      HighScore = document.getElementById("highscore"),
      Lives = document.getElementById("lives"),
      frog = document.getElementById("frog")!,
      //function to show the html element
      show = (id: string, condition: boolean) =>
        ((e: HTMLElement) => (condition ? e.classList.remove("hidden") : true))(
          document.getElementById(id)!
        ),
      unshow = (id: string, condition: boolean) =>
        ((e: HTMLElement) => (condition ? e.classList.add("hidden") : true))(
          document.getElementById(id)!
        ),
        // the actual place where the svg element position is created
      updateBodyView = (b: Body) => {
        function createBodyView() {
          let v = document.createElementNS(svg.namespaceURI, "rect")!;
          if (b.viewType === "car") {
            attr(v, { id: b.id, width: b.width, height: b.height, fill: "burlywood" });
          } else if (b.viewType === "log") {
            attr(v, { id: b.id, width: b.width, height: b.height, fill: "brown" });
          } else if (b.viewType === "turtle") {
            v = document.createElementNS(svg.namespaceURI, "ellipse")!;
            attr(v, { id: b.id, rx: b.radius, ry: b.radius, fill: "red" });
          }
          v.classList.add(b.viewType);
          svg.appendChild(v);
          return v;
        }
        //check if the element is created or not, if it is, then we will update the position, else we will create a new element
        const v = document.getElementById(b.id) || createBodyView();
        if (b.viewType === "car" || b.viewType === "log") {
          attr(v, { x: b.pos.x, y: b.pos.y });
        }
        if (b.viewType === "turtle") attr(v, { cx: b.pos.x, cy: b.pos.y });
      },
      // function to update the view of turtle
      updateTurtleView = (b: Body) => {
        function createBodyView() {
          const v = document.createElementNS(svg.namespaceURI, "ellipse")!;
          if (b.viewType === "turtle") {
            attr(v, { id: b.id, rx: b.radius, ry: b.radius, fill: "red" });
          }

          v.classList.add(b.viewType);
          svg.appendChild(v);
          return v;
        }
        const v = document.getElementById(b.id) || createBodyView();

        if (b.viewType === "turtle") attr(v, { cx: b.pos.x, cy: b.pos.y });
      };

    //Update the html view of score, high score and lives
    //Every time the frog enter the target area, the html element in the target area, which is the frog will be shown
    //The element will be unshown when all of the target area is filled up which trrigger a function
    //to update the number in respective area to become zero in order to notify the function to update the view
    Score!.innerText = String(s.score);
    HighScore!.innerText = String(s.highscore);
    Lives!.innerText = String(s.lives);
    show("inArea1", s.area1 > 0);
    show("inArea2", s.area2 > 0);
    show("inArea3", s.area3 > 0);
    show("inArea4", s.area4 > 0);
    unshow("inArea1", s.area1 == 0);
    unshow("inArea2", s.area2 == 0);
    unshow("inArea3", s.area3 == 0);
    unshow("inArea4", s.area4 == 0);

    s.log.forEach(updateBodyView);
    s.car.forEach(updateBodyView);
    s.turtle.forEach(updateTurtleView);
    console.log(s.level)


    //To make turtle submerge in water by removing it from svg at a interval of time using turtleSubmergeEvent Function
    //Here I use a counter so that the turtle submerging action is done every 500 ticks
    //For the first 100 tick, the turtle will be removed from the svg canvas
    //After the 100 tick, the turtle will be created again until 400 ticks where it changes colour to green
    //The process is then repeated again
    let x = s.counter % 500;
    let counter = false;
    const turtleSubergeEvent=(remove:boolean,fill?:string)=>{
      s.turtle
      .map((o) => document.getElementById(o.id))
      .filter(isNotNullOrUndefined)
      .forEach((v) => {
        try {
          remove?svg.removeChild(v):v.setAttribute("fill", fill!);;
        } catch (e) {
          console.log("Already removed: " + v.id);
        }
      });

    };
    if (x < 100) {
      counter = true;
      turtleSubergeEvent(true)

    } else if (x > 400) {
      //warning for turtle about to submerge into the water
      turtleSubergeEvent(false,"lightgreen")
    } else {
      turtleSubergeEvent(false,"red")
    }

    attr(frog, { cx: s.frog.pos.x, cy: s.frog.pos.y });
    svg.appendChild(frog);
    if (s.gameOver) {
      //display a text when gameover

      const v = document.createElementNS(svg.namespaceURI, "text")!;
      attr(v, {
        x: Constants.CanvasSize / 6,
        y: Constants.CanvasSize / 2,
        class: "gameover",
      });
      v.textContent = "Game Over";
      svg.appendChild(v);
      function remove() {
        svg.removeChild(v);
      }
      setTimeout(remove, 2000);
    }
  }
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}

function showKeys() {
  function showKey(k: Key) {
    const arrowKey = document.getElementById(k)!,
      o = (e: Event) =>
        fromEvent<KeyboardEvent>(document, e).pipe(
          filter(({ code }) => code === k)
        );
    o("keydown").subscribe((e) => arrowKey.classList.add("highlight"));
    o("keyup").subscribe((_) => arrowKey.classList.remove("highlight"));
  }
  showKey("ArrowLeft");
  showKey("ArrowRight");
  showKey("ArrowUp");
  showKey("ArrowDown");
}

setTimeout(showKeys, 0);

/////////////////////////////////////////////////////////////////////
// Utility functions

/**
 * A simple immutable vector class
 */

class Vec {
  constructor(public readonly x: number = 0, public readonly y: number = 0) {}
  add = (b: Vec) => new Vec(this.x + b.x, this.y + b.y);
  sub = (b: Vec) => this.add(b.scale(-1));
  area1 = () => this.boundX(50, 110) && this.boundY(20, 40);
  area2 = () => this.boundX(210, 270) && this.boundY(20, 40);
  area3 = () => this.boundX(370, 430) && this.boundY(20, 40);
  area4 = () => this.boundX(530, 590) && this.boundY(20, 40);
  boundX = (a: number, b: number) => this.x >= a && this.x <= b;
  boundY = (a: number, b: number) => this.y >= a && this.y <= b;
  restrictedArea = () => this.area1;
  len = () => Math.sqrt(this.x * this.x + this.y * this.y);
  scale = (s: number) => new Vec(this.x * s, this.y * s);

  static Zero = new Vec();
}

const /**
   * Composable not: invert boolean result of given function
   * @param f a function returning boolean
   * @param x the value that will be tested with f
   */
  not =
    <T>(f: (x: T) => boolean) =>
    (x: T) =>
      !f(x),
 
  /**
   * set a number of attributes area an Element at once
   * @param e the Element
   * @param o a property bag
   */
  attr = (e: Element, o: { [k: string]: Object }) => {
    for (const k in o) e.setAttribute(k, String(o[k]));
  };
/**
 * Type guard for use in filters
 * @param input something that might be null or undefined
 */
function isNotNullOrUndefined<T extends Object>(
  input: null | undefined | T
): input is T {
  return input != null;
}
