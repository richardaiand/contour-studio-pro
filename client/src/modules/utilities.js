import * as THREE from 'three';
import { api } from '../utils.js';
import { getScene, getTerrainMesh } from './viewport.js';

const PIPE_COLORS = {
  sewer: 0x2dd4bf,
  water: 0x3b82f6,
  gas: 0xfacc15,
  electric: 0xef4444,
};

const METERS_PER_DEGREE_LAT = 111320;

let utilityGroup = null;

export async function loadUtilities(bounds, type = 'sewer') {
  const data = await api(`/utilities?bounds=${encodeURIComponent(JSON.stringify(bounds))}&type=${type}`);
  return data;
}

export function renderUtilityPipes(scene, features, terrainMesh, bounds) {
  if (!scene || !terrainMesh || !bounds) return;

  clearUtilityPipes(scene);

  utilityGroup = new THREE.Group();
  utilityGroup.name = 'utility-pipes';

  const latMid = (bounds.minLat + bounds.maxLat) / 2;
  const xScale = METERS_PER_DEGREE_LAT * Math.cos((latMid * Math.PI) / 180);
  const zScale = METERS_PER_DEGREE_LAT;

  const xSpanMeters = (bounds.maxLon - bounds.minLon) * xScale;
  const zSpanMeters = (bounds.maxLat - bounds.minLat) * zScale;

  for (const feature of features) {
    const geom = feature.geometry;
    const utilityType = feature.properties?.utilityType || 'sewer';
    const color = PIPE_COLORS[utilityType] || 0x2dd4bf;

    if (geom.type === 'LineString') {
      renderLineString(geom.coordinates, utilityType, color, bounds, xScale, zScale, xSpanMeters, zSpanMeters, terrainMesh);
    } else if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates) {
        renderLineString(line, utilityType, color, bounds, xScale, zScale, xSpanMeters, zSpanMeters, terrainMesh);
      }
    }
  }

  scene.add(utilityGroup);
}

function renderLineString(coords, utilityType, color, bounds, xScale, zScale, xSpanMeters, zSpanMeters, terrainMesh) {
  const diameter = (utilityType === 'sewer' ? 0.4 : 0.3) * 2;

  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];

    const x1 = (lon1 - bounds.minLon) * xScale - xSpanMeters / 2;
    const z1 = (lat1 - bounds.minLat) * zScale - zSpanMeters / 2;
    const x2 = (lon2 - bounds.minLon) * xScale - xSpanMeters / 2;
    const z2 = (lat2 - bounds.minLat) * zScale - zSpanMeters / 2;

    const y1 = getTerrainHeightAt(x1, z1, terrainMesh);
    const y2 = getTerrainHeightAt(x2, z2, terrainMesh);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (length < 0.1) continue;

    const geo = new THREE.CylinderGeometry(diameter / 2, diameter / 2, length, 8, 1);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 });
    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2 + 0.5, (z1 + z2) / 2);

    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
    mesh.quaternion.copy(quat);

    utilityGroup.add(mesh);
  }
}

function getTerrainHeightAt(x, z, terrainMesh) {
  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, 10000, z), new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(terrainMesh, false);
  if (intersects.length > 0) {
    return intersects[0].point.y;
  }

  if (terrainMesh.geometry?.attributes?.position) {
    const pos = terrainMesh.geometry.attributes.position;
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

export function clearUtilityPipes(scene) {
  if (!scene || !utilityGroup) return;
  utilityGroup.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  scene.remove(utilityGroup);
  utilityGroup = null;
}

export function getUtilityGroup() {
  return utilityGroup;
}
