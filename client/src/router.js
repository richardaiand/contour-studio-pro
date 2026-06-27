// Simple client-side router for multi-page layout
// Switches between views: login, dashboard, map, studio, walk

import { store } from './store/index.js';

const VIEWS = ['login', 'dashboard', 'map', 'studio', 'walk'];
let currentView = 'login';
let navigationHistory = [];

export function initRouter() {
  // Wire up navigation buttons
  document.getElementById('exitWalk')?.addEventListener('click', () => goBack());
  document.getElementById('backToDashboard')?.addEventListener('click', () => navigate('dashboard'));
  document.getElementById('backToDashboardFromMap')?.addEventListener('click', () => navigate('dashboard'));

  // Subscribe to store view changes
  store.subscribe((state) => {
    if (state.currentView && state.currentView !== currentView) {
      currentView = state.currentView;
      renderView();
    }
  });
}

export function navigate(view) {
  if (!VIEWS.includes(view)) return;
  if (view === currentView) return;
  navigationHistory.push(currentView);
  currentView = view;
  renderView();
  store.set({ currentView: view });
}

export function goBack() {
  if (navigationHistory.length === 0) {
    currentView = 'dashboard';
  } else {
    currentView = navigationHistory.pop();
  }
  renderView();
  store.set({ currentView });
}

function renderView() {
  // Hide all views
  VIEWS.forEach((v) => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });

  // Show current view
  const el = document.getElementById(`view-${currentView}`);
  if (el) el.classList.remove('hidden');

  // Trigger resize for map/canvas after view becomes visible
  window.dispatchEvent(new Event('resize'));

  if (currentView === 'map') {
    import('./modules/map.js').then(({ resizeMap }) => resizeMap()).catch(() => {});
  }

  // Studio view needs extra time for canvas to get dimensions
  if (currentView === 'studio') {
    import('./modules/viewport.js').then(({ triggerResize }) => triggerResize());
  }
}

export function getCurrentView() {
  return currentView;
}

export function canGoBack() {
  return navigationHistory.length > 0;
}

export function setInitialView(isAuthenticated) {
  currentView = isAuthenticated ? 'dashboard' : 'login';
  navigationHistory = [];
  renderView();
  store.set({ currentView });
}
