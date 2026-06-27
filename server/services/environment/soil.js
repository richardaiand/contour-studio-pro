import { AppError } from '../../errors.js';

export async function fetchSoilData(lat, lon) {
  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=clay&property=sand&property=silt&property=bdod&property=soc&depth=0-5cm&depth=5-15cm&depth=15-30cm&depth=30-60cm&depth=60-100cm&depth=100-200cm`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new AppError(`SoilGrids API error ${res.status}`, 502, 'SOIL_ERROR');
  }

  const data = await res.json();

  const props = {};
  if (data.properties?.layers) {
    for (const layer of data.properties.layers) {
      const name = layer.name;
      let sum = 0;
      let count = 0;
      for (const depth of layer.depths) {
        if (depth.values?.mean !== undefined && depth.values.mean !== null) {
          sum += depth.values.mean;
          count++;
        }
      }
      props[name] = count > 0 ? sum / count : null;
    }
  }

  const clayPercent = props.clay ? Math.round((props.clay / 10) * 10) / 10 : null;
  const sandPercent = props.sand ? Math.round((props.sand / 10) * 10) / 10 : null;
  const siltPercent = props.silt ? Math.round((props.silt / 10) * 10) / 10 : null;
  const bulkDensity = props.bdod ? Math.round(props.bdod / 10) / 100 : null;
  const organicCarbon = props.soc ? Math.round((props.soc / 100) * 10) / 10 : null;

  const soilType = (clayPercent !== null && sandPercent !== null)
    ? classifySoil(clayPercent, sandPercent)
    : 'Unknown';

  return {
    soilType,
    clayPercent,
    sandPercent,
    siltPercent,
    bulkDensity,
    organicCarbon,
  };
}

export function classifySoil(clayPercent, sandPercent) {
  const siltPercent = 100 - clayPercent - sandPercent;

  if (sandPercent >= 85) return 'Sand';
  if (sandPercent >= 70 && clayPercent < 15) return 'Loamy Sand';
  if (sandPercent >= 43 && clayPercent < 10) return 'Loamy Sand';
  if (clayPercent >= 40 && sandPercent >= 45) return 'Sandy Clay';
  if (clayPercent >= 40 && siltPercent >= 40) return 'Silty Clay';
  if (clayPercent >= 40) return 'Clay';
  if (clayPercent >= 27 && sandPercent >= 20 && sandPercent <= 45) return 'Clay Loam';
  if (clayPercent >= 20 && sandPercent > 45) return 'Sandy Clay Loam';
  if (clayPercent >= 27 && siltPercent > 40) return 'Silty Clay Loam';
  if (clayPercent >= 7 && sandPercent <= 52 && siltPercent >= 28) return 'Loam';
  if (siltPercent >= 50 && clayPercent >= 12) return 'Silt Loam';
  if (siltPercent >= 80) return 'Silt';
  if (clayPercent < 10 && sandPercent >= 43 && sandPercent < 85) return 'Loamy Sand';
  return 'Loam';
}
