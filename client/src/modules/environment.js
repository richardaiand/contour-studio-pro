import { $, api } from '../utils.js';
import { store, setStatus } from '../store/index.js';

export function initEnvironment() {
  // Button wiring is handled in main.js
}

export async function loadEnvironmentalReport(lat, lon) {
  const reportEl = $('envReport');
  if (!reportEl) return;

  reportEl.innerHTML = '<div class="hint">Fetching climate, seismic, and soil data…</div>';

  try {
    const data = await api(`/environment?lat=${lat}&lon=${lon}`);
    renderReport(data, reportEl);
    store.set({ environmentReport: data });
  } catch (e) {
    reportEl.innerHTML = `<div class="error-text">${e.message}</div>`;
    setStatus('Environmental report failed: ' + e.message, 'error');
  }
}

function renderReport(data, el) {
  const sections = [];

  if (data.weather) {
    sections.push(`
      <div class="env-section">
        <h4>Current Weather</h4>
        <div class="env-stats">
          <span><b>${data.weather.temperatureC}°C</b> temperature</span>
          <span><b>${data.weather.humidity}%</b> humidity</span>
          <span><b>${data.weather.windSpeedKmh} km/h</b> wind</span>
        </div>
      </div>
    `);
  }

  if (data.climate) {
    sections.push(`
      <div class="env-section">
        <h4>Climate (${data.climate.period})</h4>
        <div class="env-stats">
          <span><b>${data.climate.avgTempC}°C</b> avg temp</span>
          <span><b>${data.climate.minTempC}°C</b> – <b>${data.climate.maxTempC}°C</b> range</span>
          <span><b>${data.climate.avgPrecipMm}mm</b> avg daily precip</span>
          <span><b>${data.climate.avgSnowCm}cm</b> avg snow</span>
        </div>
        <div class="env-zone">${data.climate.climateZone}</div>
      </div>
    `);
  }

  if (data.seismic) {
    const riskClass = data.seismic.riskLevel.replace(/\s+/g, '-');
    sections.push(`
      <div class="env-section">
        <h4>Seismic Risk</h4>
        <div class="env-stats">
          <span><b>${data.seismic.maxMagnitude}</b> max magnitude (25yr)</span>
          <span><b>${data.seismic.earthquakeCount}</b> earthquakes (M≥2.5)</span>
          <span><b>${data.seismic.radiusKm}km</b> radius</span>
        </div>
        <div class="risk-badge risk-${riskClass}">${data.seismic.riskLevel.toUpperCase()}</div>
        ${data.seismic.recentEvents && data.seismic.recentEvents.length > 0 ? `
          <details class="env-details">
            <summary>Recent notable events</summary>
            <ul class="quake-list">
              ${data.seismic.recentEvents.slice(0, 5).map((e) => `
                <li><b>M${e.magnitude}</b> — ${e.place}</li>
              `).join('')}
            </ul>
          </details>
        ` : ''}
      </div>
    `);
  }

  if (data.soil) {
    sections.push(`
      <div class="env-section">
        <h4>Soil</h4>
        <div class="env-stats">
          <span><b>${data.soil.soilType}</b></span>
          ${data.soil.clayPercent !== null ? `<span><b>${data.soil.clayPercent}%</b> clay</span>` : ''}
          ${data.soil.sandPercent !== null ? `<span><b>${data.soil.sandPercent}%</b> sand</span>` : ''}
          ${data.soil.organicCarbon !== null ? `<span><b>${data.soil.organicCarbon}g/kg</b> organic C</span>` : ''}
        </div>
      </div>
    `);
  }

  if (data.summary) {
    sections.push(`
      <div class="env-summary">${data.summary}</div>
    `);
  }

  if (data.errors && data.errors.length > 0) {
    sections.push(`
      <details class="env-details">
        <summary>Some data sources unavailable</summary>
        <ul class="error-list">
          ${data.errors.map((e) => `<li>${e.source}: ${e.error}</li>`).join('')}
        </ul>
      </details>
    `);
  }

  if (sections.length === 0) {
    el.innerHTML = '<div class="hint">No environmental data available for this location.</div>';
  } else {
    el.innerHTML = sections.join('');
  }
}
