export const PIPE_COLORS = {
  sewer: [0.18, 0.83, 0.75],
  water: [0.23, 0.51, 0.96],
  gas: [0.98, 0.80, 0.08],
  electric: [0.94, 0.31, 0.31],
};

export const PIPE_TYPES = {
  STRAIGHT: 'straight',
  ELBOW: 'elbow',
  JUNCTION: 'junction',
  VALVE: 'valve',
};

export function generatePipeMesh(start, end, utilityType = 'sewer', diameter = 0.3) {
  const segments = 8;
  const radius = diameter / 2;
  const color = PIPE_COLORS[utilityType] || PIPE_COLORS.sewer;

  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (length < 0.01) {
    return { positions: [], normals: [], indices: [], colors: [], length: 0 };
  }

  const positions = [];
  const normals = [];
  const indices = [];
  const colors = [];

  const dir = [dx / length, dy / length, dz / length];
  const up = [0, 1, 0];
  let right;
  if (Math.abs(dir[1]) > 0.99) {
    right = [1, 0, 0];
  } else {
    const cx = up[1] * dir[2] - up[2] * dir[1];
    const cy = up[2] * dir[0] - up[0] * dir[2];
    const cz = up[0] * dir[1] - up[1] * dir[0];
    const cl = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
    right = [cx / cl, cy / cl, cz / cl];
  }
  const up2 = [
    right[1] * dir[2] - right[2] * dir[1],
    right[2] * dir[0] - right[0] * dir[2],
    right[0] * dir[1] - right[1] * dir[0],
  ];

  for (const t of [0, 1]) {
    const cx = start[0] + dx * t;
    const cy = start[1] + dy * t;
    const cz = start[2] + dz * t;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const nx = right[0] * cos + up2[0] * sin;
      const ny = right[1] * cos + up2[1] * sin;
      const nz = right[2] * cos + up2[2] * sin;
      positions.push(cx + nx * radius, cy + ny * radius, cz + nz * radius);
      normals.push(nx, ny, nz);
      colors.push(color[0], color[1], color[2]);
    }
  }

  for (let i = 0; i < segments; i++) {
    const a = i;
    const b = (i + 1) % segments;
    const c = segments + i;
    const d = segments + ((i + 1) % segments);
    indices.push(a, c, b);
    indices.push(b, c, d);
  }

  return { positions, normals, indices, colors, length };
}

export function generateFittingMesh(type, size = 0.5) {
  const segments = 12;
  const radius = size;
  const color = [0.5, 0.5, 0.5];

  if (type === PIPE_TYPES.ELBOW) {
    return generateElbowFitting(radius, segments, 90);
  } else if (type === PIPE_TYPES.JUNCTION) {
    return generateJunctionFitting(radius, segments);
  } else if (type === PIPE_TYPES.VALVE) {
    return generateValveFitting(radius, segments);
  }

  return generateStraightFitting(radius, segments);
}

function generateStraightFitting(radius, segments) {
  const positions = [];
  const normals = [];
  const indices = [];
  const colors = [];

  for (const t of [0, 1]) {
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      positions.push(Math.cos(angle) * radius, t, Math.sin(angle) * radius);
      normals.push(Math.cos(angle), 0, Math.sin(angle));
      colors.push(0.5, 0.5, 0.5);
    }
  }

  for (let i = 0; i < segments; i++) {
    const a = i;
    const b = (i + 1) % segments;
    indices.push(a, segments + i, b);
    indices.push(b, segments + i, segments + ((i + 1) % segments));
  }

  return { positions, normals, indices, colors };
}

function generateElbowFitting(radius, segments, angleDeg) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const arcSegments = Math.max(8, Math.ceil(angleDeg / 10));
  const positions = [];
  const normals = [];
  const indices = [];
  const colors = [];

  for (let s = 0; s <= arcSegments; s++) {
    const t = s / arcSegments;
    const a = t * angleRad;
    for (let i = 0; i < segments; i++) {
      const ringAngle = (i / segments) * Math.PI * 2;
      const cx = Math.sin(a) * radius * 2;
      const cy = Math.cos(a) * radius * 2;
      const nx = Math.cos(ringAngle) * Math.sin(a);
      const ny = Math.cos(ringAngle) * Math.cos(a);
      const nz = Math.sin(ringAngle);
      positions.push(cx + nx * radius, cy + ny * radius, nz * radius);
      normals.push(nx, ny, nz);
      colors.push(0.5, 0.5, 0.5);
    }
  }

  for (let s = 0; s < arcSegments; s++) {
    for (let i = 0; i < segments; i++) {
      const a = s * segments + i;
      const b = s * segments + ((i + 1) % segments);
      const c = (s + 1) * segments + i;
      const d = (s + 1) * segments + ((i + 1) % segments);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  return { positions, normals, indices, colors };
}

function generateJunctionFitting(radius, segments) {
  const straight = generateStraightFitting(radius, segments);

  const sphereGeo = generateSphereFitting(radius * 1.3, segments * 2);
  return {
    positions: [...straight.positions, ...sphereGeo.positions],
    normals: [...straight.normals, ...sphereGeo.normals],
    indices: [...straight.indices, ...sphereGeo.indices.map((i) => i + straight.positions.length / 3)],
    colors: [...straight.colors, ...sphereGeo.colors],
  };
}

function generateSphereFitting(radius, segments) {
  const positions = [];
  const normals = [];
  const indices = [];
  const colors = [];

  const rings = Math.floor(segments / 2);
  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI;
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(theta) * radius;
      const y = Math.cos(phi) * radius;
      const z = Math.sin(phi) * Math.sin(theta) * radius;
      positions.push(x, y, z);
      normals.push(x / radius, y / radius, z / radius);
      colors.push(0.5, 0.5, 0.5);
    }
  }

  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < segments; i++) {
      const a = r * segments + i;
      const b = r * segments + ((i + 1) % segments);
      const c = (r + 1) * segments + i;
      const d = (r + 1) * segments + ((i + 1) % segments);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  return { positions, normals, indices, colors };
}

function generateValveFitting(radius, segments) {
  const straight = generateStraightFitting(radius, segments);

  const valvePositions = [];
  const valveNormals = [];
  const valveIndices = [];
  const valveColors = [];

  const valveRadius = radius * 1.5;
  const valveHeight = radius * 0.8;
  for (const t of [0, 1]) {
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      valvePositions.push(Math.cos(angle) * valveRadius, t * valveHeight, Math.sin(angle) * valveRadius);
      valveNormals.push(Math.cos(angle), 0, Math.sin(angle));
      valveColors.push(0.8, 0.3, 0.3);
    }
  }
  for (let i = 0; i < segments; i++) {
    const a = i;
    const b = (i + 1) % segments;
    valveIndices.push(a, segments + i, b);
    valveIndices.push(b, segments + i, segments + ((i + 1) % segments));
  }

  const offset = straight.positions.length / 3;
  return {
    positions: [...straight.positions, ...valvePositions],
    normals: [...straight.normals, ...valveNormals],
    indices: [...straight.indices, ...valveIndices.map((i) => i + offset)],
    colors: [...straight.colors, ...valveColors],
  };
}
