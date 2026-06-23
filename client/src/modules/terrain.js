import { $, api } from '../utils.js';
import { store, setStatus } from '../store/index.js';
import { setTerrain, getTerrainMesh } from './viewport.js';
import { computeBounds } from './map.js';

export function initTerrain() {
  $('searchBtn').addEventListener('click', searchAddress);
  $('addressInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchAddress();
  });

  $('generateBtn').addEventListener('click', generateTerrain);

  // Detail selector
  const detailBtns = document.querySelectorAll('#detailSelector button');
  detailBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      detailBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      store.set({ detail: btn.dataset.value });
    });
  });

  // Exports
  document.querySelectorAll('.exports button').forEach((btn) => {
    btn.addEventListener('click', () => exportTerrain(btn.dataset.export));
  });

  store.subscribe((state) => {
    const hasTerrain = !!state.currentTerrain;
    document.querySelectorAll('.exports button').forEach((b) => (b.disabled = !hasTerrain));
    $('generateBtn').disabled = !state.bounds;
  });
}

async function searchAddress() {
  const address = $('addressInput').value.trim();
  if (!address) return;

  setStatus('Geocoding address…', '');
  try {
    const data = await api('/geocode', {
      method: 'POST',
      body: JSON.stringify({ address, sizeMeters: 1000 }),
    });
    store.set({ center: data.center, bounds: data.bounds });
    setStatus(`Found: ${data.displayName}`, 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

async function generateTerrain() {
  const bounds = store.get('bounds');
  if (!bounds) {
    setStatus('Search for a location first.', 'error');
    return;
  }

  store.set({ isGenerating: true });
  setStatus('Fetching elevation data…', '');
  document.querySelectorAll('.exports button').forEach((b) => (b.disabled = true));

  try {
    const detailLevel = store.get('detail');
    const data = await api('/terrain/generate', {
      method: 'POST',
      body: JSON.stringify({ bounds, detailLevel, verticalExaggeration: 1.5 }),
    });

    store.set({ currentTerrain: data });
    setTerrain(data.mesh);
    updateStats(data);
    setStatus(`${data.sourceDescription} · ${data.resolutionMeters}m resolution`, 'ok');
  } catch (e) {
    setStatus('Generation failed: ' + e.message, 'error');
  } finally {
    store.set({ isGenerating: false });
  }
}

function updateStats(data) {
  const stats = $('stats');
  const range = (data.maxElevation - data.minElevation).toFixed(1);
  stats.innerHTML = `
    <b>${data.mesh.width} × ${data.mesh.height}</b> vertices ·
    <b>${range}</b> m range ·
    <b>${data.verticalExaggeration}×</b> vertical exaggeration
  `;
}

async function exportTerrain(format) {
  const terrain = store.get('currentTerrain');
  if (!terrain) return;

  setStatus(`Exporting ${format.toUpperCase()}…`, '');
  try {
    const filename = $('filename').value.trim() || 'terrain';
    const res = await fetch('/api/terrain/export', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesh: terrain.mesh, format, filename }),
    });

    if (!res.ok) throw new Error(`Export ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Export complete.', 'ok');
  } catch (e) {
    setStatus('Export failed: ' + e.message, 'error');
  }
}
