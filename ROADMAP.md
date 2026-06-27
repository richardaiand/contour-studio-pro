# Contour Studio Pro — Development Roadmap

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

## V2 — Site Intelligence (DONE)

### 2.1 Utility Line Overlays
- DataSF sewer/water main GIS data via Socrata API
- ArcGIS/Socrata REST API client with fallback to sample data
- Render pipe locations as low-poly cylinders on the 3D model
- Toggle buttons for sewer/water in studio sidebar
- Files: `server/routes/utilities.js`, `server/services/utilities/arcgis.js`, `server/services/utilities/sources.js`
- Client: `client/src/modules/utilities.js`

### 2.2 3D Pipe/Fitting Library
- Generate pipe mesh data (straight, elbow, junction, valve)
- Cylinder geometry with proper normals and UVs
- Color-coded by utility type
- Files: `server/services/terrain/fittings.js`

### 2.3 AI Map Legend Understanding
- Enhanced vision prompt extracts: legend symbols, scale ratio, contour interval, north arrow, datum, CRS, title, publisher, edition
- Returns structured JSON
- Toggle between basic and full legend analysis on map upload
- Files: `server/services/ai/legend-analyzer.js`, `server/routes/maps.js`

### 2.4 Geometry Cleanup
- Remove degenerate triangles (zero-area cross product check)
- Merge duplicate vertices (spatial hash, 3-decimal precision)
- Recompute normals after cleanup
- Wired into worker after gridToMesh
- Files: `server/services/terrain/cleanup.js`

---

## V3 — Environmental Context + Design Tools (DONE)

### 3.1 AI Environmental Site Report
- Open-Meteo Archive API: 10-year climate averages (temp, precip, snow, climate zone)
- Open-Meteo Forecast API: current weather conditions
- USGS Earthquake API: 25-year seismic history, risk classification (low to very high)
- ISRIC SoilGrids API: soil composition, USDA texture classification
- Promise.allSettled for parallel fetching with graceful degradation
- AI-generated summary combining all data sources
- Client panel with climate stats, seismic risk badge, soil composition
- Files: `server/routes/environment.js`, `server/services/environment/climate.js`, `seismic.js`, `soil.js`
- Client: `client/src/modules/environment.js`

### 3.2 Tree/Rock Placement
- Click on terrain to place 3D objects
- Low-poly library: tree (trunk + 3-layer cones), rock (distorted icosahedron), building (box + roof)
- Scale to real-world sizes (tree 8m, rock 2m, building 6m)
- Raycaster-based terrain intersection
- Object palette in studio sidebar with active state
- Clear all button
- Files: `client/src/modules/placement.js`, `client/src/modules/objects/library.js`

### 3.3 To-Scale People Models
- Low-poly person: body capsule, legs, head, arms (1.75m default)
- Eye height stored for walk mode spawn
- Same placement system as trees/rocks
- Files: `client/src/modules/objects/library.js`

### 3.4 Geometry Fixes
- Degenerate triangle removal and vertex welding implemented in V2.4
- Normal recomputation after cleanup
- Mesh test updated for solid block vertex count

---

## V4 — Immersive Walkthrough (DONE)

### 4.1 Drop a Person Model
- Person model placed via object palette
- Used as scale reference and spawn point

### 4.2 First-Person View
- PointerLockControls for mouse look
- WASD + arrow keys movement (8 m/s)
- Real-time exploration on studio canvas
- Walk HUD overlay with controls hint
- Files: `client/src/modules/walk-mode.js`

### 4.3 Walk Around the Site
- Terrain collision via down-raycasting (height-based)
- Camera follows terrain surface at eye level (1.65m)
- Esc key or "Back to Studio" button exits
- OrbitControls restored on exit
- Files: `client/src/modules/walk-mode.js`

---

## Additional Features (DONE)

### Customizable Rectangle
- Separate W × H area inputs (areaValue + areaValue2)
- rotatedSquare supports non-square dimensions
- Store tracks sizeMeters and sizeMeters2
- Updated formatSizeLabel, unit limits, area inputs

### Security
- Removed /api/debug endpoint
- All new routes require authentication
- Environment route uses Promise.allSettled for graceful degradation

---

## Multi-Page Router (Infrastructure)

### Pages
1. **Login** — sign in / create account
2. **Dashboard** — project list
3. **Map** — area selection, address search, map upload
4. **Studio** — full-screen 3D model, placement tools, environmental report, utilities, walk mode
5. **Walk** — first-person full-screen exploration (uses studio canvas with HUD overlay)

### Navigation Flow
```
Login → [Map page] → Generate → [Studio page] → Enter Walk → [Walk HUD overlay]
                ← Back                          ← Back to Studio
```

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
