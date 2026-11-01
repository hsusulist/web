import { icon } from '../lib/icons.js';
import { escapeHtml } from '../lib/highlight.js';

function storedAuth() {
  try {
    return JSON.parse(localStorage.getItem('luc.auth') || 'null');
  } catch {
    return null;
  }
}

export function renderAuth(mode, params = {}) {
  const registering = mode === 'register';
  const cliCode = params.cli || '';
  const next = params.next || '';
  const title = registering ? 'Make your account.' : 'Welcome back.';

  return {
    title: `${registering ? 'Register' : 'Login'} — LUC`,
    description: 'Sign in to LUC to publish and manage packages.',
    html: `
      <section class="auth-page">
        <div class="auth-card">
          <a class="auth-brand" href="#/"><span>L</span><b>luc.</b></a>
          <p class="eyebrow"><span class="eyebrow-dot"></span> LUC ACCOUNT</p>
          <h1>${title}</h1>
          <p class="auth-lede">${cliCode ? 'Authorize this terminal to use your LUC account.' : registering ? 'Join the LUC package community.' : 'Sign in to publish and manage your packages.'}</p>
          <div class="auth-current" id="auth-current" hidden></div>
          <button class="btn btn-primary auth-submit" id="auth-approve" type="button" hidden>Log in to LUC ${icon('arrow-right', { size: 15 })}</button>
          <form id="auth-form">
            <label class="auth-field">Username
              <input name="username" required minlength="3" maxlength="32" autocomplete="username" placeholder="yourname" />
            </label>
            <label class="auth-field">Password
              <input name="password" type="password" required minlength="8" maxlength="128" autocomplete="${registering ? 'new-password' : 'current-password'}" placeholder="At least 8 characters" />
            </label>
            <p class="auth-error" id="auth-error" role="alert"></p>
            <button class="btn btn-primary auth-submit" type="submit">${registering ? 'Create account' : 'Log in'} ${icon('arrow-right', { size: 15 })}</button>
          </form>
          <button class="auth-google" id="auth-google" type="button" hidden><span class="google-g">G</span> Continue with Google</button>
          <p class="auth-google-note" id="auth-google-note" hidden>Google sign-in needs OAuth credentials configured on this local server.</p>
          <button class="auth-different" id="auth-different" type="button" hidden>Use a different account</button>
          <p class="auth-switch">${registering ? 'Already have an account?' : 'New to LUC?'} <a href="#/${registering ? 'login' : 'register'}${cliCode ? `?cli=${encodeURIComponent(cliCode)}` : next ? `?next=${encodeURIComponent(next)}` : ''}">${registering ? 'Log in' : 'Create an account'}</a></p>
          <p class="auth-foot">Your terminal login stays scoped to this terminal session.</p>
        </div>
      </section>`,
    async after() {
      const form = document.getElementById('auth-form');
      const error = document.getElementById('auth-error');
      const current = document.getElementById('auth-current');
      const approve = document.getElementById('auth-approve');
      const different = document.getElementById('auth-different');
      const google = document.getElementById('auth-google');
      const googleNote = document.getElementById('auth-google-note');
      const submit = form?.querySelector('button[type="submit"]');

      try {
        const configResponse = await fetch('/api/auth/config');
        const config = await configResponse.json();
        google.hidden = !config.googleEnabled;
        googleNote.hidden = Boolean(config.googleEnabled);
      } catch {
        googleNote.hidden = false;
      }

      async function authorize(data) {
        localStorage.setItem('luc.auth', JSON.stringify(data));
        if (cliCode) {
          const result = await fetch('/api/auth/cli/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
            body: JSON.stringify({ code: cliCode })
          });
          const response = await result.json();
          if (!result.ok) throw new Error(response.error || 'Could not authorize this terminal.');
          window.location.hash = '#/';
          return;
        }
        window.location.hash = next.startsWith('/') ? `#${next}` : '#/';
      }

      if (cliCode) {
        const auth = storedAuth();
        if (auth?.token) {
          try {
            const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${auth.token}` } });
            const data = await response.json();
            if (response.ok) {
              current.hidden = false;
              current.innerHTML = `Authenticating as <strong>@${escapeHtml(data.user.username)}</strong>`;
              form.hidden = true;
              approve.hidden = false;
              different.hidden = false;
              approve.onclick = async () => {
                try { await authorize(auth); } catch (e) { error.textContent = e.message; }
              };
            } else {
              localStorage.removeItem('luc.auth');
            }
          } catch {
            error.textContent = 'Could not verify the saved account. Try again.';
          }
        }
      }

      different?.addEventListener('click', () => {
        localStorage.removeItem('luc.auth');
        current.hidden = true;
        form.hidden = false;
        approve.hidden = true;
        different.hidden = true;
        error.textContent = '';
      });

      google?.addEventListener('click', () => {
        const query = cliCode ? `?cli=${encodeURIComponent(cliCode)}` : '';
        window.location.href = `/api/auth/google/start${query}`;
      });

      form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        error.textContent = '';
        submit.disabled = true;
        const payload = Object.fromEntries(new FormData(form));
        try {
          const response = await fetch(`/api/auth/${registering ? 'register' : 'login'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Could not sign in.');
          await authorize(data);
        } catch (e) {
          error.textContent = e.message || 'Could not reach the LUC server.';
          submit.disabled = false;
        }
      });
    }
  };
}
