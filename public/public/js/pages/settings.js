import { icon } from '../lib/icons.js';
import { escapeHtml } from '../lib/highlight.js';
import { toast } from '../lib/ui.js';
import { getAuth, authFetch, updateUser, signOut, clearAuth, avatarMarkup, displayName } from '../lib/session.js';

const AVATAR_OUT = 512;          // exported avatar size (px)
const MAX_SOURCE = 15 * 1024 * 1024;
const MAX_DIRECT = 2 * 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const svg = (body, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const LOCK = '<rect width="16" height="11" x="4" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';
const LOGOUT = '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>';
const TRASH = '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
const PIN = '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>';
const ZOOM_OUT = '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>';
const ZOOM_IN = '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/><path d="M11 8v6"/>';

function field({ id, label, value = '', placeholder = '', hint = '', type = 'text', max = 100, prefix = '', iconSvg = '', disabled = false, textarea = false }) {
  const control = textarea
    ? `<textarea id="${id}" name="${id}" maxlength="${max}" rows="3" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
    : `<input id="${id}" name="${id}" type="${type}" maxlength="${max}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${disabled ? 'disabled' : ''} spellcheck="false" autocomplete="off" />`;
  return `
    <div class="st-field" data-field="${id}">
      <label for="${id}">${label}</label>
      <div class="st-input ${prefix ? 'has-prefix' : ''} ${iconSvg ? 'has-icon' : ''} ${textarea ? 'is-textarea' : ''}">
        ${iconSvg}
        ${prefix ? `<span class="st-prefix">${prefix}</span>` : ''}
        ${control}
      </div>
      <p class="st-hint">${hint}${textarea ? ` <span class="st-count" data-count-for="${id}">${String(value || '').length}/${max}</span>` : ''}</p>
      <p class="st-error" data-error-for="${id}" hidden></p>
    </div>`;
}

export function renderSettings() {
  const auth = getAuth();
  if (!auth) {
    window.location.hash = '#/login?next=%2Fsettings';
    return { title: 'Sign in — LUC', html: '' };
  }

  const user = auth.user || { username: '' };
  const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

  return {
    title: 'Settings — LUC',
    description: 'Manage your LUC profile, avatar and account security.',
    html: `
      <section class="settings-page" id="settings-page">
        <div class="settings-wrap">
          <header class="settings-head">
            <div class="settings-id">
              <div id="st-head-avatar">${avatarMarkup(user, 'user-avatar-lg')}</div>
              <div>
                <p class="settings-eyebrow">ACCOUNT SETTINGS</p>
                <h1 id="st-head-name">${escapeHtml(displayName(user))}</h1>
                <p class="settings-sub">@<span id="st-head-handle">${escapeHtml(user.username)}</span>${joined ? ` · joined ${escapeHtml(joined)}` : ''}</p>
              </div>
            </div>
            <button class="st-btn st-btn-ghost" id="st-signout" type="button">${svg(LOGOUT)} Sign out</button>
          </header>

          <div class="settings-grid">
            <nav class="settings-nav" aria-label="Settings sections">
              <a href="#profile" data-section="profile" class="is-active">${icon('user', { size: 16 })} Profile</a>
              <a href="#account" data-section="account">${icon('mail', { size: 16 })} Account</a>
              <a href="#security" data-section="security">${svg(LOCK)} Security</a>
              <a href="#danger" data-section="danger" class="is-danger">${svg(TRASH)} Danger zone</a>
            </nav>

            <div class="settings-panels">
              <!-- profile -->
              <form class="st-card" id="profile" novalidate>
                <div class="st-card-head">
                  <h2>Profile</h2>
                  <p>How you appear on packages and around the registry.</p>
                </div>

                <div class="st-avatar-row">
                  <div class="st-avatar-drop" id="st-avatar-drop" tabindex="0" role="button" aria-label="Upload a new avatar">
                    <div id="st-avatar-preview">${avatarMarkup(user, 'user-avatar-xl')}</div>
                    <span class="st-avatar-overlay">${icon('upload', { size: 18 })}</span>
                  </div>
                  <div class="st-avatar-copy">
                    <h3>Profile picture</h3>
                    <p>PNG only. Big or non-square images open the crop tool. Saved at ${AVATAR_OUT}×${AVATAR_OUT}.</p>
                    <div class="st-avatar-actions">
                      <button class="st-btn st-btn-dark" id="st-avatar-pick" type="button">${icon('upload', { size: 15 })} Upload .png</button>
                      <button class="st-btn st-btn-ghost" id="st-avatar-remove" type="button" ${user.avatarUrl ? '' : 'hidden'}>Remove</button>
                    </div>
                    <input type="file" id="st-avatar-file" accept="image/png,.png" hidden />
                  </div>
                </div>

                <div class="st-row">
                  ${field({ id: 'displayName', label: 'Display name', value: user.displayName, placeholder: user.username, hint: 'Shown instead of your username.', max: 50 })}
                  ${field({ id: 'username', label: 'Username', value: user.username, prefix: '@', hint: 'Used in install commands: <code>luc install -p @name/pkg</code>', max: 32 })}
                </div>
                ${field({ id: 'bio', label: 'Bio', value: user.bio, placeholder: 'What do you build with LUC?', textarea: true, max: 200 })}
                <div class="st-row">
                  ${field({ id: 'location', label: 'Location', value: user.location, placeholder: 'Earth', iconSvg: svg(PIN), max: 60 })}
                  ${field({ id: 'website', label: 'Website', value: user.website, placeholder: 'https://', type: 'url', iconSvg: icon('link', { size: 16 }), max: 200 })}
                </div>

                <div class="st-card-foot">
                  <span class="st-dirty" id="st-profile-dirty" hidden>Unsaved changes</span>
                  <button class="st-btn st-btn-primary" type="submit" id="st-profile-save">Save profile</button>
                </div>
              </form>

              <!-- account -->
              <form class="st-card" id="account" novalidate>
                <div class="st-card-head">
                  <h2>Account</h2>
                  <p>Private details. Never shown publicly.</p>
                </div>
                ${field({ id: 'email', label: 'Email', value: user.email, type: 'email', placeholder: 'you@example.com', iconSvg: icon('mail', { size: 16 }), disabled: user.google, hint: user.google ? 'Managed by your Google account.' : 'Optional — used for account recovery.', max: 120 })}
                <div class="st-linked">
                  <span class="st-linked-icon"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg></span>
                  <div><strong>Google</strong><span>${user.google ? 'Connected' : 'Not connected'}</span></div>
                  <span class="st-pill ${user.google ? 'is-on' : ''}">${user.google ? 'linked' : 'off'}</span>
                </div>
                <div class="st-card-foot">
                  <button class="st-btn st-btn-primary" type="submit" ${user.google ? 'disabled' : ''}>Save email</button>
                </div>
              </form>

              <!-- security -->
              <form class="st-card" id="security" novalidate>
                <div class="st-card-head">
                  <h2>Security</h2>
                  <p>${user.hasPassword ? 'Changing your password signs out every other device.' : 'Add a password so you can also sign in with your username.'}</p>
                </div>
                ${user.hasPassword ? field({ id: 'currentPassword', label: 'Current password', type: 'password', iconSvg: svg(LOCK), max: 128 }) : ''}
                <div class="st-row">
                  ${field({ id: 'newPassword', label: 'New password', type: 'password', placeholder: 'At least 8 characters', iconSvg: svg(LOCK), max: 128 })}
                  ${field({ id: 'confirmPassword', label: 'Confirm new password', type: 'password', iconSvg: svg(LOCK), max: 128 })}
                </div>
                <div class="st-card-foot">
                  <button class="st-btn st-btn-primary" type="submit">${user.hasPassword ? 'Update password' : 'Set password'}</button>
                </div>
              </form>

              <!-- danger -->
              <form class="st-card st-card-danger" id="danger" novalidate>
                <div class="st-card-head">
                  <h2>Delete account</h2>
                  <p>Removes your account and avatar. Packages you published stay in the registry. This cannot be undone.</p>
                </div>
                ${field({ id: 'confirm', label: `Type <code>${escapeHtml(user.username)}</code> to confirm`, placeholder: user.username, max: 32 })}
                <div class="st-card-foot">
                  <button class="st-btn st-btn-danger" type="submit">${svg(TRASH)} Delete my account</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      <div class="crop-modal" id="crop-modal" hidden role="dialog" aria-modal="true" aria-labelledby="crop-title">
        <div class="crop-backdrop" data-crop-close></div>
        <div class="crop-dialog">
          <header class="crop-head">
            <div>
              <h2 id="crop-title">Crop your picture</h2>
              <p id="crop-meta">Drag to reposition. Scroll or use the slider to zoom.</p>
            </div>
            <button class="crop-x" type="button" data-crop-close aria-label="Close">${icon('x', { size: 18 })}</button>
          </header>
          <div class="crop-stage" id="crop-stage">
            <canvas id="crop-canvas"></canvas>
            <div class="crop-mask" aria-hidden="true"></div>
            <div class="crop-grid" aria-hidden="true"></div>
          </div>
          <div class="crop-zoom">
            <button type="button" class="crop-zbtn" id="crop-zoom-out" aria-label="Zoom out">${svg(ZOOM_OUT, 17)}</button>
            <input type="range" id="crop-zoom" min="1" max="4" step="0.01" value="1" aria-label="Zoom" />
            <button type="button" class="crop-zbtn" id="crop-zoom-in" aria-label="Zoom in">${svg(ZOOM_IN, 17)}</button>
          </div>
          <footer class="crop-foot">
            <button class="st-btn st-btn-ghost" type="button" id="crop-reset">${icon('refresh', { size: 15 })} Reset</button>
            <div class="crop-foot-right">
              <button class="st-btn st-btn-ghost" type="button" data-crop-close>Cancel</button>
              <button class="st-btn st-btn-primary" type="button" id="crop-apply">Apply &amp; upload</button>
            </div>
          </footer>
        </div>
      </div>`,

    async after() {
      const page = document.getElementById('settings-page');
      if (!page) return;
      let current = { ...user };
      const disposers = [];

      /* ---------------- helpers ---------------- */
      const setErrors = (form, fields = {}) => {
        form.querySelectorAll('[data-error-for]').forEach((el) => {
          const msg = fields[el.dataset.errorFor];
          el.textContent = msg || '';
          el.hidden = !msg;
          el.closest('.st-field')?.classList.toggle('has-error', Boolean(msg));
        });
      };
      const busy = (button, on) => {
        if (!button) return;
        button.disabled = on;
        button.classList.toggle('is-loading', on);
      };
      const paintIdentity = (u) => {
        current = { ...u };
        document.getElementById('st-head-avatar').innerHTML = avatarMarkup(u, 'user-avatar-lg');
        document.getElementById('st-avatar-preview').innerHTML = avatarMarkup(u, 'user-avatar-xl');
        document.getElementById('st-head-name').textContent = displayName(u);
        document.getElementById('st-head-handle').textContent = u.username;
        document.getElementById('st-avatar-remove').hidden = !u.avatarUrl;
      };
      async function send(url, options) {
        const response = await authFetch(url, options);
        let data = {};
        try { data = await response.json(); } catch { /* empty */ }
        if (response.status === 401 && !url.includes('/password')) {
          toast('Your session expired. Please sign in again.', 'error');
          window.location.hash = '#/login?next=%2Fsettings';
          throw Object.assign(new Error('expired'), { silent: true });
        }
        if (!response.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { fields: data.fields || {} });
        return data;
      }

      /* ---------------- section nav (scroll spy) ---------------- */
      const navLinks = [...page.querySelectorAll('.settings-nav a')];
      navLinks.forEach((link) => link.addEventListener('click', (event) => {
        event.preventDefault();
        const target = document.getElementById(link.dataset.section);
        if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 96, behavior: 'smooth' });
      }));
      const spy = () => {
        let active = navLinks[0];
        for (const link of navLinks) {
          const el = document.getElementById(link.dataset.section);
          if (el && el.getBoundingClientRect().top < 160) active = link;
        }
        navLinks.forEach((l) => l.classList.toggle('is-active', l === active));
      };
      window.addEventListener('scroll', spy, { passive: true });
      disposers.push(() => window.removeEventListener('scroll', spy));

      /* ---------------- sign out ---------------- */
      document.getElementById('st-signout').addEventListener('click', async () => {
        await signOut();
        toast('Signed out.');
        window.location.hash = '#/';
      });

      /* ---------------- profile ---------------- */
      const profile = document.getElementById('profile');
      const dirty = document.getElementById('st-profile-dirty');
      const profileKeys = ['displayName', 'username', 'bio', 'location', 'website'];
      const profileValues = () => Object.fromEntries(profileKeys.map((k) => [k, profile.elements[k].value.trim()]));
      const markDirty = () => {
        const v = profileValues();
        dirty.hidden = !profileKeys.some((k) => v[k] !== String(current[k] || ''));
      };
      profile.addEventListener('input', (event) => {
        if (event.target.name === 'bio') {
          const counter = profile.querySelector('[data-count-for="bio"]');
          if (counter) counter.textContent = `${event.target.value.length}/200`;
        }
        markDirty();
      });
      profile.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = document.getElementById('st-profile-save');
        const values = profileValues();
        values.username = values.username.replace(/^@/, '').toLowerCase();
        setErrors(profile);
        busy(button, true);
        try {
          const data = await send('/api/account', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...values, email: current.email || '' })
          });
          updateUser(data.user);
          paintIdentity(data.user);
          profile.elements.username.value = data.user.username;
          dirty.hidden = true;
          toast('Profile saved.');
        } catch (error) {
          if (!error.silent) { setErrors(profile, error.fields); toast(error.message, 'error'); }
        } finally {
          busy(button, false);
        }
      });

      /* ---------------- account (email) ---------------- */
      const account = document.getElementById('account');
      account.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = account.querySelector('button[type="submit"]');
        setErrors(account);
        busy(button, true);
        try {
          const body = Object.fromEntries(profileKeys.map((k) => [k, current[k] || '']));
          body.email = account.elements.email.value.trim();
          const data = await send('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          updateUser(data.user);
          current = { ...data.user };
          toast('Email saved.');
        } catch (error) {
          if (!error.silent) { setErrors(account, error.fields); toast(error.message, 'error'); }
        } finally {
          busy(button, false);
        }
      });

      /* ---------------- security ---------------- */
      const security = document.getElementById('security');
      security.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = security.querySelector('button[type="submit"]');
        const next = security.elements.newPassword.value;
        const confirm = security.elements.confirmPassword.value;
        const errors = {};
        if (next.length < 8) errors.newPassword = 'Use at least 8 characters.';
        if (next !== confirm) errors.confirmPassword = 'Passwords do not match.';
        setErrors(security, errors);
        if (Object.keys(errors).length) return;
        busy(button, true);
        try {
          const data = await send('/api/account/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: security.elements.currentPassword?.value || '', newPassword: next })
          });
          updateUser(data.user);
          security.reset();
          toast('Password updated. Other devices were signed out.');
        } catch (error) {
          if (!error.silent) { setErrors(security, error.fields); toast(error.message, 'error'); }
        } finally {
          busy(button, false);
        }
      });

      /* ---------------- danger ---------------- */
      const danger = document.getElementById('danger');
      danger.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = danger.querySelector('button[type="submit"]');
        const confirm = danger.elements.confirm.value.trim().toLowerCase();
        if (confirm !== current.username) return setErrors(danger, { confirm: 'That does not match your username.' });
        setErrors(danger);
        busy(button, true);
        try {
          await send('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm }) });
          clearAuth();
          toast('Your account was deleted.');
          window.location.hash = '#/';
        } catch (error) {
          if (!error.silent) { setErrors(danger, error.fields); toast(error.message, 'error'); }
          busy(button, false);
        }
      });

      /* ---------------- avatar: pick / validate ---------------- */
      const fileInput = document.getElementById('st-avatar-file');
      const drop = document.getElementById('st-avatar-drop');
      const pick = () => fileInput.click();
      document.getElementById('st-avatar-pick').addEventListener('click', pick);
      drop.addEventListener('click', pick);
      drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
      ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
      drop.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (file) handleFile(file);
      });
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (file) handleFile(file);
      });

      document.getElementById('st-avatar-remove').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        busy(button, true);
        try {
          const data = await send('/api/account/avatar', { method: 'DELETE' });
          updateUser(data.user);
          paintIdentity(data.user);
          toast('Profile picture removed.');
        } catch (error) {
          if (!error.silent) toast(error.message, 'error');
        } finally {
          busy(button, false);
        }
      });

      async function isRealPng(file) {
        const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
        return PNG_MAGIC.every((b, i) => head[i] === b);
      }

      async function handleFile(file) {
        const named = /\.png$/i.test(file.name);
        if (!named || (file.type && file.type !== 'image/png') || !(await isRealPng(file))) {
          toast('Only .png images are supported.', 'error');
          return;
        }
        if (file.size > MAX_SOURCE) {
          toast('That PNG is over 15 MB. Pick a smaller one.', 'error');
          return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const square = img.naturalWidth === img.naturalHeight;
          const small = img.naturalWidth <= AVATAR_OUT && file.size <= MAX_DIRECT;
          if (square && small) {
            URL.revokeObjectURL(url);
            uploadBlob(file);
          } else {
            openCropper(img, url, file);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          toast('That PNG could not be read.', 'error');
        };
        img.src = url;
      }

      async function uploadBlob(blob) {
        const preview = document.getElementById('st-avatar-preview');
        preview.classList.add('is-uploading');
        try {
          const data = await send('/api/account/avatar', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob });
          updateUser(data.user);
          paintIdentity(data.user);
          toast('Profile picture updated.');
        } catch (error) {
          if (!error.silent) toast(error.message, 'error');
        } finally {
          document.getElementById('st-avatar-preview')?.classList.remove('is-uploading');
        }
      }

      /* ---------------- avatar: crop tool ---------------- */
      const modal = document.getElementById('crop-modal');
      // #app animates with a transform, which would trap position:fixed. Portal to <body>.
      document.body.appendChild(modal);
      const stage = document.getElementById('crop-stage');
      const canvas = document.getElementById('crop-canvas');
      const ctx = canvas.getContext('2d');
      const zoom = document.getElementById('crop-zoom');
      const meta = document.getElementById('crop-meta');
      const crop = { img: null, url: '', size: 0, base: 1, scale: 1, x: 0, y: 0 };

      function stageSize() {
        return Math.round(stage.getBoundingClientRect().width) || 340;
      }
      function clamp() {
        const w = crop.img.naturalWidth * crop.base * crop.scale;
        const h = crop.img.naturalHeight * crop.base * crop.scale;
        crop.x = Math.min(0, Math.max(crop.size - w, crop.x));
        crop.y = Math.min(0, Math.max(crop.size - h, crop.y));
      }
      function draw() {
        if (!crop.img) return;
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== crop.size * dpr) {
          canvas.width = crop.size * dpr;
          canvas.height = crop.size * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, crop.size, crop.size);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(crop.img, crop.x, crop.y, crop.img.naturalWidth * crop.base * crop.scale, crop.img.naturalHeight * crop.base * crop.scale);
      }
      function setScale(next, cx = crop.size / 2, cy = crop.size / 2) {
        const prev = crop.scale;
        crop.scale = Math.min(4, Math.max(1, next));
        // zoom around the given focal point
        crop.x = cx - ((cx - crop.x) * crop.scale) / prev;
        crop.y = cy - ((cy - crop.y) * crop.scale) / prev;
        zoom.value = String(crop.scale);
        clamp();
        draw();
      }
      function resetCrop() {
        crop.size = stageSize();
        crop.base = crop.size / Math.min(crop.img.naturalWidth, crop.img.naturalHeight);
        crop.scale = 1;
        zoom.value = '1';
        crop.x = (crop.size - crop.img.naturalWidth * crop.base) / 2;
        crop.y = (crop.size - crop.img.naturalHeight * crop.base) / 2;
        draw();
      }
      function openCropper(img, url, file) {
        crop.img = img;
        crop.url = url;
        const mb = (file.size / 1024 / 1024).toFixed(file.size > 1024 * 1024 ? 1 : 2);
        meta.textContent = `${img.naturalWidth}×${img.naturalHeight} · ${mb} MB — drag to reposition, scroll to zoom.`;
        modal.hidden = false;
        document.body.classList.add('crop-open');
        requestAnimationFrame(() => {
          resetCrop();
          document.getElementById('crop-apply').focus();
        });
      }
      function closeCropper() {
        modal.hidden = true;
        document.body.classList.remove('crop-open');
        if (crop.url) URL.revokeObjectURL(crop.url);
        crop.img = null;
        crop.url = '';
      }

      let drag = null;
      stage.addEventListener('pointerdown', (e) => {
        if (!crop.img) return;
        stage.setPointerCapture(e.pointerId);
        drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: crop.x, oy: crop.y };
        stage.classList.add('is-dragging');
      });
      stage.addEventListener('pointermove', (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        crop.x = drag.ox + (e.clientX - drag.sx);
        crop.y = drag.oy + (e.clientY - drag.sy);
        clamp();
        draw();
      });
      const endDrag = () => { drag = null; stage.classList.remove('is-dragging'); };
      stage.addEventListener('pointerup', endDrag);
      stage.addEventListener('pointercancel', endDrag);
      stage.addEventListener('wheel', (e) => {
        if (!crop.img) return;
        e.preventDefault();
        const rect = stage.getBoundingClientRect();
        setScale(crop.scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - rect.left, e.clientY - rect.top);
      }, { passive: false });
      zoom.addEventListener('input', () => setScale(Number(zoom.value)));
      document.getElementById('crop-zoom-in').addEventListener('click', () => setScale(crop.scale + 0.25));
      document.getElementById('crop-zoom-out').addEventListener('click', () => setScale(crop.scale - 0.25));
      document.getElementById('crop-reset').addEventListener('click', resetCrop);
      modal.querySelectorAll('[data-crop-close]').forEach((el) => el.addEventListener('click', closeCropper));

      const onKey = (e) => {
        if (modal.hidden) return;
        if (e.key === 'Escape') closeCropper();
        const step = e.shiftKey ? 20 : 5;
        const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
        if (moves[e.key]) {
          e.preventDefault();
          crop.x += moves[e.key][0];
          crop.y += moves[e.key][1];
          clamp();
          draw();
        }
        if (e.key === '+' || e.key === '=') setScale(crop.scale + 0.1);
        if (e.key === '-') setScale(crop.scale - 0.1);
      };
      document.addEventListener('keydown', onKey);
      disposers.push(() => document.removeEventListener('keydown', onKey));

      const onResize = () => {
        if (!crop.img || modal.hidden) return;
        const ratio = stageSize() / crop.size;
        crop.size = stageSize();
        crop.base *= ratio;
        crop.x *= ratio;
        crop.y *= ratio;
        clamp();
        draw();
      };
      window.addEventListener('resize', onResize);
      disposers.push(() => window.removeEventListener('resize', onResize));

      document.getElementById('crop-apply').addEventListener('click', async (event) => {
        if (!crop.img) return;
        const button = event.currentTarget;
        busy(button, true);
        const out = document.createElement('canvas');
        out.width = AVATAR_OUT;
        out.height = AVATAR_OUT;
        const octx = out.getContext('2d');
        octx.imageSmoothingQuality = 'high';
        const k = AVATAR_OUT / crop.size;
        octx.drawImage(
          crop.img,
          crop.x * k,
          crop.y * k,
          crop.img.naturalWidth * crop.base * crop.scale * k,
          crop.img.naturalHeight * crop.base * crop.scale * k
        );
        const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
        busy(button, false);
        if (!blob) return toast('Could not export the cropped image.', 'error');
        closeCropper();
        uploadBlob(blob);
      });

      return () => {
        disposers.forEach((fn) => fn());
        modal.remove();
        document.body.classList.remove('crop-open');
        if (crop.url) URL.revokeObjectURL(crop.url);
      };
    }
  };
}
