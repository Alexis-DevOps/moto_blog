# Roadbook Map — Setup & Customisation

## 1. MapTiler API key

The map uses MapTiler vector tiles (terrain, hillshade, contour lines).

1. Create a free account at https://cloud.maptiler.com
2. Copy your API key from **Account → Keys**
3. Open `components/MapStyle.js` and replace `YOUR_MAPTILER_KEY` on line 1:

```js
const MAPTILER_KEY = 'paste-your-key-here';
```

Free tier: 100 000 map loads / month — more than enough for a personal blog.

## 2. Swapping tile providers

### Stadia Maps (Stamen Terrain)
Replace the `buildStyle` function body with a single style URL:

```js
// In TopoMap.jsx / TripMiniMap, change the style option to:
style: `https://tiles.stadiamaps.com/styles/stamen_terrain.json?api_key=YOUR_STADIA_KEY`
```

Then add your `rb-trip-*` layers in the `style.load` callback as usual.
No custom source block needed — Stadia bundles everything.

### Thunderforest Outdoors
```js
style: `https://tile.thunderforest.com/thunderforest.outdoors-v2.json?apikey=YOUR_TF_KEY`
```

Both are drop-in replacements at the style-URL level.

## 3. Tweaking the colour palette

All theme colours live at the top of `components/MapStyle.js` in the `DARK` and `LIGHT`
objects. Each key maps to a MapLibre layer paint property:

| Key          | Affects                                      |
|--------------|----------------------------------------------|
| `sea`        | Background / ocean fill                      |
| `land`       | Landcover base fill                          |
| `land2`      | Landcover secondary tint                     |
| `coastline`  | Country boundary line colour                 |
| `contour`    | Standard contour line colour                 |
| `contourHi`  | Index (every-5th) contour colour             |
| `text`       | Country label text                           |
| `textDim`    | City label text                              |
| `hillShadow` | Hillshade shadow tint                        |
| `hillHigh`   | Hillshade highlight tint                     |
| `water`      | Lakes and rivers                             |
| `accent`     | Trip routes and pin markers (`#e86a33`)      |

After editing colours, reload the page — no build step required.
