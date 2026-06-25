import { $, api } from '../utils.js';
import { store, setStatus } from '../store/index.js';
import { setTerrain, getTerrainMesh } from './viewport.js';
import { computeBounds, getCenter, sizeMetersFromInputs, getAreaInputs, formatSizeLabel, unitLimits } from './map.js';
import { loadProjects } from './projects.js';

let suggestionIndex = -1;
let suggestions = [];

export function initTerrain() {
  $('searchBtn').addEventListener('click', searchAddress);
  $('addressInput').addEventListener('keydown', handleInputKey);
  $('addressInput').addEventListener('input', debounce(handleAddressInput, 250));

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

  // Area size / unit / rotation inputs
  const updateArea = () => {
    const center = store.get('center') || getCenter();
    if (center) {
      const sizeMeters = sizeMetersFromInputs();
      const bounds = computeBounds(center, sizeMeters);
      store.set({ sizeMeters, bounds });
    }
  };

  const updateUnitLimits = () => {
    const unit = $('areaUnit')?.value || 'km';
    const input = $('areaValue');
    if (!input) return;
    const limits = unitLimits(unit);
    input.min = limits.min;
    input.max = limits.max;
    input.step = limits.step;
    // Clamp existing value to new unit limits
    const current = parseFloat(input.value);
    if (Number.isFinite(current)) {
      const clamped = Math.max(limits.min, Math.min(limits.max, current));
      if (clamped !== current) input.value = String(clamped);
    }
  };

  $('areaValue')?.addEventListener('input', updateArea);
  $('areaUnit')?.addEventListener('change', () => {
    updateUnitLimits();
    updateArea();
  });

  updateUnitLimits();

  // Exports
  document.querySelectorAll('.exports button').forEach((btn) => {
    btn.addEventListener('click', () => exportTerrain(btn.dataset.export));
  });

  // Map upload
  $('mapUpload').addEventListener('change', analyzeMapUpload);

  store.subscribe((state) => {
    const hasTerrain = !!state.currentTerrain;
    document.querySelectorAll('.exports button').forEach((b) => (b.disabled = !hasTerrain));
    $('generateBtn').disabled = !state.bounds;
  });
}

function handleInputKey(e) {
  const list = $('searchSuggestions');
  if (!list.classList.contains('active')) {
    if (e.key === 'Enter') searchAddress();
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    suggestionIndex = Math.min(suggestionIndex + 1, suggestions.length - 1);
    renderSuggestions();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    suggestionIndex = Math.max(suggestionIndex - 1, -1);
    renderSuggestions();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (suggestionIndex >= 0 && suggestions[suggestionIndex]) {
      selectSuggestion(suggestions[suggestionIndex]);
    } else {
      searchAddress();
      hideSuggestions();
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
}

async function handleAddressInput(e) {
  const query = e.target.value.trim();
  if (query.length < 3) {
    hideSuggestions();
    return;
  }

  try {
    suggestions = await fetchSuggestions(query);
    suggestionIndex = -1;
    renderSuggestions();
  } catch (err) {
    hideSuggestions();
  }
}

async function fetchSuggestions(query) {
  const res = await fetch(`/api/geocode/autocomplete?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Autocomplete error');
  const data = await res.json();
  return data.results || [];
}

function renderSuggestions() {
  const list = $('searchSuggestions');
  if (suggestions.length === 0) {
    hideSuggestions();
    return;
  }

  list.innerHTML = '';
  suggestions.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'suggestion-item' + (i === suggestionIndex ? ' active' : '');
    div.textContent = s.name;
    div.addEventListener('click', () => selectSuggestion(s));
    list.appendChild(div);
  });

  list.classList.add('active');
}

function hideSuggestions() {
  const list = $('searchSuggestions');
  list.classList.remove('active');
  list.innerHTML = '';
  suggestions = [];
  suggestionIndex = -1;
}

function selectSuggestion(s) {
  $('addressInput').value = s.name;
  hideSuggestions();
  geocodeFromSuggestion(s);
}

async function geocodeFromSuggestion(s) {
  setStatus('Geocoding address…', '');
  try {
    const body = { address: s.name, sizeMeters: 1000, lat: s.lat, lon: s.lon, bbox: s.bbox };
    const data = await api('/geocode', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    store.set({ center: data.center, bounds: data.bounds });
    setStatus(`Found: ${data.displayName}`, 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

async function searchAddress() {
  const address = $('addressInput').value.trim();
  if (!address) return;
  hideSuggestions();

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

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function generateTerrain() {
  const bounds = store.get('bounds');
  if (!bounds) {
    setStatus('Search for a location first.', 'error');
    return;
  }

  if (!store.get('user')) {
    setStatus('Sign in to generate terrain.', 'error');
    return;
  }

  store.set({ isGenerating: true });
    setStatus('Queueing terrain generation…', '');
    setProgress(0, true);
    document.querySelectorAll('.exports button').forEach((b) => (b.disabled = true));

  try {
    const detailLevel = store.get('detail');
    const { jobId } = await api('/jobs/terrain', {
      method: 'POST',
      body: JSON.stringify({ bounds, detailLevel, verticalExaggeration: 1.5 }),
    });

    setStatus('Generating terrain…', '');
    const data = await pollJob(jobId);

    store.set({ currentTerrain: data, currentProject: { id: data.projectId } });
    setTerrain(data.mesh);
    updateStats(data);
    setProgress(100, false);
    const sizeLabel = formatSizeLabel();
    setStatus(`${data.sourceDescription || 'Terrain'} · ${sizeLabel} · ${data.resolutionMeters}m resolution`, 'ok');
    loadProjects();
  } catch (e) {
    setProgress(0, false);
    setStatus('Generation failed: ' + e.message, 'error');
  } finally {
    store.set({ isGenerating: false });
  }
}

function setProgress(percent, visible) {
  const bar = $('progressBar');
  const fill = $('progressFill');
  if (!bar || !fill) return;
  bar.style.display = visible ? 'block' : 'none';
  fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

async function pollJob(jobId) {
  const start = Date.now();
  const maxWait = 5 * 60 * 1000; // 5 minutes

  while (Date.now() - start < maxWait) {
    const job = await api(`/jobs/${jobId}`);

    if (job.status === 'completed') {
      return job.result;
    }
    if (job.status === 'failed') {
      throw new Error(job.error || 'Job failed');
    }

    setStatus(`Generating terrain… ${job.progress}%`, '');
    setProgress(job.progress);
    await sleep(1500);
  }

  throw new Error('Terrain generation timed out');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeMapUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!store.get('user')) {
    setStatus('Sign in to analyze uploaded maps.', 'error');
    e.target.value = '';
    return;
  }

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    setStatus('File too large. Maximum is 10MB.', 'error');
    e.target.value = '';
    return;
  }

  setStatus(`Analyzing ${file.name}…`, '');
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/maps/analyze', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      throw new Error(err.message);
    }

    const data = await res.json();
    store.set({ currentMapAnalysis: data.analysis });

    const interval = data.analysis?.contourIntervalMeters
      ? `${data.analysis.contourIntervalMeters}m contour interval`
      : 'no contour interval detected';
    setStatus(`Map analyzed: ${data.analysis?.title || file.name} · ${interval}`, 'ok');
  } catch (e) {
    setStatus('Map analysis failed: ' + e.message, 'error');
  } finally {
    e.target.value = '';
  }
}

function updateStats(data) {
  const stats = $('stats');
  const range = (data.maxElevation - data.minElevation).toFixed(1);
  const sizeLabel = formatSizeLabel();
  stats.innerHTML = `
    <b>${sizeLabel}</b> area ·
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
      body: JSON.stringify({ mesh: terrain.mesh, format, filename, projectId: terrain.projectId }),
    });

    if (!res.ok) throw new Error(`Export ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = format === 'heightmap' ? 'png' : format;
    a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `${filename}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Export complete.', 'ok');
  } catch (e) {
    setStatus('Export failed: ' + e.message, 'error');
  }
}
