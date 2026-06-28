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
const moveState = { forward: false, backward: false, left: false, right: false };
const MOVE_SPEED = 8;
const EYE_HEIGHT = 1.65;
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

  // Create a dedicated scene for walk mode
  walkScene = new THREE.Scene();
  walkScene.background = new THREE.Color(0x87ceeb);
  walkScene.fog = new THREE.Fog(0x87ceeb, 500, 2000);

  // Clone the terrain geometry into the walk scene
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

  // Add lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  walkScene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(200, 300, 100);
  walkScene.add(dir);

  // Create walk camera
  walkCamera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.1, 5000);

  // Create renderer on the walk canvas
  walkRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
  walkRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  walkRenderer.setSize(canvas.clientWidth, canvas.clientHeight);

  // Position camera at terrain center or given start position
  if (startPos) {
    walkCamera.position.set(startPos.x, startPos.y + EYE_HEIGHT, startPos.z);
  } else {
    const center = getTerrainCenter();
    if (center) {
      walkCamera.position.set(center.x, center.y + EYE_HEIGHT, center.z);
    } else {
      walkCamera.position.set(0, EYE_HEIGHT, 0);
    }
  }

  // Create avatar (visible third-person person model)
  avatar = createPerson(1.75);
  avatar.position.copy(walkCamera.position);
  avatar.position.y = walkCamera.position.y - EYE_HEIGHT;
  walkScene.add(avatar);

  // Create pointer lock controls on the walk canvas
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
    if (isWalking) {
      // Don't fully exit — just pause. User can click to re-lock.
    }
  });

  // Register keyboard listeners
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

  // Disable orbit controls on the studio view
  if (originalControls) {
    originalControls.enabled = false;
  }

  // Try to lock pointer
  try {
    walkControls.lock();
  } catch (err) {
    console.error('Pointer lock failed:', err);
  }

  // Start render loop
  lastTime = performance.now();
  walkAnimId = requestAnimationFrame(walkLoop);

  // Handle resize
  window.addEventListener('resize', onWalkResize);

  return true;
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

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize();
    const distance = MOVE_SPEED * delta;

    const newX = walkCamera.position.x + moveDir.x * distance;
    const newZ = walkCamera.position.z + moveDir.z * distance;

    const terrainY = getTerrainHeightAt(newX, newZ);
    walkCamera.position.x = newX;
    walkCamera.position.z = newZ;
    walkCamera.position.y = terrainY + EYE_HEIGHT;

    if (avatar) {
      avatar.position.x = newX;
      avatar.position.z = newZ;
      avatar.position.y = terrainY;
      avatar.rotation.y = Math.atan2(moveDir.x, moveDir.z);
    }
  } else {
    const terrainY = getTerrainHeightAt(walkCamera.position.x, walkCamera.position.z);
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
