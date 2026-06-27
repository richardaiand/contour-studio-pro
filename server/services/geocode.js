import { config } from '../config.js';
import { AppError } from '../errors.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export async function geocodeAddress(address) {
  if (!address || typeof address !== 'string') {
    throw new AppError('Address is required', 400, 'BAD_REQUEST');
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', address.trim());
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url, {
    headers: {
      'User-Agent': config.geocoding.userAgent,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new AppError(`Geocoding service error: ${res.status}`, 502, 'GEOCODE_ERROR');
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new AppError('Address not found', 404, 'NOT_FOUND');
  }

  const result = data[0];
  return {
    lat: parseFloat(result.lat),
    lon: parseFloat(result.lon),
    displayName: result.display_name,
    boundingBox: result.boundingbox?.map(Number) || null,
    address: result.address || null,
  };
}

export async function autocompleteAddress(query) {
  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    return [];
  }

  const q = query.trim();

  // Prefer OpenCage if an API key is configured; it handles house numbers well.
  if (config.geocoding.openCageKey) {
    return await autocompleteOpenCage(q);
  }

  return await autocompleteNominatim(q);
}

async function autocompleteOpenCage(query) {
  const url = new URL('https://api.opencagedata.com/geocode/v1/json');
  url.searchParams.set('q', query);
  url.searchParams.set('key', config.geocoding.openCageKey);
  url.searchParams.set('limit', '5');
  url.searchParams.set('autocomplete', '1');
  url.searchParams.set('no_annotations', '1');

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new AppError(`Geocoding service error: ${res.status}`, 502, 'GEOCODE_ERROR');
  }

  const data = await res.json();
  return (data.results || []).map((r) => ({
    name: r.formatted,
    lat: r.geometry.lat,
    lon: r.geometry.lng,
    bbox: r.bounds
      ? [r.bounds.southwest.lng, r.bounds.southwest.lat, r.bounds.northeast.lng, r.bounds.northeast.lat]
      : null,
  }));
}

async function autocompleteNominatim(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url, {
    headers: {
      'User-Agent': config.geocoding.userAgent,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new AppError(`Geocoding service error: ${res.status}`, 502, 'GEOCODE_ERROR');
  }

  const data = await res.json();
  return data.map((r) => ({
    name: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    bbox: r.boundingbox
      ? [Number(r.boundingbox[2]), Number(r.boundingbox[0]), Number(r.boundingbox[3]), Number(r.boundingbox[1])]
      : null,
  }));
}

export async function reverseGeocode(lat, lon) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url, {
    headers: {
      'User-Agent': config.geocoding.userAgent,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new AppError(`Reverse geocoding error: ${res.status}`, 502, 'GEOCODE_ERROR');
  }

  const data = await res.json();
  if (!data || data.error) {
    throw new AppError('Location not found', 404, 'NOT_FOUND');
  }

  return {
    lat: parseFloat(data.lat),
    lon: parseFloat(data.lon),
    displayName: data.display_name,
    address: data.address || null,
  };
}

export function computeBounds(center, sizeMeters = 1000) {
  // Rough conversion: 1 degree lat ≈ 111,320 m
  // lon degrees vary by latitude
  const latDelta = sizeMeters / 111320;
  const lonDelta = sizeMeters / (111320 * Math.cos((center.lat * Math.PI) / 180));

  return {
    minLon: center.lon - lonDelta / 2,
    maxLon: center.lon + lonDelta / 2,
    minLat: center.lat - latDelta / 2,
    maxLat: center.lat + latDelta / 2,
  };
}
