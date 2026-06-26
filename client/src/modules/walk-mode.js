// V4: First-person walk mode
// TODO: PointerLockControls for mouse look
// TODO: WASD movement
// TODO: Height-based collision with terrain
// TODO: Esc to exit back to orbit view

import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

let walkControls = null;
let walkCamera = null;
let isWalking = false;
const moveState = { forward: false, backward: false, left: false, right: false };

export function initWalkMode(scene, camera, renderer, terrainMesh) {
  // TODO: Create PointerLockControls
  // TODO: Add keydown/keyup listeners for WASD
  // TODO: Add animation loop for movement
}

export function enterFirstPerson(scene, camera, renderer) {
  // TODO: Switch from OrbitControls to PointerLockControls
  // TODO: Position camera at person model height
  // TODO: Request pointer lock
  isWalking = true;
}

export function exitFirstPerson() {
  // TODO: Release pointer lock
  // TODO: Switch back to OrbitControls
  isWalking = false;
}

function updateMovement(delta, terrainMesh) {
  if (!isWalking || !walkControls) return;

  // TODO: Calculate movement direction from WASD state
  // TODO: Get terrain height at new position
  // TODO: Keep camera at eye level above terrain
  // TODO: Apply movement
}

function onKeyDown(e) {
  switch (e.code) {
    case 'KeyW': moveState.forward = true; break;
    case 'KeyS': moveState.backward = true; break;
    case 'KeyA': moveState.left = true; break;
    case 'KeyD': moveState.right = true; break;
    case 'Escape': exitFirstPerson(); break;
  }
}

function onKeyUp(e) {
  switch (e.code) {
    case 'KeyW': moveState.forward = false; break;
    case 'KeyS': moveState.backward = false; break;
    case 'KeyA': moveState.left = false; break;
    case 'KeyD': moveState.right = false; break;
  }
}

// TODO: Raycaster for terrain height lookup
function getTerrainHeight(x, z, terrainMesh) {
  // TODO: Raycast down from above to find terrain surface height
  // TODO: Return Y coordinate
  return 0;
}
