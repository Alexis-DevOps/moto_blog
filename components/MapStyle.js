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

const MAPTILER_KEY = 'RScRJ13Jj5RMTB1vogJ7';

const DARK = {
  sea:        '#06090d',
  seaDeep:    '#0a0f14',
  land:       '#14202b',
  land2:      '#1a2936',
  coastline:  '#3d5a76',
  contour:    '#2a4157',
  contourHi:  '#3a5a78',
  grid:       'rgba(120,160,200,0.12)',
  text:       '#8aa4bf',
  textDim:    '#4d6680',
  accent:     '#e86a33',
  hillShadow: '#040810',
  hillHigh:   '#1e3040',
  water:      '#080c12',
};

const LIGHT = {
  sea:        '#e8eef2',
  seaDeep:    '#dde6ec',
  land:       '#f4ede0',
  land2:      '#ece3d0',
  coastline:  '#6b5a3e',
  contour:    '#c9b99a',
  contourHi:  '#b19b74',
  grid:       'rgba(107,90,62,0.14)',
  text:       '#6b5a3e',
  textDim:    '#a9997a',
  accent:     '#e86a33',
  hillShadow: '#c5b49a',
  hillHigh:   '#f8f0e0',
  water:      '#c8d8e4',
};

function buildStyle(theme, maptilerKey) {
  const key = maptilerKey || MAPTILER_KEY;
  const C = theme === 'dark' ? DARK : LIGHT;

  return {
    version: 8,
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${key}`,
    sprite: `https://api.maptiler.com/maps/outdoor-v2/sprite?key=${key}`,
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
    },
    terrain: {
      source: 'hillshade',
      exaggeration: 0,
    },
    layers: [
      // ── background / sea ──────────────────────────────────────────
      {
        id: 'rb-background',
        type: 'background',
        paint: { 'background-color': C.sea },
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
          'hillshade-exaggeration': theme === 'dark' ? 0.38 : 0.28,
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
            ['forest', 'grass', 'scrub'], theme === 'dark' ? '#162330' : '#eae5d5',
            ['sand', 'beach'],            theme === 'dark' ? '#1c2a1c' : '#e8e0c8',
            ['ice', 'glacier'],           theme === 'dark' ? '#1d2e3a' : '#edf2f5',
            C.land,
          ],
          'fill-opacity': 0.7,
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
        source: 'maptiler',
        'source-layer': 'contour',
        minzoom: 5,
        filter: ['!=', ['get', 'nth_line'], 5],
        paint: {
          'line-color': C.contour,
          'line-width': 0.5,
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 9, 0.6],
        },
      },
      {
        id: 'rb-contour-hi',
        type: 'line',
        source: 'maptiler',
        'source-layer': 'contour',
        minzoom: 5,
        filter: ['==', ['get', 'nth_line'], 5],
        paint: {
          'line-color': C.contourHi,
          'line-width': 0.9,
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 9, 0.75],
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
          'text-halo-color': C.sea,
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
        maxzoom: 10,
        layout: {
          'text-field': ['get', 'name:en'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 8, 13],
        },
        paint: {
          'text-color': C.textDim,
          'text-halo-color': C.sea,
          'text-halo-width': 1.2,
          'text-opacity': 0.75,
        },
      },

      // Trip layers are added dynamically with rb-trip-* ids
    ],
  };
}

window.buildStyle = buildStyle;
window.MAPTILER_KEY = MAPTILER_KEY;
