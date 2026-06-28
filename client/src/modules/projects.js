import { $, api, escapeHtml } from '../utils.js';
import { store, setStatus } from '../store/index.js';
import { setBounds } from './map.js';
import { navigate } from '../router.js';

export function initProjects() {
  store.subscribe((state) => {
    renderDashboard(state.projects);
    renderExportList(state.exports);
  });
}

export async function loadProjects() {
  if (!store.get('user')) return;
  try {
    const projects = await api('/projects');
    store.set({ projects });
  } catch (e) {
    store.set({ projects: [] });
  }

  try {
    const exports = await api('/projects/exports');
    store.set({ exports });
  } catch (e) {
    store.set({ exports: [] });
  }
}

export async function selectProject(project) {
  try {
    const data = await api(`/projects/${project.id}`);
    store.set({ currentProject: data.project });
    if (data.project.bounds) {
      store.set({ bounds: data.project.bounds, center: data.project.center });
      setBounds(data.project.bounds);
    }

    if (data.project.terrainData) {
      store.set({ currentTerrain: data.project.terrainData });
      navigate('studio');
      requestAnimationFrame(() => {
        setTimeout(() => {
          import('./viewport.js').then(({ setTerrain, drawSelectionOutline, triggerResize }) => {
            const rotation = store.get('rotation') || 0;
            triggerResize();
            setTerrain(data.project.terrainData.mesh, rotation);
            if (data.project.terrainData.wasExpanded && data.project.terrainData.originalBounds && data.project.terrainData.fetchBounds) {
              drawSelectionOutline(data.project.terrainData.originalBounds, data.project.terrainData.fetchBounds);
            }
            const stats = document.getElementById('stats');
            if (stats) {
              const range = (data.project.terrainData.maxElevation - data.project.terrainData.minElevation).toFixed(1);
              stats.innerHTML = `<b>${data.project.terrainData.mesh.width} × ${data.project.terrainData.mesh.height}</b> vertices · <b>${range}</b> m range · <b>${data.project.terrainData.verticalExaggeration}×</b> vertical exaggeration`;
            }
            const elevLow = document.getElementById('elevLow');
            const elevHigh = document.getElementById('elevHigh');
            if (elevLow) elevLow.textContent = `${data.project.terrainData.minElevation.toFixed(0)}m`;
            if (elevHigh) elevHigh.textContent = `${data.project.terrainData.maxElevation.toFixed(0)}m`;
          });
          import('./terrain.js').then(({ renderVersionList }) => {
            renderVersionList(data.project.terrainVersions, data.project.terrainData);
          });
        }, 100);
      });
    } else {
      navigate('map');
    }
  } catch (e) {
    setStatus('Failed to load project: ' + e.message, 'error');
  }
}

export function renderDashboard(projects) {
  const grid = $('projectGrid');
  if (!grid) return;

  if (!store.get('user')) {
    grid.innerHTML = '<div class="hint">Sign in to see your projects.</div>';
    return;
  }

  if (!projects) {
    grid.innerHTML = '<div class="hint">Create your first project to get started.</div>';
    return;
  }

  if (projects.length === 0) {
    grid.innerHTML = '<div class="hint">Create your first project to get started.</div>';
    return;
  }

  grid.innerHTML = '';
  projects.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="project-card-thumb">
        ${p.thumbnail
          ? `<img src="${p.thumbnail}" alt="${escapeHtml(p.title)}" />`
          : `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`
        }
      </div>
      <div class="project-card-body">
        <div class="project-card-title">${escapeHtml(p.title)}</div>
        <div class="project-card-meta">
          <span>${formatDate(p.updatedAt)}</span>
          <div class="project-card-actions">
            <button class="ghost sm project-card-rename" data-id="${p.id}" title="Rename">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="ghost sm project-card-delete" data-id="${p.id}" title="Delete">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.project-card-delete')) {
        e.stopPropagation();
        deleteProject(p);
      } else if (e.target.closest('.project-card-rename')) {
        e.stopPropagation();
        renameProject(p);
      } else {
        selectProject(p);
      }
    });
    grid.appendChild(card);
  });
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

async function deleteProject(project) {
  if (!confirm(`Delete "${project.title}"?`)) return;
  try {
    await api(`/projects/${project.id}`, { method: 'DELETE' });
    const projects = store.get('projects').filter(p => p.id !== project.id);
    store.set({ projects });
    setStatus('Project deleted.', 'ok');
  } catch (e) {
    setStatus('Failed to delete project: ' + e.message, 'error');
  }
}

async function renameProject(project) {
  const newName = prompt('Enter new project name:', project.title);
  if (!newName || !newName.trim() || newName.trim() === project.title) return;
  try {
    const updated = await api(`/projects/${project.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: newName.trim() }),
    });
    const projects = store.get('projects').map(p => p.id === updated.id ? updated : p);
    store.set({ projects });
    setStatus('Project renamed.', 'ok');
  } catch (e) {
    setStatus('Failed to rename project: ' + e.message, 'error');
  }
}

function renderExportList(exports) {
  const list = $('exportList');
  if (!list) return;

  if (!exports || exports.length === 0) {
    list.innerHTML = '<div class="hint">No exports yet.</div>';
    return;
  }

  list.innerHTML = '';
  exports.forEach((e) => {
    const item = document.createElement('div');
    item.className = 'project-item';
    item.innerHTML = `
      <span>${escapeHtml(e.filename)}.${e.format}</span>
      <small>${formatDate(e.createdAt)}</small>
    `;
    list.appendChild(item);
  });
}
