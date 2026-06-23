import { $, api, escapeHtml } from '../utils.js';
import { store, setStatus } from '../store/index.js';
import { setBounds } from './map.js';

export function initProjects() {
  $('newProjectBtn').addEventListener('click', createProject);

  store.subscribe((state) => {
    renderProjectList(state.projects, state.currentProject);
    renderExportList(state.exports);
  });
}

export async function loadProjects() {
  if (!store.get('user')) return;
  try {
    const projects = await api('/projects');
    store.set({ projects });
  } catch (e) {
    setStatus('Failed to load projects: ' + e.message, 'error');
  }

  try {
    const exports = await api('/projects/exports');
    store.set({ exports });
  } catch (e) {
    // Non-fatal
    console.error('Failed to load exports', e);
  }
}

async function createProject() {
  if (!store.get('user')) {
    setStatus('Sign in to save projects.', 'error');
    return;
  }
  const title = prompt('Project title:', 'New Terrain Project');
  if (!title) return;

  try {
    const project = await api('/projects', {
      method: 'POST',
      body: JSON.stringify({ title, detailLevel: store.get('detail') }),
    });
    store.set({ currentProject: project, projects: [project, ...store.get('projects')] });
    setStatus('Project created.', 'ok');
  } catch (e) {
    setStatus('Failed to create project: ' + e.message, 'error');
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
    setStatus(`Loaded ${data.project.title}`, 'ok');
  } catch (e) {
    setStatus('Failed to load project: ' + e.message, 'error');
  }
}

function renderProjectList(projects, currentProject) {
  const list = $('projectList');
  if (!store.get('user')) {
    list.innerHTML = '<div class="hint">Sign in to save and manage projects.</div>';
    return;
  }

  if (projects.length === 0) {
    list.innerHTML = '<div class="hint">No projects yet.</div>';
    return;
  }

  list.innerHTML = '';
  projects.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'project-item' + (currentProject?.id === p.id ? ' active' : '');
    item.innerHTML = `<span>${escapeHtml(p.title)}</span>`;
    item.addEventListener('click', () => selectProject(p));
    list.appendChild(item);
  });
}

function renderExportList(exports = []) {
  const list = $('exportList');
  if (!store.get('user')) {
    list.innerHTML = '<div class="hint">Sign in to see export history.</div>';
    return;
  }

  if (exports.length === 0) {
    list.innerHTML = '<div class="hint">No exports yet.</div>';
    return;
  }

  list.innerHTML = '';
  exports.slice(0, 20).forEach((x) => {
    const item = document.createElement('div');
    item.className = 'project-item';
    const size = formatBytes(x.sizeBytes);
    item.innerHTML = `<span>${escapeHtml(x.filename)} · ${x.format.toUpperCase()} · ${size}</span>`;
    list.appendChild(item);
  });
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}
