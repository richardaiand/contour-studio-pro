// Simple client-side router for multi-page layout
// TODO: Switch between views: login, map, studio, walk
// TODO: Back button navigation
// TODO: Session-based initial route

import { store } from './store/index.js';

const VIEWS = ['login', 'map', 'studio', 'walk'];
let currentView = 'login';
let navigationHistory = [];

export function initRouter() {
  // TODO: Show/hide view sections based on currentView
  // TODO: Set initial view based on session
}

export function navigate(view) {
  if (!VIEWS.includes(view)) return;
  if (currentView) navigationHistory.push(currentView);
  currentView = view;
  renderView();
}

export function goBack() {
  if (navigationHistory.length === 0) return;
  currentView = navigationHistory.pop();
  renderView();
}

function renderView() {
  // TODO: Hide all view sections
  // TODO: Show current view section
  // TODO: Update back button visibility
  // TODO: Update store with current view
  store.set({ currentView });
}

export function getCurrentView() {
  return currentView;
}

export function canGoBack() {
  return navigationHistory.length > 0;
}

// Session-based routing
export function setInitialView(isAuthenticated) {
  currentView = isAuthenticated ? 'map' : 'login';
  navigationHistory = [];
  renderView();
}
