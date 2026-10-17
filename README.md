# Duolign Admin

Internal admin dashboard, deployed at
[admin.duolign.co.uk](https://admin.duolign.co.uk) via GitHub Pages.
Private tool — not part of the consumer product.

## Develop

```
npm install
npm run dev
```

Requires `VITE_API_BASE_URL` to be set to reach the live API.

## Deploy

Push to `main` — the GitHub Actions workflow builds and publishes to
GitHub Pages automatically.
