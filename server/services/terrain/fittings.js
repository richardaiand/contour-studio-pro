// V2: 3D Pipe/Fitting Library
// TODO: Generate low-poly cylinder meshes for pipe segments
// TODO: Generate elbow/junction fittings
// TODO: Color-code by utility type (sewer=green, water=blue, gas=yellow, electric=red)

export const PIPE_COLORS = {
  sewer: 0x2dd4bf,
  water: 0x3b82f6,
  gas: 0xfacc15,
  electric: 0xef4444,
};

export const PIPE_TYPES = {
  STRAIGHT: 'straight',
  ELBOW: 'elbow',
  JUNCTION: 'junction',
  VALVE: 'valve',
};

// TODO: Implement generatePipeMesh(segment, type)
// TODO: Returns { positions, normals, indices, colors } like terrain mesh

export function generatePipeMesh(segment, type = PIPE_TYPES.STRAIGHT) {
  // TODO: Create cylinder geometry for pipe segment
  // TODO: Add end caps
  // TODO: Return mesh data compatible with Three.js BufferGeometry
  throw new Error('Not implemented — see ROADMAP.md V2.2');
}

export function generateFittingMesh(type, size) {
  // TODO: Create elbow or junction fitting
  throw new Error('Not implemented — see ROADMAP.md V2.2');
}
