'use strict';

/*
 * LUC website + package registry.
 *
 * Zero dependencies. Serves the static site from ./public and a small JSON API
 * backed by ./data/packages.json (seeded from ./data/seed.js on first run).
 *
 *   node website/server.js
 *   PORT=3000 node website/server.js
 */

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public', 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'packages.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ARTIFACT_DIR = path.join(DATA_DIR, 'artifacts');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MAX_BODY = 1024 * 1024;
const MAX_ARTIFACT = 25 * 1024 * 1024;
const ACCENTS = ['#ff7a18', '#8b5cf6', '#38d996', '#5aa9ff', '#f472b4', '#ffd166', '#7dd3fc', '#a3e635', '#fb7185'];
const LICENSES = ['Apache-2.0', 'MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'GPL-3.0', 'LGPL-3.0', 'MPL-2.0', 'Unlicense', 'CC0-1.0', 'Other'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

/* ------------------------------------------------------------------ */
/* database                                                            */
/* ------------------------------------------------------------------ */

let db = null;
let writeQueue = Promise.resolve();
let users = [];
const sessions = new Map();
const cliCodes = new Map();
const cliUploads = new Map();
const googleStates = new Map();

function normalize(pkg) {
  return {
    slug: pkg.slug,
    name: pkg.name,
    importName: pkg.importName || String(pkg.name || pkg.slug || '').replace(/-/g, '_'),
    summary: pkg.summary || '',
    version: pkg.version || '0.1.0',
    license: pkg.license || 'Apache-2.0',
    repo: pkg.repo || '',
    homepage: pkg.homepage || '',
    author: pkg.author || { name: 'anonymous', handle: 'anonymous', url: '', verified: false },
    official: Boolean(pkg.official),
    featured: Boolean(pkg.featured),
    tags: Array.isArray(pkg.tags) ? pkg.tags.slice(0, 8) : [],
    accent: pkg.accent || '#ff7a18',
    size: pkg.size || '—',
    readme: typeof pkg.readme === 'string' ? pkg.readme : '',
    weeklyDownloads: Number(pkg.weeklyDownloads) || 0,
    totalDownloads: Number(pkg.totalDownloads) || 0,
    downloadsHistory: Array.isArray(pkg.downloadsHistory) && pkg.downloadsHistory.length === 7
      ? pkg.downloadsHistory.map((n) => Number(n) || 0)
      : [0, 0, 0, 0, 0, 0, 0],
    publishedAt: pkg.publishedAt || new Date().toISOString().slice(0, 10),
    updatedAt: pkg.updatedAt || new Date().toISOString().slice(0, 10),
    dependencies: pkg.dependencies && typeof pkg.dependencies === 'object' ? pkg.dependencies : {},
    versions: Array.isArray(pkg.versions) ? pkg.versions : [],
    ownerKey: pkg.ownerKey || '',
    artifact: pkg.artifact || ''
  };
}

async function loadDb() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fsp.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    db = Array.isArray(parsed) ? parsed.map(normalize) : [];
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[luc] could not read packages.json, reseeding:', err.message);
    }
    const seed = require('./data/seed.js');
    db = seed.packages.map((p) => normalize({ ...p, ownerKey: 'official' }));
    await persist();
  }
  const demoPackages = new Set(['term', 'tester', 'dotenv', 'luc-web']);
  const previousCount = db.length;
  db = db.filter((pkg) => !demoPackages.has(pkg.slug) || pkg.ownerKey !== 'official');
  if (db.length !== previousCount) await persist();
  try {
    const rawUsers = await fsp.readFile(USERS_FILE, 'utf8');
    const parsedUsers = JSON.parse(rawUsers);
    users = Array.isArray(parsedUsers) ? parsedUsers : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[luc] could not read users.json:', err.message);
    users = [];
    await persistUsers();
  }
  await fsp.mkdir(ARTIFACT_DIR, { recursive: true });
  console.log(`[luc] registry ready with ${db.length} packages`);
}

function persist() {
  const snapshot = JSON.stringify(db, null, 2);
  writeQueue = writeQueue.then(async () => {
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, snapshot);
    await fsp.rename(tmp, DB_FILE);
  }).catch((err) => {
    console.error('[luc] failed to persist registry:', err);
  });
  return writeQueue;
}

let userWriteQueue = Promise.resolve();
function persistUsers() {
  const snapshot = JSON.stringify(users, null, 2);
  const write = userWriteQueue.then(async () => {
    const tmp = `${USERS_FILE}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, snapshot);
    await fsp.rename(tmp, USERS_FILE);
  });
  userWriteQueue = write.catch((err) => {
    console.error('[luc] failed to persist accounts:', err);
  });
  return write;
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000 });
  return token;
}

function sessionUser(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer ([a-f0-9]{64})$/i);
  if (!match) return null;
  const session = sessions.get(match[1]);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(match[1]);
    return null;
  }
  return users.find((user) => user.id === session.userId) || null;
}

function publicUser(user) {
  return { username: user.username, email: user.email || '' };
}

function sessionResponse(user) {
  return { token: createSession(user), user: publicUser(user) };
}

function saveCliGrant(code, user) {
  const pending = cliCodes.get(code);
  if (!pending || pending.expiresAt <= Date.now()) return false;
  pending.grant = sessionResponse(user);
  return true;
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function json(res, status, body, extraHeaders) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    ...extraHeaders
  });
  res.end(payload);
}

function fail(res, status, message, fields) {
  json(res, status, { error: message, fields: fields || {} });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request body is too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Body must be valid JSON.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').trim().slice(0, max);
}

function isHttpUrl(value) {
  if (!value) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function publicPackage(pkg) {
  const { ownerKey, artifact, ...rest } = pkg;
  return rest;
}

function stats(pkgs) {
  const authors = new Set(pkgs.map((p) => p.author.handle));
  return {
    packages: pkgs.length,
    weeklyDownloads: pkgs.reduce((sum, p) => sum + p.weeklyDownloads, 0),
    authors: authors.size,
    licenses: new Set(pkgs.map((p) => p.license)).size,
    updatedAt: new Date().toISOString()
  };
}

function validatePublish(input, existingSlug) {
  const fields = {};
  const name = cleanText(input.name, 64);
  const slug = slugify(name);
  if (!name) fields.name = 'Pick a package name.';
  else if (!/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
    fields.name = 'Use 3–40 characters: lowercase letters, numbers and hyphens. Start with a letter.';
  } else if (!existingSlug && db.some((p) => p.slug === slug)) {
    fields.name = `"${slug}" is already taken. Try another name.`;
  }

  const summary = cleanText(input.summary, 220);
  if (summary.length < 12) fields.summary = 'Write at least a sentence (12+ characters).';
  if (summary.length > 220) fields.summary = 'Keep the summary under 220 characters.';

  const version = cleanText(input.version, 32) || '0.1.0';
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    fields.version = 'Use semver, for example 0.1.0 or 1.0.0-beta.1.';
  }

  const license = cleanText(input.license, 40) || 'Apache-2.0';
  if (!LICENSES.includes(license) && license !== 'Other') {
    fields.license = 'Choose a license from the list.';
  }

  const repo = cleanText(input.repo, 300);
  if (repo && !isHttpUrl(repo)) fields.repo = 'Repository must be an http(s) URL.';

  const homepage = cleanText(input.homepage, 300);
  if (homepage && !isHttpUrl(homepage)) fields.homepage = 'Homepage must be an http(s) URL.';

  const authorName = cleanText(input.authorName || (input.author && input.author.name), 60);
  if (!authorName) fields.authorName = 'Add a name or handle.';

  const authorUrl = cleanText(input.authorUrl || (input.author && input.author.url), 300);
  if (authorUrl && !isHttpUrl(authorUrl)) fields.authorUrl = 'Author link must be an http(s) URL.';

  const readme = cleanText(input.readme, 60000);
  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags.map((t) => cleanText(String(t), 24).toLowerCase()).filter(Boolean))].slice(0, 6)
    : [];

  let dependencies = {};
  if (input.dependencies && typeof input.dependencies === 'string') {
    for (const chunk of input.dependencies.split(',')) {
      const [depName, depVer] = chunk.split('@').map((s) => cleanText(s, 40));
      if (depName) dependencies[depName] = depVer ? `^${depVer.replace(/^\^/, '')}` : '*';
    }
  } else if (input.dependencies && typeof input.dependencies === 'object') {
    for (const [depName, depVer] of Object.entries(input.dependencies).slice(0, 12)) {
      const key = cleanText(depName, 40);
      if (key) dependencies[key] = cleanText(String(depVer), 20) || '*';
    }
  }

  return {
    fields,
    ok: Object.keys(fields).length === 0,
    value: { name: slug, slug, summary, version, license, repo, homepage, authorName, authorUrl, readme, tags, dependencies }
  };
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // api, packages, ...

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-File-Name'
    });
    return res.end();
  }

  if (parts[1] === 'auth') {
    if (parts[2] === 'config' && req.method === 'GET') {
      return json(res, 200, { googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
    }

    if (parts[2] === 'register' && req.method === 'POST') {
      const body = await readBody(req);
      const username = cleanText(body.username, 32).toLowerCase();
      const password = typeof body.password === 'string' ? body.password : '';
      if (!/^[a-z][a-z0-9_-]{2,31}$/.test(username)) {
        return fail(res, 422, 'Choose a username with 3–32 letters, numbers, underscores or hyphens.');
      }
      if (password.length < 8 || password.length > 128) {
        return fail(res, 422, 'Password must be between 8 and 128 characters.');
      }
      if (users.some((user) => user.username.toLowerCase() === username)) {
        return fail(res, 409, 'That username is already taken.');
      }
      const salt = crypto.randomBytes(16).toString('hex');
      const user = {
        id: crypto.randomUUID(),
        username,
        email: '',
        salt,
        passwordHash: crypto.scryptSync(password, salt, 64).toString('hex'),
        googleId: '',
        createdAt: new Date().toISOString()
      };
      users.push(user);
      await persistUsers();
      return json(res, 201, sessionResponse(user));
    }

    if (parts[2] === 'login' && req.method === 'POST') {
      const body = await readBody(req);
      const username = cleanText(body.username, 32).toLowerCase();
      const password = typeof body.password === 'string' ? body.password : '';
      const user = users.find((item) => item.username.toLowerCase() === username);
      const candidate = user && user.salt
        ? crypto.scryptSync(password, user.salt, 64)
        : Buffer.alloc(64);
      const stored = user && user.passwordHash ? Buffer.from(user.passwordHash, 'hex') : Buffer.alloc(64);
      if (!user || stored.length !== candidate.length || !crypto.timingSafeEqual(stored, candidate)) {
        return fail(res, 401, 'Username or password is incorrect.');
      }
      return json(res, 200, sessionResponse(user));
    }

    if (parts[2] === 'me' && req.method === 'GET') {
      const user = sessionUser(req);
      return user ? json(res, 200, { user: publicUser(user) }) : fail(res, 401, 'Sign in to continue.');
    }

    if (parts[2] === 'logout' && req.method === 'POST') {
      const match = (req.headers.authorization || '').match(/^Bearer ([a-f0-9]{64})$/i);
      if (match) sessions.delete(match[1]);
      return json(res, 200, { ok: true });
    }

    if (parts[2] === 'cli' && parts[3] === 'start' && req.method === 'POST') {
      const code = crypto.randomBytes(24).toString('hex');
      cliCodes.set(code, { expiresAt: Date.now() + 10 * 60 * 1000, grant: null });
      const origin = `${req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
      return json(res, 201, { code, loginUrl: `${origin}/#/login?cli=${code}` });
    }

    if (parts[2] === 'cli' && parts[3] === 'complete' && req.method === 'POST') {
      const body = await readBody(req);
      const user = sessionUser(req);
      if (!user) return fail(res, 401, 'Sign in to authorize this terminal.');
      if (!saveCliGrant(cleanText(body.code, 64), user)) return fail(res, 410, 'This terminal login request expired.');
      return json(res, 200, { ok: true });
    }

    if (parts[2] === 'cli' && parts[3] === 'poll' && req.method === 'POST') {
      const body = await readBody(req);
      const code = cleanText(body.code, 64);
      const pending = cliCodes.get(code);
      if (!pending || pending.expiresAt <= Date.now()) {
        cliCodes.delete(code);
        return fail(res, 410, 'This terminal login request expired. Run luc login again.');
      }
      if (!pending.grant) return json(res, 202, { pending: true });
      cliCodes.delete(code);
      return json(res, 200, pending.grant);
    }

    if (parts[2] === 'cli' && parts[3] === 'uploads' && parts.length === 4 && req.method === 'POST') {
      const user = sessionUser(req);
      if (!user) return fail(res, 401, 'Run luc login before publishing.');
      const filename = cleanText(req.headers['x-file-name'], 120);
      if (!filename.toLowerCase().endsWith('.luic')) return fail(res, 422, 'Publish a .luic file.');
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_ARTIFACT) return fail(res, 413, 'Package file exceeds the 25 MB limit.');
        chunks.push(chunk);
      }
      if (!size) return fail(res, 422, 'The package file is empty.');
      const id = crypto.randomBytes(20).toString('hex');
      cliUploads.set(id, {
        userId: user.id,
        filename: path.basename(filename),
        bytes: Buffer.concat(chunks),
        readme: '',
        expiresAt: Date.now() + 60 * 60 * 1000
      });
      return json(res, 201, { id, filename });
    }

    if (parts[2] === 'cli' && parts[3] === 'uploads' && parts.length === 6 && parts[5] === 'readme' && req.method === 'POST') {
      const user = sessionUser(req);
      const uploadId = parts[4];
      if (!user) return fail(res, 401, 'Run luc login before publishing.');
      const pending = cliUploads.get(uploadId);
      if (!pending || pending.userId !== user.id || pending.expiresAt <= Date.now()) {
        return fail(res, 404, 'The uploaded package expired. Run luc publish -p again.');
      }
      const body = await readBody(req);
      pending.readme = cleanText(body.readme, 60000);
      return json(res, 200, { ok: true });
    }

    if (parts[2] === 'cli' && parts[3] === 'uploads' && parts.length === 5 && req.method === 'GET') {
      const user = sessionUser(req);
      const upload = cliUploads.get(parts[4]);
      if (!user) return fail(res, 401, 'Sign in to continue.');
      if (!upload || upload.userId !== user.id || upload.expiresAt <= Date.now()) return fail(res, 404, 'Upload not found or expired.');
      return json(res, 200, { id: parts[4], filename: upload.filename, readme: upload.readme });
    }

    if (parts[2] === 'google' && parts[3] === 'start' && req.method === 'GET') {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return fail(res, 503, 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
      }
      const state = crypto.randomBytes(24).toString('hex');
      const cliCode = cleanText(url.searchParams.get('cli'), 64);
      googleStates.set(state, { cliCode, expiresAt: Date.now() + 10 * 60 * 1000 });
      const origin = `${req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
      const redirectUri = `${origin}/api/auth/google/callback`;
      const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      googleUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
      googleUrl.searchParams.set('redirect_uri', redirectUri);
      googleUrl.searchParams.set('response_type', 'code');
      googleUrl.searchParams.set('scope', 'openid email profile');
      googleUrl.searchParams.set('state', state);
      res.writeHead(302, { Location: googleUrl.toString(), 'Cache-Control': 'no-store' });
      return res.end();
    }

    if (parts[2] === 'google' && parts[3] === 'callback' && req.method === 'GET') {
      const state = googleStates.get(url.searchParams.get('state'));
      googleStates.delete(url.searchParams.get('state'));
      if (!state || state.expiresAt <= Date.now() || !url.searchParams.get('code')) {
        return fail(res, 400, 'Google sign-in expired or was cancelled. Please try again.');
      }
      const origin = `${req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
      const redirectUri = `${origin}/api/auth/google/callback`;
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: url.searchParams.get('code'),
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });
      if (!tokenResponse.ok) return fail(res, 502, 'Google could not complete sign-in.');
      const tokenData = await tokenResponse.json();
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (!profileResponse.ok) return fail(res, 502, 'Could not read the Google account profile.');
      const profile = await profileResponse.json();
      if (!profile.sub || !profile.email || profile.email_verified !== true) return fail(res, 502, 'Google did not return a verified email address.');

      let user = users.find((item) => item.googleId === profile.sub || item.email.toLowerCase() === profile.email.toLowerCase());
      if (!user) {
        const base = slugify(String(profile.name || profile.email.split('@')[0])).replace(/-/g, '').slice(0, 24) || 'lucuser';
        let username = base.length < 3 ? `luc${base}` : base;
        let suffix = 2;
        while (users.some((item) => item.username.toLowerCase() === username.toLowerCase())) username = `${base.slice(0, 27)}${suffix++}`;
        user = { id: crypto.randomUUID(), username, email: profile.email, salt: '', passwordHash: '', googleId: profile.sub, createdAt: new Date().toISOString() };
        users.push(user);
      } else {
        user.email = profile.email;
        user.googleId = profile.sub;
      }
      await persistUsers();
      const response = sessionResponse(user);
      if (state.cliCode) saveCliGrant(state.cliCode, user);
      const payload = safeJson(response);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(`<!doctype html><meta charset="utf-8"><title>Signed in to LUC</title><p>Finishing sign-in…</p><script>localStorage.setItem('luc.auth',JSON.stringify(${payload}));location.replace('/#/');</script>`);
    }

    return fail(res, 404, 'Unknown authentication route.');
  }

  if (parts[1] === 'stats' && req.method === 'GET') {
    return json(res, 200, stats(db));
  }

  if (parts[1] === 'licenses' && req.method === 'GET') {
    return json(res, 200, { licenses: LICENSES });
  }

  if (parts[1] !== 'packages') return fail(res, 404, 'Unknown API route.');

  /* GET /api/packages */
  if (parts.length === 2 && req.method === 'GET') {
    let list = db.slice();
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const tag = (url.searchParams.get('tag') || '').trim().toLowerCase();
    const sort = url.searchParams.get('sort') || 'downloads';

    if (q) {
      list = list.filter((p) =>
        [p.name, p.summary, p.author.name, p.author.handle, ...(p.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    if (tag) list = list.filter((p) => p.tags.some((t) => t.toLowerCase() === tag));

    if (sort === 'downloads') list.sort((a, b) => b.weeklyDownloads - a.weeklyDownloads);
    else if (sort === 'recent') list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'new') list.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));

    return json(res, 200, {
      packages: list.map(publicPackage),
      stats: stats(db),
      total: list.length,
      query: { q, tag, sort }
    });
  }

  /* POST /api/packages */
  if (parts.length === 2 && req.method === 'POST') {
    const body = await readBody(req);
    const user = sessionUser(req);
    if (!user) return fail(res, 401, 'Sign in before publishing a package.');
    const check = validatePublish(body);
    if (!check.ok) return fail(res, 422, 'Please fix the highlighted fields.', check.fields);

    const { value } = check;
    const today = new Date().toISOString().slice(0, 10);
    const accent = ACCENTS[db.length % ACCENTS.length];
    const pkg = normalize({
      slug: value.slug,
      name: value.name,
      importName: value.name.replace(/-/g, '_'),
      summary: value.summary,
      version: value.version,
      license: value.license,
      repo: value.repo,
      homepage: value.homepage,
      author: {
        name: user.username,
        handle: user.username,
        url: value.authorUrl,
        verified: false
      },
      official: false,
      featured: false,
      tags: value.tags,
      accent,
      size: cleanText(body.size, 24) || '—',
      readme: value.readme,
      weeklyDownloads: 0,
      totalDownloads: 0,
      downloadsHistory: [0, 0, 0, 0, 0, 0, 0],
      publishedAt: today,
      updatedAt: today,
      dependencies: value.dependencies,
      versions: [{ version: value.version, date: today, notes: 'First release published from the website.' }],
      ownerKey: user.id,
      artifact: ''
    });

    const uploadId = cleanText(body.uploadId, 64);
    if (uploadId) {
      const upload = cliUploads.get(uploadId);
      if (!upload || upload.userId !== user.id || upload.expiresAt <= Date.now()) {
        return fail(res, 404, 'The uploaded .luic file expired. Run luc publish -p again.');
      }
      const artifactName = `${pkg.slug}-${crypto.randomBytes(6).toString('hex')}.luic`;
      await fsp.writeFile(path.join(ARTIFACT_DIR, artifactName), upload.bytes);
      pkg.artifact = artifactName;
      pkg.size = `${(upload.bytes.length / 1024).toFixed(upload.bytes.length < 10240 ? 1 : 0)} KB`;
      if (!pkg.readme) pkg.readme = upload.readme;
      cliUploads.delete(uploadId);
    }

    db.push(pkg);
    await persist();
    return json(res, 201, { package: publicPackage(pkg), message: `Published ${pkg.name}@${pkg.version}.` });
  }

  const slug = parts[2] ? decodeURIComponent(parts[2]).toLowerCase() : '';
  const pkg = db.find((p) => p.slug === slug);

  /* GET /api/packages/:slug */
  if (parts.length === 3 && req.method === 'GET') {
    if (!pkg) return fail(res, 404, `No package named "${slug}".`);
    return json(res, 200, { package: publicPackage(pkg) });
  }

  if (parts.length === 4 && parts[3] === 'file' && req.method === 'GET') {
    if (!pkg) return fail(res, 404, `No package named "${slug}".`);
    if (!pkg.artifact) return fail(res, 404, 'This package does not have a published .luic file.');
    const filename = path.join(ARTIFACT_DIR, path.basename(pkg.artifact));
    try {
      const data = await fsp.readFile(filename);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': data.length,
        'Content-Disposition': `attachment; filename="${pkg.slug}.luic"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      });
      return res.end(data);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      return fail(res, 404, 'The package artifact is missing from the registry.');
    }
  }

  /* POST /api/packages/:slug/install — bump counters when an install is copied */
  if (parts.length === 4 && parts[3] === 'install' && req.method === 'POST') {
    if (!pkg) return fail(res, 404, `No package named "${slug}".`);
    pkg.totalDownloads += 1;
    pkg.weeklyDownloads += 1;
    pkg.downloadsHistory[pkg.downloadsHistory.length - 1] += 1;
    await persist();
    return json(res, 200, {
      slug: pkg.slug,
      weeklyDownloads: pkg.weeklyDownloads,
      totalDownloads: pkg.totalDownloads,
      downloadsHistory: pkg.downloadsHistory
    });
  }

  /* GET /api/packages/:slug/install — the exact install recipe */
  if (parts.length === 4 && parts[3] === 'install' && req.method === 'GET') {
    if (!pkg) return fail(res, 404, `No package named "${slug}".`);
    const origin = `${req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
    const command = `luc install -p @${pkg.author.handle}/${pkg.name}`;
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(`${command}\n`);
  }

  return fail(res, 404, 'Unknown API route.');
}

function valHandle(name) {
  return name.toLowerCase().replace(/[^a-z0-9_-]+/g, '').slice(0, 32) || 'anonymous';
}

/* ------------------------------------------------------------------ */
/* static files                                                       */
/* ------------------------------------------------------------------ */

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!safePath.startsWith(PUBLIC_DIR + path.sep) && safePath !== path.join(PUBLIC_DIR, 'index.html')) {
    return fail(res, 403, 'Forbidden.');
  }

  let stat = null;
  try {
    stat = await fsp.stat(safePath);
  } catch {
    stat = null;
  }

  if (stat && stat.isDirectory()) {
    return serveStatic(req, res, new URL(`${pathname.replace(/\/$/, '')}/index.html`, url));
  }

  if (!stat || !stat.isFile()) {
    // SPA fallback for extension-less paths such as /about
    if (!path.extname(pathname)) {
      return sendFile(req, res, path.join(PUBLIC_DIR, 'index.html'), true);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }

  return sendFile(req, res, safePath, false);
}

async function sendFile(req, res, file, spa) {
  try {
    const data = await fsp.readFile(file);
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'X-Content-Type-Options': 'nosniff'
    };
    if (spa) headers['Cache-Control'] = 'no-cache';
    else if (ext === '.html') headers['Cache-Control'] = 'no-cache';
    else headers['Cache-Control'] = 'public, max-age=300';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  } catch (err) {
    console.error('[luc] failed to read', file, err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
}

/* ------------------------------------------------------------------ */
/* server                                                              */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return fail(res, 400, 'Bad request.');
  }

  res.on('finish', () => {
    if (process.env.LUC_SITE_LOG !== '0') {
      const ms = Date.now() - started;
      console.log(`${req.method} ${res.statusCode} ${url.pathname}${url.search} ${ms}ms`);
    }
  });

  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Method not allowed.');
    return await serveStatic(req, res, url);
  } catch (err) {
    console.error('[luc] request error:', err);
    if (res.headersSent) return res.end();
    return fail(res, err.status || 500, err.status ? err.message : 'Something went wrong on the server.');
  }
});

loadDb().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`[luc] website running at http://${HOST}:${PORT}`);
  });
});

function shutdown(signal) {
  console.log(`[luc] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
