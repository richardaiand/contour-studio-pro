import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { $ } from '../utils.js';
import { store } from '../store/index.js';

let map;
let marker;
let rotationHandle;
let isDraggingMarker = false;
let isDraggingBox = false;
let isRotating = false;
let boxDragStart = null;
let rotateStart = null;
let ignoreNextClick = false;

const METERS_PER_DEGREE_LAT = 111320;
const MAX_SIZE_METERS = 10000;
const MIN_SIZE_METERS = 10;
const HANDLE_DISTANCE_METERS = 80;

export function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
    center: [-98.5795, 39.8283],
    zoom: 3,
    minZoom: 2,
    maxZoom: 19,
    renderWorldCopies: false,
    scrollZoom: { smooth: true, speed: 0.6 },
    touchZoomRotate: true,
    dragRotate: false,
    dragPan: false,
    pitchWithRotate: false,
    maxPitch: 0,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right');

  // Prevent right-click context menu
  map.getCanvas().addEventListener('contextmenu', (e) => e.preventDefault());

  // Custom right-click drag to pan the map
  let isRightPanning = false;
  let rightPanStart = null;

  map.on('mousedown', (e) => {
    if (e.originalEvent.button !== 2) return; // right-click only
    isRightPanning = true;
    rightPanStart = {
      x: e.originalEvent.clientX,
      y: e.originalEvent.clientY,
      center: { ...map.getCenter() },
    };
    map.getCanvas().style.cursor = 'grabbing';
  });

  map.on('mousemove', (e) => {
    if (!isRightPanning || !rightPanStart) return;
    const dx = e.originalEvent.clientX - rightPanStart.x;
    const dy = e.originalEvent.clientY - rightPanStart.y;
    // Convert pixel delta to degrees based on zoom level
    const scale = 256 * Math.pow(2, map.getZoom());
    const lngDeg = -dx / scale * 360;
    const latDeg = dy / scale * 180;
    map.jumpTo({
      center: [
        Math.max(-180, Math.min(180, rightPanStart.center.lng + lngDeg)),
        Math.max(-85, Math.min(85, rightPanStart.center.lat + latDeg)),
      ],
    });
  });

  map.on('mouseup', () => {
    if (isRightPanning) {
      isRightPanning = false;
      rightPanStart = null;
      map.getCanvas().style.cursor = '';
    }
  });

  // Also stop panning if mouse leaves the canvas
  map.getCanvas().addEventListener('mouseleave', () => {
    if (isRightPanning) {
      isRightPanning = false;
      rightPanStart = null;
      map.getCanvas().style.cursor = '';
    }
  });

  // Clamp latitude so the map doesn't scroll past the poles
  map.on('move', () => {
    const c = map.getCenter();
    if (c.lat > 85 || c.lat < -85) {
      map.setCenter([c.lng, Math.max(-85, Math.min(85, c.lat))]);
    }
  });

  // Interrupt any fitBounds animation when the user interacts
  const stopAnimation = () => { if (map.isMoving()) map.stop(); };
  map.on('wheel', stopAnimation);
  map.on('mousedown', stopAnimation);
  map.on('touchstart', stopAnimation);
  map.on('dragstart', stopAnimation);

  map.on('error', (e) => {
    console.error('Map error:', e.error);
  });

  map.on('styleimagemissing', (e) => {
    console.warn('Map image missing:', e.id);
  });

  map.on('load', () => {
    map.addSource('selection', {
      type: 'geojson',
      data: emptyPolygon(),
    });

    map.addLayer({
      id: 'selection-fill',
      type: 'fill',
      source: 'selection',
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.12,
      },
    });

    map.addLayer({
      id: 'selection-outline',
      type: 'line',
      source: 'selection',
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2,
        'line-dasharray': [2, 2],
      },
    });
  });

  // Drag the selection box
  map.on('mousedown', 'selection-fill', (e) => {
    if (isDraggingMarker || isDraggingBox || isRotating) return;
    isDraggingBox = true;
    boxDragStart = {
      lngLat: e.lngLat,
      center: store.get('center') || { lat: e.lngLat.lat, lon: e.lngLat.lng },
    };
    map.getCanvas().style.cursor = 'grabbing';
    map.dragPan.disable();
  });

  map.on('mousemove', (e) => {
    if (isDraggingBox) {
      const deltaLng = e.lngLat.lng - boxDragStart.lngLat.lng;
      const deltaLat = e.lngLat.lat - boxDragStart.lngLat.lat;
      const newCenter = {
        lat: boxDragStart.center.lat + deltaLat,
        lon: boxDragStart.center.lon + deltaLng,
      };
      if (marker) marker.setLngLat([newCenter.lon, newCenter.lat]);
      updateSelection(newCenter, true, false);
      return;
    }

    if (isRotating) {
      const center = store.get('center');
      if (!center) return;
      const local = lonLatToLocalMeters(center, e.lngLat.lat, e.lngLat.lng);
      const angle = Math.atan2(local.dy, local.dx);
      // Handle sits at top (north) at rotation 0; mouse angle maps directly
      const target = ((90 - (angle * 180) / Math.PI) % 360 + 360) % 360;
      const current = store.get('rotation') || 0;
      let diff = target - current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      const rotation = ((current + diff * 0.5) % 360 + 360) % 360;
      setRotation(rotation);
      return;
    }
  });

  map.on('mouseup', () => {
    if (isDraggingBox) {
      isDraggingBox = false;
      boxDragStart = null;
      ignoreNextClick = true;
      map.getCanvas().style.cursor = '';
      map.dragPan.enable();
      setTimeout(() => {
        ignoreNextClick = false;
      }, 100);
      return;
    }

    if (isRotating) {
      isRotating = false;
      ignoreNextClick = true;
      if (rotationHandle) rotationHandle.getElement().style.cursor = 'grab';
      // Snap to nearest 0/90/180/270 if within 7 degrees
      const rotation = store.get('rotation') || 0;
      const nearest = Math.round(rotation / 90) * 90;
      if (Math.abs(rotation - nearest) <= 7) {
        setRotation(nearest);
      }
      setTimeout(() => {
        ignoreNextClick = false;
      }, 100);
    }
  });

  map.on('mouseenter', 'selection-fill', () => {
    if (!isDraggingBox && !isDraggingMarker && !isRotating) {
      map.getCanvas().style.cursor = 'grab';
    }
  });

  map.on('mouseleave', 'selection-fill', () => {
    if (!isDraggingBox && !isDraggingMarker && !isRotating) {
      map.getCanvas().style.cursor = '';
    }
  });

  map.on('click', (e) => {
    if (isDraggingMarker || ignoreNextClick || isDraggingBox || isRotating) return;
    const { lng, lat } = e.lngLat;
    setMarker({ lat, lon: lng });
    reverseGeocode(lat, lng);
  });

  store.subscribe((state) => {
    if (state.center && !isDraggingBox && !isRotating) {
      const current = marker ? marker.getLngLat() : null;
      const moved = !current || Math.abs(current.lat - state.center.lat) > 1e-9 || Math.abs(current.lng - state.center.lon) > 1e-9;
      if (moved) {
        setMarker(state.center, false);
      } else {
        updateSelection(state.center, false, false);
      }
    }
  });

  return map;
}

export function setMarker(center, updateStore = true, shouldZoom = true) {
  if (!map) return;

  if (marker) marker.remove();

  const el = document.createElement('div');
  el.className = 'map-marker';
  el.innerHTML = '<div class="marker-pin"></div>';

  marker = new maplibregl.Marker({
    element: el,
    draggable: true,
  })
    .setLngLat([center.lon, center.lat])
    .addTo(map);

  marker.on('dragstart', () => {
    isDraggingMarker = true;
  });

  marker.on('dragend', () => {
    const { lng, lat } = marker.getLngLat();
    updateSelection({ lat, lon: lng }, true, false);
    isDraggingMarker = false;
  });

  updateSelection(center, updateStore, false);

  if (shouldZoom) {
    const bounds = store.get('bounds');
    if (bounds) {
      map.fitBounds(
        [
          [bounds.minLon, bounds.minLat],
          [bounds.maxLon, bounds.maxLat],
        ],
        { padding: proportionalPadding(), maxZoom: 19, duration: 600 }
      );
    }
  }
}

function proportionalPadding() {
  const canvas = map.getCanvas();
  const minDim = Math.min(canvas.clientWidth, canvas.clientHeight);
  return Math.round(minDim * 0.25);
}

function createRotationHandle(center, sizeMeters, rotation) {
  if (rotationHandle) rotationHandle.remove();

  const el = document.createElement('div');
  el.className = 'rotation-handle';
  el.title = 'Drag to rotate';
  el.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.636-6.364"/>
      <path d="M21 3v9h-9"/>
      <path d="M3 12a9 9 0 1 1 2.636 6.364"/>
      <path d="M3 21v-9h9"/>
    </svg>
  `;

  const pos = handlePosition(center, sizeMeters, rotation);
  rotationHandle = new maplibregl.Marker({
    element: el,
    draggable: false,
  })
    .setLngLat([pos.lon, pos.lat])
    .addTo(map);

  el.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isRotating = true;
    el.style.cursor = 'grabbing';
  });

  el.addEventListener('mouseenter', () => {
    if (!isRotating) el.style.cursor = 'grab';
  });

  return rotationHandle;
}

function handlePosition(center, sizeMeters, rotation) {
  const half = sizeMeters / 2;
  const distance = half + HANDLE_DISTANCE_METERS;
  const rad = (rotation * Math.PI) / 180;
  // Handle sits at top (north) when rotation=0, rotates with the box
  const dx = distance * Math.sin(rad);
  const dy = distance * Math.cos(rad);
  return localMetersToLonLat(center, dx, dy);
}

export function getAreaInputs() {
  const value = parseFloat($('areaValue')?.value);
  const unit = $('areaUnit')?.value || 'km';
  const rotation = store.get('rotation') || 0;
  return { value: Number.isFinite(value) ? value : 1, unit, rotation };
}

export function sizeMetersFromInputs(inputs = getAreaInputs()) {
  const { value, unit } = inputs;
  if (value <= 0) return 1000;

  let meters;
  switch (unit) {
    case 'm':
      meters = value;
      break;
    case 'km':
      meters = value * 1000;
      break;
    case 'ft':
      meters = value * 0.3048;
      break;
    case 'mi':
      meters = value * 1609.344;
      break;
    case 'acre':
      meters = Math.sqrt(value * 4046.85642);
      break;
    default:
      meters = value * 1000;
  }

  return Math.max(MIN_SIZE_METERS, Math.min(MAX_SIZE_METERS, meters));
}

export function unitLimits(unit) {
  switch (unit) {
    case 'm':
      return { min: 10, max: 10000, step: 1 };
    case 'km':
      return { min: 0.01, max: 10, step: 0.01 };
    case 'ft':
      return { min: 33, max: 32808, step: 1 };
    case 'mi':
      return { min: 0.006, max: 6.214, step: 0.001 };
    case 'acre':
      return { min: 0.003, max: 24.71, step: 0.001 };
    default:
      return { min: 0.01, max: 10, step: 0.01 };
  }
}

export function formatSizeLabel() {
  const { value, unit } = getAreaInputs();
  if (unit === 'acre') return `${value} acres`;
  return `${value} ${unit} × ${value} ${unit}`;
}

function setRotation(rotation) {
  const center = store.get('center');
  if (!center) return;
  rotation = ((rotation % 360) + 360) % 360;
  const sizeMeters = sizeMetersFromInputs();
  const bounds = boundsFromPolygon(rotatedSquare(center, sizeMeters, rotation));
  store.set({ center, bounds, sizeMeters, rotation });
  updateSelectionLayer(rotatedSquare(center, sizeMeters, rotation));
  createRotationHandle(center, sizeMeters, rotation);
}

function updateSelection(center, updateStore = true, shouldZoom = false) {
  const sizeMeters = sizeMetersFromInputs();
  const rotation = store.get('rotation') || 0;
  const polygon = rotatedSquare(center, sizeMeters, rotation);
  const bounds = boundsFromPolygon(polygon);

  if (updateStore) {
    store.set({ center, bounds, sizeMeters, rotation });
  }
  updateSelectionLayer(polygon);
  createRotationHandle(center, sizeMeters, rotation);

  if (shouldZoom) {
    map.fitBounds(
      [
        [bounds.minLon, bounds.minLat],
        [bounds.maxLon, bounds.maxLat],
      ],
      { padding: 80, maxZoom: 17, duration: 600 }
    );
  }
}

function updateSelectionLayer(polygon) {
  if (!map || !map.getSource('selection')) return;
  map.getSource('selection').setData(polygon);
}

function emptyPolygon() {
  return polygonFromBounds({ minLon: 0, minLat: 0, maxLon: 0, maxLat: 0 });
}

function polygonFromBounds(bounds) {
  const { minLon, minLat, maxLon, maxLat } = bounds;
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat],
        ],
      ],
    },
    properties: {},
  };
}

function localMetersToLonLat(center, dx, dy) {
  const latDelta = dy / METERS_PER_DEGREE_LAT;
  const lonDelta = dx / (METERS_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180));
  return { lat: center.lat + latDelta, lon: center.lon + lonDelta };
}

function lonLatToLocalMeters(center, lat, lon) {
  const dy = (lat - center.lat) * METERS_PER_DEGREE_LAT;
  const dx = (lon - center.lon) * METERS_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180);
  return { dx, dy };
}

function rotatedSquare(center, sizeMeters, rotationDegrees) {
  const half = sizeMeters / 2;
  // Negate rotation so the box rotates in the same direction as the handle
  const rotation = (-rotationDegrees * Math.PI) / 180;
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);

  // Unrotated corners in local meters (square centered at origin)
  const corners = [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ];

  const rotated = corners.map(({ x, y }) => {
    const rx = x * cosR - y * sinR;
    const ry = x * sinR + y * cosR;
    return localMetersToLonLat(center, rx, ry);
  });

  rotated.push(rotated[0]);

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [rotated.map((p) => [p.lon, p.lat])],
    },
    properties: {},
  };
}

function boundsFromPolygon(polygon) {
  const coords = polygon.geometry.coordinates[0];
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return { minLon, maxLon, minLat, maxLat };
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.displayName) {
      $('addressInput').value = data.displayName;
    }
  } catch (e) {
    // ignore reverse geocode failures
  }
}

export function setBounds(bounds) {
  if (!map || !bounds) return;
  map.fitBounds(
    [
      [bounds.minLon, bounds.minLat],
      [bounds.maxLon, bounds.maxLat],
    ],
    { padding: proportionalPadding(), maxZoom: 19, duration: 600 }
  );
  const center = { lat: (bounds.minLat + bounds.maxLat) / 2, lon: (bounds.minLon + bounds.maxLon) / 2 };
  updateSelection(center, false, false);
}

export function getCenter() {
  return marker ? { lat: marker.getLngLat().lat, lon: marker.getLngLat().lng } : null;
}

export function getMapCenter() {
  if (!map) return null;
  const c = map.getCenter();
  return { lat: c.lat, lon: c.lng };
}

export function computeBounds(center, sizeMeters = 1000) {
  const latDelta = sizeMeters / METERS_PER_DEGREE_LAT;
  const lonDelta = sizeMeters / (METERS_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180));
  return {
    minLon: center.lon - lonDelta / 2,
    maxLon: center.lon + lonDelta / 2,
    minLat: center.lat - latDelta / 2,
    maxLat: center.lat + latDelta / 2,
  };
}
