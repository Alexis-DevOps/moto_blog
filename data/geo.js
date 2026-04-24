// Topographic Europe map — layered SVG. Not geographically perfect; stylized.
// Uses rough country silhouettes + contour-like concentric paths for mountain ranges.
// Projection: simple equirectangular, configured via projectLL(lat, lon, W, H).
//
// Bounds for our map viewport (covers all trip pins including Iceland + Greece):
//   lon: -26 .. 30
//   lat:  35 .. 71

window.MAP_BOUNDS = { lonMin: -26, lonMax: 30, latMin: 35, latMax: 71 };

window.projectLL = function projectLL(lat, lon, W, H) {
  const { lonMin, lonMax, latMin, latMax } = window.MAP_BOUNDS;
  const x = ((lon - lonMin) / (lonMax - lonMin)) * W;
  // invert Y because SVG y grows downward; also apply a mild cos(lat) correction for visual balance
  const yNorm = 1 - (lat - latMin) / (latMax - latMin);
  const y = yNorm * H;
  return [x, y];
};

// Stylized country outlines — approximate, for mood. Each is an array of [lat,lon] nodes.
// Not cartographically accurate; enough to give the map a recognizable Europe silhouette.
window.COUNTRY_PATHS = [
  // Iberian peninsula
  { name: 'Iberia', pts: [[43.8,-9.4],[43.7,-7.7],[43.5,-5.7],[43.4,-3.0],[43.3,-1.8],[42.8,-1.3],[42.5,0.7],[42.4,3.2],[41.1,1.2],[39.5,-0.1],[38.7,0.2],[37.6,-0.8],[36.7,-2.0],[36.0,-5.4],[36.8,-6.5],[37.2,-7.3],[38.7,-9.4],[40.1,-8.8],[41.7,-8.9],[42.8,-9.3],[43.8,-9.4]] },
  // France + Benelux + south UK bits (very approximate)
  { name: 'France', pts: [[43.5,-1.8],[43.3,3.1],[43.7,4.8],[43.2,5.5],[43.5,7.4],[44.9,7.6],[45.9,6.9],[46.5,6.2],[47.5,7.6],[48.9,8.2],[49.2,6.5],[50.7,6.0],[51.0,4.2],[51.0,2.5],[50.1,1.6],[49.4,0.1],[48.8,-1.6],[48.2,-4.7],[47.5,-2.9],[46.3,-1.8],[45.5,-1.2],[44.5,-1.3],[43.5,-1.8]] },
  // British Isles — Ireland + GB (two paths)
  { name: 'Ireland', pts: [[55.3,-8.3],[54.6,-5.6],[52.5,-6.1],[51.5,-10.0],[54.5,-10.2],[55.3,-8.3]] },
  { name: 'GB', pts: [[58.6,-5.1],[58.0,-2.6],[55.9,-1.4],[53.2,0.4],[52.0,1.8],[51.0,1.4],[50.3,-3.6],[50.5,-5.5],[51.8,-5.3],[53.4,-4.7],[54.8,-3.3],[55.9,-5.5],[57.5,-5.8],[58.6,-5.1]] },
  // Scandinavia (Norway + Sweden fused)
  { name: 'Scandinavia', pts: [[58.0,11.0],[59.4,10.5],[60.2,5.2],[62.5,5.0],[63.8,8.0],[66.0,12.5],[68.1,14.0],[70.1,18.0],[71.1,25.7],[70.6,30.0],[69.0,30.0],[66.0,23.0],[63.5,22.5],[60.0,18.0],[58.4,17.5],[56.0,14.5],[55.3,13.0],[57.7,11.6],[58.0,11.0]] },
  // Denmark + Germany + Poland + Low Countries (single blob)
  { name: 'CentralN', pts: [[55.7,8.1],[57.7,10.5],[55.0,10.5],[54.5,13.0],[54.4,18.6],[54.8,22.7],[54.1,23.4],[52.4,23.2],[51.0,23.9],[50.6,22.3],[50.8,19.2],[50.2,14.7],[50.5,12.3],[49.0,12.5],[48.6,13.5],[48.3,16.4],[47.5,16.0],[47.4,11.5],[47.5,9.6],[47.5,7.6],[48.9,8.2],[49.2,6.5],[50.7,6.0],[51.0,4.2],[51.5,4.8],[53.5,6.8],[55.0,8.1],[55.7,8.1]] },
  // Italy
  { name: 'Italy', pts: [[46.5,7.0],[46.4,10.5],[46.7,13.6],[45.8,13.8],[44.0,12.5],[42.0,14.2],[40.0,17.9],[39.9,18.5],[40.1,17.2],[40.5,16.5],[39.0,17.1],[38.0,15.6],[39.1,16.2],[40.3,14.9],[41.1,13.0],[43.0,10.9],[44.3,8.3],[43.5,7.4],[44.9,7.6],[45.9,6.9],[46.0,8.3],[46.5,7.0]] },
  // Alps/central + Balkans
  { name: 'Balkans', pts: [[46.5,16.0],[46.0,16.9],[45.8,17.4],[45.5,19.6],[46.1,20.3],[48.3,22.3],[47.9,24.1],[47.9,26.9],[46.4,28.2],[45.5,28.8],[43.7,28.6],[42.1,27.9],[41.7,26.3],[40.8,26.1],[40.7,22.8],[39.7,21.0],[37.7,21.1],[36.9,22.4],[36.5,23.0],[37.2,24.1],[38.7,26.4],[39.9,20.0],[40.9,19.3],[42.5,19.3],[43.5,15.3],[44.8,14.9],[45.8,13.8],[46.5,13.6],[46.5,16.0]] },
  // Iceland (simplified)
  { name: 'Iceland', pts: [[66.5,-23.0],[66.3,-17.0],[65.6,-14.5],[64.0,-15.0],[63.4,-19.0],[64.1,-22.4],[65.0,-24.5],[66.5,-23.0]] }
];

// Mountain centers — used to draw topographic "contour" rings.
// [lat, lon, rings count, baseRadius (in lonLat units), jaggedness seed]
window.MOUNTAINS = [
  { name: 'Alps',     lat: 46.5, lon: 9.5,   rings: 5, r: 3.2, seed: 1 },
  { name: 'Pyrenees', lat: 42.7, lon: 0.5,   rings: 4, r: 2.4, seed: 2 },
  { name: 'Carpath',  lat: 47.5, lon: 25.0,  rings: 5, r: 3.5, seed: 3 },
  { name: 'Scandes',  lat: 62.0, lon: 9.0,   rings: 5, r: 3.8, seed: 4 },
  { name: 'Apennine', lat: 42.5, lon: 13.5,  rings: 3, r: 2.0, seed: 5 },
  { name: 'Cantabr',  lat: 43.1, lon: -5.0,  rings: 3, r: 1.6, seed: 6 },
  { name: 'SierraN',  lat: 37.1, lon: -3.4,  rings: 3, r: 1.4, seed: 7 },
  { name: 'Highlands',lat: 57.3, lon: -4.5,  rings: 3, r: 1.6, seed: 8 },
  { name: 'Balkans',  lat: 43.0, lon: 23.0,  rings: 4, r: 2.6, seed: 9 },
  { name: 'Dinaric',  lat: 44.0, lon: 17.5,  rings: 3, r: 1.8, seed: 10 },
  { name: 'Pindus',   lat: 39.5, lon: 21.2,  rings: 3, r: 1.4, seed: 11 },
  { name: 'Iceland',  lat: 64.8, lon: -18.5, rings: 4, r: 2.0, seed: 12 }
];

// deterministic pseudo-random for jagged contour rings
window.prand = function prand(seed) {
  let s = seed * 9301 + 49297;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};
