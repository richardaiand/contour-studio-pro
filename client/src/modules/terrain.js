import { $, api } from '../utils.js';
import { store, setStatus } from '../store/index.js';
import { setTerrain, getTerrainMesh, drawSelectionOutline, captureStudioThumbnail } from './viewport.js';
import { computeBounds, getCenter, getMapCenter, sizeMetersFromInputs, getAreaInputs, formatSizeLabel, unitLimits, captureMapThumbnail } from './map.js';
import { loadProjects } from './projects.js';
import { navigate } from '../router.js';

let suggestionIndex = -1;
let suggestions = [];

export function initTerrain() {
  $('searchBtn')?.addEventListener('click', searchAddress);
  $('addressInput')?.addEventListener('keydown', handleInputKey);
  $('addressInput')?.addEventListener('input', debounce(handleAddressInput, 250));

  $('generateBtn')?.addEventListener('click', generateTerrain);
  $('dropCenterBtn')?.addEventListener('click', dropCenter);

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
  $('mapUpload')?.addEventListener('change', analyzeMapUpload);

  store.subscribe((state) => {
    const hasTerrain = !!state.currentTerrain;
    document.querySelectorAll('.exports button').forEach((b) => (b.disabled = !hasTerrain));
    const genBtn = $('generateBtn');
    if (genBtn) genBtn.disabled = !state.bounds;
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

  // Keep existing suggestions visible while fetching new ones
  try {
    const newSuggestions = await fetchSuggestions(query);
    // Only update if the input still matches (user didn't type more)
    if ($('addressInput').value.trim() === query) {
      suggestions = newSuggestions;
      suggestionIndex = -1;
      renderSuggestions();
    }
  } catch (err) {
    // Don't hide on error — keep old suggestions visible
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

function dropCenter() {
  const center = getMapCenter();
  if (!center) return;
  const sizeMeters = sizeMetersFromInputs();
  const bounds = computeBounds(center, sizeMeters);
  store.set({ center, bounds, sizeMeters });
  setStatus('Center dropped at current map view.', 'ok');
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
  setLoading(true, 'Queueing terrain generation…');
  document.querySelectorAll('.exports button').forEach((b) => (b.disabled = true));
  const genBtn = $('generateBtn');
  if (genBtn) genBtn.disabled = true;

  try {
    const detailLevel = store.get('detail');

    const currentProject = store.get('currentProject');
    let projectId = currentProject?.id;

    if (currentProject?.isNew) {
      const project = await api('/projects', {
        method: 'POST',
        body: JSON.stringify({ title: currentProject.title, detailLevel, bounds, center: store.get('center') }),
      });
      store.set({ currentProject: project });
      projectId = project.id;
    }

    const response = await api('/jobs/terrain', {
      method: 'POST',
      body: JSON.stringify({ bounds, detailLevel, verticalExaggeration: 1.5, projectId }),
    });

    const jobId = response.jobId;
    if (!jobId) {
      throw new Error('No job ID returned from server');
    }

    setLoading(true, 'Generating terrain…');
    const data = await pollJob(jobId);

    store.set({ currentTerrain: data, currentProject: { id: data.projectId, title: data.projectTitle } });
    const rotation = store.get('rotation') || 0;
    navigate('studio');
    requestAnimationFrame(() => {
      setTerrain(data.mesh, rotation);
      if (data.originalBounds && data.fetchBounds) {
        drawSelectionOutline(data.originalBounds, data.fetchBounds);
      }
      updateStats(data);
      setTimeout(async () => {
        const thumb = captureStudioThumbnail();
        if (thumb && data.projectId) {
          try {
            await api(`/projects/${data.projectId}`, {
              method: 'PATCH',
              body: JSON.stringify({ thumbnail: thumb }),
            });
            loadProjects();
          } catch {}
        }
      }, 500);
    });
    setLoading(false);
    const sizeLabel = formatSizeLabel();
    let statusMsg = `${data.sourceDescription || 'Terrain'} · ${sizeLabel} · ${data.resolutionMeters}m resolution`;
    if (data.wasExpanded) {
      statusMsg += ' · Area expanded to meet minimum data requirements';
    }
    setStatus(statusMsg, 'ok');
    loadProjects();
    navigate('studio');

    try {
      const projData = await api(`/projects/${data.projectId}`);
      if (projData.project?.terrainVersions) {
        store.set({ currentProject: { ...store.get('currentProject'), terrainVersions: projData.project.terrainVersions } });
        renderVersionList(projData.project.terrainVersions, data);
      }
    } catch {}
  } catch (e) {
    setLoading(false);
    setStatus('Generation failed: ' + e.message, 'error');
  } finally {
    store.set({ isGenerating: false });
    const gb = $('generateBtn');
    if (gb) gb.disabled = !store.get('bounds');
  }
}

function setLoading(visible, text) {
  const overlay = $('loadingOverlay');
  const textEl = $('loadingText');
  if (!overlay) return;
  if (visible) {
    if (textEl && text) textEl.textContent = text;
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

async function pollJob(jobId) {
  const start = Date.now();
  const maxWait = 5 * 60 * 1000;

  while (Date.now() - start < maxWait) {
    const job = await api(`/jobs/${jobId}`);

    if (job.status === 'completed') {
      return job.result;
    }
    if (job.status === 'failed') {
      throw new Error(job.error || 'Job failed');
    }

    if (job.progress > 0) {
      setLoading(true, 'Generating terrain…');
    }
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

  const elevLow = $('elevLow');
  const elevHigh = $('elevHigh');
  if (elevLow) elevLow.textContent = `${data.minElevation.toFixed(0)}m`;
  if (elevHigh) elevHigh.textContent = `${data.maxElevation.toFixed(0)}m`;
}

async function exportTerrain(format) {
  const terrain = store.get('currentTerrain');
  if (!terrain) return;

  const progress = document.getElementById('exportProgress');
  const progressText = document.getElementById('exportProgressText');
  const buttons = document.querySelectorAll('.exports button');

  if (progress) progress.classList.remove('hidden');
  if (progressText) progressText.textContent = `Exporting ${format.toUpperCase()}…`;
  buttons.forEach((b) => (b.disabled = true));

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
  } finally {
    if (progress) progress.classList.add('hidden');
    const hasTerrain = !!store.get('currentTerrain');
    buttons.forEach((b) => (b.disabled = !hasTerrain));
  }
}

export function renderVersionList(versions, currentTerrain) {
  const list = $('versionList');
  if (!list) return;

  if (!versions || versions.length === 0) {
    list.innerHTML = '<div class="hint">Previous generations will appear here.</div>';
    return;
  }

  list.innerHTML = '';
  versions.forEach((v, i) => {
    const item = document.createElement('div');
    item.className = 'version-item';
    const date = new Date(v.savedAt || 0);
    const isActive = currentTerrain && v.mesh && currentTerrain.mesh &&
      v.mesh.positions?.length === currentTerrain.mesh.positions?.length;
    if (isActive) item.classList.add('active');

    const detailLabel = v.sourceDescription || v.resolutionMeters
      ? `${v.resolutionMeters}m res`
      : 'Terrain';

    item.innerHTML = `
      <div class="version-item-info">
        <div class="version-item-title">${detailLabel}</div>
        <div class="version-item-meta">${date.toLocaleString()}</div>
      </div>
      <button class="ghost sm" title="Load this version">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
    `;

    item.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      loadVersion(v);
    });

    list.appendChild(item);
  });
}

function loadVersion(version) {
  const rotation = store.get('rotation') || 0;
  store.set({ currentTerrain: version });
  setTerrain(version.mesh, rotation);
  if (version.originalBounds && version.fetchBounds) {
    drawSelectionOutline(version.originalBounds, version.fetchBounds);
  }
  updateStats(version);
  const versions = store.get('currentProject')?.terrainVersions || [];
  renderVersionList(versions, version);
  setStatus('Loaded previous version.', 'ok');
}
