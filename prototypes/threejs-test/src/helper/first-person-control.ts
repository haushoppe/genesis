import { Camera } from "three";
import { PointerLockControls } from "./pointer-lock-controls";


let controls = {} as any;
export const player = {
  height: 0.8,
  turnSpeed: .1,
  speed: .1  ,
  jumpHeight: .2,
  gravity: .01,
  velocity: 0,

  jumps: false
};

// Controls:Listeners
document.addEventListener('keydown', ({ keyCode }) => { controls[keyCode] = true });
document.addEventListener('keyup', ({ keyCode }) => { controls[keyCode] = false });

// super simple first person control
// source https://codepen.io/olchyk98/pen/NLBVoW?editors=1010
// W, S, A, D, Space - Left Arrow, Right Arrow
export function firstPersonControl(camera: Camera) {

  // Controls:Engine
  if(controls[87]){ // w
    camera.position.x -= Math.sin(camera.rotation.y) * player.speed;
    camera.position.z -= -Math.cos(camera.rotation.y) * player.speed;
    // console.log('Move forward!')
  }
  if(controls[83]){ // s
    camera.position.x += Math.sin(camera.rotation.y) * player.speed;
    camera.position.z += -Math.cos(camera.rotation.y) * player.speed;
    // console.log('Move backward!')
  }
  if(controls[65]){ // a
    camera.position.x += Math.sin(camera.rotation.y + Math.PI / 2) * player.speed;
    camera.position.z += -Math.cos(camera.rotation.y + Math.PI / 2) * player.speed;
    // console.log('Move left!')
  }
  if(controls[68]){ // d
    camera.position.x += Math.sin(camera.rotation.y - Math.PI / 2) * player.speed;
    camera.position.z += -Math.cos(camera.rotation.y - Math.PI / 2) * player.speed;
    // console.log('Move right!')
  }
  if(controls[37]){ // la
    camera.rotation.y -= player.turnSpeed;
  }
  if(controls[39]){ // ra
    camera.rotation.y += player.turnSpeed;
  }
  if(controls[32]) { // space
    if(player.jumps) return false;
    player.jumps = true;
    player.velocity = -player.jumpHeight;
  }
}

export function doMovementUpdate(camera: Camera) {
  player.velocity += player.gravity;
  camera.position.y -= player.velocity;

  if(camera.position.y < player.height) {
    camera.position.y = player.height;
    player.jumps = false;
  }
}

// Look: MOUSE
export function bindPointerLockControls(camera: Camera) {

  const controls = new PointerLockControls(camera, document.body);
  const button = document.getElementById('debugButton');
  button?.addEventListener('click', () => controls.lock());
}
