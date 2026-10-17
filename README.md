# Duolign Admin

Standalone admin dashboard for Duolign, deployed at
[admin.duolign.co.uk](https://admin.duolign.co.uk) via GitHub Pages.
Calls the same Railway-hosted API the consumer app
([Couple_finance_app](https://github.com/jeffnet-ltd/Couple_finance_app))
uses, but has its own completely separate login — a dedicated
email+password admin account (`server/admin_auth_service.py` in the
main repo), domain-restricted to `@duolign.co.uk`, nothing to do with
the consumer app's Supabase household auth. There is no path from the
consumer app into this dashboard; it's reachable only by visiting this
site directly and signing in with an admin account.

## Develop

```
npm install
npm run dev
```

Needs `VITE_API_BASE_URL` set (see `.env.production` for the real
backend URL used in the deployed build) to actually reach the API —
without it, requests go to a bare `/api` path with nothing to serve it.

## Deploy

Push to `main` — `.github/workflows/deploy.yml` builds and publishes to
GitHub Pages automatically. No manual build step.

## Custom domain

- `public/CNAME` contains `admin.duolign.co.uk` — this is what tells
  GitHub Pages which custom domain to serve (copied into `dist/` on
  every build, read from the published artifact since this repo
  deploys via GitHub Actions rather than Pages' "deploy from a
  branch" mode).
- DNS: a `CNAME` record for `admin.duolign.co.uk` pointing at
  `jeffnet-ltd.github.io` (added at whichever registrar/DNS provider
  manages `duolign.co.uk` — same provider `duolign-web`'s own `www`
  subdomain uses).
- Once DNS resolves: Settings → Pages → Enforce HTTPS (GitHub
  auto-provisions the certificate).

## Updating the admin dashboard itself

The dashboard components (`src/pages/Admin.jsx`,
`src/context/AdminContext.jsx`, `src/components/AdminMetricChart.jsx`,
`src/components/Loading.jsx`, `src/components/Spinner.jsx`,
`src/components/StatusDot.jsx`) and the trimmed `src/api.js` were
ported from the consumer app's `frontend/src/` — if the admin dashboard
changes there in the future (a new section, a new admin API route), the
matching files need porting over here too; this repo doesn't share code
with that one directly.
