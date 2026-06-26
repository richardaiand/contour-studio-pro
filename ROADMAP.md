# Contour Studio — Development Roadmap

## Demo Location: San Francisco
- Iconic hills, immediately recognizable
- USGS 1m lidar available (Survey detail)
- DataSF has public sewer/water GIS data via ArcGIS REST API
- Dramatic elevation range (sea level to ~280m)

---

## V1 — Core Engine (DONE)
- Address search + autocomplete (Photon/Nominatim/OpenCage)
- Map area selector with rotation, units, draggable box
- 3D terrain generation from real DEM data (OpenTopography + Open-Meteo)
- OBJ/STL/Heightmap exports
- Project management with SQLite
- AI map upload analysis
- Settings with AIand model dropdown
- Solid block mesh with walls and flat bottom

---

## V2 — Site Intelligence

### 2.1 Utility Line Overlays
- Integrate San Francisco DataSF sewer main GIS data via ArcGIS REST API
- Render pipe locations as low-poly cylinders on the 3D model
- Proof of concept for one city; business plan mentions municipal GIS partnerships
- Files: `server/routes/utilities.js`, `server/services/utilities/arcgis.js`, `server/services/utilities/sources.js`
- Client: `client/src/modules/utilities.js`

### 2.2 3D Pipe/Fitting Library
- Simple cylinders, elbows, junctions
- Show pipe routing in 3D
- Files: `server/services/terrain/fittings.js`, `client/src/modules/pipe-library.js`

### 2.3 AI Map Legend Understanding
- Improve vision prompt to extract: legend symbols, scale bar ratio, contour interval, north arrow, datum
- Return structured data
- Files: `server/services/ai/legend-analyzer.js`

### 2.4 Geometry Cleanup
- Review mesh generation for clean vertices, normals, indices
- Remove degenerate triangles
- Files: `server/services/terrain/cleanup.js`

---

## V3 — Environmental Context + Design Tools

### 3.1 AI Environmental Site Report
- Open-Meteo API for climate/precipitation averages
- USGS Earthquake API for seismic risk
- ISRIC SoilGrids for soil types
- AI summarizes into a site report panel
- Files: `server/routes/environment.js`, `server/services/environment/*.js`
- Client: `client/src/modules/environment.js`

### 3.2 Tree/Rock Placement
- Click on terrain to place objects
- Small low-poly library: tree, rock, building footprint
- Scale to real-world sizes
- Files: `client/src/modules/placement.js`, `client/src/modules/object-library.js`

### 3.3 To-Scale People Models
- Place human figures for scale reference
- Simple capsule or low-poly human model
- Files: `client/src/modules/people.js`

### 3.4 Geometry Fixes
- Any remaining mesh issues from testing

---

## V4 — Immersive Walkthrough

### 4.1 Drop a Person Model
- Like Google Maps pegman
- Click on terrain to drop a person
- Files: `client/src/modules/walk-mode.js`

### 4.2 First-Person View
- PointerLockControls for mouse look
- WASD movement
- Real-time exploration
- Files: `client/src/modules/first-person.js`

### 4.3 Walk Around the Site
- Collision with terrain (height-based)
- Esc to exit back to orbit view

---

## Multi-Page Router (Infrastructure)

### Pages
1. **Login** — sign in / create account
2. **Map** — area selection, project list, address search
3. **Studio** — full-screen 3D model, placement tools, projects sidebar
4. **Walk** — first-person full-screen exploration

### Navigation Flow
```
Login → [Map page] → Generate → [Studio page] → Drop person → [Walk page]
                ← Back                          ← Back
```

### Session Handling
- Page loads → check session → signed in? → map page
- Page loads → check session → not signed in? → login page
- Sign in → redirect to map page
- Logout → back to login page
- Returning users skip login

### Files
- `client/src/router.js` — simple view switcher
- `client/src/views/login.js`
- `client/src/views/map.js`
- `client/src/views/studio.js`
- `client/src/views/walk.js`

---

## Monday Demo Flow
1. Search "Lombard Street, San Francisco" → generate terrain (Survey detail)
2. Show the environmental AI report (climate, seismic, soil)
3. Upload a topo map → AI reads the legend and scale
4. Show utility line overlay (sewer mains as cylinders)
5. Place some trees/rocks on the terrain
6. Drop into first-person and walk around the hills
7. Export to OBJ/STL
8. Mention V2 utility partnerships as business model

---

## Build Priority Before Monday
1. ~~Fix remaining bugs~~ (done)
2. Environmental AI report (V3) — high impact, pure API integration
3. AI legend understanding (V2) — quick prompt change
4. Utility overlay demo (V2) — San Francisco sewer data as cylinders
5. Tree/rock placement (V3) — 3D interactivity
6. First-person walk (V4) — wow factor
7. Geometry cleanup — review pass
