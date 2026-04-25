// MapStyle.js — bespoke MapLibre style for Roadbook — Alexis
//
// SETUP: paste your free MapTiler key from https://cloud.maptiler.com/account/keys/
// into MAPTILER_KEY below, or pass it at runtime via buildStyle(theme, key).
//
// ALTERNATIVES (swap the source URLs below):
//   Stadia/Stamen Terrain:  https://tiles.stadiamaps.com/styles/stamen_terrain.json?api_key=YOUR_KEY
//   Thunderforest Outdoors: https://tile.thunderforest.com/thunderforest.outdoors-v2.json?apikey=YOUR_KEY
//   Both are drop-in style-URL replacements — remove the custom sources block and use their
//   style directly, then layer your rb-* layers on top in the style.load callback.

// Key loaded from config.js (gitignored). Falls back to empty string so the
// app still starts — tiles will 401 until a valid key is provided.
const MAPTILER_KEY = (typeof window !== 'undefined' && window.MAPTILER_KEY) || '';

const DARK = {
  sea:          '#215367',
  seaDeep:      '#183c4bff',
  land:         '#14202b',
  land2:        '#1a2936',
  coastline:    '#3d5a76',
  contour:      '#2e4a6a',
  contourHi:    '#4a7aaa',
  grid:         'rgba(120,160,200,0.12)',
  text:         '#8aa4bf',
  textDim:      '#4d6680',
  accent:       '#e86a33',
  hillShadow:   '#020406',
  hillHigh:     '#2e4f70',
  water:        '#14323fff',
  roadMotorway: '#3e6a8a',
  roadPrimary:  '#3a6080',
  roadSecondary:'#2a4558',
  roadMinor:    '#1e3242',
  roadCasing:   '#05101a',
};

const LIGHT = {
  sea:          '#e8eef2',
  seaDeep:      '#dde6ec',
  land:         '#f1e3c7ff',
  land2:        '#ebdbbaff',
  coastline:    '#6b5a3e',
  contour:      '#b8a27a',
  contourHi:    '#8c6e40',
  grid:         'rgba(107,90,62,0.14)',
  text:         '#6b5a3e',
  textDim:      '#a9997a',
  accent:       '#e86a33',
  hillShadow:   '#a08860',
  hillHigh:     '#fdf8f0',
  water:        '#35D5FE',
  roadMotorway: '#6090b8',
  roadPrimary:  '#5880a8',
  roadSecondary:'#7898b8',
  roadMinor:    '#98b0c8',
  roadCasing:   '#e8e0d0',
};

function buildStyle(theme, maptilerKey) {
  const key = maptilerKey || MAPTILER_KEY;
  const C = theme === 'dark' ? DARK : LIGHT;

  return {
    version: 8,
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${key}`,
    sources: {
      maptiler: {
        type: 'vector',
        url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${key}`,
      },
      hillshade: {
        type: 'raster-dem',
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`,
        tileSize: 256,
        encoding: 'mapbox',
      },
      contours: {
        type: 'vector',
        url: `https://api.maptiler.com/tiles/contours/tiles.json?key=${key}`,
      },
    },
    layers: [
      // ── background / land ─────────────────────────────────────────
      {
        id: 'rb-background',
        type: 'background',
        paint: { 'background-color': C.land },
      },

      // ── hillshading ───────────────────────────────────────────────
      {
        id: 'rb-hillshade',
        type: 'hillshade',
        source: 'hillshade',
        paint: {
          'hillshade-shadow-color': C.hillShadow,
          'hillshade-highlight-color': C.hillHigh,
          'hillshade-illumination-direction': 315,
          'hillshade-exaggeration': theme === 'dark' ? 0.68 : 0.55,
          'hillshade-accent-color': C.land,
        },
      },

      // ── water ─────────────────────────────────────────────────────
      {
        id: 'rb-water',
        type: 'fill',
        source: 'maptiler',
        'source-layer': 'water',
        paint: { 'fill-color': C.water },
      },

      // ── landcover: grass / forest / sand ──────────────────────────
      {
        id: 'rb-landcover',
        type: 'fill',
        source: 'maptiler',
        'source-layer': 'landcover',
        paint: {
          'fill-color': [
            'match', ['get', 'class'],
            ['forest', 'grass', 'scrub'], theme === 'dark' ? '#1a3a28' : '#d8e8cc',
            ['sand', 'beach'],            theme === 'dark' ? '#1c2a1c' : '#e8e0c8',
            ['ice', 'glacier'],           theme === 'dark' ? '#1d2e3a' : '#edf2f5',
            C.land,
          ],
          'fill-opacity': 0.65,
        },
      },

      // ── land (park/national park fill) ────────────────────────────
      {
        id: 'rb-land',
        type: 'fill',
        source: 'maptiler',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['park', 'national_park', 'nature_reserve']]],
        paint: {
          'fill-color': theme === 'dark' ? '#162330' : '#e6ded0',
          'fill-opacity': 0.5,
        },
      },

      // ── coastline (stroke the water polygon = exact coast) ───────
      {
        id: 'rb-coastline',
        type: 'line',
        source: 'maptiler',
        'source-layer': 'water',
        paint: {
          'line-color': C.coastline,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 8, 1.4],
          'line-opacity': 0.9,
        },
      },

      // ── contour lines ─────────────────────────────────────────────
      {
        id: 'rb-contour',
        type: 'line',
        source: 'contours',
        'source-layer': 'contour',
        minzoom: 5,
        filter: ['!=', ['get', 'nth_line'], 5],
        paint: {
          'line-color': C.contour,
          'line-width': 0.7,
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.55, 9, 0.85],
        },
      },
      {
        id: 'rb-contour-hi',
        type: 'line',
        source: 'contours',
        'source-layer': 'contour',
        minzoom: 5,
        filter: ['==', ['get', 'nth_line'], 5],
        paint: {
          'line-color': C.contourHi,
          'line-width': 1.2,
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 9, 0.95],
        },
      },

      // ── roads ─────────────────────────────────────────────────────
      // Tracks & unpaved — dashed, high zoom only
      {
        id: 'rb-road-track',
        type: 'line',
        source: 'maptiler',
        'source-layer': 'transportation',
        minzoom: 10,
        filter: ['in', ['get', 'class'], ['literal', ['track', 'path']]],
        paint: {
          'line-color': C.roadMinor,
          'line-width': 0.5,
          'line-dasharray': [3, 3],
          'line-opacity': 0.5,
        },
      },
      // Minor & service roads
      {
        id: 'rb-road-minor',
        type: 'line',
        source: 'maptiler',
        'source-layer': 'transportation',
        minzoom: 9,
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'service']]],
        paint: {
          'line-color': C.roadMinor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.35, 14, 1.2],
          'line-opacity': 0.6,
        },
      },
      // Tertiary
      {
        id: 'rb-road-tertiary',
        type: 'line',
        source: 'maptiler',
        'source-layer': 'transportation',
        minzoom: 7,
        filter: ['==', ['get', 'class'], 'tertiary'],
        paint: {
          'line-color': C.roadSecondary,
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 14, 1.8],
          'line-opacity': 0.65,
        },
      },
      // Secondary
      {
        id: 'rb-road-secondary',
        type: 'line',
        source: 'maptiler',
        'source-layer': 'transportation',
        minzoom: 5,
        filter: ['==', ['get', 'class'], 'secondary'],
        paint: {
          'line-color': C.roadSecondary,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 14, 2.2],
          'line-opacity': 0.7,
        },
      },
      // Primary + trunk
      {
        id: 'rb-road-primary',
        type: 'line',
        source: 'maptiler',
        'source-layer': 'transportation',
        minzoom: 4,
        filter: ['in', ['get', 'class'], ['literal', ['primary', 'trunk']]],
        paint: {
          'line-color': C.roadPrimary,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.55, 14, 3],
          'line-opacity': 0.72,
        },
      },
      // Motorway — same weight as primary, just slightly wider
      {
        id: 'rb-road-motorway',
        type: 'line',
        source: 'maptiler',
        'source-layer': 'transportation',
        minzoom: 3,
        filter: ['==', ['get', 'class'], 'motorway'],
        paint: {
          'line-color': C.roadMotorway,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 14, 3.5],
          'line-opacity': 0.72,
        },
      },

      // ── country boundaries (land only — exclude maritime lines) ──
      {
        id: 'rb-boundary',
        type: 'line',
        source: 'maptiler',
        'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
        paint: {
          'line-color': C.coastline,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 8, 1.2],
          'line-opacity': 0.8,
        },
      },

      // ── country labels ────────────────────────────────────────────
      {
        id: 'rb-label-country',
        type: 'symbol',
        source: 'maptiler',
        'source-layer': 'place',
        filter: ['==', ['get', 'class'], 'country'],
        minzoom: 2,
        maxzoom: 7,
        layout: {
          'text-field': ['get', 'name:en'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 14],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.14,
        },
        paint: {
          'text-color': C.text,
          'text-halo-color': C.land,
          'text-halo-width': 1.5,
          'text-opacity': 0.85,
        },
      },

      // ── capital / major city labels ───────────────────────────────
      {
        id: 'rb-label-city',
        type: 'symbol',
        source: 'maptiler',
        'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
        minzoom: 4,
        maxzoom: 14,
        layout: {
          'text-field': ['get', 'name:en'],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 8, 15, 12, 17],
          'text-letter-spacing': 0.04,
        },
        paint: {
          'text-color': C.text,
          'text-halo-color': C.land,
          'text-halo-width': 2,
          'text-opacity': 1,
        },
      },

      // ── village / hamlet labels (zoom 7+) ─────────────────────────
      {
        id: 'rb-label-village',
        type: 'symbol',
        source: 'maptiler',
        'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['village', 'hamlet', 'suburb']]],
        minzoom: 7,
        maxzoom: 14,
        layout: {
          'text-field': ['get', 'name:en'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 10, 13, 13, 14],
          'text-letter-spacing': 0.02,
        },
        paint: {
          'text-color': C.textDim,
          'text-halo-color': C.land,
          'text-halo-width': 1.5,
          'text-opacity': 0.9,
        },
      },

      // Trip layers are added dynamically with rb-trip-* ids
    ],
  };
}

window.buildStyle = buildStyle;
window.MAPTILER_KEY = MAPTILER_KEY;
