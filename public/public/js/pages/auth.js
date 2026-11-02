import { icon } from '../lib/icons.js';
import { escapeHtml } from '../lib/highlight.js';
import { getAuth, setAuth, clearAuth } from '../lib/session.js';

const storedAuth = getAuth;

const EYE = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>';
const EYE_OFF = '<path d="M9.9 4.2A10.6 10.6 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-2.2 3.2"/><path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2"/><path d="m2 2 20 20"/>';
const svg = (body) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const LOCK = '<rect width="16" height="11" x="4" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';

export function renderAuth(mode, params = {}) {
  const registering = mode === 'register';
  const cliCode = params.cli || '';
  const next = params.next || '';
  const switchQuery = cliCode ? `?cli=${encodeURIComponent(cliCode)}` : next ? `?next=${encodeURIComponent(next)}` : '';

  const title = registering ? 'Create your account' : 'Welcome back';
  const lede = cliCode
    ? 'Sign in to authorize this terminal to use your LUC account.'
    : registering
      ? 'Join the LUC community and start publishing packages.'
      : 'Sign in to publish and manage your packages.';

  const kicker = cliCode ? 'TERMINAL LOGIN' : registering ? 'JOIN LUC' : 'WELCOME BACK';
  const heading = cliCode
    ? 'Connect your<br>terminal.'
    : registering ? 'Make yourself<br>at home.' : 'Good to see<br>you again.';
  const artLine = registering
    ? { a: 'Everything you make', b: 'runs on' }
    : { a: 'Pick up where', b: 'you left off on' };

  return {
    title: `${registering ? 'Register' : 'Login'} — LUC`,
    description: 'Sign in to LUC to publish and manage packages.',
    html: `
      <section class="auth-page au2" id="auth-page" data-mode="${registering ? 'register' : 'login'}">
        <div class="au2-form-col">
          <div class="au2-form-top">
            <span class="au2-index">${registering ? '01 / NEW ACCOUNT' : '01 / SIGN IN'}</span>
            <span class="au2-index au2-index-right">LUC ACCOUNT</span>
          </div>

          <div class="auth-card au2-card">
            <header class="auth-head">
              <p class="auth-eyebrow"><span class="au2-kline"></span>${kicker}</p>
              <h1>${heading}</h1>
              <p class="auth-lede">${lede}</p>
            </header>

            <div class="auth-tabs au2-tabs" role="tablist">
              <a role="tab" class="auth-tab ${registering ? '' : 'is-active'}" aria-selected="${!registering}" href="#/login${switchQuery}">Log in</a>
              <a role="tab" class="auth-tab ${registering ? 'is-active' : ''}" aria-selected="${registering}" href="#/register${switchQuery}">Create account</a>
            </div>

            <div class="auth-current" id="auth-current" hidden></div>
            <button class="auth-btn auth-btn-primary" id="auth-approve" type="button" hidden><span class="auth-btn-label">Authorize this terminal</span> ${icon('arrow-right', { size: 16 })}</button>
            <button class="auth-different" id="auth-different" type="button" hidden>Use a different account</button>

            <div id="auth-body">
              <form id="auth-form" novalidate>
                <div class="auth-field">
                  <div class="au2-label-row"><label for="auth-username">Username</label>${registering ? '<span>3–32 characters</span>' : ''}</div>
                  <div class="auth-input">
                    ${icon('user', { size: 17 })}
                    <input id="auth-username" name="username" required minlength="3" maxlength="32" autocomplete="username" placeholder="${registering ? 'Choose a username' : 'yourname'}" spellcheck="false" autocapitalize="off" />
                  </div>
                  ${registering ? '<p class="auth-hint">This is how people will find you in the registry.</p>' : ''}
                </div>
                <div class="auth-field">
                  <div class="au2-label-row"><label for="auth-password">Password</label>${registering ? '<span>8–128 characters</span>' : ''}</div>
                  <div class="auth-input">
                    ${svg(LOCK)}
                    <input id="auth-password" name="password" type="password" required minlength="8" maxlength="128" autocomplete="${registering ? 'new-password' : 'current-password'}" placeholder="${registering ? 'At least 8 characters' : 'Your password'}" />
                    <button class="auth-eye" id="auth-eye" type="button" aria-label="Show password">${svg(EYE)}</button>
                  </div>
                  ${registering ? '<div class="auth-strength" id="auth-strength"><i></i><i></i><i></i><i></i></div><p class="auth-hint au2-strength-label" id="auth-strength-label">Add a password to check its strength.</p>' : ''}
                </div>
                <p class="auth-error" id="auth-error" role="alert" hidden></p>
                <button class="auth-btn auth-btn-primary" id="auth-submit" type="submit">
                  <span class="auth-btn-label">${registering ? 'Create account' : 'Log in'}</span>
                  ${icon('arrow-right', { size: 16 })}
                </button>
              </form>

              <div class="auth-divider" id="auth-divider"><span>or</span></div>

              <button class="auth-btn auth-btn-google" id="auth-google" type="button">
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                <span>${registering ? 'Sign up with Google' : 'Continue with Google'}</span>
              </button>
              <p class="au2-google-note" id="auth-google-note" hidden>Google sign-in isn't switched on for this server yet. Use a username and password for now.</p>
            </div>

            <p class="auth-switch">${registering ? 'Already have an account?' : 'New to LUC?'} <a href="#/${registering ? 'login' : 'register'}${switchQuery}">${registering ? 'Log in' : 'Create an account'}</a></p>
            ${cliCode ? '<p class="auth-foot">This login is scoped to the terminal session that opened this page.</p>' : ''}
          </div>

          <div class="au2-form-foot">
            <span>Apache 2.0 · open source</span>
            <a href="https://github.com/hsusulist/luc/issues" target="_blank" rel="noopener noreferrer">Get help ${icon('arrow-up-right', { size: 12 })}</a>
          </div>
        </div>

        <aside class="au2-art" aria-hidden="true">
          <i class="au2-corner au2-corner-tl"></i><i class="au2-corner au2-corner-tr"></i>
          <i class="au2-corner au2-corner-bl"></i><i class="au2-corner au2-corner-br"></i>
          <div class="au2-art-top">
            <span>LUC / ${registering ? 'JOIN' : 'LOGIN'}</span>
            <span class="au2-signal"><i></i><i></i><i></i><i></i><i></i><b>REGISTRY ONLINE</b></span>
          </div>
          <div class="au2-art-code"><span>import</span> libraries<br><span>get</span> what you need<br><span>make</span> something yours</div>

          <div class="au2-sq au2-sq-lime">${icon('package', { size: 24 })}<b>PACKAGE</b><span>.luic</span></div>
          <div class="au2-sq au2-sq-orange">${icon('command', { size: 23 })}<b>MODULE</b><span>luc</span></div>
          <div class="au2-sq au2-sq-cream">${icon('terminal', { size: 20 })}<b>SCRIPT</b><span>hello.luc</span></div>
          <div class="au2-sq au2-sq-dot"></div>

          <div class="au2-tagline">
            <span>${artLine.a}</span>
            <span class="au2-tag-row">${artLine.b} <em class="au2-pill"><img src="/assets/logo.svg" width="30" height="30" alt="" />luc<b>.</b></em></span>
          </div>

          <div class="au2-art-bottom">
            <span>LUC REGISTRY ${icon('arrow-right', { size: 14 })} YOUR PROJECT</span>
            <span>${registering ? '02 — PUBLISH' : '02 — CONTINUE'}</span>
          </div>
        </aside>
      </section>`,
    async after() {
      const form = document.getElementById('auth-form');
      const body = document.getElementById('auth-body');
      const error = document.getElementById('auth-error');
      const current = document.getElementById('auth-current');
      const approve = document.getElementById('auth-approve');
      const different = document.getElementById('auth-different');
      const google = document.getElementById('auth-google');
      const divider = document.getElementById('auth-divider');
      const submit = document.getElementById('auth-submit');
      const password = document.getElementById('auth-password');
      const eye = document.getElementById('auth-eye');
      const strength = document.getElementById('auth-strength');

      const showError = (msg) => {
        error.textContent = msg || '';
        error.hidden = !msg;
      };
      const setLoading = (on) => {
        submit.disabled = on;
        submit.classList.toggle('is-loading', on);
      };

      // Google sign-in is always offered; if the server has no OAuth keys we say so on click.
      let googleEnabled = true;
      try {
        const config = await (await fetch('/api/auth/config')).json();
        googleEnabled = Boolean(config.googleEnabled);
      } catch { /* assume enabled; the server will answer */ }
      const googleNote = document.getElementById('auth-google-note');

      eye?.addEventListener('click', () => {
        const show = password.type === 'password';
        password.type = show ? 'text' : 'password';
        eye.innerHTML = svg(show ? EYE_OFF : EYE);
        eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        password.focus();
      });

      if (strength) {
        password.addEventListener('input', () => {
          const v = password.value;
          let score = 0;
          if (v.length >= 8) score++;
          if (v.length >= 12) score++;
          if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
          if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
          strength.dataset.score = v ? String(Math.max(1, score)) : '0';
          const label = document.getElementById('auth-strength-label');
          if (label) label.textContent = v ? ['Too weak', 'Weak — add more characters', 'Okay — mix in upper & lower case', 'Good — add a symbol and a number', 'Strong password'][Math.max(1, score)] : 'Add a password to check its strength.';
        });
      }

      // Already signed in and not authorizing a terminal: go straight to settings.
      if (!cliCode && storedAuth()?.user) {
        window.location.hash = next.startsWith('/') ? `#${next}` : '#/settings';
        return;
      }

      async function authorize(data) {
        setAuth(data);
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

      // Terminal (CLI) flow: if already signed in, offer one-click authorize.
      if (cliCode) {
        const auth = storedAuth();
        if (auth?.token) {
          try {
            const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${auth.token}` } });
            const data = await response.json();
            if (response.ok) {
              current.hidden = false;
              current.innerHTML = `${icon('user', { size: 16 })} Signed in as <strong>@${escapeHtml(data.user.username)}</strong>`;
              body.hidden = true;
              approve.hidden = false;
              different.hidden = false;
              approve.onclick = async () => {
                try { await authorize(auth); } catch (e) { showError(e.message); }
              };
            } else {
              clearAuth();
            }
          } catch {
            showError('Could not verify the saved account. Try again.');
          }
        }
      }

      different?.addEventListener('click', () => {
        clearAuth();
        current.hidden = true;
        body.hidden = false;
        approve.hidden = true;
        different.hidden = true;
        showError('');
      });

      google?.addEventListener('click', () => {
        if (!googleEnabled) {
          googleNote.hidden = false;
          google.classList.add('is-shake');
          setTimeout(() => google.classList.remove('is-shake'), 450);
          return;
        }
        const query = cliCode ? `?cli=${encodeURIComponent(cliCode)}` : '';
        window.location.href = `/api/auth/google/start${query}`;
      });

      form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        showError('');
        const payload = Object.fromEntries(new FormData(form));
        payload.username = String(payload.username || '').trim();
        if (payload.username.length < 3) return showError('Username must be at least 3 characters.');
        if (String(payload.password || '').length < 8) return showError('Password must be at least 8 characters.');
        setLoading(true);
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
          showError(e.message || 'Could not reach the LUC server.');
          setLoading(false);
        }
      });
    }
  };
}
