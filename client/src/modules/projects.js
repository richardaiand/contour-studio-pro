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
    navigate('map');
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

  if (!projects || projects.length === 0) {
    grid.innerHTML = '<div class="hint">No projects yet. Click "New Project" to get started.</div>';
    return;
  }

  grid.innerHTML = '';
  projects.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="project-card-thumb">⛰️</div>
      <div class="project-card-body">
        <div class="project-card-title">${escapeHtml(p.title)}</div>
        <div class="project-card-meta">
          <span>${formatDate(p.updatedAt)}</span>
          <button class="ghost sm project-card-delete" data-id="${p.id}" title="Delete">🗑</button>
        </div>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.project-card-delete')) {
        e.stopPropagation();
        deleteProject(p);
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
