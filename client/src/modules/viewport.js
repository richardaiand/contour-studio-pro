import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { $ } from '../utils.js';
import { store } from '../store/index.js';

let renderer, scene, camera, controls, terrainMesh, gridHelper, northArrow;
let lastTheme = null;
let initialized = false;
let animFrameId = null;

export function initViewport() {
  const canvas = $('scene');
  if (!canvas) return;
  if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;

  if (initialized) {
    return { renderer, scene, camera, controls };
  }

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 5000);
  camera.position.set(0, 400, 600);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(200, 300, 100);
  scene.add(dir);

  const dir2 = new THREE.DirectionalLight(0x88aaff, 0.4);
  dir2.position.set(-100, 100, -100);
  scene.add(dir2);

  gridHelper = new THREE.GridHelper(1000, 40);
  gridHelper.material.fog = false;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.35;
  scene.add(gridHelper);

  createNorthArrow();

  applyThemeColors();
  store.subscribe((state) => {
    if (state.theme !== lastTheme) {
      applyThemeColors(state.theme);
    }
  });

  window.addEventListener('resize', resize);

  initialized = true;
  animate();

  return { renderer, scene, camera, controls };
}

function createNorthArrow() {
  if (northArrow) {
    scene.remove(northArrow);
    northArrow.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }

  northArrow = new THREE.Group();

  // Arrow points -Y (becomes +Z = north after rotation.x = -PI/2)
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, -1);
  arrowShape.lineTo(0.3, 0.5);
  arrowShape.lineTo(0, 0.2);
  arrowShape.lineTo(-0.3, 0.5);
  arrowShape.lineTo(0, -1);

  const arrowGeo = new THREE.ShapeGeometry(arrowShape);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
  const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
  northArrow.add(arrowMesh);

  const ringGeo = new THREE.RingGeometry(0.8, 1, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  northArrow.add(ring);

  // N label near the tip (-Y end = north after rotation)
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 128;
  labelCanvas.height = 128;
  const ctx = labelCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', 64, 60);
  const texture = new THREE.CanvasTexture(labelCanvas);
  const labelMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  const labelGeo = new THREE.PlaneGeometry(0.6, 0.6);
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.set(0, -0.6, 0);
  northArrow.add(label);

  northArrow.rotation.x = -Math.PI / 2;
  northArrow.visible = false;
  scene.add(northArrow);
}

function applyThemeColors(theme = store.get('theme')) {
  if (!scene) return;
  lastTheme = theme;

  // Studio viewport always uses light background for better terrain visibility
  scene.background = new THREE.Color(0xf4f6f9);
  scene.fog = null;

  if (gridHelper) {
    gridHelper.material.color = new THREE.Color(0xd8dee8);
  }
}

function cssColor(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) return 0x0d1016;
  return new THREE.Color(value).getHex();
}

export function setTerrain(meshData, rotationDeg = 0) {
  const canvas = $('scene');
  if (!canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) {
    setTimeout(() => setTerrain(meshData, rotationDeg), 100);
    return;
  }
  if (!renderer || !scene) {
    initViewport();
  }
  if (!scene) return;

  if (terrainMesh) {
    scene.remove(terrainMesh);
    terrainMesh.geometry.dispose();
    if (Array.isArray(terrainMesh.material)) terrainMesh.material.forEach((m) => m.dispose());
    else terrainMesh.material.dispose();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(meshData.colors, 3));
  geometry.setIndex(meshData.indices);
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.05,
    side: THREE.DoubleSide,
    flatShading: false,
  });

  terrainMesh = new THREE.Mesh(geometry, material);
  scene.add(terrainMesh);

  // Frame camera
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = (camera.fov * Math.PI) / 180;
  const dist = (maxDim / (2 * Math.tan(fov / 2))) * 1.8;

  camera.position.set(center.x + dist * 0.6, center.y + dist * 0.4, center.z + dist * 0.8);
  controls.target.copy(center);
  controls.update();

  if (northArrow) {
    const arrowScale = maxDim * 0.08;
    northArrow.scale.set(arrowScale, arrowScale, arrowScale);
    northArrow.position.set(
      box.min.x - arrowScale * 1.5,
      box.min.y + 1,
      box.min.z + arrowScale * 0.5
    );
    northArrow.rotation.x = -Math.PI / 2;
    northArrow.rotation.z = -rotationDeg * Math.PI / 180;
    northArrow.visible = true;
  }

  triggerResize();
}

export function clearTerrain() {
  if (terrainMesh) {
    scene.remove(terrainMesh);
    terrainMesh.geometry.dispose();
    terrainMesh.material.dispose();
    terrainMesh = null;
  }
}

function resize() {
  const canvas = $('scene');
  if (!canvas || !renderer) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// Allow external code to trigger resize when view changes
export function triggerResize() {
  setTimeout(resize, 50);
  setTimeout(resize, 200);
}

function animate() {
  animFrameId = requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

let selectionOutline = null;

export function drawSelectionOutline(originalBounds, fetchBounds) {
  if (!scene) return;
  if (selectionOutline) {
    scene.remove(selectionOutline);
    selectionOutline.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }

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

  const yBottom = 0;
  let yTop = 100;
  if (terrainMesh?.geometry) {
    terrainMesh.geometry.computeBoundingBox();
    const box = terrainMesh.geometry.boundingBox;
    if (box) yTop = box.max.y + Math.max((box.max.y - box.min.y) * 0.3, 30);
  }

  const wallHeight = yTop - yBottom;
  const group = new THREE.Group();

  const wallGeo = new THREE.BufferGeometry();
  const wallPositions = new Float32Array([
    x0, yBottom, z0,  x1, yBottom, z0,  x1, yTop, z0,  x0, yTop, z0,
    x1, yBottom, z0,  x1, yBottom, z1,  x1, yTop, z1,  x1, yTop, z0,
    x1, yBottom, z1,  x0, yBottom, z1,  x0, yTop, z1,  x1, yTop, z1,
    x0, yBottom, z1,  x0, yBottom, z0,  x0, yTop, z0,  x0, yTop, z1,
  ]);
  wallGeo.setAttribute('position', new THREE.BufferAttribute(wallPositions, 3));
  wallGeo.setIndex([0,1,2, 0,2,3,  4,5,6, 4,6,7,  8,9,10, 8,10,11,  12,13,14, 12,14,15]);

  const wallMat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(wallGeo, wallMat));

  const edgeGeo = new THREE.BufferGeometry();
  const edgePositions = new Float32Array([
    x0, yBottom, z0,  x1, yBottom, z0,
    x1, yBottom, z0,  x1, yBottom, z1,
    x1, yBottom, z1,  x0, yBottom, z1,
    x0, yBottom, z1,  x0, yBottom, z0,
    x0, yTop, z0,  x1, yTop, z0,
    x1, yTop, z0,  x1, yTop, z1,
    x1, yTop, z1,  x0, yTop, z1,
    x0, yTop, z1,  x0, yTop, z0,
    x0, yBottom, z0,  x0, yTop, z0,
    x1, yBottom, z0,  x1, yTop, z0,
    x1, yBottom, z1,  x1, yTop, z1,
    x0, yBottom, z1,  x0, yTop, z1,
  ]);
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));

  const edgeMat = new THREE.LineBasicMaterial({ color: 0x60a5fa, linewidth: 2 });
  group.add(new THREE.LineSegments(edgeGeo, edgeMat));

  selectionOutline = group;
  scene.add(selectionOutline);
}

export function getTerrainMesh() {
  return terrainMesh;
}

export function getScene() {
  return scene;
}

export function getCamera() {
  return camera;
}

export function getRenderer() {
  return renderer;
}

export function getControls() {
  return controls;
}

export function captureStudioThumbnail() {
  if (!renderer || !scene || !camera) return null;
  renderer.render(scene, camera);
  const canvas = renderer.domElement;
  try {
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}
