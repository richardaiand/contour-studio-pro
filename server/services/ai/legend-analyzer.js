// V2: AI Map Legend Analyzer
// TODO: Enhanced vision prompt for extracting structured legend data
// TODO: Extract: legend symbols, scale bar ratio, contour interval, north arrow, datum

const LEGEND_ANALYSIS_PROMPT = `You are analyzing a topographic map image. Extract the following structured data:

1. **Legend Symbols**: List all symbols shown in the legend with their meanings
2. **Scale Bar**: Measure the scale bar ratio (e.g., 1:24000, 1:50000)
3. **Contour Interval**: The elevation difference between contour lines (in feet or meters)
4. **North Arrow**: Direction of true north or magnetic north
5. **Datum**: The geographic datum used (e.g., NAD27, NAD83, WGS84)
6. **Coordinate System**: Any grid system shown (e.g., UTM zone)
7. **Map Title**: The title of the map
8. **Publisher/Agency**: Who published the map (e.g., USGS)
9. **Edition/Date**: Publication date or edition number

Return as JSON with this exact structure:
{
  "legendSymbols": [{ "symbol": "description", "meaning": "description" }],
  "scaleRatio": "1:24000",
  "contourIntervalMeters": 10,
  "contourIntervalFeet": 40,
  "northArrow": "true north",
  "datum": "NAD83",
  "coordinateSystem": "UTM Zone 10N",
  "title": "Map title",
  "publisher": "USGS",
  "edition": "2024",
  "notes": "any additional observations"
}`;

export async function analyzeMapLegend(imageBuffer, mimeType, provider) {
  // TODO: Call AI vision API with LEGEND_ANALYSIS_PROMPT
  // TODO: Parse structured JSON response
  // TODO: Return legend data object
  throw new Error('Not implemented — see ROADMAP.md V2.3');
}
