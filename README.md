# The Timeline.

**[Live demo →](https://udbhav-shrinet.github.io/timeline/)**

Search any topic, watch today's coverage get clustered into distinct stories, then click one to trace it back through the history that actually led to it — as a scannable list or as a draggable bubble graph of connected events.

![search → cluster → trace](https://img.shields.io/badge/search-cluster-blue?style=flat-square) ![no build step](https://img.shields.io/badge/build-none%20required-brightgreen?style=flat-square) ![license](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)

## What it does

1. **Search** — type any topic (or leave it blank for what's trending globally right now).
2. **Feed** — live headlines are pulled from Google News and grouped into 6–12 broad story clusters.
3. **Timeline** — pick a cluster and it's expanded into a chronological trace of the events behind it, newest first, each with its source and a link to read more.
4. **Bubbles** — toggle to a force-directed graph where events are connected chronologically *and* by shared keywords, so you can drag nodes around and see how stories relate.

It's a single static `index.html` file: no build step, no server, no database.

## Running it

Just open `index.html` in a browser, or serve the folder with anything static:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## AI enrichment (optional)

Out of the box, clustering and history-tracing run entirely on built-in JavaScript heuristics — the app is fully functional with zero setup and zero API keys.

Click the **gear icon** in the header to add your own free [OpenRouter](https://openrouter.ai/keys) API key for AI-written cluster summaries and deeper historical context. The key is saved only in your browser's `localStorage` and is sent only to `openrouter.ai` — it never touches any server of this project.

> **If you're picking up this repo from an earlier commit:** older versions of this project had an API key hardcoded in `app.jsx` / `index.htmml`. Those files have been removed and the app no longer ships with any embedded key. If that key is yours, treat it as compromised and revoke it at [openrouter.ai/keys](https://openrouter.ai/keys) — anything committed to a public repo's history should be considered public.

## How it fetches news without a backend

Google News RSS doesn't send CORS headers, so the app calls it through a chain of public read-only proxies, each with a short timeout, falling back to the next on failure:

1. [`rss2json.com`](https://rss2json.com) (fastest — returns JSON directly)
2. [`allorigins.win`](https://allorigins.win) (raw XML proxy)
3. [`corsproxy.io`](https://corsproxy.io) (raw XML proxy)
4. A small built-in sample feed, so the UI never dead-ends even if every proxy above is down

Images are pulled from [picsum.photos](https://picsum.photos) using the topic headline as a seed.

## Tech

- React 18 + Babel Standalone, loaded from a CDN and compiled in the browser — no npm install, no bundler
- Tailwind CSS (play CDN) for styling, Font Awesome for icons
- A hand-rolled force-directed layout (spring attraction + node repulsion) powers the bubble graph — no charting library

## Project structure

```
index.html   the entire app: markup, styles, and React components in one file
```

## Deploying your own copy

Any static host works — there's no build step. This repo ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that publishes `index.html` to GitHub Pages automatically on every push to `main`. Fork it and Pages will pick it up the first time the workflow runs.

## License

MIT
