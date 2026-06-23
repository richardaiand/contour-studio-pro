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
