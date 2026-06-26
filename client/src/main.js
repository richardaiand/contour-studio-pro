import { $ } from './utils.js';
import { store, setStatus } from './store/index.js';
import { initTheme, applyTheme } from './modules/theme.js';
import { initAuth, restoreSession } from './modules/auth.js';
import { initSettings } from './modules/settings.js';
import { initProjects, loadProjects, renderDashboard } from './modules/projects.js';
import { initMap } from './modules/map.js';
import { initViewport } from './modules/viewport.js';
import { initTerrain } from './modules/terrain.js';
import { initRouter, setInitialView, navigate } from './router.js';

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

  // Settings buttons
  ['settingsBtn', 'settingsBtnDashboard'].forEach((id) => {
    $(id)?.addEventListener('click', () => $('settingsDlg')?.showModal());
  });

  // Sign out buttons on all views
  ['authBtn', 'authBtnStudio', 'authBtnDashboard'].forEach((id) => {
    const btn = $(id);
    if (btn) {
      btn.addEventListener('click', () => {
        store.set({ user: null, settings: null, currentProject: null });
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        setStatus('Signed out.', '');
        navigate('login');
      });
    }
  });

  // Edit Site button → back to map
  $('editSiteBtn')?.addEventListener('click', () => navigate('map'));

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

  // Restore session
  const hasCookie = document.cookie.includes('token=');
  if (hasCookie) {
    // Show dashboard immediately while session restores
    setInitialView(true);
  }
  const session = await restoreSession();
  if (session) {
    setInitialView(true);
    setStatus('Ready. Search for a location to begin.', '');
  } else {
    setInitialView(false);
  }
}

init().catch((e) => {
  console.error('Init error', e);
  setStatus('Startup error: ' + e.message, 'error');
});
