// V3: Environmental site report UI
// TODO: Fetch and display environmental data for the current terrain location
// TODO: Show climate, seismic risk, soil type in a panel

import { $, api } from '../utils.js';
import { store, setStatus } from '../store/index.js';

export function initEnvironment() {
  // TODO: Add "Generate Report" button
  // TODO: Fetch /api/environment?lat=&lon=
  // TODO: Display results in a panel
}

export async function loadEnvironmentalReport(lat, lon) {
  // TODO: Call API and store result
  // TODO: Show climate averages, seismic risk, soil classification
  throw new Error('Not implemented — see ROADMAP.md V3.1');
}
