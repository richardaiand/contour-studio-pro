import { $, api, escapeHtml } from '../utils.js';
import { store, setStatus } from '../store/index.js';

export function initProjects() {
  $('newProjectBtn').addEventListener('click', createProject);

  store.subscribe((state) => {
    renderProjectList(state.projects, state.currentProject);
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
