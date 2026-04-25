/* global React, maplibregl, buildStyle, MAPTILER_KEY */
const { useEffect, useRef, useState } = React;

const ACCENT = '#e86a33';
const EMPTY_FC = { type: 'FeatureCollection', features: [] };

// ---------- map layer helpers ----------

function addRouteLayers(map, trips, showAll) {
  ['rb-trip-route', 'rb-trip-route-glow', 'rb-trips-all'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource('trips-active')) map.removeSource('trips-active');
  if (map.getSource('trips-all'))    map.removeSource('trips-all');

  // All-routes layer (drawn first, so hover route sits on top)
  const allFeatures = (trips || [])
    .filter(t => t.waypoints && t.waypoints.length >= 2)
    .map(t => ({
      type: 'Feature',
      properties: { id: t.id },
      geometry: { type: 'LineString', coordinates: t.waypoints.map(([la, lo]) => [lo, la]) },
    }));

  map.addSource('trips-all', { type: 'geojson', data: { type: 'FeatureCollection', features: allFeatures } });
  map.addLayer({
    id: 'rb-trips-all',
    type: 'line',
    source: 'trips-all',
    paint: { 'line-color': ACCENT, 'line-width': 1.5, 'line-opacity': showAll ? 0.45 : 0 },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  });

  // Active-route layers (hover / open) — drawn on top
  map.addSource('trips-active', { type: 'geojson', data: EMPTY_FC });
  map.addLayer({
    id: 'rb-trip-route-glow',
    type: 'line',
    source: 'trips-active',
    paint: { 'line-color': ACCENT, 'line-width': 8, 'line-opacity': 0, 'line-blur': 3 },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  });
  map.addLayer({
    id: 'rb-trip-route',
    type: 'line',
    source: 'trips-active',
    paint: { 'line-color': ACCENT, 'line-width': 2, 'line-opacity': 0 },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  });
}

// ---------- animation ----------

function lerp2(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// Progressive GeoJSON draw: grows the line from start → end over DUR_LINE ms
// cancelToken is an object { cancelled: bool } so we can flip the flag without
// worrying about stale closure references.
function startRouteAnim(map, trip, cancelToken) {
  const coords = trip.waypoints.map(([la, lo]) => [lo, la]);
  const DUR_GLOW = 300;
  const DUR_LINE = 1100;

  // glow fade-in
  let tGlow = null;
  function tickGlow(ts) {
    if (cancelToken.cancelled) return;
    if (!tGlow) tGlow = ts;
    const p = Math.min((ts - tGlow) / DUR_GLOW, 1);
    map.setPaintProperty('rb-trip-route-glow', 'line-opacity', p * 0.18);
    if (p < 1) requestAnimationFrame(tickGlow);
  }
  requestAnimationFrame(tickGlow);

  // line opacity on immediately; draw via GeoJSON growth
  map.setPaintProperty('rb-trip-route', 'line-opacity', 0.9);

  let tLine = null;
  function tickLine(ts) {
    if (cancelToken.cancelled) return;
    if (!tLine) tLine = ts;
    const p = Math.min((ts - tLine) / DUR_LINE, 1);
    // ease-out matching cubic-bezier(.2,.7,.2,1)
    const e = 1 - Math.pow(1 - p, 2.8);

    // how far along the coords array to draw
    const pos = (coords.length - 1) * e;
    const idx = Math.floor(pos);
    const frac = pos - idx;

    const partial = coords.slice(0, idx + 1);
    if (idx + 1 < coords.length) partial.push(lerp2(coords[idx], coords[idx + 1], frac));

    if (partial.length >= 2) {
      map.getSource('trips-active').setData({
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: partial },
      });
    }

    if (p < 1) {
      requestAnimationFrame(tickLine);
    } else {
      // ensure the final frame is the complete route
      map.getSource('trips-active').setData({
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      });
    }
  }
  requestAnimationFrame(tickLine);
}

function clearRoute(map) {
  if (!map.getSource('trips-active')) return;
  map.setPaintProperty('rb-trip-route', 'line-opacity', 0);
  map.setPaintProperty('rb-trip-route-glow', 'line-opacity', 0);
  map.getSource('trips-active').setData(EMPTY_FC);
}

// ---------- pin button ----------

function PinButton({ trip, pos, hovered, active, theme, onEnter, onLeave, onClick }) {
  if (!pos) return null;
  const dark = theme === 'dark';
  const ring = dark ? '#0a0f14' : '#f4ede0';
  return (
    <button
      className={`map-pin-btn${hovered || active ? ' hovered' : ''}`}
      style={{ left: pos.x, top: pos.y }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      title={trip.title}
      aria-label={`${trip.title} — open roadbook`}
    >
      <svg width="44" height="44" viewBox="0 0 44 44" style={{ overflow: 'visible' }}>
        <circle cx="22" cy="22" r={hovered ? 18 : 10} fill={ACCENT} opacity={hovered ? 0.18 : 0.08} />
        <circle cx="22" cy="22" r={hovered ? 11 : 7}  fill={ACCENT} opacity={hovered ? 0.35 : 0.15} />
        {hovered && (
          <circle cx="22" cy="22" r="14" fill="none" stroke={ACCENT} strokeWidth="0.8" opacity="0.6">
            <animate attributeName="r" from="10" to="22" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.7" to="0" dur="1.4s" repeatCount="indefinite" />
          </circle>
        )}
        <circle cx="22" cy="22" r="4.5" fill={ACCENT} stroke={ring} strokeWidth="1.5" />
        <circle cx="22" cy="22" r="1.5" fill={ring} />
        <g transform="translate(30 8)">
          <rect x="0" y="0" width="17" height="12" rx="2"
            fill={dark ? '#0f1720' : '#f4ede0'} stroke={ACCENT} strokeWidth="0.8" />
          <text x="8.5" y="9" textAnchor="middle"
            fontFamily="'JetBrains Mono', monospace" fontSize="8.5"
            fill={ACCENT} fontWeight="700">{trip.n}</text>
        </g>
      </svg>
    </button>
  );
}

// ---------- main component ----------

function TopoMap({ theme, trips, hoverId, openId, showRouteOnHover, showAllRoutes, onPinEnter, onPinLeave, onPinClick, onReady }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const mountedRef   = useRef(false);
  const animToken    = useRef({ cancelled: true });
  const [pinPositions, setPinPositions] = useState({});

  // Mirror latest props into refs so the async style.load handler always sees
  // the current values without relying on React state updates (which can be batched).
  const hoverIdRef      = useRef(hoverId);
  const openIdRef       = useRef(openId);
  const showRouteRef    = useRef(showRouteOnHover);
  const showAllRef      = useRef(showAllRoutes);
  const tripsRef        = useRef(trips);
  hoverIdRef.current    = hoverId;
  openIdRef.current     = openId;
  showRouteRef.current  = showRouteOnHover;
  showAllRef.current    = showAllRoutes;
  tripsRef.current      = trips;

  // Init map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(theme, MAPTILER_KEY),
      center: [14, 54],
      zoom: 3.8,
      minZoom: 2,
      maxZoom: 14,
      scrollZoom: true,
      doubleClickZoom: true,
      dragRotate: false,
      touchZoomRotate: true,
      pitchWithRotate: false,
      attributionControl: false,
    });

    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    const updatePins = () => {
      const pos = {};
      tripsRef.current.forEach(t => {
        const pt = map.project([t.pin[1], t.pin[0]]);
        pos[t.id] = { x: pt.x, y: pt.y };
      });
      setPinPositions({ ...pos });
    };

    map.on('move', updatePins);
    map.on('resize', updatePins);

    // Fires on initial load AND after every setStyle call.
    // Reads refs directly — no React state updates needed to restore the route.
    map.on('style.load', () => {
      addRouteLayers(map, tripsRef.current, showAllRef.current);
      updatePins();
      const activeId   = openIdRef.current || (showRouteRef.current ? hoverIdRef.current : null);
      const activeTrip = activeId ? tripsRef.current.find(t => t.id === activeId) : null;
      animToken.current.cancelled = true;
      if (activeTrip) {
        animToken.current = { cancelled: false };
        startRouteAnim(map, activeTrip, animToken.current);
      }
      if (onReady) onReady(map);
    });

    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line

  // Theme change → rebuild style
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    const map = mapRef.current;
    if (!map) return;
    animToken.current.cancelled = true;
    // diff:false forces a full style swap so style.load always fires and layers are rebuilt
    map.setStyle(buildStyle(theme, MAPTILER_KEY), { diff: false });
    // style.load fires → re-adds layers and restores active route via refs
  }, [theme]); // eslint-disable-line

  // Route effect — handles hover/click/toggle while style is already loaded.
  // Guard: map.getSource returns null while setStyle is in flight → skips safely.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('trips-active')) return;

    const activeId   = openId || (showRouteOnHover ? hoverId : null);
    const activeTrip = activeId ? trips.find(t => t.id === activeId) : null;

    animToken.current.cancelled = true;

    if (!activeTrip) {
      clearRoute(map);
      return;
    }

    animToken.current = { cancelled: false };
    startRouteAnim(map, activeTrip, animToken.current);
  }, [hoverId, openId, showRouteOnHover]); // eslint-disable-line

  // Show/hide all routes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('trips-all')) return;
    map.setPaintProperty('rb-trips-all', 'line-opacity', showAllRoutes ? 0.45 : 0);
  }, [showAllRoutes]); // eslint-disable-line

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {trips.map(t => (
        <PinButton
          key={t.id}
          trip={t}
          pos={pinPositions[t.id]}
          hovered={hoverId === t.id}
          active={openId === t.id}
          theme={theme}
          onEnter={() => onPinEnter(t.id)}
          onLeave={onPinLeave}
          onClick={() => onPinClick(t.id)}
        />
      ))}
    </div>
  );
}

window.TopoMap = TopoMap;
