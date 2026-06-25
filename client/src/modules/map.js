import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { $ } from '../utils.js';
import { store } from '../store/index.js';

let map;
let marker;
let isDraggingMarker = false;

const METERS_PER_DEGREE_LAT = 111320;
const MAX_SIZE_METERS = 10000;
const MIN_SIZE_METERS = 10;

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
  });

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

  map.on('click', (e) => {
    if (isDraggingMarker) return;
    const { lng, lat } = e.lngLat;
    setMarker({ lat, lon: lng });
    reverseGeocode(lat, lng);
  });

  store.subscribe((state) => {
    if (state.center) {
      const current = marker ? marker.getLngLat() : null;
      const moved = !current || Math.abs(current.lat - state.center.lat) > 1e-9 || Math.abs(current.lng - state.center.lon) > 1e-9;
      if (moved) {
        setMarker(state.center, false);
      } else {
        updateSelection(state.center, false);
      }
    }
  });

  return map;
}

export function setMarker(center, updateStore = true) {
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
    updateSelection({ lat, lon: lng });
    isDraggingMarker = false;
  });

  updateSelection(center, updateStore);
  map.flyTo({ center: [center.lon, center.lat], zoom: Math.max(map.getZoom(), fitZoomForSize()) });
}

export function getAreaInputs() {
  const value = parseFloat($('areaValue')?.value);
  const unit = $('areaUnit')?.value || 'km';
  const rotation = parseFloat($('areaRotation')?.value) || 0;
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
      // Treat acre as a square area; side length = sqrt(area)
      meters = Math.sqrt(value * 4046.85642);
      break;
    default:
      meters = value * 1000;
  }

  return Math.max(MIN_SIZE_METERS, Math.min(MAX_SIZE_METERS, meters));
}

export function unitLimits(unit) {
  // Convert 10 m min and 10,000 m max into each unit
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
  const meters = sizeMetersFromInputs();
  if (unit === 'acre') return `${value} acres (${Math.round(meters)} m side)`;
  return `${value} ${unit} × ${value} ${unit}`;
}

function fitZoomForSize() {
  const meters = sizeMetersFromInputs();
  if (meters <= 100) return 17;
  if (meters <= 500) return 15;
  if (meters <= 1000) return 14;
  if (meters <= 5000) return 13;
  return 12;
}

function updateSelection(center, updateStore = true) {
  const sizeMeters = sizeMetersFromInputs();
  const rotation = parseFloat($('areaRotation')?.value) || 0;
  const polygon = rotatedSquare(center, sizeMeters, rotation);
  const bounds = boundsFromPolygon(polygon);

  if (updateStore) {
    store.set({ center, bounds, sizeMeters, rotation });
  }
  updateSelectionLayer(polygon);
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

function rotatedSquare(center, sizeMeters, rotationDegrees) {
  const half = sizeMeters / 2;
  const rotation = (rotationDegrees * Math.PI) / 180;
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);

  // Convert half side from meters to degrees
  const latDelta = half / METERS_PER_DEGREE_LAT;
  const lonDelta = half / (METERS_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180));

  // Unrotated corners relative to center
  const corners = [
    { x: -lonDelta, y: -latDelta },
    { x: lonDelta, y: -latDelta },
    { x: lonDelta, y: latDelta },
    { x: -lonDelta, y: latDelta },
  ];

  const rotated = corners.map(({ x, y }) => ({
    lon: center.lon + x * cosR - y * sinR,
    lat: center.lat + x * sinR + y * cosR,
  }));

  // Close the polygon
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
    { padding: 40 }
  );
  const center = { lat: (bounds.minLat + bounds.maxLat) / 2, lon: (bounds.minLon + bounds.maxLon) / 2 };
  updateSelection(center, false);
}

export function getCenter() {
  return marker ? { lat: marker.getLngLat().lat, lon: marker.getLngLat().lng } : null;
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
