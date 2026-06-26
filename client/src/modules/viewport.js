import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { $ } from '../utils.js';
import { store } from '../store/index.js';

let renderer, scene, camera, controls, terrainMesh, gridHelper;

export function initViewport() {
  const canvas = $('scene');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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

  applyThemeColors();
  store.subscribe((state) => {
    applyThemeColors(state.theme);
  });

  window.addEventListener('resize', resize);
  animate();

  return { renderer, scene, camera, controls };
}

function applyThemeColors(theme = store.get('theme')) {
  if (!scene) return;

  const bg = cssColor('--bg');
  const border = cssColor('--panel-border');

  scene.background = new THREE.Color(bg);
  scene.fog = null;

  if (gridHelper) {
    gridHelper.material.color = new THREE.Color(border);
  }
}

function cssColor(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) return 0x0d1016;
  return new THREE.Color(value).getHex();
}

export function setTerrain(meshData) {
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

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

let selectionOutline = null;

export function drawSelectionOutline(originalBounds, fetchBounds) {
  if (!scene) return;
  if (selectionOutline) {
    scene.remove(selectionOutline);
    selectionOutline.geometry?.dispose();
    selectionOutline.material?.dispose();
  }

  const latMid = (originalBounds.minLat + originalBounds.maxLat) / 2;
  const xScale = 111320 * Math.cos((latMid * Math.PI) / 180);
  const zScale = 111320;

  const fetchCenterLat = (fetchBounds.minLat + fetchBounds.maxLat) / 2;
  const fetchCenterLon = (fetchBounds.minLon + fetchBounds.maxLon) / 2;
  const offsetX = (fetchCenterLon - fetchBounds.minLon) * xScale - xScale * (fetchBounds.maxLon - fetchBounds.minLon) / 2;
  const offsetZ = (fetchCenterLat - fetchBounds.minLat) * zScale - zScale * (fetchBounds.maxLat - fetchBounds.minLat) / 2;

  const w = (originalBounds.maxLon - originalBounds.minLon) * xScale;
  const h = (originalBounds.maxLat - originalBounds.minLat) * zScale;
  const cx = (originalBounds.minLon + originalBounds.maxLon) / 2;
  const cz = (originalBounds.minLat + originalBounds.maxLat) / 2;

  const px = (cx - fetchBounds.minLon) * xScale - xScale * (fetchBounds.maxLon - fetchBounds.minLon) / 2;
  const pz = (cz - fetchBounds.minLat) * zScale - zScale * (fetchBounds.maxLat - fetchBounds.minLat) / 2;

  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    px - w / 2, 1, pz - h / 2,
    px + w / 2, 1, pz - h / 2,
    px + w / 2, 1, pz + h / 2,
    px - w / 2, 1, pz + h / 2,
    px - w / 2, 1, pz - h / 2,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 3 });
  selectionOutline = new THREE.Line(geo, mat);
  scene.add(selectionOutline);
}

export function getTerrainMesh() {
  return terrainMesh;
}
