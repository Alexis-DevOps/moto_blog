/* global React, maplibregl, buildStyle, MAPTILER_KEY, BIKES, PILOTS */
const { useState, useRef, useEffect, useMemo: useMemoP } = React;

const ACCENT = '#e86a33';

// ---------- Hover preview card (HTML, positioned over map) ----------
// x, y are already CSS pixel coords provided by the parent via map.project()
function PreviewCard({ trip, x, y, W, H, preferRight = true, routeEdgeX = null, altRouteEdgeX = null }) {
  if (!trip) return null;
  const cw = 280, ch = 172, gap = 16;
  const edge    = routeEdgeX    !== null ? routeEdgeX    : x;
  const altEdge = altRouteEdgeX !== null ? altRouteEdgeX : x;
  let left = preferRight ? edge + gap : edge - cw - gap;
  let top  = y - ch / 2;
  if (left + cw > W - 12) left = altEdge - cw - gap;
  if (left < 12) left = altEdge + gap;
  if (top < 12) top = 12;
  if (top + ch > H - 12) top = H - ch - 12;
  return (
    <div className="preview-card" style={{ left, top, width: cw }}>
      <div className="preview-photo">
        {trip.images?.hero
          ? <img src={trip.images.hero} alt={trip.title} className="photo-real" />
          : <div className="photo-placeholder" data-label={trip.gallery[0]} />}
        <div className="preview-n">{trip.n}</div>
      </div>
      <div className="preview-body">
        <div className="preview-title">{trip.title}</div>
        <div className="preview-meta">
          <span>{trip.date}</span>
          <span className="dot">·</span>
          <span>{trip.region}</span>
        </div>
        <div className="preview-stats">
          <div><b>{trip.km}</b><i>km</i></div>
          <div><b>{trip.days}</b><i>days</i></div>
          {trip.elev > 0 && <div><b>{(trip.elev/1000).toFixed(1)}k</b><i>m↑</i></div>}
        </div>
        <div className="preview-cta">Click pin to open roadbook →</div>
      </div>
    </div>
  );
}

// ---------- Bottom timeline ----------
const MONTH_IDX = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };

function parseTripStart(t) {
  // "12 Jun — 19 Jun 2024"  →  Date(2024, 5, 12)
  const parts = t.date.split('—')[0].trim().split(' ');
  return new Date(t.year, MONTH_IDX[parts[1]], parseInt(parts[0], 10)).getTime();
}

function Timeline({ trips, activeId, hoveredId, onHover, onLeave, onClick }) {
  const sorted = useMemoP(() =>
    [...trips].sort((a, b) => parseTripStart(a) - parseTripStart(b)),
  [trips]);

  const timestamps = useMemoP(() => sorted.map(parseTripStart), [sorted]);
  const minTs = timestamps[0];
  const maxTs = timestamps[timestamps.length - 1];
  const span  = maxTs - minTs || 1;

  // Convert a timestamp to a 0-100 percentage along the rail
  const toPct = (ts) => (ts - minTs) / span * 100;

  // Year boundary ticks — Jan 1 of each year that falls strictly inside the range
  const yearTicks = useMemoP(() => {
    const ticks = [];
    const y0 = new Date(minTs).getFullYear();
    const y1 = new Date(maxTs).getFullYear();
    for (let y = y0 + 1; y <= y1; y++) {
      ticks.push({ year: y, pct: toPct(new Date(y, 0, 1).getTime()) });
    }
    return ticks;
  }, [minTs, maxTs]); // eslint-disable-line

  // Greedy vertical staggering: pins within THRESH% of each other get offset up/down
  const THRESH = 4; // ~50px on a 1280px rail
  const pinRows = useMemoP(() => {
    const rows = [];
    // track highest pct placed in each row: row 0 = center, 1 = above, -1 = below
    const rowMax = { 0: -Infinity, 1: -Infinity, '-1': -Infinity };
    timestamps.forEach(ts => {
      const p = toPct(ts);
      // prefer center, then above, then below
      let chosen = 0;
      for (const r of [0, 1, -1]) {
        if (p - rowMax[r] >= THRESH) { chosen = r; break; }
      }
      rowMax[chosen] = p;
      rows.push(chosen);
    });
    return rows;
  }, [timestamps]); // eslint-disable-line

  // Vertical offsets per row (relative to the timeline-pins container = on the line)
  const ROW_TOP = { 0: -11, 1: -26, '-1': 4 };

  return (
    <div className="timeline">
      <div className="timeline-rail">
        <div className="timeline-line" />

        {yearTicks.map(({ year, pct }) => (
          <div key={year} className="timeline-year-tick" style={{ left: `${pct.toFixed(2)}%` }}>
            <span>{year}</span>
          </div>
        ))}

        <div className="timeline-pins">
          {sorted.map((t, i) => {
            const pct = toPct(timestamps[i]);
            const row = pinRows[i];
            return (
              <button
                key={t.id}
                className={`tl-pin ${activeId === t.id ? 'active' : ''} ${hoveredId === t.id ? 'hovered' : ''}`}
                style={{
                  left: `calc(${Math.min(Math.max(pct, 0.5), 99.5).toFixed(2)}% - 11px)`,
                  top:  ROW_TOP[row],
                }}
                onMouseEnter={() => onHover(t.id)}
                onMouseLeave={onLeave}
                onClick={() => onClick(t.id)}
                title={t.title}
              >
                <span className="tl-pin-n">{t.n}</span>
                <span className="tl-pin-label">
                  <b>{t.title}</b>
                  <i>{t.km} km · {t.date}</i>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Trip detail overlay ----------
function TripDetail({ trip, onClose, theme }) {
  if (!trip) return null;

  const profilePts = useMemoP(() => {
    const n = 60;
    const rng = (s => () => { s = (s*9301+49297)%233280; return s/233280; })(trip.id.charCodeAt(1)*13);
    const base = [];
    let y = 0.3 + rng()*0.2;
    for (let i = 0; i < n; i++) {
      y += (rng() - 0.5) * 0.12;
      y = Math.max(0.05, Math.min(0.95, y));
      base.push(y);
    }
    return base.map((_, i) => {
      const w = [base[i-2], base[i-1], base[i], base[i+1], base[i+2]].filter(v => v !== undefined);
      return w.reduce((a, b) => a+b, 0) / w.length;
    });
  }, [trip.id]);

  return (
    <div className="detail-scrim" onClick={onClose}>
      <div className="detail-sheet" onClick={e => e.stopPropagation()}>
        <div className="detail-header">
          <div className="detail-head-left">
            <div className="detail-n">ROADBOOK №{trip.n}</div>
            <div className="detail-title">{trip.title}</div>
            <div className="detail-sub">{trip.region} · {trip.date}</div>
          </div>
          <button className="detail-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>

        <div className="detail-grid">
          <div className="detail-col detail-col-main">
            <div className="detail-hero">
              {trip.images?.hero
                ? <img src={trip.images.hero} alt={trip.title} className="photo-real big" />
                : <div className="photo-placeholder big" data-label={trip.gallery[0]} />}
            </div>
            <p className="detail-story">{trip.story}</p>

            <div className="detail-section-label">Route</div>
            <TripMiniMap trip={trip} theme={theme} />

            {trip.elev > 0 && (<>
            <div className="detail-section-label">Elevation profile</div>
            <div className="elev-profile">
              <svg viewBox="0 0 300 70" preserveAspectRatio="none" width="100%" height="70">
                <defs>
                  <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e86a33" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#e86a33" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {(() => {
                  const pts = profilePts;
                  const PW = 300, PH = 70;
                  const step = PW / (pts.length - 1);
                  let d = `M 0 ${PH}`;
                  pts.forEach((yv, i) => { d += ` L ${(i*step).toFixed(1)} ${((1-yv)*PH).toFixed(1)}`; });
                  d += ` L ${PW} ${PH} Z`;
                  let dLine = `M 0 ${((1-pts[0])*PH).toFixed(1)}`;
                  pts.forEach((yv, i) => { dLine += ` L ${(i*step).toFixed(1)} ${((1-yv)*PH).toFixed(1)}`; });
                  return (
                    <g>
                      <path d={d} fill="url(#elevFill)" />
                      <path d={dLine} fill="none" stroke="#e86a33" strokeWidth="1.2" />
                    </g>
                  );
                })()}
              </svg>
              <div className="elev-meta">
                <span>0 km</span>
                <span>+{trip.elev.toLocaleString()} m cumul.</span>
                <span>{trip.km} km</span>
              </div>
            </div>
            </>)}

            <div className="detail-section-label">Gallery</div>
            <div className="detail-gallery">
              {trip.gallery.map((g, i) => (
                trip.images?.gallery?.[i]
                  ? <img key={i} src={trip.images.gallery[i]} alt={g} className="photo-real gal" />
                  : <div key={i} className="photo-placeholder gal" data-label={g} />
              ))}
            </div>
          </div>

          <div className="detail-col detail-col-side">
            <div className="stat-grid">
              <div className="stat-cell"><b>{trip.km}</b><i>kilometres</i></div>
              <div className="stat-cell"><b>{trip.days}</b><i>days on road</i></div>
              {trip.elev > 0 && <div className="stat-cell"><b>{trip.elev.toLocaleString()}</b><i>m elev. gain</i></div>}
              <div className="stat-cell"><b>{trip.difficulty}</b><i>difficulty</i></div>
            </div>

            <div className="detail-section-label">Machine</div>
            <div className="bike-card">
              {(() => {
                const bike = (typeof BIKES !== 'undefined' ? BIKES : []).find(b => b.id === trip.bike_id);
                const specs = bike ? [bike.year, bike.cc && `${bike.cc} cc`, bike.power_hp && `${bike.power_hp} hp`].filter(Boolean).join(' · ') : '';
                return (
                  <>
                    {bike?.image
                      ? <img src={bike.image} alt={`${bike.make} ${bike.model}`} className="bike-photo" />
                      : <div className="bike-silhouette">
                          <svg viewBox="0 0 120 60" width="100%">
                            <g stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round">
                              <circle cx="25" cy="45" r="11" />
                              <circle cx="95" cy="45" r="11" />
                              <path d="M25 45 L45 28 L70 28 L85 22 L95 45" />
                              <path d="M70 28 L75 18 L82 18" />
                              <path d="M45 28 L50 18 L58 18" />
                              <rect x="55" y="22" width="22" height="8" rx="2" />
                            </g>
                          </svg>
                        </div>
                    }
                    <div>
                      <div className="bike-name">{bike ? `${bike.make} ${bike.model}` : '—'}</div>
                      {specs && <div className="bike-specs">{specs}</div>}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="detail-section-label">Gear list</div>
            <ul className="gear-list">
              {trip.gear.map((g, i) => <li key={i}><span>·</span>{g}</li>)}
            </ul>

            {(trip.pilot_ids || []).length > 0 && (() => {
              const allPilots = typeof PILOTS !== 'undefined' ? PILOTS : [];
              const found = trip.pilot_ids.map(id => allPilots.find(p => p.id === id)).filter(Boolean);
              return found.length ? (
                <>
                  <div className="detail-section-label">{found.length > 1 ? 'Riders' : 'Rider'}</div>
                  <ul className="gear-list">
                    {found.map(p => <li key={p.id}><span>·</span>{p.name}{p.nationality ? `, ${p.nationality}` : ''}</li>)}
                  </ul>
                </>
              ) : null;
            })()}

            <button className="gpx-btn">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path d="M7 1 V10 M3 6 L7 10 L11 6 M2 13 H12" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
              </svg>
              Download GPX · roadbook-{trip.n}.gpx
            </button>

            <div className="coord-readout">
              <div>LAT {trip.pin[0].toFixed(3)}°</div>
              <div>LON {trip.pin[1].toFixed(3)}°</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Mini zoomed MapLibre map for the detail page ----------
function TripMiniMap({ trip, theme }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const themeRef = useRef(theme);

  // Compute bounds from waypoints
  const bounds = useMemoP(() => {
    const lats = trip.waypoints.map(p => p[0]);
    const lons = trip.waypoints.map(p => p[1]);
    return [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
  }, [trip.id]);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(theme, MAPTILER_KEY),
      interactive: false,
      attributionControl: false,
    });

    map.on('style.load', () => {
      map.fitBounds(bounds, { padding: 40, duration: 0 });

      const accent = ACCENT;
      const dark = themeRef.current === 'dark';

      map.addSource('mm-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: trip.waypoints.map(([la, lo]) => [lo, la]),
          },
        },
      });

      map.addLayer({
        id: 'mm-route-glow',
        type: 'line',
        source: 'mm-route',
        paint: { 'line-color': accent, 'line-width': 6, 'line-opacity': 0.18, 'line-blur': 3 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      map.addLayer({
        id: 'mm-route-line',
        type: 'line',
        source: 'mm-route',
        paint: { 'line-color': accent, 'line-width': 2.2, 'line-opacity': 0.95 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // Waypoint dots
      map.addSource('mm-dots', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: trip.waypoints.map(([la, lo]) => ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [lo, la] },
          })),
        },
      });
      map.addLayer({
        id: 'mm-dots',
        type: 'circle',
        source: 'mm-dots',
        paint: { 'circle-radius': 3, 'circle-color': accent },
      });

      // Start / end markers as HTML overlays
      const startCoord = trip.waypoints[0];
      const endCoord   = trip.waypoints[trip.waypoints.length - 1];

      function markerEl(label) {
        const el = document.createElement('div');
        el.style.cssText = `
          font-family:'JetBrains Mono',monospace;
          font-size:9px; font-weight:700;
          color:${accent}; padding:2px 5px;
          background:${dark ? 'rgba(8,12,18,0.85)' : 'rgba(248,242,228,0.9)'};
          border:1px solid ${accent}; border-radius:2px;
          white-space:nowrap; pointer-events:none;
        `;
        el.textContent = label;
        return el;
      }

      new maplibregl.Marker({ element: markerEl('START'), anchor: 'bottom-left' })
        .setLngLat([startCoord[1], startCoord[0]])
        .addTo(map);

      new maplibregl.Marker({ element: markerEl('END'), anchor: 'bottom-left' })
        .setLngLat([endCoord[1], endCoord[0]])
        .addTo(map);
    });

    mapRef.current = map;
    themeRef.current = theme;

    return () => { map.remove(); mapRef.current = null; };
  }, [trip.id]); // eslint-disable-line

  // Theme change on existing minimap
  useEffect(() => {
    const map = mapRef.current;
    if (!map || themeRef.current === theme) return;
    themeRef.current = theme;

    map.setStyle(buildStyle(theme, MAPTILER_KEY));
    map.once('style.load', () => {
      map.fitBounds(bounds, { padding: 40, duration: 0 });

      const accent = ACCENT;
      const dark = theme === 'dark';

      map.addSource('mm-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: trip.waypoints.map(([la, lo]) => [lo, la]),
          },
        },
      });
      map.addLayer({ id: 'mm-route-glow', type: 'line', source: 'mm-route',
        paint: { 'line-color': accent, 'line-width': 6, 'line-opacity': 0.18, 'line-blur': 3 },
        layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'mm-route-line', type: 'line', source: 'mm-route',
        paint: { 'line-color': accent, 'line-width': 2.2, 'line-opacity': 0.95 },
        layout: { 'line-cap': 'round', 'line-join': 'round' } });

      map.addSource('mm-dots', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: trip.waypoints.map(([la, lo]) => ({
            type: 'Feature', properties: {},
            geometry: { type: 'Point', coordinates: [lo, la] },
          })),
        },
      });
      map.addLayer({ id: 'mm-dots', type: 'circle', source: 'mm-dots',
        paint: { 'circle-radius': 3, 'circle-color': accent } });

      const startCoord = trip.waypoints[0];
      const endCoord   = trip.waypoints[trip.waypoints.length - 1];

      function markerEl(label) {
        const el = document.createElement('div');
        el.style.cssText = `
          font-family:'JetBrains Mono',monospace;
          font-size:9px; font-weight:700;
          color:${accent}; padding:2px 5px;
          background:${dark ? 'rgba(8,12,18,0.85)' : 'rgba(248,242,228,0.9)'};
          border:1px solid ${accent}; border-radius:2px;
          white-space:nowrap; pointer-events:none;
        `;
        el.textContent = label;
        return el;
      }
      new maplibregl.Marker({ element: markerEl('START'), anchor: 'bottom-left' })
        .setLngLat([startCoord[1], startCoord[0]]).addTo(map);
      new maplibregl.Marker({ element: markerEl('END'), anchor: 'bottom-left' })
        .setLngLat([endCoord[1], endCoord[0]]).addTo(map);
    });
  }, [theme]); // eslint-disable-line

  return (
    <div className="mini-map" style={{ position: 'relative', height: 260 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

Object.assign(window, { PreviewCard, Timeline, TripDetail, TripMiniMap });
