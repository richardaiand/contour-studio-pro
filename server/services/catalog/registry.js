import { getDb, generateId } from '../../db.js';
import { now } from '../../utils/index.js';
import { seedSources } from './sources.js';

export function seedCatalog() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM map_sources').get().c;
  if (count > 0) return;

  const stmt = db.prepare(
    `INSERT INTO map_sources (id, country_code, region, agency, source_type, base_url, coverage_json, min_scale, max_scale, formats_json, license, access_notes, is_direct_download, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const source of seedSources) {
    stmt.run(
      source.id,
      source.countryCode,
      source.region,
      source.agency,
      source.sourceType,
      source.baseUrl,
      JSON.stringify(source.coverage),
      source.minScale,
      source.maxScale,
      JSON.stringify(source.formats),
      source.license,
      source.accessNotes,
      source.isDirectDownload ? 1 : 0,
      source.isActive ? 1 : 0,
      now()
    );
  }

  console.log(`Seeded ${seedSources.length} map sources.`);
}

export function findSourcesForBounds(bounds) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM map_sources WHERE is_active = 1').all();

  return rows
    .map((row) => ({
      id: row.id,
      countryCode: row.countryCode,
      region: row.region,
      agency: row.agency,
      sourceType: row.source_type,
      baseUrl: row.base_url,
      coverage: JSON.parse(row.coverage_json),
      minScale: row.min_scale,
      maxScale: row.max_scale,
      formats: JSON.parse(row.formats_json),
      license: row.license,
      accessNotes: row.access_notes,
      isDirectDownload: Boolean(row.is_direct_download),
    }))
    .filter((source) => intersectsBounds(source.coverage, bounds))
    .sort((a, b) => (a.minScale || Infinity) - (b.minScale || Infinity));
}

function intersectsBounds(a, b) {
  return (
    a.minLat < b.maxLat &&
    a.maxLat > b.minLat &&
    a.minLon < b.maxLon &&
    a.maxLon > b.minLon
  );
}
