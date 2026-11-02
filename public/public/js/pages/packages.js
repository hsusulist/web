import { icon } from '../lib/icons.js';
import { escapeHtml } from '../lib/highlight.js';
import { renderMarkdown } from '../lib/markdown.js';
import {
  packageCard,
  packageAvatar,
  tagList,
  installCommand,
  formatNumber,
  formatDate,
  timeAgo,
  pageHero,
  sectionHead,
  observeReveal,
  toast,
  emptyState,
  commandBox,
  sparkline,
  icon as uiIcon
} from '../lib/ui.js';

const LICENSES = ['Apache-2.0', 'MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'GPL-3.0', 'LGPL-3.0', 'MPL-2.0', 'Unlicense', 'CC0-1.0', 'Other'];

/* ====================================================================== */
/* registry list                                                          */
/* ====================================================================== */

const CATEGORIES = [
  { id: 'graphics', label: 'Graphics & games', icon: 'monitor', tags: ['graphics', 'gamedev', 'sound', 'sdl2', 'ui', 'gui'] },
  { id: 'ai', label: 'AI & ML', icon: 'sparkles', tags: ['ai', 'machine-learning', 'tensor', 'neural-network', 'llm'] },
  { id: 'network', label: 'Networking', icon: 'globe', tags: ['http', 'networking', 'websocket', 'server', 'web', 'api'] },
  { id: 'bots', label: 'Bots & chat', icon: 'message', tags: ['bots', 'discord', 'chat', 'telegram'] },
  { id: 'data', label: 'Data & parsing', icon: 'file-text', tags: ['json', 'parsing', 'data', 'csv', 'yaml'] },
  { id: 'tooling', label: 'CLI & tooling', icon: 'terminal', tags: ['libraries', 'tooling', 'packaging', 'cli', 'testing'] }
];
const PAGE_SIZE = 10;

function registryRow(pkg, index = 0) {
  const href = `#/packages/${encodeURIComponent(pkg.slug)}`;
  const handle = pkg.author.handle || pkg.author.name;
  const tilt = [-6, 5, -3, 7, -5, 4][index % 6];
  return `
    <article class="rg-row" style="--accent:${escapeHtml(pkg.accent || '#ef6130')};--tilt:${tilt}deg">
      <i class="rg-brk rg-brk-tl"></i><i class="rg-brk rg-brk-br"></i>
      <a class="rg-row-mark" href="${href}" aria-hidden="true" tabindex="-1"><span>${escapeHtml(pkg.name.slice(0, 1).toUpperCase())}</span></a>
      <div class="rg-row-main">
        <h3 class="rg-row-title">
          <a href="${href}">${escapeHtml(pkg.name)}</a>
          <span class="rg-row-ver">v${escapeHtml(pkg.version)}</span>
          ${pkg.official ? `<span class="rg-badge rg-badge-official">${icon('check', { size: 10 })} official</span>` : ''}
        </h3>
        <p class="rg-row-summary">${escapeHtml(pkg.summary)}</p>
        <div class="rg-row-foot">
          <span class="rg-row-author"><span class="rg-mini-avatar">${escapeHtml(handle.slice(0, 1).toUpperCase())}</span>@${escapeHtml(handle)}</span>
          <span>${escapeHtml(timeAgo(pkg.updatedAt) || formatDate(pkg.updatedAt))}</span>
          <span>${escapeHtml(pkg.license)}</span>
          ${pkg.tags.slice(0, 4).map((t) => `<button type="button" class="rg-tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('')}
        </div>
      </div>
      <div class="rg-row-side">
        <span class="rg-row-dl"><strong data-weekly="${escapeHtml(pkg.slug)}">${formatNumber(pkg.weeklyDownloads, true)}</strong> / week</span>
        ${sparkline(pkg.downloadsHistory, pkg.accent)}
        <button class="rg-row-copy" type="button" data-copy data-copy-text="${escapeHtml(installCommand(pkg))}" data-install="${escapeHtml(pkg.slug)}" title="${escapeHtml(installCommand(pkg))}">${icon('copy', { size: 13 })}<span>install</span></button>
      </div>
    </article>`;
}

function stackSquare(pkg, i) {
  const cls = ['rg-sq-lime', 'rg-sq-orange', 'rg-sq-cream'][i] || 'rg-sq-cream';
  return `
    <a class="rg-sq ${cls}" href="#/packages/${encodeURIComponent(pkg.slug)}">
      <span class="rg-sq-rank">#${i + 1}</span>
      ${icon(i === 1 ? 'command' : 'package', { size: 20 })}
      <b>${escapeHtml(pkg.name.toUpperCase())}</b>
      <span class="rg-sq-meta">${formatNumber(pkg.weeklyDownloads, true)}/wk · v${escapeHtml(pkg.version)}</span>
    </a>`;
}

export function renderPackages(params = {}) {
  return {
    title: 'Packages — the LUC registry',
    description: 'Browse community and official LUC libraries. Search by name, tag or author, then copy a one-line install command.',
    html: `
      <div class="rg-page luc-refresh" id="registry-page">

        <!-- HERO ======================================================= -->
        <section class="rg-hero">
          <div class="rg-hero-gridmark" aria-hidden="true">LUC / REGISTRY</div>
          <div class="rg-hero-inner">
            <div class="rg-hero-copy">
              <div class="lr-kicker"><span class="lr-kicker-line"></span>Package registry <span class="lr-version" id="rg-hero-count">— packages</span></div>
              <h1>Find a package.<br><span>Make it yours.</span></h1>
              <p class="rg-lede">Libraries for LUC, published by the community and the core team. Read what you install, then pull it in with one line.</p>

              <form class="rg-search" id="rg-hero-search" role="search">
                <i class="rg-brk rg-brk-tl"></i><i class="rg-brk rg-brk-br"></i>
                ${icon('search', { size: 18 })}
                <input type="search" id="rg-hero-input" placeholder="Search packages, tags or authors…" autocomplete="off" spellcheck="false" aria-label="Search packages" value="${escapeHtml(params.q || '')}" />
                <kbd>/</kbd>
                <button type="submit">Search ${icon('arrow-right', { size: 15 })}</button>
              </form>

              <div class="rg-hero-tags" id="rg-hero-tags">
                <span>Try</span>
                ${['graphics', 'http', 'ai', 'json', 'discord'].map((t) => `<button type="button" class="rg-tag" data-tag="${t}">#${t}</button>`).join('')}
              </div>
            </div>

            <div class="rg-stage" aria-label="Most installed this week">
              <i class="rg-brk rg-brk-tl"></i><i class="rg-brk rg-brk-tr"></i><i class="rg-brk rg-brk-bl"></i><i class="rg-brk rg-brk-br"></i>
              <div class="rg-stage-top"><span>TOP THIS WEEK</span><span class="rg-signal"><i></i><i></i><i></i><i></i><i></i><b>LIVE</b></span></div>
              <div class="rg-stage-code"><span>import</span> libraries<br><span>get</span> what you need<br><span>make</span> something yours</div>
              <div class="rg-stack" id="rg-stack">
                <div class="rg-sq rg-sq-lime is-ghost"></div>
                <div class="rg-sq rg-sq-orange is-ghost"></div>
                <div class="rg-sq rg-sq-cream is-ghost"></div>
              </div>
              <div class="rg-stage-bottom"><span>LUC REGISTRY ${icon('arrow-right', { size: 14 })} YOUR PROJECT</span><span>luc install -p</span></div>
            </div>
          </div>

          <div class="rg-numbers-band">
            <dl class="rg-numbers">
              <div><dt><span>01</span>Packages</dt><dd id="rg-n-packages">—</dd></div>
              <div><dt><span>02</span>Installs · last week</dt><dd id="rg-n-weekly">—</dd></div>
              <div><dt><span>03</span>Installs · all time</dt><dd id="rg-n-total">—</dd></div>
              <div><dt><span>04</span>Authors</dt><dd id="rg-n-authors">—</dd></div>
            </dl>
          </div>
        </section>

        <!-- CATEGORIES ================================================= -->
        <section class="rg-kinds">
          <div class="rg-kinds-top">
            <div><span class="lr-section-index">01 / BROWSE BY KIND</span><h2>Start with what<br>you want to <em>make.</em></h2></div>
            <p>Pick a shelf. Click it again to put it back. Every package is tagged, so you can mix a shelf with a search.</p>
          </div>
          <div class="rg-discover" id="rg-discover">
            ${CATEGORIES.map((c, i) => `
              <button type="button" class="rg-cat" data-cat="${c.id}">
                <i class="rg-brk rg-brk-tl"></i><i class="rg-brk rg-brk-br"></i>
                <span class="rg-cat-top"><span>${String(i + 1).padStart(2, '0')}</span><em data-cat-count="${c.id}">—</em></span>
                <span class="rg-cat-mark">${icon(c.icon, { size: 20 })}</span>
                <strong>${c.label}</strong>
                <span class="rg-cat-tags">${c.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}</span>
              </button>`).join('')}
          </div>
        </section>

        <!-- RESULTS ==================================================== -->
        <section class="rg-results" id="rg-results-section" aria-labelledby="rg-results-h">
          <div class="rg-results-grid">
            <div class="rg-results-main">
              <div class="rg-results-head">
                <div>
                  <span class="lr-section-index">02 / THE SHELF</span>
                  <h2 id="rg-results-h">All packages</h2>
                  <p class="rg-count" id="rg-count" aria-live="polite">Loading…</p>
                </div>
                <div class="rg-tools">
                  <label class="rg-filter">
                    ${icon('filter', { size: 15 })}
                    <input type="search" id="rg-filter" placeholder="Filter by name, tag or author" autocomplete="off" spellcheck="false" aria-label="Filter packages" value="${escapeHtml(params.q || '')}" />
                  </label>
                  <div class="rg-sort" role="tablist" aria-label="Sort packages" id="rg-sort">
                    <button type="button" data-sort="downloads" class="is-active">Popular</button>
                    <button type="button" data-sort="recent">Updated</button>
                    <button type="button" data-sort="new">Newest</button>
                    <button type="button" data-sort="name">A–Z</button>
                  </div>
                </div>
              </div>
              <div class="rg-active" id="rg-active" hidden></div>
              <div class="rg-list" id="rg-list">
                ${'<div class="rg-skel rg-skel-row"></div>'.repeat(4)}
              </div>
              <nav class="rg-pager" id="rg-pager" aria-label="Pagination" hidden></nav>
            </div>

            <aside class="rg-aside">
              <div class="rg-aside-card">
                <i class="rg-brk rg-brk-tl"></i><i class="rg-brk rg-brk-br"></i>
                <h3 class="rg-aside-head">${icon('zap', { size: 15 })} Popular this week</h3>
                <ol class="rg-popular" id="rg-popular">
                  ${'<li class="rg-skel"></li>'.repeat(5)}
                </ol>
              </div>
              <div class="rg-aside-card rg-aside-dark">
                <i class="rg-brk rg-brk-tl"></i><i class="rg-brk rg-brk-br"></i>
                <h3 class="rg-aside-head">${icon('terminal', { size: 15 })} Install anything</h3>
                <code class="rg-aside-cmd"><b>$</b> luc install -p @user/name</code>
                <p>The CLI downloads the <code>.luic</code> file and records the install. Every package page has a copy button.</p>
                <a href="#/guide#libraries">How packages work ${icon('arrow-right', { size: 14 })}</a>
              </div>
            </aside>
          </div>
        </section>

        <!-- CTA ======================================================== -->
        <section class="rg-cta">
          <div class="rg-cta-inner">
            <div class="rg-cta-copy">
              <span class="lr-section-index">03 / YOUR TURN</span>
              <h2>Made something useful?<br><em>Put it on the shelf.</em></h2>
              <p>One <code>.luic</code> file and an optional README. Sign in once from the terminal and publish in three commands.</p>
              <div class="rg-cta-actions">
                <a class="lr-button lr-button-orange" href="#/publish">${icon('upload', { size: 16 })} Publish a package ${icon('arrow-right', { size: 15 })}</a>
                <a class="lr-text-link" href="#/guide#libraries">${icon('book', { size: 15 })} Read the guide</a>
              </div>
            </div>
            <div class="rg-cta-art" aria-hidden="true">
              <div class="rg-sq rg-sq-lime rg-cta-sq1">${icon('package', { size: 20 })}<b>YOUR</b><span>.luic</span></div>
              <div class="rg-terminal">
                <div class="rg-terminal-head"><span>${icon('terminal', { size: 14 })} PUBLISH</span><span>01—03</span></div>
                <div class="rg-terminal-line"><i>01</i><b>$</b> luc login</div>
                <div class="rg-terminal-line"><i>02</i><b>$</b> cd my-package</div>
                <div class="rg-terminal-line"><i>03</i><b>$</b> luc publish -p</div>
                <div class="rg-terminal-status"><span><i></i> PUBLISHED</span><span>@you/my-package</span></div>
              </div>
            </div>
          </div>
        </section>
      </div>`,

    async after() {
      const list = document.getElementById('rg-list');
      const count = document.getElementById('rg-count');
      const filter = document.getElementById('rg-filter');
      const sortWrap = document.getElementById('rg-sort');
      const active = document.getElementById('rg-active');
      const pager = document.getElementById('rg-pager');
      const discover = document.getElementById('rg-discover');
      const popular = document.getElementById('rg-popular');
      if (!list) return;

      const state = {
        q: params.q || '',
        tag: params.tag || '',
        cat: CATEGORIES.some((c) => c.id === params.cat) ? params.cat : '',
        sort: ['downloads', 'recent', 'new', 'name'].includes(params.sort) ? params.sort : 'downloads',
        page: Math.max(1, Number(params.page) || 1)
      };
      let all = [];

      try {
        const res = await fetch('/api/packages');
        if (!res.ok) throw new Error('registry unavailable');
        const data = await res.json();
        all = data.packages || [];
        const stats = data.stats || {};
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('rg-n-packages', formatNumber(stats.packages ?? all.length));
        set('rg-n-weekly', formatNumber(all.reduce((s, p) => s + p.weeklyDownloads, 0)));
        set('rg-n-total', formatNumber(all.reduce((s, p) => s + p.totalDownloads, 0)));
        set('rg-n-authors', formatNumber(stats.authors ?? new Set(all.map((p) => p.author.handle)).size));
        set('rg-hero-count', `${formatNumber(stats.packages ?? all.length)} packages`);
      } catch {
        popular.innerHTML = '<li class="rg-empty-li">Registry unavailable.</li>';
        count.textContent = 'The registry could not be loaded.';
        list.innerHTML = emptyState({ iconName: 'alert', title: 'Registry unavailable', body: 'The package API did not answer. Refresh the page in a moment.' });
        return;
      }

      // popular column
      const ranked = all.slice().sort((a, b) => b.weeklyDownloads - a.weeklyDownloads);
      const top = ranked.slice(0, 6);
      const peak = Math.max(1, ...top.map((p) => p.weeklyDownloads));
      popular.innerHTML = top.length
        ? top.map((p) => `<li style="--accent:${escapeHtml(p.accent || '#ef6130')};--w:${Math.max(6, Math.round((p.weeklyDownloads / peak) * 100))}%"><a href="#/packages/${encodeURIComponent(p.slug)}"><span>${escapeHtml(p.name)}</span><em>${formatNumber(p.weeklyDownloads, true)}</em></a><i class="rg-pop-bar"></i></li>`).join('')
        : '<li class="rg-empty-li">No packages yet.</li>';
      const stack = document.getElementById('rg-stack');
      if (stack) stack.innerHTML = ranked.slice(0, 3).map(stackSquare).join('') || '<p class="rg-stack-empty">Nothing published yet.</p>';

      // category counts
      const inCat = (pkg, cat) => {
        const c = CATEGORIES.find((x) => x.id === cat);
        return c ? pkg.tags.some((t) => c.tags.includes(t.toLowerCase())) : true;
      };
      CATEGORIES.forEach((c) => {
        const el = discover.querySelector(`[data-cat-count="${c.id}"]`);
        if (el) el.textContent = String(all.filter((p) => inCat(p, c.id)).length);
      });

      function updateUrl() {
        const q = new URLSearchParams();
        if (state.q) q.set('q', state.q);
        if (state.tag) q.set('tag', state.tag);
        if (state.cat) q.set('cat', state.cat);
        if (state.sort !== 'downloads') q.set('sort', state.sort);
        if (state.page > 1) q.set('page', String(state.page));
        const s = q.toString();
        history.replaceState(null, '', `#/packages${s ? `?${s}` : ''}`);
      }

      function render({ scroll = false } = {}) {
        const q = state.q.trim().toLowerCase();
        let rows = all.filter((pkg) => {
          if (state.cat && !inCat(pkg, state.cat)) return false;
          if (state.tag && !pkg.tags.some((t) => t.toLowerCase() === state.tag.toLowerCase())) return false;
          if (!q) return true;
          return [pkg.name, pkg.summary, pkg.author.name, pkg.author.handle, ...pkg.tags].join(' ').toLowerCase().includes(q);
        });
        if (state.sort === 'downloads') rows.sort((a, b) => b.weeklyDownloads - a.weeklyDownloads);
        else if (state.sort === 'recent') rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        else if (state.sort === 'new') rows.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
        else rows.sort((a, b) => a.name.localeCompare(b.name));

        const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
        state.page = Math.min(state.page, pages);
        const slice = rows.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

        count.innerHTML = `<strong>${formatNumber(rows.length)}</strong> ${rows.length === 1 ? 'package' : 'packages'} found`;

        // active filter chips
        const chips = [];
        if (state.cat) chips.push(`<button type="button" class="rg-chip" data-clear="cat">${escapeHtml(CATEGORIES.find((c) => c.id === state.cat).label)} ${icon('x', { size: 12 })}</button>`);
        if (state.tag) chips.push(`<button type="button" class="rg-chip" data-clear="tag">#${escapeHtml(state.tag)} ${icon('x', { size: 12 })}</button>`);
        if (state.q) chips.push(`<button type="button" class="rg-chip" data-clear="q">“${escapeHtml(state.q)}” ${icon('x', { size: 12 })}</button>`);
        active.hidden = !chips.length;
        active.innerHTML = chips.length ? `${chips.join('')}<button type="button" class="rg-chip-clear" data-clear="all">Clear all</button>` : '';

        discover.querySelectorAll('.rg-cat').forEach((b) => b.classList.toggle('is-active', b.dataset.cat === state.cat));
        sortWrap.querySelectorAll('button').forEach((b) => {
          b.classList.toggle('is-active', b.dataset.sort === state.sort);
          b.setAttribute('aria-selected', String(b.dataset.sort === state.sort));
        });

        list.innerHTML = slice.length
          ? slice.map((pkg, i) => registryRow(pkg, i)).join('')
          : emptyState({ iconName: 'search', title: 'Nothing matched that', body: 'Try a shorter filter or another category — or publish the package that is missing.', action: '<button class="st-btn st-btn-ghost" type="button" data-clear="all">Clear filters</button>' });

        if (pages > 1) {
          const btn = (p, label = p, extra = '') => `<button type="button" data-page="${p}" class="${p === state.page ? 'is-active' : ''}" ${extra}>${label}</button>`;
          let html = btn(Math.max(1, state.page - 1), icon('chevron-left', { size: 14 }), `aria-label="Previous page" ${state.page === 1 ? 'disabled' : ''}`);
          for (let p = 1; p <= pages; p++) html += btn(p);
          html += btn(Math.min(pages, state.page + 1), icon('chevron-right', { size: 14 }), `aria-label="Next page" ${state.page === pages ? 'disabled' : ''}`);
          pager.innerHTML = html;
          pager.hidden = false;
        } else {
          pager.hidden = true;
          pager.innerHTML = '';
        }

        updateUrl();
        if (scroll) {
          const head = document.getElementById('rg-results-section');
          window.scrollTo({ top: head.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
        }
      }

      const page = document.getElementById('registry-page');
      const onClick = (event) => {
        const cat = event.target.closest('.rg-cat');
        if (cat) {
          state.cat = state.cat === cat.dataset.cat ? '' : cat.dataset.cat;
          state.page = 1;
          return render({ scroll: true });
        }
        const tag = event.target.closest('.rg-tag');
        if (tag) {
          state.tag = tag.dataset.tag;
          state.page = 1;
          return render({ scroll: true });
        }
        // Scope lookups to this page: <body> carries data-page="packages" from the router.
        const sort = event.target.closest('#rg-sort [data-sort]');
        if (sort) {
          state.sort = sort.dataset.sort;
          state.page = 1;
          return render();
        }
        const pg = event.target.closest('#rg-pager [data-page]');
        if (pg) {
          if (!pg.disabled) {
            state.page = Number(pg.dataset.page) || 1;
            render({ scroll: true });
          }
          return;
        }
        const clear = event.target.closest('#registry-page [data-clear]');
        if (clear) {
          const what = clear.dataset.clear;
          if (what === 'all' || what === 'q') { state.q = ''; filter.value = ''; }
          if (what === 'all' || what === 'tag') state.tag = '';
          if (what === 'all' || what === 'cat') state.cat = '';
          state.page = 1;
          render();
        }
      };
      page.addEventListener('click', onClick);

      // hero search mirrors into the shelf filter and scrolls down to results
      const heroForm = document.getElementById('rg-hero-search');
      const heroInput = document.getElementById('rg-hero-input');
      heroForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        state.q = heroInput.value.trim();
        filter.value = state.q;
        state.page = 1;
        render({ scroll: true });
      });
      const onKey = (e) => {
        if (e.key === '/' && !/input|textarea/i.test(document.activeElement?.tagName || '')) {
          e.preventDefault();
          heroInput?.focus();
        }
      };
      document.addEventListener('keydown', onKey);

      let timer = null;
      filter.addEventListener('input', () => {
        if (heroInput) heroInput.value = filter.value;
        clearTimeout(timer);
        timer = setTimeout(() => {
          state.q = filter.value.trim();
          state.page = 1;
          render();
        }, 140);
      });
      filter.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { filter.value = ''; state.q = ''; render(); }
      });

      render();
      return () => { clearTimeout(timer); document.removeEventListener('keydown', onKey); };
    }
  };
}

/* ====================================================================== */
/* package detail                                                         */
/* ====================================================================== */

export async function renderPackageDetail(params) {
  const slug = params.slug;

  let pkg;
  try {
    const res = await fetch(`/api/packages/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error(res.status === 404 ? 'not-found' : 'error');
    const data = await res.json();
    pkg = data.package;
  } catch (error) {
    const missing = error.message === 'not-found';
    return {
      title: missing ? `Package ${slug} not found — LUC` : 'Registry unavailable — LUC',
      html: `
        <section class="section">
          <div class="container container-narrow">
            <div class="error-panel">
              <span class="empty-icon" style="margin-inline:auto">${uiIcon(missing ? 'package' : 'alert', { size: 26 })}</span>
              <h2>${missing ? `No package named “${escapeHtml(slug)}”` : 'The registry is taking a nap'}</h2>
              <p>${missing ? 'It may have been renamed, or it has not been published yet. The name you want might still be free.' : 'The package API did not answer. Try refreshing in a moment.'}</p>
              <div class="hero-actions" style="justify-content:center">
                <a class="btn btn-primary" href="#/packages">Back to packages</a>
                <a class="btn btn-ghost" href="#/publish">Publish this name</a>
              </div>
            </div>
          </div>
        </section>`,
      after() { observeReveal(); }
    };
  }

  const command = installCommand(pkg);
  const readme = renderMarkdown(pkg.readme);
  const history = pkg.downloadsHistory || [];
  const maxHistory = Math.max(...history, 1);
  const deps = Object.entries(pkg.dependencies || {});

  const repoLink = pkg.repo
    ? `<a class="meta-chip" href="${escapeHtml(pkg.repo)}" target="_blank" rel="noopener noreferrer">${icon('github', { size: 12 })} Repository ${icon('external', { size: 11 })}</a>`
    : '';
  const homepageLink = pkg.homepage
    ? `<a class="meta-chip" href="${escapeHtml(pkg.homepage)}" target="_blank" rel="noopener noreferrer">${icon('globe', { size: 12 })} Homepage</a>`
    : '';

  return {
    title: `${pkg.name} ${pkg.version} — LUC packages`,
    description: pkg.summary,
    html: `
      <section class="pkg-detail">
        <div class="container">
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="#/packages">packages</a>
            ${icon('chevron-right', { size: 12 })}
            <span>${escapeHtml(pkg.name)}</span>
          </nav>

          <header class="pkg-detail-head">
            ${packageAvatar(pkg, 'xl')}
            <div class="pkg-detail-title">
              <div class="pkg-detail-title-line">
                <h1>${escapeHtml(pkg.name)}</h1>
                <span class="pkg-version">v${escapeHtml(pkg.version)}</span>
                ${pkg.official ? `<span class="badge badge-official">${icon('check', { size: 10 })} official</span>` : '<span class="badge badge-new">community</span>'}
              </div>
              <p class="pkg-detail-summary">${escapeHtml(pkg.summary)}</p>
              <div class="pkg-meta-chips">
                <span class="meta-chip">${icon('scale', { size: 12 })} ${escapeHtml(pkg.license)}</span>
                <span class="meta-chip">${icon('clock', { size: 12 })} updated ${timeAgo(pkg.updatedAt)}</span>
                <span class="meta-chip">${icon('download', { size: 12 })} <span data-weekly="${escapeHtml(pkg.slug)}">${formatNumber(pkg.weeklyDownloads, true)}</span> / week</span>
                <span class="meta-chip">${icon('user', { size: 12 })} @${escapeHtml(pkg.author.handle || pkg.author.name)}</span>
                ${repoLink}
                ${homepageLink}
              </div>
            </div>
            <div class="pkg-detail-actions">
              <button class="btn btn-primary" type="button" data-copy data-copy-text="${escapeHtml(command)}" data-install="${escapeHtml(pkg.slug)}">${icon('download', { size: 16 })} Copy install</button>
              ${pkg.repo ? `<a class="btn btn-ghost" href="${escapeHtml(pkg.repo)}" target="_blank" rel="noopener noreferrer">${icon('github', { size: 16 })} Source</a>` : ''}
            </div>
          </header>

          <div class="pkg-layout">
            <div class="pkg-main">
              <div class="install-panel">
                <div class="install-panel-head">
                  <h3>${icon('terminal', { size: 16 })} Install ${escapeHtml(pkg.name)}</h3>
                  <span class="install-note">pulls from this page</span>
                </div>
                <div class="install-row">
                  <span class="prompt">$</span>
                  <code>${escapeHtml(command)}</code>
                  <button class="copy-btn" type="button" data-copy data-copy-text="${escapeHtml(command)}" data-install="${escapeHtml(pkg.slug)}">${icon('copy', { size: 13 })}<span>Copy</span></button>
                </div>
                <p class="install-foot">
                  Then use it in LUC: <code>import ${escapeHtml(pkg.importName || pkg.name)}</code>
                  ${pkg.official ? ' · maintained by the LUC team' : ` · by @${escapeHtml(pkg.author.handle || pkg.author.name)}`}
                </p>
              </div>

              <div class="readme-card">
                <div class="readme-card-head">
                  <h2>${icon('file-text', { size: 16 })} README ${pkg.readme ? '' : '<span class="badge badge-beta">empty</span>'}</h2>
                  ${pkg.repo ? `<a href="${escapeHtml(pkg.repo)}" target="_blank" rel="noopener noreferrer">view source ${icon('external', { size: 11 })}</a>` : ''}
                </div>
                ${readme
                  ? `<div class="prose" style="margin-top:18px">${readme}</div>`
                  : `<div class="empty-state" style="margin-top:18px;border:0;background:none">
                      <span class="empty-icon">${icon('file-text', { size: 24 })}</span>
                      <h3>No README yet</h3>
                      <p>The author published this package without a readme. That is allowed — the install command above and the metadata are enough to get started.</p>
                    </div>`}
              </div>
            </div>

            <aside class="pkg-sidebar">
              <div class="side-card">
                <h3>Downloads</h3>
                ${pkg.totalDownloads === 0
                  ? `<div class="chart-empty">${icon('download', { size: 18 })}<span>No installs yet — be the first.</span></div>`
                  : `<div class="download-chart" role="img" aria-label="Weekly download chart">
                      ${history.map((value) => `<span style="height:${Math.max(14, Math.round((value / maxHistory) * 100))}%" title="${formatNumber(value)} installs"></span>`).join('')}
                    </div>
                    <div class="chart-legend"><span>7 days ago</span><span>today</span></div>`}
                <div class="meta-list" style="margin-top:14px">
                  <div class="meta-row"><dt>This week</dt><dd data-weekly="${escapeHtml(pkg.slug)}">${formatNumber(pkg.weeklyDownloads)}</dd></div>
                  <div class="meta-row"><dt>All time</dt><dd data-total="${escapeHtml(pkg.slug)}">${formatNumber(pkg.totalDownloads)}</dd></div>
                </div>
              </div>

              <div class="side-card">
                <h3>Details</h3>
                <dl class="meta-list">
                  <div class="meta-row"><dt>Version</dt><dd>${escapeHtml(pkg.version)}</dd></div>
                  <div class="meta-row"><dt>License</dt><dd>${escapeHtml(pkg.license)}</dd></div>
                  <div class="meta-row"><dt>Published</dt><dd>${formatDate(pkg.publishedAt)}</dd></div>
                  <div class="meta-row"><dt>Updated</dt><dd>${formatDate(pkg.updatedAt)}</dd></div>
                  <div class="meta-row"><dt>Package size</dt><dd>${escapeHtml(pkg.size || '—')}</dd></div>
                  <div class="meta-row"><dt>Dependencies</dt><dd>${deps.length}</dd></div>
                  <div class="meta-row"><dt>Import</dt><dd>${escapeHtml(pkg.importName || pkg.name)}</dd></div>
                </dl>
              </div>

              <div class="side-card">
                <h3>Maintainer</h3>
                <div class="author-row">
                  <span class="author-avatar">${escapeHtml(pkg.author.name.slice(0, 2).toUpperCase())}</span>
                  <div>
                    <div class="author-name">${escapeHtml(pkg.author.name)}${pkg.author.verified ? ` ${icon('check', { size: 12 })}` : ''}</div>
                    <div class="author-handle">@${escapeHtml(pkg.author.handle || 'anonymous')}</div>
                  </div>
                </div>
                ${pkg.author.url ? `<a class="btn btn-ghost btn-sm btn-block" style="margin-top:14px" href="${escapeHtml(pkg.author.url)}" target="_blank" rel="noopener noreferrer">${icon('github', { size: 14 })} View profile</a>` : ''}
              </div>

              ${deps.length ? `
              <div class="side-card">
                <h3>Dependencies</h3>
                <div class="side-links">
                  ${deps.map(([name, version]) => `<a href="#/packages/${encodeURIComponent(name)}">${icon('package', { size: 14 })} ${escapeHtml(name)} <span style="margin-left:auto;font-family:var(--font-mono);font-size:10px;color:var(--muted-2)">${escapeHtml(version)}</span></a>`).join('')}
                </div>
              </div>` : ''}

              <div class="side-card">
                <h3>Versions</h3>
                <ul class="version-list">
                  ${(pkg.versions || []).map((version, index) => `
                    <li class="version-item">
                      <strong>v${escapeHtml(version.version)} ${index === 0 ? '<span class="badge badge-new" style="margin-left:4px">latest</span>' : ''}</strong>
                      <span>${formatDate(version.date)}</span>
                      ${version.notes ? `<p>${escapeHtml(version.notes)}</p>` : ''}
                    </li>`).join('') || '<li class="version-item"><strong>v' + escapeHtml(pkg.version) + '</strong><span>No changelog yet.</span></li>'}
                </ul>
              </div>

              <div class="side-card">
                <h3>Tags</h3>
                <div class="pkg-tags">${tagList(pkg.tags, 8) || '<span style="font-size:11.5px;color:var(--muted-2)">No tags</span>'}</div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    `,
    after() {
      observeReveal();
    }
  };
}

/* ====================================================================== */
/* publish                                                                */
/* ====================================================================== */

function field({ id, label, hint = '', type = 'text', placeholder = '', value = '', mono = false, help = '' }) {
  return `
    <div class="field" data-field="${id}">
      <label for="${id}">${label}${hint ? `<span class="hint">${hint}</span>` : ''}</label>
      <input id="${id}" name="${id}" type="${type}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" ${mono ? 'class="mono"' : ''} spellcheck="false" />
      ${help ? `<p class="field-help">${help}</p>` : ''}
      <p class="field-error" data-error="${id}"></p>
    </div>`;
}

export function renderPublish(params = {}) {
  const uploadId = params.upload || '';
  return {
    title: 'Publish a package — LUC registry',
    description: 'Publish a LUC library in a minute. Name it, describe it, add a readme if you like, and get a copyable install command.',
    html: `
      ${pageHero({
        eyebrow: 'Publish',
        title: 'Put your library<br /><span class="grad">on the page.</span>',
        lede: 'A name, one sentence, a version. Everything else is optional — including the README. Your install command is generated the moment you publish.',
        meta: `
          <span>${icon('clock', { size: 14 })} Takes about a minute</span>
          <span>${icon('package', { size: 14 })} Libraries, games, tools — anything</span>
          <span>${icon('scale', { size: 14 })} You choose the license</span>`
      })}

      <div class="container">
        <div class="publish-layout">
          <form class="form-card" id="publish-form" novalidate>
            <div class="publish-artifact-note" id="publish-artifact-note" hidden></div>
            <div class="form-section">
              <p class="form-section-title">The basics<span>A good name and one honest sentence.</span></p>
              <div class="form-grid">
                ${field({ id: 'name', label: 'Package name', hint: 'lowercase, hyphens', placeholder: 'mymath', mono: true, help: 'This becomes the import name and the folder on the registry page.' })}
                ${field({ id: 'version', label: 'Version', hint: 'semver', placeholder: '0.1.0', value: '0.1.0', mono: true })}
              </div>
              <div class="field" data-field="summary">
                <label for="summary">Summary <span class="hint"><span id="summary-count">0</span>/220</span></label>
                <input id="summary" name="summary" type="text" maxlength="220" placeholder="Exact big-integer helpers with a friendly API." autocomplete="off" />
                <p class="field-error" data-error="summary"></p>
              </div>
              <div class="field" data-field="license">
                <label for="license">License <span class="hint">pick one</span></label>
                <select id="license" name="license">
                  ${LICENSES.map((license) => `<option value="${license}" ${license === 'Apache-2.0' ? 'selected' : ''}>${license}</option>`).join('')}
                </select>
                <p class="field-error" data-error="license"></p>
              </div>
            </div>

            <div class="form-section">
              <p class="form-section-title">Links<span>Where people can read or follow the source.</span></p>
              <div class="form-grid">
                ${field({ id: 'repo', label: 'Repository', hint: 'optional', placeholder: 'https://github.com/you/project', type: 'url', mono: true })}
                ${field({ id: 'homepage', label: 'Homepage', hint: 'optional', placeholder: 'https://your.site/mymath', type: 'url', mono: true })}
              </div>
              <div class="form-grid">
                ${field({ id: 'authorName', label: 'Your name', hint: 'required', placeholder: 'Your name or handle' })}
                ${field({ id: 'authorUrl', label: 'Profile link', hint: 'optional', placeholder: 'https://github.com/you', type: 'url', mono: true })}
              </div>
              <div class="field" data-field="tags">
                <label for="tag-input">Tags <span class="hint">up to 6 · Enter to add</span></label>
                <div class="tag-editor" id="tag-editor">
                  <input id="tag-input" type="text" placeholder="math, tooling, ai…" autocomplete="off" />
                </div>
                <p class="field-help">Tags help people find your package. Use lowercase words.</p>
                <p class="field-error" data-error="tags"></p>
              </div>
              <div class="field" data-field="dependencies">
                <label for="dependencies">Dependencies <span class="hint">optional</span></label>
                <input id="dependencies" name="dependencies" type="text" placeholder="net@1.1.0, json@0.4.0" class="mono" autocomplete="off" />
                <p class="field-help">Comma separated, <code>name@version</code>. Leave blank if none.</p>
              </div>
            </div>

            <div class="form-section">
              <p class="form-section-title">README<span>Optional. Markdown works: headings, lists, code fences, links, tables.</span></p>
              <div class="field" data-field="readme">
                <label for="readme">Long description <span class="hint">optional · up to 60,000 characters</span></label>
                <textarea id="readme" name="readme" placeholder="# mymath&#10;&#10;Exact math helpers for LUC.&#10;&#10;Add usage, examples and an install section. Markdown is supported."></textarea>
                <p class="field-help">Leave it blank if you prefer. The package page will show a friendly “no README yet” state.</p>
                <p class="field-error" data-error="readme"></p>
              </div>
            </div>

            <div class="form-footer">
              <p>By publishing you confirm you have the right to share this code and that the license you picked applies to it.</p>
              <button class="btn btn-primary" type="submit" id="publish-submit">${icon('upload', { size: 16 })} Publish package</button>
            </div>
          </form>

          <aside class="preview-card">
            <div class="preview-label"><span class="dot-live"></span> Live preview</div>
            <div id="preview-host">
              ${packageCard({
                slug: 'preview',
                name: 'your-package',
                summary: 'Your summary will appear here. Write one clear sentence about what the package does and who it is for.',
                version: '0.1.0',
                license: 'Apache-2.0',
                weeklyDownloads: 0,
                tags: ['tag'],
                accent: '#ff7a18',
                author: { name: 'you', handle: 'you', url: '', verified: false },
                official: false
              })}
            </div>
            <div class="preview-readme" id="preview-readme">
              <div class="prose"><p style="color:var(--muted-2)">Your README preview appears here. Empty is fine.</p></div>
            </div>
            <div class="side-card" style="margin-top:14px">
              <h3>What happens on publish</h3>
              <div class="feature-list" style="margin-top:0">
                <li>${icon('check', { size: 13 })} <span>A package page with your metadata</span></li>
                <li>${icon('check', { size: 13 })} <span>A copyable install command</span></li>
                <li>${icon('check', { size: 13 })} <span>Search, tags and version history</span></li>
                <li>${icon('check', { size: 13 })} <span>No build step, no waiting</span></li>
              </div>
            </div>
          </aside>
        </div>
      </div>
    `,
    async after() {
      observeReveal();

      const form = document.getElementById('publish-form');
      if (!form) return;
      const layout = document.querySelector('.publish-layout');
      let auth;
      try {
        auth = JSON.parse(localStorage.getItem('luc.auth') || 'null');
      } catch {
        auth = null;
      }
      let account = null;
      if (auth?.token) {
        try {
          const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${auth.token}` } });
          if (response.ok) account = (await response.json()).user;
        } catch {
          account = null;
        }
      }
      if (!account) {
        layout.innerHTML = `
          <div class="publish-cli">
            <div class="publish-cli-copy">
              <p class="eyebrow"><span class="eyebrow-dot"></span> PUBLISH FROM YOUR TERMINAL</p>
              <h2>Three commands.<br><em>Then it's live.</em></h2>
              <p>Publishing starts in the folder that holds your <code>.luic</code> file. The CLI opens this page with everything filled in — you only add a name and a summary.</p>
              ${uploadId ? `<p class="publish-cli-resume">${icon('upload', { size: 15 })} <span>Your upload is waiting. <a href="#/login?next=${encodeURIComponent(`/publish?upload=${uploadId}`)}">Sign in to finish publishing</a>.</span></p>` : ''}
              <div class="publish-cli-actions">
                <a class="btn btn-primary" href="#/guide#libraries">${icon('book', { size: 16 })} How libraries work</a>
                <a class="btn btn-ghost" href="#/packages">Browse packages ${icon('arrow-right', { size: 15 })}</a>
              </div>
            </div>
            <ol class="publish-cli-steps">
              <li>
                <span class="publish-cli-no">01</span>
                <div><strong>Pack your library</strong><p>Run a script that ends with <code>pack mylib</code> — it writes <code>mylib.luic</code>.</p>${commandBox('luc pack.luc', { label: '' })}</div>
              </li>
              <li>
                <span class="publish-cli-no">02</span>
                <div><strong>Authorize this machine</strong><p>A browser tab confirms it is really you.</p>${commandBox('luc login', { label: '' })}</div>
              </li>
              <li>
                <span class="publish-cli-no">03</span>
                <div><strong>Publish</strong><p>Your package page and install command appear instantly.</p>${commandBox('luc publish -p', { label: '' })}</div>
              </li>
            </ol>
          </div>`;
        return;
      }

      const name = document.getElementById('name');
      const version = document.getElementById('version');
      const summary = document.getElementById('summary');
      const license = document.getElementById('license');
      const repo = document.getElementById('repo');
      const homepage = document.getElementById('homepage');
      const authorName = document.getElementById('authorName');
      const authorUrl = document.getElementById('authorUrl');
      const readme = document.getElementById('readme');
      const dependencies = document.getElementById('dependencies');
      const tagInput = document.getElementById('tag-input');
      const tagEditor = document.getElementById('tag-editor');
      const previewHost = document.getElementById('preview-host');
      const previewReadme = document.getElementById('preview-readme');
      const summaryCount = document.getElementById('summary-count');
      const submit = document.getElementById('publish-submit');
      if (authorName) {
        authorName.value = account.username;
        authorName.readOnly = true;
      }
      const tags = [];
      let previewTimer = null;

      if (uploadId) {
        try {
          const response = await fetch(`/api/auth/cli/uploads/${encodeURIComponent(uploadId)}`, {
            headers: { Authorization: `Bearer ${auth.token}` }
          });
          const upload = await response.json();
          if (!response.ok) throw new Error(upload.error || 'Uploaded package not found.');
          if (name && !name.value) name.value = upload.filename.replace(/\.luic$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
          if (readme && upload.readme) readme.value = upload.readme;
          const artifactNote = document.getElementById('publish-artifact-note');
          if (artifactNote) {
            artifactNote.hidden = false;
            artifactNote.innerHTML = `${icon('package', { size: 16 })}<span><strong>${escapeHtml(upload.filename)}</strong> is attached. Add a name and description, then publish.</span>`;
          }
          renderPreview();
        } catch (error) {
          toast(error.message || 'Could not load the uploaded package.', 'error');
        }
      }

      const clean = (value) => String(value || '').trim();

      function renderPreview() {
        const pkgName = clean(name?.value) || 'your-package';
        const pkg = {
          slug: 'preview',
          name: pkgName.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'your-package',
          summary: clean(summary?.value) || 'Your summary will appear here. Write one clear sentence about what the package does and who it is for.',
          version: clean(version?.value) || '0.1.0',
          license: license?.value || 'Apache-2.0',
          weeklyDownloads: 0,
          tags: tags.length ? tags : ['tag'],
          accent: '#ff7a18',
          author: { name: clean(authorName?.value) || 'you', handle: clean(authorName?.value).toLowerCase().replace(/[^a-z0-9_-]+/g, '') || 'you', url: '', verified: false },
          official: false
        };
        if (previewHost) previewHost.innerHTML = packageCard(pkg);
        if (previewReadme) {
          const text = clean(readme?.value);
          previewReadme.innerHTML = text
            ? `<div class="prose">${renderMarkdown(text)}</div>`
            : '<div class="prose"><p style="color:var(--muted-2)">Your README preview appears here. Empty is fine.</p></div>';
        }
      }

      function schedulePreview() {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(renderPreview, 120);
      }

      function renderTags() {
        if (!tagEditor || !tagInput) return;
        tagEditor.querySelectorAll('.tag-chip').forEach((chip) => chip.remove());
        tags.forEach((tag) => {
          const chip = document.createElement('span');
          chip.className = 'tag-chip';
          chip.innerHTML = `${escapeHtml(tag)}<button type="button" aria-label="Remove ${escapeHtml(tag)}">${icon('x', { size: 10 })}</button>`;
          chip.querySelector('button').addEventListener('click', () => {
            tags.splice(tags.indexOf(tag), 1);
            renderTags();
            renderPreview();
          });
          tagEditor.insertBefore(chip, tagInput);
        });
      }

      function addTag(raw) {
        const value = raw.toLowerCase().replace(/[^a-z0-9._-]+/g, '').slice(0, 24);
        if (value && !tags.includes(value) && tags.length < 6) {
          tags.push(value);
          renderTags();
          renderPreview();
        }
        if (tagInput) tagInput.value = '';
      }

      tagInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ',') {
          event.preventDefault();
          addTag(tagInput.value);
        } else if (event.key === 'Backspace' && !tagInput.value && tags.length) {
          tags.pop();
          renderTags();
          renderPreview();
        }
      });
      tagInput?.addEventListener('blur', () => {
        if (tagInput.value.trim()) addTag(tagInput.value);
      });

      summary?.addEventListener('input', () => {
        if (summaryCount) summaryCount.textContent = String(summary.value.length);
        schedulePreview();
      });

      /* Clear a field's error as soon as the visitor edits it. */
      form.querySelectorAll('input, textarea, select').forEach((input) => {
        const clear = () => input.closest('.field')?.classList.remove('has-error');
        input.addEventListener('input', clear);
        input.addEventListener('change', clear);
      });

      [name, version, license, authorName].forEach((input) => input?.addEventListener('input', schedulePreview));
      license?.addEventListener('change', schedulePreview);
      readme?.addEventListener('input', schedulePreview);

      const clearErrors = () => {
        form.querySelectorAll('.field.has-error').forEach((fieldEl) => fieldEl.classList.remove('has-error'));
      };

      const showErrors = (fields) => {
        Object.entries(fields).forEach(([key, message]) => {
          const wrap = form.querySelector(`[data-field="${key}"]`);
          if (!wrap) return;
          wrap.classList.add('has-error');
          const error = wrap.querySelector('.field-error');
          if (error) error.textContent = message;
        });
        const first = form.querySelector('.field.has-error');
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        first?.querySelector('input, textarea, select')?.focus({ preventScroll: true });
      };

      const clientCheck = () => {
        const errors = {};
        const pkgName = clean(name.value);
        if (!pkgName) errors.name = 'Pick a package name.';
        else if (!/^[a-zA-Z][a-zA-Z0-9-]{1,38}[a-zA-Z0-9]$/.test(pkgName)) errors.name = '3–40 characters: letters, numbers and hyphens, starting with a letter.';
        if (clean(summary.value).length < 12) errors.summary = 'Write at least a sentence (12+ characters).';
        if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(clean(version.value))) errors.version = 'Use semver, for example 0.1.0.';
        if (!clean(authorName.value)) errors.authorName = 'Add your name or handle.';
        const repoValue = clean(repo.value);
        if (repoValue && !/^https?:\/\/.+/i.test(repoValue)) errors.repo = 'Use a full http(s) URL.';
        const homepageValue = clean(homepage.value);
        if (homepageValue && !/^https?:\/\/.+/i.test(homepageValue)) errors.homepage = 'Use a full http(s) URL.';
        return errors;
      };

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearErrors();
        const errors = clientCheck();
        if (Object.keys(errors).length) {
          showErrors(errors);
          return;
        }

        const payload = {
          name: clean(name.value),
          summary: clean(summary.value),
          version: clean(version.value),
          license: license.value,
          repo: clean(repo.value),
          homepage: clean(homepage.value),
          authorName: clean(authorName.value),
          authorUrl: clean(authorUrl.value),
          readme: readme.value,
          tags,
          dependencies: clean(dependencies.value),
          uploadId
        };

        submit.disabled = true;
        const previous = submit.innerHTML;
        submit.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(0,0,0,.25);border-top-color:#1a0d02;border-radius:50%;animation:spin .7s linear infinite"></span> Publishing…`;

        try {
          const res = await fetch('/api/packages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
            body: JSON.stringify(payload)
          });
          const data = await res.json();

          if (!res.ok) {
            if (data.fields) showErrors(data.fields);
            toast(data.error || 'Could not publish the package.', 'error');
            submit.disabled = false;
            submit.innerHTML = previous;
            return;
          }

          const pkg = data.package;
          const command = installCommand(pkg);
          const app = document.getElementById('app');
          app.innerHTML = `
            <section class="section">
              <div class="container">
                <div class="publish-success">
                  <span class="success-mark">${icon('check', { size: 28 })}</span>
                  <h1>${escapeHtml(pkg.name)} is live.</h1>
                  <p>Version ${escapeHtml(pkg.version)} is on the registry. Copy the install line or open the package page.</p>
                  <div class="commandbox">
                    <div class="commandbox-label">Install from this page</div>
                    <div class="commandbox-row">
                      <span class="commandbox-prompt">$</span>
                      <code>${escapeHtml(command)}</code>
                      <button class="copy-btn copy-btn-ghost" type="button" data-copy data-copy-text="${escapeHtml(command)}" data-install="${escapeHtml(pkg.slug)}">${icon('copy', { size: 14 })}<span>Copy</span></button>
                    </div>
                  </div>
                  <div class="success-actions">
                    <a class="btn btn-primary" href="#/packages/${encodeURIComponent(pkg.slug)}">View package</a>
                    <a class="btn btn-ghost" href="#/publish">Publish another</a>
                    <a class="btn btn-ghost" href="#/packages">Browse registry</a>
                  </div>
                  <p style="margin-top:22px;font-size:11.5px;color:var(--muted-2)">Saved to this site's registry. You can share the package URL — the install command pulls the metadata from this page.</p>
                </div>
              </div>
            </section>`;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          toast(`${pkg.name}@${pkg.version} published.`);
          observeReveal();
        } catch {
          toast('Could not reach the registry. Try again in a moment.', 'error');
          submit.disabled = false;
          submit.innerHTML = previous;
        }
      });

      renderPreview();
    }
  };
}
