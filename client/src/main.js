import { $ } from './utils.js';
import { store, setStatus } from './store/index.js';
import { initTheme } from './modules/theme.js';
import { initAuth } from './modules/auth.js';
import { initSettings } from './modules/settings.js';
import { initProjects, loadProjects } from './modules/projects.js';
import { initMap, setBounds } from './modules/map.js';
import { initViewport } from './modules/viewport.js';
import { initTerrain } from './modules/terrain.js';

async function init() {
  initTheme();
  initAuth();
  initSettings();
  initProjects();
  initMap();
  initViewport();
  initTerrain();

  store.subscribe((state) => {
    if (state.bounds) setBounds(state.bounds);
  });

  store.subscribe((state) => {
    if (state.user) loadProjects();
  });

  setStatus('Ready. Search for a location to begin.', '');
}

init().catch((e) => {
  console.error('Init error', e);
  setStatus('Startup error: ' + e.message, 'error');
});
