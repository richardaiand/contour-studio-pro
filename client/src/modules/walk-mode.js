import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { createPerson } from './objects/library.js';
import { store } from '../store/index.js';

let walkScene = null;
let walkCamera = null;
let walkRenderer = null;
let walkControls = null;
let walkAnimId = null;
let avatar = null;
let avatarHead = null;
let selectionBorder = null;
let isWalking = false;
let lastTime = 0;
let isMoving = false;
let isBackward = false;
let walkPhase = 0;
let thirdPerson = false;
let smoothedY = 0;
let frameCount = 0;
const moveState = { forward: false, backward: false, left: false, right: false };
const MOVE_SPEED = 8;
const EYE_HEIGHT = 1.65;
const THIRD_PERSON_DISTANCE = 5;
const THIRD_PERSON_HEIGHT = 2.5;
const SMOOTH_FACTOR = 0.15;
const MOUSE_SENSITIVITY = 1.5;
let terrainMeshRef = null;
let terrainClone = null;
let terrainBounds = null;
let onKeyDownRef = null;
let onKeyUpRef = null;
let onMouseMoveRef = null;
let listenersRegistered = false;
let originalCamera = null;
let originalControls = null;

const raycaster = new THREE.Raycaster();
const downDir = new THREE.Vector3(0, -1, 0);
const raycastOrigin = new THREE.Vector3();
const moveDir = new THREE.Vector3();
const rightVec = new THREE.Vector3();
const forwardVec = new THREE.Vector3();
const avatarForward = new THREE.Vector3();
const tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let lastTerrainY = 0;
let lastCamTerrainY = 0;

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
  walkScene.fog = new THREE.Fog(0x87ceeb, 300, 1500);

  if (terrainMeshRef.geometry) {
    const geo = terrainMeshRef.geometry.clone();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.FrontSide,
      flatShading: false,
    });
    terrainClone = new THREE.Mesh(geo, mat);
    walkScene.add(terrainClone);

    // Compute terrain bounds for collision (clamp avatar inside)
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    if (box) {
      terrainBounds = {
        minX: box.min.x + 2,
        maxX: box.max.x - 2,
        minZ: box.min.z + 2,
        maxZ: box.max.z - 2,
      };
    }
  }

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  walkScene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(200, 300, 100);
  walkScene.add(dir);

  walkCamera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);

  walkRenderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  walkRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  walkRenderer.setSize(canvas.clientWidth, canvas.clientHeight);

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
  smoothedY = terrainY;

  avatar = createPerson(1.75);
  avatar.position.set(startX, terrainY, startZ);
  walkScene.add(avatar);

  avatarHead = avatar.userData.head || null;

  const terrain = store.get('currentTerrain');
  if (terrain?.originalBounds && terrain?.fetchBounds) {
    createSelectionBorder(terrain.originalBounds, terrain.fetchBounds);
  }

  walkCamera.position.set(startX, terrainY + EYE_HEIGHT, startZ);
  thirdPerson = false;
  updateCameraLabel();
  updateHeadVisibility();

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

  walkControls.addEventListener('unlock', () => {});

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

    // Custom mouse look with adjustable sensitivity
    onMouseMoveRef = (e) => {
      if (!isWalking || !walkControls.isLocked) return;
      const yaw = -e.movementX * 0.002 * MOUSE_SENSITIVITY;
      const pitch = -e.movementY * 0.002 * MOUSE_SENSITIVITY;
      walkControls.getObject().rotation.y += yaw;
      tempEuler.copy(walkControls.getObject().rotation);
      tempEuler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, tempEuler.x + pitch));
      walkControls.getObject().rotation.copy(tempEuler);
    };

    document.addEventListener('keydown', onKeyDownRef);
    document.addEventListener('keyup', onKeyUpRef);
    document.addEventListener('mousemove', onMouseMoveRef);
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
  frameCount = 0;
  walkAnimId = requestAnimationFrame(walkLoop);

  window.addEventListener('resize', onWalkResize);

  return true;
}

function createSelectionBorder(originalBounds, fetchBounds) {
  const latMid = (fetchBounds.minLat + fetchBounds.maxLat) / 2;
  const xScale = 111320 * Math.cos((latMid * Math.PI) / 180);
  const zScale = 111320;

  const fetchW = (fetchBounds.maxLon - fetchBounds.minLon) * xScale;
  const fetchH = (fetchBounds.maxLat - fetchBounds.minLat) * zScale;
  const origW = (originalBounds.maxLon - originalBounds.minLon) * xScale;
  const origH = (originalBounds.maxLat - originalBounds.minLat) * zScale;

  const origCenterLon = (originalBounds.minLon + originalBounds.maxLon) / 2;
  const origCenterLat = (originalBounds.minLat + originalBounds.maxLat) / 2;

  const px = (origCenterLon - fetchBounds.minLon) * xScale - fetchW / 2;
  const pz = (origCenterLat - fetchBounds.minLat) * zScale - fetchH / 2;

  const halfW = origW / 2;
  const halfH = origH / 2;
  const x0 = px - halfW;
  const x1 = px + halfW;
  const z0 = pz - halfH;
  const z1 = pz + halfH;

  let yTop = 100;
  if (terrainClone?.geometry) {
    terrainClone.geometry.computeBoundingBox();
    const box = terrainClone.geometry.boundingBox;
    if (box) yTop = box.max.y + Math.max((box.max.y - box.min.y) * 0.3, 30);
  }

  const group = new THREE.Group();

  const wallGeo = new THREE.BufferGeometry();
  const yB = 0;
  const yT = yTop;
  const wallPositions = new Float32Array([
    x0, yB, z0,  x1, yB, z0,  x1, yT, z0,  x0, yT, z0,
    x1, yB, z0,  x1, yB, z1,  x1, yT, z1,  x1, yT, z0,
    x1, yB, z1,  x0, yB, z1,  x0, yT, z1,  x1, yT, z1,
    x0, yB, z1,  x0, yB, z0,  x0, yT, z0,  x0, yT, z1,
  ]);
  wallGeo.setAttribute('position', new THREE.BufferAttribute(wallPositions, 3));
  wallGeo.setIndex([0,1,2, 0,2,3,  4,5,6, 4,6,7,  8,9,10, 8,10,11,  12,13,14, 12,14,15]);

  const wallMat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(wallGeo, wallMat));

  const edgeGeo = new THREE.BufferGeometry();
  const edgePositions = new Float32Array([
    x0, yB, z0,  x1, yB, z0,  x1, yB, z0,  x1, yB, z1,
    x1, yB, z1,  x0, yB, z1,  x0, yB, z1,  x0, yB, z0,
    x0, yT, z0,  x1, yT, z0,  x1, yT, z0,  x1, yT, z1,
    x1, yT, z1,  x0, yT, z1,  x0, yT, z1,  x0, yT, z0,
    x0, yB, z0,  x0, yT, z0,  x1, yB, z0,  x1, yT, z0,
    x1, yB, z1,  x1, yT, z1,  x0, yB, z1,  x0, yT, z1,
  ]);
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x60a5fa });
  group.add(new THREE.LineSegments(edgeGeo, edgeMat));

  selectionBorder = group;
  walkScene.add(selectionBorder);
}

export function toggleCameraMode() {
  thirdPerson = !thirdPerson;
  updateCameraLabel();
  updateHeadVisibility();
}

function updateCameraLabel() {
  const label = document.getElementById('cameraToggleLabel');
  if (label) {
    label.textContent = thirdPerson ? '3rd Person' : '1st Person';
  }
}

function updateHeadVisibility() {
  if (avatarHead) {
    avatarHead.visible = thirdPerson;
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
  frameCount++;

  updateMovement(delta);
  updateWalkAnimation(delta);
  updateCameraPosition();

  walkRenderer.render(walkScene, walkCamera);
  walkAnimId = requestAnimationFrame(walkLoop);
}

function updateMovement(delta) {
  if (!walkControls || !walkControls.isLocked) return;

  // Get camera's look direction for movement basis
  walkCamera.getWorldDirection(forwardVec);
  forwardVec.y = 0;
  forwardVec.normalize();
  rightVec.crossVectors(forwardVec, walkCamera.up).normalize();

  moveDir.set(0, 0, 0);
  if (moveState.forward) moveDir.add(forwardVec);
  if (moveState.backward) moveDir.sub(forwardVec);
  if (moveState.right) moveDir.add(rightVec);
  if (moveState.left) moveDir.sub(rightVec);

  isMoving = moveDir.lengthSq() > 0;
  isBackward = moveState.backward && !moveState.forward;

  if (isMoving) {
    moveDir.normalize();
    const distance = MOVE_SPEED * delta;

    let newX = avatar.position.x + moveDir.x * distance;
    let newZ = avatar.position.z + moveDir.z * distance;

    // Clamp to terrain bounds — don't let the avatar walk off the edge
    if (terrainBounds) {
      newX = Math.max(terrainBounds.minX, Math.min(terrainBounds.maxX, newX));
      newZ = Math.max(terrainBounds.minZ, Math.min(terrainBounds.maxZ, newZ));
    }

    let terrainY;
    if (frameCount % 2 === 0) {
      terrainY = getTerrainHeightAt(newX, newZ);
      lastTerrainY = terrainY;
    } else {
      terrainY = lastTerrainY;
    }

    avatar.position.x = newX;
    avatar.position.z = newZ;
    avatar.position.y = terrainY;
  }

  // Avatar always faces camera forward direction (not movement direction)
  // This means strafing doesn't rotate the avatar, and walking backward
  // keeps the avatar facing forward (just with reversed animation)
  const camYaw = Math.atan2(forwardVec.x, forwardVec.z);
  avatar.rotation.y = camYaw;
}

function updateWalkAnimation(delta) {
  if (!avatar) return;

  const leftLeg = avatar.userData.leftLeg;
  const rightLeg = avatar.userData.rightLeg;
  const leftArm = avatar.userData.leftArm;
  const rightArm = avatar.userData.rightArm;
  const leftElbow = avatar.userData.leftElbow;
  const rightElbow = avatar.userData.rightElbow;

  if (!leftLeg || !rightLeg || !leftArm || !rightArm) return;

  if (isMoving) {
    walkPhase += delta * 8;

    const swing = Math.sin(walkPhase) * 0.4;
    // Reverse leg swing when walking backward
    const dir = isBackward ? -1 : 1;
    leftLeg.rotation.x = swing * dir;
    rightLeg.rotation.x = -swing * dir;
    leftArm.rotation.x = -swing * 0.6 * dir;
    rightArm.rotation.x = swing * 0.6 * dir;
    if (leftElbow) leftElbow.rotation.x = Math.max(0, -swing * 0.3 * dir) + 0.15;
    if (rightElbow) rightElbow.rotation.x = Math.max(0, swing * 0.3 * dir) + 0.15;
  } else {
    walkPhase = 0;
    leftLeg.rotation.x *= 0.8;
    rightLeg.rotation.x *= 0.8;
    leftArm.rotation.x *= 0.8;
    rightArm.rotation.x *= 0.8;
    if (leftElbow) leftElbow.rotation.x = (leftElbow.rotation.x - 0.15) * 0.8 + 0.15;
    if (rightElbow) rightElbow.rotation.x = (rightElbow.rotation.x - 0.15) * 0.8 + 0.15;
  }
}

function updateCameraPosition() {
  if (!walkCamera || !avatar) return;

  let targetY;
  if (frameCount % 3 === 0) {
    targetY = getTerrainHeightAt(avatar.position.x, avatar.position.z);
    lastCamTerrainY = targetY;
  } else {
    targetY = lastCamTerrainY;
  }

  smoothedY += (targetY - smoothedY) * SMOOTH_FACTOR;

  if (thirdPerson) {
    // Use camera's yaw (set by mouse) to orbit around avatar
    const camYaw = walkCamera.rotation.y;
    const camPitch = walkCamera.rotation.x;

    const offsetX = Math.sin(camYaw) * THIRD_PERSON_DISTANCE;
    const offsetZ = Math.cos(camYaw) * THIRD_PERSON_DISTANCE;
    const offsetY = Math.sin(camPitch) * THIRD_PERSON_DISTANCE;

    const camX = avatar.position.x + offsetX;
    const camZ = avatar.position.z + offsetZ;
    const camY = smoothedY + THIRD_PERSON_HEIGHT - offsetY;

    walkCamera.position.set(camX, camY, camZ);
    walkCamera.lookAt(avatar.position.x, smoothedY + 1.2, avatar.position.z);
  } else {
    // First person: camera at eye level
    walkCamera.position.x = avatar.position.x;
    walkCamera.position.z = avatar.position.z;
    walkCamera.position.y = smoothedY + EYE_HEIGHT;
  }
}

function getTerrainHeightAt(x, z) {
  if (!terrainClone) return 0;

  raycastOrigin.set(x, 10000, z);
  raycaster.set(raycastOrigin, downDir);
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

  terrainBounds = null;

  if (selectionBorder) {
    walkScene?.remove(selectionBorder);
    selectionBorder.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    selectionBorder = null;
  }

  if (avatar) {
    walkScene?.remove(avatar);
    avatar.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    avatar = null;
  }

  avatarHead = null;

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
