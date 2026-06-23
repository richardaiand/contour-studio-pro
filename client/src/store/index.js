// Lightweight centralized store with subscriptions
class Store {
  constructor(initial = {}) {
    this.state = { ...initial };
    this.listeners = new Set();
  }

  get(key) {
    return key ? this.state[key] : this.state;
  }

  set(updates) {
    const changed = Object.keys(updates).some((k) => this.state[k] !== updates[k]);
    if (!changed) return;
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const store = new Store({
  user: null,
  settings: null,
  theme: 'dark',
  detail: 'standard',
  currentProject: null,
  projects: [],
  currentTerrain: null,
  bounds: null,
  center: null,
  isGenerating: false,
  status: '',
  statusKind: '',
});

export function setStatus(text, kind = '') {
  store.set({ status: text, statusKind: kind });
}
