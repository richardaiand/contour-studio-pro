// V3: Object placement on terrain
// TODO: Click on terrain to place objects (trees, rocks, people)
// TODO: Raycaster to find terrain intersection point
// TODO: Store placed objects in scene

import * as THREE from 'three';

let placedObjects = [];

export function initPlacement(scene, camera, renderer, terrainMesh) {
  // TODO: Add click listener for placement mode
  // TODO: Raycast from mouse to terrain
  // TODO: Place selected object at intersection point
  // TODO: Scale to real-world dimensions
}

export function setPlacementMode(objectType) {
  // TODO: Set current placement type ('tree', 'rock', 'person', null)
}

export function clearPlacedObjects(scene) {
  // TODO: Remove all placed objects from scene
  placedObjects.forEach((obj) => {
    scene.remove(obj);
    obj.geometry?.dispose();
    obj.material?.dispose();
  });
  placedObjects = [];
}

export function getPlacedObjects() {
  return placedObjects;
}
