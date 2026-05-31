# Kriminalvarden Concept Site

Standalone rebuild of the `Kriminalvarden` page that originally lived inside an older multi-page school portfolio.

This repo gives the concept its own home:

- a modern static front page built with Astro
- a preserved legacy version under `/legacy/`
- a GitHub Pages deployment flow

## Legacy route

The original page is kept available here:

- `/legacy/html/kriminalvarden.html`

To avoid broken navigation after the split, small legacy companion pages are included for `info`, `contact`, and `index`.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

GitHub Pages deploy is configured in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
