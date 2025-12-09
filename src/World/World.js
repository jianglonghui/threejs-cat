import { createScene } from "./components/scene";
import { createCamera } from "./components/camera";
import { createRenderer } from "./systems/renderer";
import { createLights } from "./components/lights";
import { createControls } from "./systems/controls";
import { loadToonCat } from "./components/toonCat/toonCat";
import { createGround } from "./components/ground";
import { Loop } from "./systems/Loop.js";
import { createPhysics } from "./systems/physics";
import { createDragControls } from "./systems/dragControls";
import { createInputControls } from "./systems/inputControls";
import { Vec3 } from "cannon-es";

//* debuggers
import { createHelpers } from "./components/helpers";
import { createCube } from "./components/cube";
import { Vector3 } from "three";

let camera;
let renderer;
let scene;
let loop;
let physicsWorld;
let controls;
let catDragControls;
let isCatDragging = false;
let catLowestY;
let catHighestY;
let inputControls;

// 跑步跳跃参数
const MOVE_SPEED = 2000;
const JUMP_FORCE = 8000;
const GROUND_Y_THRESHOLD = 200; // 地面检测阈值

//* debuggers
let cubeDragControls;
let isCubeDragging = false;
let cubeLowestY;

class World {
  constructor(container) {
    // renderer
    renderer = createRenderer();
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.append(renderer.domElement);

    // camera
    camera = createCamera();
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();

    // scene
    scene = createScene();

    // delta loop
    loop = new Loop(camera, scene, renderer);

    // physics
    physicsWorld = createPhysics();
    physicsWorld.tick = (delta) => {
      if (delta) {
        physicsWorld.step(delta);
      }
    };
    loop.updatables.push(physicsWorld);

    // orbit controls
    controls = createControls(camera, renderer.domElement);
    loop.updatables.push(controls);

    // 键盘输入控制
    inputControls = createInputControls();

    // lights
    const { ambientLight, mainLight } = createLights();
    scene.add(ambientLight, mainLight);

    // ground
    const { ground, groundBody } = createGround();
    scene.add(ground);
    physicsWorld.addBody(groundBody);
    groundBody.updateAABB();
    catLowestY = groundBody.aabb.upperBound.y;

    //* for debugging purposes
    // const { lightHelper, axesHelper, cannonDebugger } = createHelpers(scene, physicsWorld, mainLight);
    // scene.add(
    //   // lightHelper,
    //   axesHelper
    // );
    // loop.updatables.push(cannonDebugger);

    // const { cube, cubeBody } = createCube();
    // cubeLowestY = groundBody.aabb.upperBound.y + 100 /*cube half extent*/;

    // cube.tick = () => {
    //   if (!isCubeDragging) {
    //     cube.position.copy(cubeBody.position);
    //   }
    // };
    // cubeBody.tick = () => {
    //   if (isCubeDragging) {
    //     cubeBody.position.copy(cube.position);
    //   }
    // };

    // loop.updatables.push(cube, cubeBody);
    // scene.add(cube);
    // physicsWorld.addBody(cubeBody);

    // cubeDragControls = createDragControls([cube], camera, renderer.domElement);
    // cubeDragControls.addEventListener("dragstart", function (event) {
    //   isCubeDragging = true;
    //   controls.enabled = false;
    // });
    // cubeDragControls.addEventListener("drag", function (event) {
    //   const collided = cube.position.y < cubeLowestY; //* Finally got it :) :D
    //   if (collided) {
    //     console.log("collided");
    //     cube.position.y = cubeLowestY;
    //   }
    // });
    // cubeDragControls.addEventListener("dragend", function (event) {
    //   isCubeDragging = false;
    //   controls.enabled = true;
    // });
  }

  async init() {
    // cat
    const { cat, catBody } = await loadToonCat();
    catHighestY = 10;
    console.log("cat y", catHighestY);

    cat.tick = (delta) => {
      cat.mixer.update(delta);
      if (!isCatDragging) {
        cat.position.set(catBody.position.x, catBody.position.y - 180, catBody.position.z);
        cat.quaternion.copy(catBody.quaternion);
      }
    };
    catBody.tick = () => {
      if (isCatDragging) {
        catBody.position.set(cat.position.x, cat.position.y + 180, cat.position.z);
        catBody.quaternion.copy(cat.quaternion);
        return;
      }

      // 跑步控制
      const velocity = catBody.velocity;
      const keys = inputControls.keys;

      if (keys.forward) {
        velocity.z = -MOVE_SPEED;
      } else if (keys.backward) {
        velocity.z = MOVE_SPEED;
      } else {
        velocity.z *= 0.9; // 阻尼
      }

      if (keys.left) {
        velocity.x = -MOVE_SPEED;
      } else if (keys.right) {
        velocity.x = MOVE_SPEED;
      } else {
        velocity.x *= 0.9; // 阻尼
      }

      // 跳跃控制 - 只有在地面上才能跳
      const isOnGround = catBody.position.y <= GROUND_Y_THRESHOLD;
      if (keys.jump && isOnGround) {
        catBody.applyImpulse(new Vec3(0, JUMP_FORCE, 0), catBody.position);
        inputControls.keys.jump = false; // 防止连跳
      }
    };
    loop.updatables.push(cat, catBody);
    scene.add(cat);
    physicsWorld.addBody(catBody);

    catDragControls = createDragControls([cat], camera, renderer.domElement);
    catDragControls.transformGroup = true;
    catDragControls.addEventListener("dragstart", function (event) {
      event.object.traverse((child) => {
        if (child.isMesh) {
          child.material.emissive.set(0xffffff);
          child.material.emissiveIntensity = 0.2;
        }
      });
      isCatDragging = true;
      controls.enabled = false;
    });
    catDragControls.addEventListener("drag", function (event) {
      const collided = cat.position.y < catLowestY || cat.position.y > catHighestY;
      if (collided) {
        cat.position.y = catLowestY;
      }
    });
    catDragControls.addEventListener("dragend", function (event) {
      event.object.traverse((child) => {
        if (child.isMesh) {
          child.material.emissive.set(0x000000);
          child.material.emissiveIntensity = 0;
        }
      });
      isCatDragging = false;
      controls.enabled = true;
    });
  }

  render() {
    renderer.render(scene, camera);
  }

  start() {
    loop.start();
  }

  stop() {
    loop.stop();
  }
}

export { World };
