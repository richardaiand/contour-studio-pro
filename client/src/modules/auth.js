import { $, api } from '../utils.js';
import { store, setStatus } from '../store/index.js';
import { navigate } from '../router.js';

export function initAuth() {
  $('authSignIn')?.addEventListener('click', handleSignIn);
  $('authSignUp')?.addEventListener('click', handleSignUp);
}

async function handleSignIn() {
  const username = $('authUser').value.trim();
  const password = $('authPass').value;
  $('authError').textContent = '';

  if (!username || !password) {
    $('authError').textContent = 'Enter username and password.';
    return;
  }

  try {
    const data = await api('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAuth(data);
    navigate('map');
    setStatus(`Welcome back, ${data.user.username}.`, 'ok');
  } catch (e) {
    $('authError').textContent = e.message;
  }
}

async function handleSignUp() {
  const username = $('authUser').value.trim();
  const password = $('authPass').value;
  $('authError').textContent = '';

  if (!username || !password) {
    $('authError').textContent = 'Enter username and password.';
    return;
  }

  try {
    const data = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAuth(data);
    navigate('map');
    setStatus(`Account created. Welcome, ${data.user.username}.`, 'ok');
  } catch (e) {
    $('authError').textContent = e.message;
  }
}

export async function restoreSession() {
  try {
    const data = await api('/auth/me');
    if (data.user) {
      setAuth(data);
      return data;
    }
  } catch (err) {
    console.warn('Session restore failed:', err.message);
  }
  return null;
}

function setAuth(data) {
  store.set({ user: data.user, settings: data.settings });
  if (data.settings?.theme) store.set({ theme: data.settings.theme });
  if (data.settings?.defaultDetail) store.set({ detail: data.settings.defaultDetail });
}

export async function requireAuth() {
  if (store.get('user')) return true;
  navigate('login');
  return false;
}
