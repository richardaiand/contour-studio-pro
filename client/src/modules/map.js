import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { $ } from '../utils.js';
import { store } from '../store/index.js';

let map;
let marker;
let selectionSource;
let selectionLayer;
let isDraggingMarker = false;

const AREA_SIZE_METERS = 1000;

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
    if (state.center && (!marker || marker.getLngLat().lat !== state.center.lat || marker.getLngLat().lng !== state.center.lon)) {
      setMarker(state.center, false);
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
  map.flyTo({ center: [center.lon, center.lat], zoom: Math.max(map.getZoom(), 14) });
}

function updateSelection(center, updateStore = true) {
  const bounds = computeBounds(center, AREA_SIZE_METERS);
  if (updateStore) {
    store.set({ center, bounds });
  }
  updateSelectionLayer(bounds);
}

function updateSelectionLayer(bounds) {
  if (!map || !map.getSource('selection')) return;
  const polygon = polygonFromBounds(bounds);
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
  updateSelectionLayer(bounds);
}

export function getCenter() {
  return marker ? { lat: marker.getLngLat().lat, lon: marker.getLngLat().lng } : null;
}

export function computeBounds(center, sizeMeters = 1000) {
  const latDelta = sizeMeters / 111320;
  const lonDelta = sizeMeters / (111320 * Math.cos((center.lat * Math.PI) / 180));
  return {
    minLon: center.lon - lonDelta / 2,
    maxLon: center.lon + lonDelta / 2,
    minLat: center.lat - latDelta / 2,
    maxLat: center.lat + latDelta / 2,
  };
}
