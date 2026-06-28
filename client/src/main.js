import { $, api } from './utils.js';
import { store, setStatus } from './store/index.js';
import { initTheme, applyTheme } from './modules/theme.js';
import { initAuth, restoreSession } from './modules/auth.js';
import { initSettings } from './modules/settings.js';
import { initProjects, loadProjects, renderDashboard } from './modules/projects.js';
import { initMap } from './modules/map.js';
import { initViewport, getScene, getCamera, getRenderer, getControls, getTerrainMesh } from './modules/viewport.js';
import { initTerrain } from './modules/terrain.js';
import { initRouter, setInitialView, navigate, getCurrentView } from './router.js';
import { startWalkthrough, shouldShowWalkthrough } from './modules/walkthrough.js';
import { initEnvironment, loadEnvironmentalReport } from './modules/environment.js';
import { loadUtilities, renderUtilityPipes, clearUtilityPipes } from './modules/utilities.js';
import { initPlacement, setPlacementMode, clearPlacedObjects, getPlacementMode, disposePlacement } from './modules/placement.js';
import { initWalkMode, enterWalkMode, exitWalkMode, isWalkMode } from './modules/walk-mode.js';

async function init() {
  initTheme();
  initRouter();
  initAuth();
  initSettings();
  initProjects();
  initMap();
  initViewport();
  initTerrain();

  let projectsLoaded = false;
  store.subscribe((state) => {
    if (state.user && !projectsLoaded) {
      projectsLoaded = true;
      loadProjects();
    }
    if (!state.user) {
      projectsLoaded = false;
    }
  });

  store.subscribe((state) => {
    const titleEl = $('projectTitle');
    if (titleEl) titleEl.textContent = state.currentProject?.title || 'No project';
    const titleStudioEl = $('projectTitleStudio');
    if (titleStudioEl) titleStudioEl.textContent = state.currentProject?.title || 'No project';
  });

  // Sidebar toggles
  $('sidebarToggle')?.addEventListener('click', () => $('sidebar')?.classList.toggle('collapsed'));
  $('studioSidebarToggle')?.addEventListener('click', () => $('studioSidebar')?.classList.toggle('collapsed'));

  // Theme buttons on all views
  ['themeBtn', 'themeBtnStudio', 'themeBtnLogin', 'themeBtnDashboard'].forEach((id) => {
    const btn = $(id);
    if (btn) {
      btn.addEventListener('click', () => {
        const next = store.get('theme') === 'dark' ? 'light' : 'dark';
        store.set({ theme: next });
        localStorage.setItem('cs-theme', next);
        applyTheme(next);
      });
    }
  });

  // Settings buttons are wired in initSettings() — no duplicate registration here

  // Sign out button (inside settings dialog)
  $('signOutBtn')?.addEventListener('click', () => {
    $('settingsDlg')?.close();
    store.set({ user: null, settings: null, currentProject: null });
    localStorage.removeItem('cs-signed-in');
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setStatus('Signed out.', '');
    navigate('login');
  });

  // Legacy sign out buttons (if any remain)
  ['authBtn', 'authBtnStudio', 'authBtnDashboard'].forEach((id) => {
    $(id)?.addEventListener('click', () => {
      store.set({ user: null, settings: null, currentProject: null });
      localStorage.removeItem('cs-signed-in');
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      setStatus('Signed out.', '');
      navigate('login');
    });
  });

  // Tutorial/help buttons
  ['helpBtnDashboard', 'helpBtnMap', 'helpBtnStudio'].forEach((id) => {
    $(id)?.addEventListener('click', () => $('tutorialDlg')?.showModal());
  });
  $('closeTutorial')?.addEventListener('click', () => $('tutorialDlg')?.close());
  $('startInteractiveTour')?.addEventListener('click', () => {
    $('tutorialDlg')?.close();
    startWalkthrough();
  });

  // Edit Site button → back to map
  $('editSiteBtn')?.addEventListener('click', () => navigate('map'));

  // ===== Environmental Report =====
  $('envReportBtn')?.addEventListener('click', async () => {
    const center = store.get('center');
    if (!center) {
      setStatus('Generate terrain first to get environmental data.', 'error');
      return;
    }
    const btn = $('envReportBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating report…'; }
    try {
      await loadEnvironmentalReport(center.lat, center.lon);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Generate Site Report'; }
    }
  });

  // ===== Utility Overlays =====
  let activeUtilityTypes = new Set();
  async function toggleUtility(type) {
    const bounds = store.get('bounds');
    const terrain = store.get('currentTerrain');
    const mesh = getTerrainMesh();
    if (!bounds || !mesh || !terrain) {
      setStatus('Generate terrain first to show utilities.', 'error');
      return;
    }

    const fetchBounds = terrain.fetchBounds || terrain.originalBounds || bounds;

    if (activeUtilityTypes.has(type)) {
      activeUtilityTypes.delete(type);
      const btn = type === 'sewer' ? $('toggleSewerBtn') : $('toggleWaterBtn');
      if (btn) btn.classList.remove('active');
      const scene = getScene();
      clearUtilityPipes(scene);
      for (const remaining of activeUtilityTypes) {
        await loadAndRenderUtilities(remaining, fetchBounds, mesh);
      }
    } else {
      activeUtilityTypes.add(type);
      const btn = type === 'sewer' ? $('toggleSewerBtn') : $('toggleWaterBtn');
      if (btn) btn.classList.add('active');
      await loadAndRenderUtilities(type, fetchBounds, mesh);
    }
  }

  async function loadAndRenderUtilities(type, bounds, mesh) {
    const scene = getScene();
    try {
      const data = await loadUtilities(bounds, type);
      if (data.features && data.features.length > 0) {
        renderUtilityPipes(scene, data.features, mesh, bounds);
        setStatus(`Loaded ${data.features.length} ${type} features.`, 'ok');
      } else {
        setStatus(`No ${type} data found for this area.`, '');
      }
    } catch (e) {
      setStatus(`Failed to load ${type} data: ${e.message}`, 'error');
    }
  }

  $('toggleSewerBtn')?.addEventListener('click', () => toggleUtility('sewer'));
  $('toggleWaterBtn')?.addEventListener('click', () => toggleUtility('water'));

  // ===== Object Placement =====
  // Initialize placement when terrain is loaded
  let placementInitialized = false;
  store.subscribe((state) => {
    if (state.currentTerrain && !placementInitialized) {
      const scene = getScene();
      const camera = getCamera();
      const renderer = getRenderer();
      const mesh = getTerrainMesh();
      if (scene && camera && renderer && mesh) {
        initPlacement(scene, camera, renderer, mesh);
        placementInitialized = true;
      }
    }
    if (!state.currentTerrain && placementInitialized) {
      disposePlacement();
      placementInitialized = false;
    }
  });

  function setupPlacementButton(btnId, objectType) {
    $(btnId)?.addEventListener('click', () => {
      const mesh = getTerrainMesh();
      if (!mesh) {
        setStatus('Generate terrain first to place objects.', 'error');
        return;
      }
      const current = getPlacementMode();
      if (current === objectType) {
        setPlacementMode(null);
        $(btnId)?.classList.remove('active');
        $('placementHint').style.display = 'none';
      } else {
        document.querySelectorAll('.object-palette button').forEach((b) => b.classList.remove('active'));
        $(btnId)?.classList.add('active');
        setPlacementMode(objectType);
        $('placementHint').style.display = 'block';
      }
    });
  }
  setupPlacementButton('placeTreeBtn', 'tree');
  setupPlacementButton('placeRockBtn', 'rock');
  setupPlacementButton('placeBuildingBtn', 'building');
  setupPlacementButton('placePersonBtn', 'person');

  $('clearObjectsBtn')?.addEventListener('click', () => {
    clearPlacedObjects();
    document.querySelectorAll('.object-palette button').forEach((b) => b.classList.remove('active'));
    setPlacementMode(null);
    $('placementHint').style.display = 'none';
    setStatus('All placed objects cleared.', 'ok');
  });

  // ===== Walk Mode =====
  $('enterWalkBtn')?.addEventListener('click', () => {
    const mesh = getTerrainMesh();
    if (!mesh) {
      setStatus('Generate terrain first to enter walk mode.', 'error');
      return;
    }
    const scene = getScene();
    const camera = getCamera();
    const renderer = getRenderer();
    const controls = getControls();

    if (!scene || !camera || !renderer) {
      setStatus('3D viewport not ready. Try again.', 'error');
      return;
    }

    initWalkMode(scene, camera, renderer, mesh, controls);

    const canvas = renderer.domElement;
    canvas.style.cursor = 'none';

    enterWalkMode();
  });

  $('exitWalkMode')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const renderer = getRenderer();
    if (renderer?.domElement) renderer.domElement.style.cursor = '';
    exitWalkMode();
  });

  // Manual save buttons
  async function manualSave() {
    const project = store.get('currentProject');
    if (!project?.id) {
      setStatus('Nothing to save yet.', 'error');
      return;
    }
    const bounds = store.get('bounds');
    const center = store.get('center');
    const body = { bounds, center };

    const view = getCurrentView();
    if (view === 'map') {
      const { captureMapThumbnail } = await import('./modules/map.js');
      const thumb = await captureMapThumbnail();
      if (thumb) body.thumbnail = thumb;
    } else if (view === 'studio') {
      const { captureStudioThumbnail } = await import('./modules/viewport.js');
      const thumb = captureStudioThumbnail();
      if (thumb) body.thumbnail = thumb;
    }

    try {
      await api(`/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setStatus('Project saved.', 'ok');
    } catch (e) {
      setStatus('Save failed: ' + e.message, 'error');
    }
  }
  $('saveBtnMap')?.addEventListener('click', manualSave);
  $('saveBtnStudio')?.addEventListener('click', manualSave);

  // Autosave on bounds/center change (debounced)
  let autosaveTimer = null;
  store.subscribe((state) => {
    if (!state.currentProject?.id) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      if (state.bounds) {
        try {
          await api(`/projects/${state.currentProject.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ bounds: state.bounds, center: state.center }),
          });
        } catch {}
      }
    }, 3000);
  });

  // Studio map preview toggle — static tile image
  let studioMapInitialized = false;
  store.subscribe((state) => {
    if (state.currentProject?.id !== undefined) {
      studioMapInitialized = false;
      const thumb = $('studioMapThumb');
      if (thumb) thumb.innerHTML = '';
      const preview = $('studioMapPreview');
      const btn = $('toggleMapPreview');
      if (preview && !preview.classList.contains('collapsed')) {
        preview.classList.add('collapsed');
        if (btn) btn.textContent = 'Show Map';
      }
    }
  });
  $('toggleMapPreview')?.addEventListener('click', () => {
    const preview = $('studioMapPreview');
    const btn = $('toggleMapPreview');
    if (!preview) return;

    if (preview.classList.contains('collapsed')) {
      preview.classList.remove('collapsed');
      btn.textContent = 'Hide Map';
      const thumb = $('studioMapThumb');
      if (thumb) {
        const bounds = store.get('bounds');
        if (bounds) {
          const latMid = (bounds.minLat + bounds.maxLat) / 2;
          const lonMid = (bounds.minLon + bounds.maxLon) / 2;
          const latSpan = bounds.maxLat - bounds.minLat;
          const lonSpan = bounds.maxLon - bounds.minLon;
          const span = Math.max(latSpan, lonSpan) * 1.4;
          const zoom = Math.max(1, Math.min(19, Math.floor(Math.log2(360 / span))));
          const tileX = Math.floor(((lonMid + 180) / 360) * Math.pow(2, zoom));
          const tileY = Math.floor((1 - Math.log(Math.tan(latMid * Math.PI / 180) + 1 / Math.cos(latMid * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
          const url = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
          thumb.innerHTML = `<img src="${url}" alt="Site map" style="width:100%;height:100%;object-fit:cover;" />`;
        }
      }
    } else {
      preview.classList.add('collapsed');
      btn.textContent = 'Show Map';
    }
  });

  // Dashboard new project button
  $('newProjectBtnDashboard')?.addEventListener('click', () => {
    $('projectNameDlg')?.showModal();
    $('projectNameInput')?.focus();
  });

  // Project naming modal
  $('projectNameCancel')?.addEventListener('click', () => $('projectNameDlg')?.close());
  $('projectNameConfirm')?.addEventListener('click', () => {
    const name = $('projectNameInput').value.trim();
    if (!name) {
      $('projectNameError').textContent = 'Please enter a name.';
      return;
    }
    $('projectNameError').textContent = '';
    $('projectNameDlg')?.close();
    store.set({ currentProject: { title: name, isNew: true } });
    $('projectNameInput').value = '';
    navigate('map');
  });

  $('projectNameInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('projectNameConfirm')?.click();
  });

  // Restore session — use localStorage since cookie is httpOnly
  const wasSignedIn = localStorage.getItem('cs-signed-in') === '1';
  if (wasSignedIn) {
    // Show dashboard immediately while session restores
    setInitialView(true);
  }
  const session = await restoreSession();
  if (session) {
    localStorage.setItem('cs-signed-in', '1');
    setInitialView(true);
    setStatus('Ready. Search for a location to begin.', '');
    if (shouldShowWalkthrough()) {
      setTimeout(() => startWalkthrough(), 1000);
    }
  } else {
    localStorage.removeItem('cs-signed-in');
    setInitialView(false);
  }
}

init().catch((e) => {
  console.error('Init error', e);
  setStatus('Startup error: ' + e.message, 'error');
});
