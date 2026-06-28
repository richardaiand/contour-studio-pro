import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

let walkControls = null;
let isWalking = false;
let walkAnimId = null;
let lastTime = 0;
const moveState = { forward: false, backward: false, left: false, right: false };
const MOVE_SPEED = 8;
const EYE_HEIGHT = 1.65;
let terrainMeshRef = null;
let cameraRef = null;
let rendererRef = null;
let orbitControlsRef = null;
let walkHud = null;
let onKeyDownRef = null;
let onKeyUpRef = null;
let listenersRegistered = false;

export function initWalkMode(scene, camera, renderer, terrainMesh, orbitControls) {
  terrainMeshRef = terrainMesh;
  cameraRef = camera;
  rendererRef = renderer;
  orbitControlsRef = orbitControls;

  walkHud = document.getElementById('walkHudOverlay');

  if (!listenersRegistered) {
    onKeyDownRef = (e) => {
      if (!isWalking) return;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveState.forward = true; break;
        case 'KeyS': case 'ArrowDown': moveState.backward = true; break;
        case 'KeyA': case 'ArrowLeft': moveState.left = true; break;
        case 'KeyD': case 'ArrowRight': moveState.right = true; break;
        case 'Escape': exitWalkMode(); break;
      }
    };

    onKeyUpRef = (e) => {
      if (!isWalking) return;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveState.forward = false; break;
        case 'KeyS': case 'ArrowDown': moveState.backward = false; break;
        case 'KeyA': case 'ArrowLeft': moveState.left = false; break;
        case 'KeyD': case 'ArrowRight': moveState.right = false; break;
      }
    };

    document.addEventListener('keydown', onKeyDownRef);
    document.addEventListener('keyup', onKeyUpRef);
    listenersRegistered = true;
  }
}

export function enterWalkMode(startPos = null) {
  if (!cameraRef || !rendererRef || !terrainMeshRef) {
    console.warn('Walk mode: missing refs', { cameraRef, rendererRef, terrainMeshRef });
    return;
  }

  if (orbitControlsRef) {
    orbitControlsRef.enabled = false;
  }

  const domElement = rendererRef.domElement;

  try {
    walkControls = new PointerLockControls(cameraRef, domElement);
  } catch (err) {
    console.error('Failed to create PointerLockControls:', err);
    if (orbitControlsRef) orbitControlsRef.enabled = true;
    return;
  }

  if (startPos) {
    cameraRef.position.set(startPos.x, startPos.y + EYE_HEIGHT, startPos.z);
  } else {
    const terrainCenter = getTerrainCenter();
    if (terrainCenter) {
      cameraRef.position.set(terrainCenter.x, terrainCenter.y + EYE_HEIGHT, terrainCenter.z);
    }
  }

  const lockTimeout = setTimeout(() => {
    if (!isWalking) {
      console.warn('Walk mode: pointer lock not acquired within 3s, exiting');
      try { walkControls.dispose(); } catch {}
      walkControls = null;
      if (orbitControlsRef) orbitControlsRef.enabled = true;
      if (walkHud) walkHud.classList.add('hidden');
    }
  }, 3000);

  walkControls.addEventListener('lock', () => {
    clearTimeout(lockTimeout);
    isWalking = true;
    if (walkHud) walkHud.classList.remove('hidden');
  });

  walkControls.addEventListener('unlock', () => {
    clearTimeout(lockTimeout);
    if (isWalking) {
      exitWalkMode();
    }
  });

  try {
    walkControls.lock();
  } catch (err) {
    console.error('Pointer lock failed:', err);
    clearTimeout(lockTimeout);
    try { walkControls.dispose(); } catch {}
    walkControls = null;
    if (orbitControlsRef) orbitControlsRef.enabled = true;
    if (walkHud) walkHud.classList.add('hidden');
    return;
  }

  lastTime = performance.now();
  walkAnimId = requestAnimationFrame(walkLoop);
}

export function exitWalkMode() {
  isWalking = false;

  if (walkControls) {
    if (walkControls.isLocked) {
      walkControls.unlock();
    }
    walkControls.dispose();
    walkControls = null;
  }

  if (walkAnimId) {
    cancelAnimationFrame(walkAnimId);
    walkAnimId = null;
  }

  moveState.forward = false;
  moveState.backward = false;
  moveState.left = false;
  moveState.right = false;

  if (orbitControlsRef) {
    orbitControlsRef.enabled = true;
    orbitControlsRef.update();
  }

  if (walkHud) walkHud.classList.add('hidden');
}

function walkLoop(time) {
  if (!isWalking) return;

  const delta = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  updateMovement(delta);

  walkAnimId = requestAnimationFrame(walkLoop);
}

function updateMovement(delta) {
  if (!isWalking || !walkControls || !walkControls.isLocked) return;

  const moveDir = new THREE.Vector3();
  const right = new THREE.Vector3();
  const forward = new THREE.Vector3();

  cameraRef.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, cameraRef.up).normalize();

  if (moveState.forward) moveDir.add(forward);
  if (moveState.backward) moveDir.sub(forward);
  if (moveState.right) moveDir.add(right);
  if (moveState.left) moveDir.sub(right);

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize();
    const distance = MOVE_SPEED * delta;

    const newX = cameraRef.position.x + moveDir.x * distance;
    const newZ = cameraRef.position.z + moveDir.z * distance;

    const terrainY = getTerrainHeightAt(newX, newZ);
    cameraRef.position.x = newX;
    cameraRef.position.z = newZ;
    cameraRef.position.y = terrainY + EYE_HEIGHT;
  } else {
    const terrainY = getTerrainHeightAt(cameraRef.position.x, cameraRef.position.z);
    cameraRef.position.y = terrainY + EYE_HEIGHT;
  }
}

function getTerrainHeightAt(x, z) {
  if (!terrainMeshRef) return 0;

  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, 10000, z), new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(terrainMeshRef, false);

  if (intersects.length > 0) {
    return intersects[0].point.y;
  }

  if (terrainMeshRef.geometry?.attributes?.position) {
    const pos = terrainMeshRef.geometry.attributes.position;
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      const dist = (px - x) ** 2 + (pz - z) ** 2;
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    return pos.getY(closestIdx);
  }

  return 0;
}

function getTerrainCenter() {
  if (!terrainMeshRef?.geometry) return null;
  terrainMeshRef.geometry.computeBoundingBox();
  const box = terrainMeshRef.geometry.boundingBox;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const terrainY = getTerrainHeightAt(center.x, center.z);
  return new THREE.Vector3(center.x, terrainY, center.z);
}

export function isWalkMode() {
  return isWalking;
}
