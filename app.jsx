/* global React, ReactDOM, TRIPS, STATS, TopoMap, PreviewCard, Timeline, TripDetail, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakSelect */
const { useState, useEffect, useRef } = React;

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "showPreviewCard": true,
  "showRouteOnHover": true,
  "mapBase": "outdoor"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweaks] = useTweaks(DEFAULTS);
  const { theme, showPreviewCard, showRouteOnHover } = tweaks;

  const [hoverId, setHoverId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [pinPos, setPinPos] = useState({ x: 0, y: 0 });
  const [sz, setSz] = useState({ w: window.innerWidth, h: window.innerHeight });
  const mapRef = useRef(null);

  useEffect(() => {
    const on = () => setSz({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpenId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hoveredTrip = TRIPS.find(t => t.id === hoverId) || null;
  const openTrip    = TRIPS.find(t => t.id === openId)  || null;

  // Project hovered pin to screen pixels via MapLibre
  useEffect(() => {
    if (!hoveredTrip || !mapRef.current) return;
    const pt = mapRef.current.project([hoveredTrip.pin[1], hoveredTrip.pin[0]]);
    setPinPos({ x: pt.x, y: pt.y });
  }, [hoverId]); // eslint-disable-line

  // Also update on map move while hovering
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      if (!hoveredTrip) return;
      const pt = map.project([hoveredTrip.pin[1], hoveredTrip.pin[0]]);
      setPinPos({ x: pt.x, y: pt.y });
    };
    map.on('move', update);
    return () => map.off('move', update);
  }, [hoveredTrip]); // eslint-disable-line

  return (
    <div className={`stage theme-${theme}`}>
      <div className="map-layer">
        <TopoMap
          theme={theme}
          trips={TRIPS}
          hoverId={hoverId}
          openId={openId}
          showRouteOnHover={showRouteOnHover}
          onPinEnter={(id) => setHoverId(id)}
          onPinLeave={() => setHoverId(null)}
          onPinClick={(id) => setOpenId(id)}
          onReady={(map) => { mapRef.current = map; }}
        />
      </div>

      {/* HUD: header */}
      <header className="hud-top">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M12 2 V22 M2 12 H22" stroke="currentColor" strokeWidth="0.8" />
              <path d="M12 12 L18 6" stroke="#e86a33" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="12" cy="12" r="1.8" fill="#e86a33" />
            </svg>
          </div>
          <div className="brand-txt">
            <div className="brand-line1">ROADBOOK</div>
            <div className="brand-line2">— Alexis</div>
          </div>
        </div>

        <div className="stat-strip">
          <div className="stat">
            <b>{STATS.total_km.toLocaleString()}</b>
            <i>km ridden</i>
          </div>
          <div className="divider" />
          <div className="stat">
            <b>{STATS.trips}</b>
            <i>trips logged</i>
          </div>
          <div className="divider" />
          <div className="stat">
            <b>{STATS.countries}</b>
            <i>countries</i>
          </div>
          <div className="divider" />
          <div className="stat">
            <b>{STATS.total_days}</b>
            <i>days on road</i>
          </div>
          <div className="divider" />
          <div className="stat">
            <b>{(STATS.total_elev/1000).toFixed(1)}k</b>
            <i>m elev. gain</i>
          </div>
        </div>

        <div className="meta-cluster">
          <div className="coord-chip">
            <span>{theme === 'dark' ? 'DARK' : 'LIGHT'}</span>
            <span className="sep">·</span>
            <span>EUR</span>
            <span className="sep">·</span>
            <span>{STATS.years[0]}–{STATS.years[STATS.years.length-1]}</span>
          </div>
        </div>
      </header>

      {/* compass */}
      <div className="compass-rose" aria-hidden="true">
        <svg viewBox="0 0 60 60" width="56" height="56">
          <circle cx="30" cy="30" r="27" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
          <circle cx="30" cy="30" r="22" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
          {[0,45,90,135,180,225,270,315].map(a => (
            <line key={a} x1="30" y1="30" x2="30" y2="6" stroke="currentColor" strokeWidth="0.4" opacity="0.3" transform={`rotate(${a} 30 30)`} />
          ))}
          <path d="M30 6 L34 30 L30 24 L26 30 Z" fill="#e86a33" />
          <path d="M30 54 L34 30 L30 36 L26 30 Z" fill="currentColor" opacity="0.4" />
          <text x="30" y="5" textAnchor="middle" fontSize="5.5" fill="currentColor" fontFamily="'JetBrains Mono', monospace" fontWeight="700">N</text>
        </svg>
      </div>

      {/* idle hint */}
      {!hoverId && !openTrip && (
        <div className="idle-hint">
          <div className="idle-dot" />
          <span>Hover a pin to preview · click to open the roadbook</span>
        </div>
      )}

      {/* preview card */}
      {showPreviewCard && hoveredTrip && (
        <PreviewCard
          trip={hoveredTrip}
          x={pinPos.x}
          y={pinPos.y}
          W={sz.w}
          H={sz.h}
        />
      )}

      {/* timeline */}
      <Timeline
        trips={TRIPS}
        activeId={openId}
        hoveredId={hoverId}
        onHover={setHoverId}
        onLeave={() => setHoverId(null)}
        onClick={(id) => setOpenId(id)}
        theme={theme}
      />

      {/* detail overlay */}
      {openTrip && <TripDetail trip={openTrip} onClose={() => setOpenId(null)} theme={theme} />}

      {/* tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="Appearance">
          <TweakRadio
            label="Theme"
            value={theme}
            onChange={(v) => setTweaks({ theme: v })}
            options={[
              { label: 'Dark', value: 'dark' },
              { label: 'Light', value: 'light' },
            ]}
          />
          <TweakToggle
            label="Show preview card on hover"
            value={showPreviewCard}
            onChange={(v) => setTweaks({ showPreviewCard: v })}
          />
          <TweakToggle
            label="Draw route line on hover"
            value={showRouteOnHover}
            onChange={(v) => setTweaks({ showRouteOnHover: v })}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

window.__dataReady.then(function() {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
});
