import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { createPerson } from './objects/library.js';

let walkScene = null;
let walkCamera = null;
let walkRenderer = null;
let walkControls = null;
let walkAnimId = null;
let avatar = null;
let isWalking = false;
let lastTime = 0;
let isMoving = false;
let walkPhase = 0;
let thirdPerson = false;
const moveState = { forward: false, backward: false, left: false, right: false };
const MOVE_SPEED = 8;
const EYE_HEIGHT = 1.65;
const THIRD_PERSON_DISTANCE = 4;
let terrainMeshRef = null;
let terrainClone = null;
let onKeyDownRef = null;
let onKeyUpRef = null;
let listenersRegistered = false;
let originalCamera = null;
let originalControls = null;

export function initWalkMode(scene, camera, renderer, terrainMesh, orbitControls) {
  terrainMeshRef = terrainMesh;
  originalCamera = camera;
  originalControls = orbitControls;
}

export function enterWalkMode(startPos = null) {
  if (!terrainMeshRef || !originalCamera) {
    console.warn('Walk mode: terrain or camera not ready');
    return false;
  }

  const canvas = document.getElementById('walkCanvas');
  if (!canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) {
    console.warn('Walk mode: walk canvas not visible');
    return false;
  }

  walkScene = new THREE.Scene();
  walkScene.background = new THREE.Color(0x87ceeb);
  walkScene.fog = new THREE.Fog(0x87ceeb, 500, 2000);

  if (terrainMeshRef.geometry) {
    const geo = terrainMeshRef.geometry.clone();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    terrainClone = new THREE.Mesh(geo, mat);
    walkScene.add(terrainClone);
  }

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  walkScene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(200, 300, 100);
  walkScene.add(dir);

  walkCamera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 5000);

  walkRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  walkRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  walkRenderer.setSize(canvas.clientWidth, canvas.clientHeight);

  // Position at terrain center
  let startX = 0, startZ = 0, terrainY = 0;
  if (startPos) {
    startX = startPos.x;
    startZ = startPos.z;
  } else {
    const center = getTerrainCenter();
    if (center) {
      startX = center.x;
      startZ = center.z;
    }
  }
  terrainY = getTerrainHeightAt(startX, startZ);

  // Avatar
  avatar = createPerson(1.75);
  avatar.position.set(startX, terrainY, startZ);
  walkScene.add(avatar);

  // Camera starts in first person at eye level
  walkCamera.position.set(startX, terrainY + EYE_HEIGHT, startZ);
  thirdPerson = false;
  updateCameraLabel();

  try {
    walkControls = new PointerLockControls(walkCamera, walkRenderer.domElement);
  } catch (err) {
    console.error('PointerLockControls creation failed:', err);
    cleanupWalkMode();
    return false;
  }

  walkControls.addEventListener('lock', () => {
    isWalking = true;
  });

  walkControls.addEventListener('unlock', () => {
    // User can click to re-lock
  });

  if (!listenersRegistered) {
    onKeyDownRef = (e) => {
      if (!isWalking) return;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveState.forward = true; break;
        case 'KeyS': case 'ArrowDown': moveState.backward = true; break;
        case 'KeyA': case 'ArrowLeft': moveState.left = true; break;
        case 'KeyD': case 'ArrowRight': moveState.right = true; break;
        case 'KeyV': toggleCameraMode(); break;
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

  if (originalControls) {
    originalControls.enabled = false;
  }

  try {
    walkControls.lock();
  } catch (err) {
    console.error('Pointer lock failed:', err);
  }

  lastTime = performance.now();
  walkAnimId = requestAnimationFrame(walkLoop);

  window.addEventListener('resize', onWalkResize);

  return true;
}

export function toggleCameraMode() {
  thirdPerson = !thirdPerson;
  updateCameraLabel();
}

function updateCameraLabel() {
  const label = document.getElementById('cameraToggleLabel');
  if (label) {
    label.textContent = thirdPerson ? '3rd Person' : '1st Person';
  }
}

function onWalkResize() {
  const canvas = document.getElementById('walkCanvas');
  if (!canvas || !walkRenderer || !walkCamera) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  walkRenderer.setSize(w, h);
  walkCamera.aspect = w / h;
  walkCamera.updateProjectionMatrix();
}

function walkLoop(time) {
  if (!walkRenderer) return;

  const delta = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  updateMovement(delta);
  updateWalkAnimation(delta);
  updateCameraPosition();

  walkRenderer.render(walkScene, walkCamera);
  walkAnimId = requestAnimationFrame(walkLoop);
}

function updateMovement(delta) {
  if (!walkControls || !walkControls.isLocked) return;

  const moveDir = new THREE.Vector3();
  const right = new THREE.Vector3();
  const forward = new THREE.Vector3();

  walkCamera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, walkCamera.up).normalize();

  if (moveState.forward) moveDir.add(forward);
  if (moveState.backward) moveDir.sub(forward);
  if (moveState.right) moveDir.add(right);
  if (moveState.left) moveDir.sub(right);

  isMoving = moveDir.lengthSq() > 0;

  if (isMoving) {
    moveDir.normalize();
    const distance = MOVE_SPEED * delta;

    const newX = avatar.position.x + moveDir.x * distance;
    const newZ = avatar.position.z + moveDir.z * distance;

    const terrainY = getTerrainHeightAt(newX, newZ);
    avatar.position.x = newX;
    avatar.position.z = newZ;
    avatar.position.y = terrainY;

    // Face movement direction
    const targetRotation = Math.atan2(moveDir.x, moveDir.z);
    let currentRotation = avatar.rotation.y;
    let diff = targetRotation - currentRotation;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    avatar.rotation.y += diff * Math.min(1, delta * 10);
  }
}

function updateWalkAnimation(delta) {
  if (!avatar) return;

  const leftLeg = avatar.userData.leftLeg;
  const rightLeg = avatar.userData.rightLeg;
  const leftArm = avatar.userData.leftArm;
  const rightArm = avatar.userData.rightArm;

  if (!leftLeg || !rightLeg || !leftArm || !rightArm) return;

  if (isMoving) {
    walkPhase += delta * 8;

    const swing = Math.sin(walkPhase) * 0.5;
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    leftArm.rotation.x = -swing * 0.7;
    rightArm.rotation.x = swing * 0.7;
  } else {
    // Ease back to idle
    walkPhase = 0;
    leftLeg.rotation.x *= 0.8;
    rightLeg.rotation.x *= 0.8;
    leftArm.rotation.x *= 0.8;
    rightArm.rotation.x *= 0.8;
    leftArm.rotation.z = 0.2;
    rightArm.rotation.z = -0.2;
  }
}

function updateCameraPosition() {
  if (!walkCamera || !avatar) return;

  const terrainY = getTerrainHeightAt(avatar.position.x, avatar.position.z);

  if (thirdPerson) {
    // Camera behind and above avatar
    const forward = new THREE.Vector3();
    walkCamera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const camX = avatar.position.x - forward.x * THIRD_PERSON_DISTANCE;
    const camZ = avatar.position.z - forward.z * THIRD_PERSON_DISTANCE;
    const camY = terrainY + EYE_HEIGHT + THIRD_PERSON_DISTANCE * 0.5;

    walkCamera.position.set(camX, camY, camZ);
  } else {
    // First person: camera at avatar's eye level
    walkCamera.position.x = avatar.position.x;
    walkCamera.position.z = avatar.position.z;
    walkCamera.position.y = terrainY + EYE_HEIGHT;
  }
}

function getTerrainHeightAt(x, z) {
  if (!terrainClone) return 0;

  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, 10000, z), new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(terrainClone, false);

  if (intersects.length > 0) {
    return intersects[0].point.y;
  }

  if (terrainClone.geometry?.attributes?.position) {
    const pos = terrainClone.geometry.attributes.position;
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

export function exitWalkMode() {
  isWalking = false;
  isMoving = false;

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

  window.removeEventListener('resize', onWalkResize);

  cleanupWalkMode();

  if (originalControls) {
    originalControls.enabled = true;
    originalControls.update();
  }
}

function cleanupWalkMode() {
  if (terrainClone) {
    terrainClone.geometry?.dispose();
    terrainClone.material?.dispose();
    terrainClone = null;
  }

  if (avatar) {
    walkScene?.remove(avatar);
    avatar.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    avatar = null;
  }

  if (walkRenderer) {
    walkRenderer.dispose();
    walkRenderer = null;
  }

  walkScene = null;
  walkCamera = null;

  moveState.forward = false;
  moveState.backward = false;
  moveState.left = false;
  moveState.right = false;
}

export function isWalkMode() {
  return isWalking;
}
