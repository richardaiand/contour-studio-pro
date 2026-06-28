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

export function createPerson(height = 1.75) {
  const group = new THREE.Group();

  // Proportions
  const legHeight = height * 0.45;
  const torsoHeight = height * 0.30;
  const headRadius = height * 0.06;
  const upperArmLength = height * 0.18;
  const forearmLength = height * 0.16;
  const armRadius = height * 0.028;
  const torsoRadius = height * 0.09;
  const legRadius = height * 0.045;
  const handRadius = height * 0.025;

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfdbcb4, roughness: 0.6 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.8 });

  // Y=0 is ground level. Build up from feet.
  // Legs: 0 to legHeight
  const legGeo = new THREE.CylinderGeometry(legRadius * 0.7, legRadius, legHeight, 6);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-torsoRadius * 0.45, legHeight, 0);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.y = -legHeight / 2;
  leftLegPivot.add(leftLeg);
  group.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(torsoRadius * 0.45, legHeight, 0);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.y = -legHeight / 2;
  rightLegPivot.add(rightLeg);
  group.add(rightLegPivot);

  // Torso: legHeight to legHeight + torsoHeight
  const torsoGeo = new THREE.CylinderGeometry(torsoRadius * 0.8, torsoRadius, torsoHeight, 10);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = legHeight + torsoHeight / 2;
  group.add(torso);

  // Shoulders (slightly wider than torso top)
  const shoulderY = legHeight + torsoHeight;
  const shoulderOffset = torsoRadius * 0.85;

  // Neck
  const neckGeo = new THREE.CylinderGeometry(headRadius * 0.4, headRadius * 0.5, height * 0.04, 6);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.y = shoulderY + height * 0.02;
  group.add(neck);

  // Head
  const headGeo = new THREE.SphereGeometry(headRadius, 16, 16);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = shoulderY + height * 0.06 + headRadius;
  group.add(head);

  // Arms with shoulder pivot + elbow
  const upperArmGeo = new THREE.CylinderGeometry(armRadius, armRadius * 0.9, upperArmLength, 6);
  const forearmGeo = new THREE.CylinderGeometry(armRadius * 0.9, armRadius * 0.7, forearmLength, 6);
  const handGeo = new THREE.SphereGeometry(handRadius, 8, 8);

  // Left arm: shoulder pivot -> upper arm -> elbow pivot -> forearm + hand
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-shoulderOffset, shoulderY - height * 0.02, 0);
  group.add(leftShoulder);

  const leftUpperArm = new THREE.Mesh(upperArmGeo, shirtMat);
  leftUpperArm.position.y = -upperArmLength / 2;
  leftShoulder.add(leftUpperArm);

  const leftElbow = new THREE.Group();
  leftElbow.position.y = -upperArmLength;
  leftShoulder.add(leftElbow);

  const leftForearm = new THREE.Mesh(forearmGeo, skinMat);
  leftForearm.position.y = -forearmLength / 2;
  leftElbow.add(leftForearm);

  const leftHand = new THREE.Mesh(handGeo, skinMat);
  leftHand.position.y = -forearmLength - handRadius * 0.3;
  leftElbow.add(leftHand);

  // Right arm
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(shoulderOffset, shoulderY - height * 0.02, 0);
  group.add(rightShoulder);

  const rightUpperArm = new THREE.Mesh(upperArmGeo, shirtMat);
  rightUpperArm.position.y = -upperArmLength / 2;
  rightShoulder.add(rightUpperArm);

  const rightElbow = new THREE.Group();
  rightElbow.position.y = -upperArmLength;
  rightShoulder.add(rightElbow);

  const rightForearm = new THREE.Mesh(forearmGeo, skinMat);
  rightForearm.position.y = -forearmLength / 2;
  rightElbow.add(rightForearm);

  const rightHand = new THREE.Mesh(handGeo, skinMat);
  rightHand.position.y = -forearmLength - handRadius * 0.3;
  rightElbow.add(rightHand);

  group.userData.type = 'person';
  group.userData.height = height;
  group.userData.eyeHeight = legHeight + torsoHeight + height * 0.06 + headRadius * 2;
  group.userData.head = head;
  group.userData.leftLeg = leftLegPivot;
  group.userData.rightLeg = rightLegPivot;
  group.userData.leftArm = leftShoulder;
  group.userData.rightArm = rightShoulder;
  group.userData.leftElbow = leftElbow;
  group.userData.rightElbow = rightElbow;
  return group;
}

export const OBJECT_ICONS = {
  tree: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L8 8h2L6 14h3l-3 5h12l-3-5h3l-4-6h2z"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
  rock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20l5-12 4 4 3-6 6 14z"/></svg>',
  building: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/></svg>',
  person: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>',
};
