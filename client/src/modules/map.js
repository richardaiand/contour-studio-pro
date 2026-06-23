import maplibregl from 'maplibre-gl';
import { $ } from '../utils.js';
import { store, setStatus } from '../store/index.js';

let map;
let marker;
let selectionRect;

export function initMap() {
  const lightTheme = store.get('theme') === 'light';

  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
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

  map.on('click', (e) => {
    const { lng, lat } = e.lngLat;
    setMarker({ lat, lon: lng });
  });

  store.subscribe((state) => {
    if (state.center && state.center !== selectionRect) {
      setMarker(state.center, false);
    }
  });

  return map;
}

export function setMarker(center, updateStore = true) {
  if (!map) return;

  if (marker) marker.remove();
  marker = new maplibregl.Marker().setLngLat([center.lon, center.lat]).addTo(map);

  if (updateStore) {
    const bounds = computeBounds(center, 1000);
    store.set({ center, bounds });
  }

  map.flyTo({ center: [center.lon, center.lat], zoom: 14 });
}

export function setBounds(bounds) {
  if (!map || !bounds) return;
  map.fitBounds(
    [[bounds.minLon, bounds.minLat], [bounds.maxLon, bounds.maxLat]],
    { padding: 40 }
  );
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
