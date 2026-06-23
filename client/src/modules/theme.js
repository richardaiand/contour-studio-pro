import { store } from '../store/index.js';

export function initTheme() {
  const saved = localStorage.getItem('cs-theme') || 'dark';
  store.set({ theme: saved });
  applyTheme(saved);

  document.getElementById('themeBtn').addEventListener('click', () => {
    const next = store.get('theme') === 'dark' ? 'light' : 'dark';
    store.set({ theme: next });
    localStorage.setItem('cs-theme', next);
    applyTheme(next);
  });
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  document.getElementById('themeBtn').textContent = theme === 'dark' ? '☀️' : '🌙';
}
