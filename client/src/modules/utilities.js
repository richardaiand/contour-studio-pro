// V2: Utility overlay client module
// TODO: Fetch utility line data from /api/utilities
// TODO: Render pipe segments as cylinders on the 3D model
// TODO: Toggle visibility by utility type

import { api } from '../utils.js';

export async function loadUtilities(bounds, type = 'sewer') {
  // TODO: Fetch utility GeoJSON from server
  // TODO: Return features array
  throw new Error('Not implemented — see ROADMAP.md V2.1');
}

export function renderUtilityPipes(scene, features) {
  // TODO: For each feature, create a cylinder mesh
  // TODO: Position at correct lat/lon/elevation
  // TODO: Color by utility type
  // TODO: Add to scene
  throw new Error('Not implemented — see ROADMAP.md V2.1');
}

export function clearUtilityPipes(scene) {
  // TODO: Remove all utility pipe meshes from scene
}
