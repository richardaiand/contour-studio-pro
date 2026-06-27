import * as THREE from 'three';
import { OBJECT_LIBRARY } from './objects/library.js';

let scene = null;
let camera = null;
let renderer = null;
let terrainMesh = null;
let raycaster = null;
let mouse = null;
let currentPlacementMode = null;
let placementGroup = null;
let canvas = null;

export function initPlacement(sceneRef, cameraRef, rendererRef, terrainMeshRef) {
  scene = sceneRef;
  camera = cameraRef;
  renderer = rendererRef;
  terrainMesh = terrainMeshRef;
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  placementGroup = new THREE.Group();
  placementGroup.name = 'placed-objects';
  scene.add(placementGroup);

  canvas = renderer?.domElement || document.getElementById('scene');
  if (canvas) {
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mousemove', onCanvasMove);
  }
}

function onCanvasClick(e) {
  if (!currentPlacementMode || !terrainMesh || !camera) return;

  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(terrainMesh, false);

  if (intersects.length === 0) return;

  const point = intersects[0].point;
  placeObject(currentPlacementMode, point);
}

function onCanvasMove(e) {
  if (!currentPlacementMode) {
    if (canvas) canvas.style.cursor = '';
    return;
  }
  if (canvas) canvas.style.cursor = 'crosshair';
}

function placeObject(objectType, position) {
  const def = OBJECT_LIBRARY[objectType];
  if (!def) return;

  const obj = def.create(def.defaultHeight);
  obj.position.copy(position);

  if (objectType === 'tree' || objectType === 'rock') {
    obj.rotation.y = Math.random() * Math.PI * 2;
  }

  placementGroup.add(obj);
  return obj;
}

export function setPlacementMode(objectType) {
  currentPlacementMode = objectType;
  if (canvas) {
    canvas.style.cursor = objectType ? 'crosshair' : '';
  }
}

export function getPlacementMode() {
  return currentPlacementMode;
}

export function clearPlacedObjects() {
  if (!placementGroup) return;
  placementGroup.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
  while (placementGroup.children.length > 0) {
    placementGroup.remove(placementGroup.children[0]);
  }
}

export function getPlacedObjects() {
  return placementGroup ? placementGroup.children : [];
}

export function getPlacementGroup() {
  return placementGroup;
}

export function disposePlacement() {
  if (canvas) {
    canvas.removeEventListener('click', onCanvasClick);
    canvas.removeEventListener('mousemove', onCanvasMove);
  }
  clearPlacedObjects();
  if (placementGroup && scene) {
    scene.remove(placementGroup);
  }
  placementGroup = null;
  currentPlacementMode = null;
}
