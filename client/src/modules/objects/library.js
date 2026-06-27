import * as THREE from 'three';

export const OBJECT_LIBRARY = {
  tree: {
    label: 'Tree',
    defaultHeight: 8,
    create: (h) => createTree(h),
    icon: 'tree',
  },
  rock: {
    label: 'Rock',
    defaultHeight: 2,
    create: (h) => createRock(h),
    icon: 'rock',
  },
  building: {
    label: 'Building',
    defaultHeight: 6,
    create: (h) => createBuilding(10, h, 10),
    icon: 'building',
  },
  person: {
    label: 'Person',
    defaultHeight: 1.75,
    create: (h) => createPerson(h),
    icon: 'person',
  },
};

function createTree(height = 8) {
  const group = new THREE.Group();
  const trunkHeight = height * 0.3;
  const trunkRadius = height * 0.05;

  const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = trunkHeight / 2;
  group.add(trunk);

  const foliageHeight = height * 0.7;
  const foliageRadius = height * 0.2;
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const layerHeight = foliageHeight / layers;
    const layerRadius = foliageRadius * (1 - i * 0.2);
    const coneGeo = new THREE.ConeGeometry(layerRadius, layerHeight * 1.5, 8);
    const coneMat = new THREE.MeshStandardMaterial({
      color: i === 0 ? 0x2d5a27 : i === 1 ? 0x3a7d30 : 0x4a9d3f,
      roughness: 0.8,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = trunkHeight + layerHeight * (i + 0.5);
    group.add(cone);
  }

  group.userData.type = 'tree';
  group.userData.height = height;
  return group;
}

function createRock(size = 2) {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(size, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const noise = 0.7 + Math.random() * 0.5;
    pos.setXYZ(i, x * noise, y * noise, z * noise);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.95, metalness: 0.0, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = size * 0.4;
  group.add(mesh);

  group.userData.type = 'rock';
  group.userData.height = size;
  return group;
}

function createBuilding(width = 10, height = 6, depth = 10) {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = height / 2;
  group.add(mesh);

  const roofGeo = new THREE.BoxGeometry(width + 0.5, 0.3, depth + 0.5);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = height + 0.15;
  group.add(roof);

  group.userData.type = 'building';
  group.userData.height = height;
  return group;
}

function createPerson(height = 1.75) {
  const group = new THREE.Group();

  const bodyHeight = height * 0.45;
  const bodyRadius = height * 0.08;
  const bodyGeo = new THREE.CylinderGeometry(bodyRadius * 0.7, bodyRadius, bodyHeight, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = bodyHeight / 2 + height * 0.25;
  group.add(body);

  const legHeight = height * 0.25;
  const legRadius = height * 0.05;
  const legGeo = new THREE.CylinderGeometry(legRadius * 0.8, legRadius, legHeight, 6);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.8 });
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-bodyRadius * 0.5, legHeight / 2, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(bodyRadius * 0.5, legHeight / 2, 0);
  group.add(rightLeg);

  const headRadius = height * 0.07;
  const headGeo = new THREE.SphereGeometry(headRadius, 12, 12);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfdbcb4, roughness: 0.6 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = bodyHeight + height * 0.25 + headRadius;
  group.add(head);

  const armHeight = height * 0.3;
  const armRadius = height * 0.035;
  const armGeo = new THREE.CylinderGeometry(armRadius, armRadius * 0.8, armHeight, 6);
  const armMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7 });
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-bodyRadius * 1.2, bodyHeight / 2 + height * 0.25 + armHeight * 0.2, 0);
  leftArm.rotation.z = 0.2;
  group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(bodyRadius * 1.2, bodyHeight / 2 + height * 0.25 + armHeight * 0.2, 0);
  rightArm.rotation.z = -0.2;
  group.add(rightArm);

  group.userData.type = 'person';
  group.userData.height = height;
  group.userData.eyeHeight = height * 0.25 + bodyHeight + headRadius;
  return group;
}

export const OBJECT_ICONS = {
  tree: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L8 8h2L6 14h3l-3 5h12l-3-5h3l-4-6h2z"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
  rock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20l5-12 4 4 3-6 6 14z"/></svg>',
  building: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/></svg>',
  person: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>',
};
