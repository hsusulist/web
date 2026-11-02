/* Shared signed-in state: localStorage token + cached profile + header avatar. */

import { escapeHtml } from './highlight.js';

const KEY = 'luc.auth';
const listeners = new Set();

export function getAuth() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    return value && value.token ? value : null;
  } catch {
    return null;
  }
}

function emit() {
  const auth = getAuth();
  listeners.forEach((fn) => { try { fn(auth); } catch { /* ignore */ } });
}

export function setAuth(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
  emit();
}

export function updateUser(user) {
  const auth = getAuth();
  if (!auth) return;
  setAuth({ ...auth, user });
}

export function clearAuth() {
  localStorage.removeItem(KEY);
  emit();
}

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function authFetch(url, options = {}) {
  const auth = getAuth();
  const headers = { ...(options.headers || {}) };
  if (auth) headers.Authorization = `Bearer ${auth.token}`;
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && auth) clearAuth();
  return response;
}

export async function signOut() {
  const auth = getAuth();
  if (auth) {
    try { await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${auth.token}` } }); } catch { /* ignore */ }
  }
  clearAuth();
}

export function displayName(user) {
  return (user && (user.displayName || user.username)) || '';
}

export function avatarMarkup(user, cls = '') {
  const name = displayName(user) || '?';
  const letters = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  if (user && user.avatarUrl) {
    return `<span class="user-avatar ${cls}"><img src="${escapeHtml(user.avatarUrl)}" alt="" draggable="false" /></span>`;
  }
  return `<span class="user-avatar user-avatar-initials ${cls}" aria-hidden="true">${escapeHtml(letters)}</span>`;
}

/* ------------------------------------------------------------------ */
/* header: swap "Get Started" for the account avatar when signed in   */
/* ------------------------------------------------------------------ */

function paintHeader(auth) {
  const start = document.querySelector('.header-start');
  const account = document.getElementById('header-account');
  if (!start || !account) return;
  const signedIn = Boolean(auth && auth.user);
  start.hidden = signedIn;
  account.hidden = !signedIn;
  if (signedIn) {
    account.innerHTML = avatarMarkup(auth.user);
    const label = `Account settings for @${auth.user.username}`;
    account.setAttribute('aria-label', label);
    account.setAttribute('title', `@${auth.user.username} · Settings`);
  } else {
    account.innerHTML = '';
  }
}

export function setupSessionChrome() {
  paintHeader(getAuth());
  onAuthChange(paintHeader);
  window.addEventListener('storage', (event) => {
    if (event.key === KEY) emit();
  });

  // Validate the stored token once on boot and refresh the cached profile.
  const auth = getAuth();
  if (auth) {
    authFetch('/api/account')
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        updateUser(data.user);
      })
      .catch(() => { /* offline: keep cached profile */ });
  }
}
