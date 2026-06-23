# Contour Studio

AI-powered 3D terrain visualization from addresses, DEM databases, and topographic maps.

## What It Does

- Search for a location by address.
- Fetch elevation data from free sources (USGS 3DEP, OpenTopography, Open-Meteo fallback).
- Generate an interactive 3D terrain mesh in the browser.
- Export to OBJ or STL.
- Upload topographic maps for AI-assisted contour extraction (hybrid CV + vision LLM).
- Save projects with server-side accounts.

## Tech Stack

- **Backend:** Fastify (Node.js)
- **Database:** SQLite via `better-sqlite3` (Postgres-ready)
- **Auth:** Argon2id password hashing + JWT sessions
- **Map:** MapLibre GL JS with OpenStreetMap / OpenFreeMap tiles
- **3D:** Three.js
- **Frontend:** Vanilla JS + centralized store

## Quick Start

1. Clone the repo.
2. Copy `.env.example` to `.env` and fill in secrets:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run migrations:
   ```bash
   npm run migrate
   ```
5. Start dev server:
   ```bash
   npm run dev
   ```

The Vite dev server runs on port 5173 and proxies API calls to the Fastify backend on port 3000.

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `JWT_SECRET` | Yes | Long random string |
| `COOKIE_SECRET` | Yes | Long random string |
| `ENCRYPTION_KEY` | Yes | 64-char hex string (32 bytes) |
| `DATABASE_URL` | Yes | SQLite path or Postgres URL |
| `OPEN_TOPOGRAPHY_API_KEY` | No | Free from portal.opentopography.org |
| `AIAND_API_KEY` | No | Required for uploaded-map AI analysis |
| `OPENAI_API_KEY` | No | Optional vision provider |

## Detail Levels

| Level | Database Source | Upload Analysis |
|-------|----------------|-----------------|
| **Draft** | 30 m global DEM | Fast CV only |
| **Standard** | 10 m DEM where available | CV + legend vision |
| **Survey** | 1–3 m lidar / cross-reference | Full vision + OCR |

## Deployment

This app is configured for build.io / Render-style platforms:

- `Procfile`: `web: npm start`
- `package.json` engines: Node 20.x
- `DATABASE_URL` can point to a Postgres addon when you leave trial.
- Set `NODE_ENV=production` and fill all secrets.

## Roadmap

- [ ] Full GeoTIFF raster parsing with geotiff.js
- [ ] USGS WCS raster download
- [ ] Async job queue for long uploads
- [ ] AI contour extraction pipeline
- [ ] Local topographic map catalog direct downloads
- [ ] Heightmap PNG export with proper encoding
- [ ] GLB export
- [ ] Scene enhancement (trees, water, buildings)
