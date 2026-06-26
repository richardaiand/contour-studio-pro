// V3: Low-poly object library for placement
// TODO: Generate simple Three.js geometries for common site objects

import * as THREE from 'three';

export const OBJECT_LIBRARY = {
  tree: {
    label: 'Tree',
    defaultHeight: 8,
    create: createTree,
  },
  rock: {
    label: 'Rock',
    defaultHeight: 2,
    create: createRock,
  },
  building: {
    label: 'Building',
    defaultHeight: 6,
    create: createBuilding,
  },
  person: {
    label: 'Person',
    defaultHeight: 1.75,
    create: createPerson,
  },
};

function createTree(height = 8) {
  // TODO: Low-poly tree (cone foliage + cylinder trunk)
  const group = new THREE.Group();
  // TODO: Add trunk
  // TODO: Add foliage cones
  return group;
}

function createRock(size = 2) {
  // TODO: Low-poly rock (icosahedron, scaled)
  const geo = new THREE.IcosahedronGeometry(size, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.9 });
  return new THREE.Mesh(geo, mat);
}

function createBuilding(width = 10, height = 6, depth = 10) {
  // TODO: Simple box building
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = height / 2;
  return mesh;
}

function createPerson(height = 1.75) {
  // TODO: Simple person model (capsule body + sphere head)
  // Used for both scale reference and first-person mode
  const group = new THREE.Group();
  // TODO: Add body
  // TODO: Add head
  return group;
}
