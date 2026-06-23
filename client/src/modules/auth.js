import { $, api } from '../utils.js';
import { store, setStatus } from '../store/index.js';

let resolveAuth = null;

export function initAuth() {
  $('authBtn').addEventListener('click', openAuthDialog);
  $('authCancel').addEventListener('click', closeAuthDialog);
  $('authSignIn').addEventListener('click', handleSignIn);
  $('authSignUp').addEventListener('click', handleSignUp);

  // Try restore session
  restoreSession();
}

function openAuthDialog() {
  $('authUser').value = '';
  $('authPass').value = '';
  $('authError').textContent = '';
  $('authDlg').showModal();
}

function closeAuthDialog() {
  $('authDlg').close();
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
    closeAuthDialog();
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
    closeAuthDialog();
    setStatus(`Account created. Welcome, ${data.user.username}.`, 'ok');
  } catch (e) {
    $('authError').textContent = e.message;
  }
}

async function restoreSession() {
  try {
    const data = await api('/auth/me');
    if (data.user) setAuth(data);
  } catch {
    // Not signed in
  }
}

function setAuth(data) {
  store.set({ user: data.user, settings: data.settings });
  $('authBtn').textContent = 'Sign out';
  $('authBtn').onclick = signOut;
  if (data.settings?.theme) store.set({ theme: data.settings.theme });
  if (data.settings?.defaultDetail) store.set({ detail: data.settings.defaultDetail });
}

async function signOut() {
  try {
    await api('/auth/signout', { method: 'POST' });
  } catch {}
  store.set({ user: null, settings: null });
  $('authBtn').textContent = 'Sign in';
  $('authBtn').onclick = openAuthDialog;
  setStatus('Signed out.', '');
}

export async function requireAuth() {
  if (store.get('user')) return true;
  openAuthDialog();
  return new Promise((resolve) => {
    resolveAuth = resolve;
  });
}
