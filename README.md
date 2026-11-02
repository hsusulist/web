# LUC website

The official site for LUC: a fast, lightweight scripting language. It ships as a
zero-dependency Node service — a static front end plus a small registry API that
publishes and serves community packages.

## Run it

Requires Node 18 or newer. There is nothing to install.

```sh
cd website
node server.js
```

Open <http://localhost:3000>. Set `PORT` or `HOST` if you need to bind
differently (the default is `0.0.0.0:3000`, so it also works in a container or
preview sandbox).

## Pages

| Route | What it is |
| --- | --- |
| `#/` | Home: language pitch, a live-looking example, built-ins, registry preview |
| `#/about` | The landing page, also reachable from the About nav link (same content as `#/`) |
| `#/download` | Windows installer, portable zip, npm, PowerShell script, command builder, checksums, Linux build, editor setup |
| `#/guide` | 15-chapter beginner guide with a sticky table of contents and scroll progress |
| `#/community` | Repo, discussions, issues, demo gallery, contributing flow, roadmap |
| `#/packages` | Searchable registry with tag filters and sorting |
| `#/packages/:slug` | Package page: metadata, README, install line, weekly downloads, checksums, versions |
| `#/publish` | Live-preview publishing form with validation |
| `#/login`, `#/register` | Sign in / create an account |
| `#/settings` | Account settings: profile, PNG avatar with crop tool, email, password, delete account |

When signed in, the header's **Get Started** button is replaced by the user's
avatar (uploaded picture, or initials). Clicking it opens `#/settings`.

Everything is a hash route, so the site works from any static file server too.

## The registry

The six official packages are seeded from `data/seed.js` on first boot and stored in
`data/packages.json` (generated, git-ignored). Delete that file to reseed.

Each package carries a name, summary, version, license, repo/homepage, author,
tags, dependencies, size, weekly/total downloads, version history, an optional
README (Markdown is rendered on the package page), and the install command:

```
luc install -p @<username>/<package>
```

The page exposes that command with a copy button. The CLI downloads the `.luic`
artifact and records installs in the registry.

Create an account on `#/register`, then use `luc login` to authorize the current
terminal in a browser. `luc whoami` reports the account. To publish, run
`luc publish -p` in a folder containing one `.luic` file and an optional
`README.md`; the browser asks for the package name and summary. Google sign-in
can be enabled with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. For local
testing, the CLI uses `http://localhost:3000`; set `LUC_REGISTRY_URL` to override.
For Google OAuth, register `http://localhost:3000/api/auth/google/callback` as
an authorized redirect URI and set both variables before starting the server.

### API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/packages?q=&tag=&sort=downloads\|recent\|new\|name` | List/search packages |
| `GET` | `/api/packages/:slug` | One package |
| `POST` | `/api/packages` | Authenticated publish; returns `201`, or `422 { fields: { field: message } }` |
| `GET` | `/api/packages/:slug/install` | Install metadata |
| `POST` | `/api/packages/:slug/install` | Record an install copy, returns updated counts |
| `GET` | `/api/packages/:slug/file` | Download package `.luic` artifact |
| `GET` | `/api/stats` | Registry totals |
| `GET` | `/api/licenses` | Accepted license ids |
| `GET` | `/api/account` | Signed-in profile |
| `PATCH` | `/api/account` | Update `displayName`, `username`, `bio`, `location`, `website`, `email` (`422 { fields }` on errors) |
| `POST` | `/api/account/avatar` | Upload avatar — body is raw `image/png`, ≤ 2 MB, ≤ 1024×1024 (PNG signature is verified) |
| `DELETE` | `/api/account/avatar` | Remove avatar |
| `POST` | `/api/account/password` | `{ currentPassword, newPassword }` — signs out other sessions |
| `DELETE` | `/api/account` | `{ confirm: "<username>" }` — delete the account |
| `GET` | `/api/avatars/:username` | Public avatar PNG |

Avatars are PNG only. In the browser, a PNG that is non-square or bigger than
512 px opens a crop dialog (drag, scroll/slider zoom, arrow keys) and is
exported at 512×512 before upload. Sessions are stored in
`data/sessions.json`, so sign-ins survive a server restart.

The local demo registry supports username/password accounts and optional Google
OAuth. Package metadata is validated (`name`, semver, summary length, URL
scheme, tags, license, README size) and JSON data is written atomically.

## Structure

```
website/
├── server.js              # static file server + registry API
├── data/seed.js           # six official packages
├── data/packages.json     # generated registry state (git-ignored)
├── data/users.json        # generated account hashes (git-ignored)
├── data/artifacts/        # uploaded .luic files (git-ignored)
├── data/avatars/          # user avatar PNGs (git-ignored)
├── data/sessions.json     # active sign-in sessions (git-ignored)
└── public/
    ├── index.html         # shell, header, boot screen, footer
    ├── css/styles.css     # design system, components, responsive rules, light/dark themes
    ├── css/home-refresh.css # landing layout, shared chrome and cream/dark palette
    ├── css/pages-refresh.css # landing-style layer for download, guide, community, packages, publish
    ├── css/auth.css       # login / register
    ├── css/account.css    # header avatar, settings page, crop modal
    ├── css/registry.css   # packages page (Popular / Discover / By the numbers + list)
    ├── js/app.js          # hash router + page lifecycle
    ├── js/lib/session.js  # signed-in state, header avatar, authFetch
    ├── js/pages/settings.js # settings page + avatar crop tool
    ├── js/lib/            # icons, syntax highlighting, Markdown, shared UI (copy, toast, reveal)
    ├── js/pages/          # one module per page (home-refresh.js is the landing page)
    └── assets/            # logo, social card, self-hosted woff2 fonts
```

The front end is vanilla ES modules — no framework, no bundler, no runtime
dependencies. Fonts are self-hosted (`Sora`, `Inter`, `JetBrains Mono`, SIL Open
Font License 1.1 — see `public/assets/fonts/OFL.txt`), so the site makes no
third-party requests.

The landing page is a self-contained refresh. `home-refresh.css` is scoped to
`body.site-refresh`, which the router adds on every route, so the header, footer
and palette stay consistent across the site. `pages-refresh.css` applies the
same editorial system to the inner pages: cream paper, square edges, mono
micro-labels, orange display accents and dark code/CTA bands. Both stylesheets
support the cream default and the dark theme. The landing content is rendered by
both `#/` and `#/about`; the other routes share the same copy handlers and
package cards as the landing page.

## Publishing a package

Open `#/publish`, fill in a name, version, summary and your name (everything else
is optional, including the README), and submit. The package gets a page at
`#/packages/<slug>` and appears in the registry immediately. The live preview on
the right updates as you type.
