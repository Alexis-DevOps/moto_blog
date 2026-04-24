#!/usr/bin/env node
/**
 * Roadbook — add-trip.js
 *
 * Interactive script to append a new trip to data/roadbook.json.
 *
 * Usage:
 *   node scripts/add-trip.js                  # manual coordinates
 *   node scripts/add-trip.js path/to/route.gpx
 *
 * Images (optional):
 *   Put your photos anywhere under the project root, e.g.
 *     images/t13/hero.jpg
 *     images/t13/col-de-vars.jpg
 *   The script will ask for those paths.  The web app will
 *   display <img> tags when a path is present, placeholder otherwise.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const rl   = require('readline').createInterface({
  input:  process.stdin,
  output: process.stdout,
  terminal: false,
});

const DATA_FILE = path.resolve(__dirname, '../data/roadbook.json');

// ── prompt helpers ────────────────────────────────────────────────────────────

const q = (label, def) => new Promise(resolve => {
  const hint = def !== undefined && def !== '' ? ` \x1b[2m(${def})\x1b[0m` : '';
  process.stdout.write(`  \x1b[36m${label}\x1b[0m${hint}: `);
  rl.once('line', line => resolve(line.trim() || def || ''));
});

const qList = async (label) => {
  const raw = await q(`${label} \x1b[2m(comma-separated)\x1b[0m`);
  return raw.split(',').map(s => s.trim()).filter(Boolean);
};

const qInt = async (label, def) => {
  const v = await q(label, def !== undefined ? String(def) : undefined);
  const n = parseInt(v, 10);
  if (isNaN(n)) { console.error(`  ✗ Expected a number`); process.exit(1); }
  return n;
};

const qChoice = async (label, choices, def) => {
  const v = await q(`${label} \x1b[2m[${choices.join('/')}]\x1b[0m`, def);
  if (!choices.includes(v)) {
    console.log(`  ✗ Must be one of: ${choices.join(', ')}`);
    return qChoice(label, choices, def);
  }
  return v;
};

// ── GPX parsing ───────────────────────────────────────────────────────────────

function parseGPX(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const pts = [];
  // handle both attribute orderings
  const re = /<trkpt[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    pts.push([parseFloat(m[1]), parseFloat(m[2])]);
  }
  return pts;
}

// Douglas-Peucker simplification (coords are [lat, lon] in degrees)
function dpSimplify(pts, eps) {
  if (pts.length <= 2) return pts;
  let maxD = 0, split = 0;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    let d;
    if (len2 === 0) {
      d = Math.hypot(px - ax, py - ay);
    } else {
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }
    if (d > maxD) { maxD = d; split = i; }
  }
  if (maxD > eps) {
    const l = dpSimplify(pts.slice(0, split + 1), eps);
    const r = dpSimplify(pts.slice(split), eps);
    return [...l.slice(0, -1), ...r];
  }
  return [pts[0], pts[pts.length - 1]];
}

function round2(n) { return Math.round(n * 100) / 100; }

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const gpxFile = process.argv[2];

  console.log('\n  \x1b[1m╔══════════════════════════════════╗\x1b[0m');
  console.log('  \x1b[1m║   Roadbook — new trip            ║\x1b[0m');
  console.log('  \x1b[1m╚══════════════════════════════════╝\x1b[0m\n');

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`  ✗ Not found: ${DATA_FILE}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const nextN  = String(data.trips.length + 1).padStart(2, '0');
  const nextId = `t${nextN}`;
  console.log(`  Next trip id: \x1b[33m${nextId}\x1b[0m\n`);

  // ── metadata ────────────────────────────────────────────────────────────────
  console.log('  \x1b[1m— Metadata —\x1b[0m\n');
  const title      = await q('Title');
  const region     = await q('Region  \x1b[2me.g. France / Spain\x1b[0m');
  const dateStart  = await q('Start   \x1b[2me.g. 12 Jun\x1b[0m');
  const dateEnd    = await q('End     \x1b[2me.g. 19 Jun\x1b[0m');
  const year       = await qInt('Year', new Date().getFullYear());
  const km         = await qInt('Distance (km)');
  const days       = await qInt('Days');
  const elev       = await qInt('Elevation gain (m)');
  const difficulty = await qChoice('Difficulty', ['Easy', 'Moderate', 'Hard'], 'Moderate');
  const bike       = await q('Motorcycle');

  // ── gear ────────────────────────────────────────────────────────────────────
  console.log('\n  \x1b[1m— Gear —\x1b[0m\n');
  const gear = await qList('Items');

  // ── story ───────────────────────────────────────────────────────────────────
  console.log('\n  \x1b[1m— Story —\x1b[0m\n');
  const story = await q('One paragraph');

  // ── gallery captions ────────────────────────────────────────────────────────
  console.log('\n  \x1b[1m— Gallery captions —\x1b[0m\n');
  const gallery = await qList('Captions \x1b[2m(4 recommended)\x1b[0m');

  // ── images ──────────────────────────────────────────────────────────────────
  console.log('\n  \x1b[1m— Images \x1b[2m(leave blank to skip)\x1b[0m\x1b[1m —\x1b[0m\n');
  console.log(`  Store photos under  \x1b[2mimages/${nextId}/\x1b[0m  and give their paths here.\n`);
  const heroImg = await q('Hero image', `images/${nextId}/hero.jpg`);
  let galImgs = [];
  if (heroImg) {
    galImgs = await qList(`Gallery images \x1b[2m(same order as captions)\x1b[0m`);
  }

  // ── GPX / coordinates ───────────────────────────────────────────────────────
  let waypoints = [];
  let pin;

  if (gpxFile) {
    if (!fs.existsSync(gpxFile)) {
      console.error(`  ✗ GPX file not found: ${gpxFile}`);
      process.exit(1);
    }
    console.log(`\n  Parsing \x1b[33m${gpxFile}\x1b[0m …`);
    const raw = parseGPX(gpxFile);
    if (raw.length === 0) {
      console.error('  ✗ No <trkpt> points found in GPX file.');
      process.exit(1);
    }
    console.log(`  ${raw.length} track points → simplifying …`);
    const simple = dpSimplify(raw, 0.012); // ~15-25 points typical
    waypoints = simple.map(([la, lo]) => [round2(la), round2(lo)]);
    console.log(`  Kept \x1b[32m${waypoints.length}\x1b[0m waypoints.`);

    const lats = waypoints.map(p => p[0]);
    const lons = waypoints.map(p => p[1]);
    pin = [
      round2((Math.min(...lats) + Math.max(...lats)) / 2),
      round2((Math.min(...lons) + Math.max(...lons)) / 2),
    ];
    console.log(`  Auto pin: \x1b[2m${pin[0]}, ${pin[1]}\x1b[0m`);
    const overrideLat = await q('\n  Override pin lat', String(pin[0]));
    const overrideLon = await q('  Override pin lon', String(pin[1]));
    pin = [parseFloat(overrideLat), parseFloat(overrideLon)];
  } else {
    console.log('\n  \x1b[1m— Coordinates \x1b[2m(no GPX provided)\x1b[0m\x1b[1m —\x1b[0m\n');
    const lat = parseFloat(await q('Pin latitude'));
    const lon = parseFloat(await q('Pin longitude'));
    pin = [lat, lon];
    waypoints = [pin];
  }

  // ── build trip ──────────────────────────────────────────────────────────────
  const trip = {
    id: nextId,
    n:  nextN,
    title,
    region,
    date: `${dateStart} — ${dateEnd} ${year}`,
    year,
    km,
    days,
    elev,
    difficulty,
    bike,
    gear,
    story,
    gallery,
    waypoints,
    pin,
  };

  if (heroImg || galImgs.length) {
    trip.images = {};
    if (heroImg)        trip.images.hero    = heroImg;
    if (galImgs.length) trip.images.gallery = galImgs;
  }

  // ── recompute stats ─────────────────────────────────────────────────────────
  data.trips.push(trip);
  const regions = data.trips.flatMap(t => t.region.split('/').map(r => r.trim()));
  data.stats = {
    total_km:   data.trips.reduce((s, t) => s + t.km,   0),
    total_days: data.trips.reduce((s, t) => s + t.days, 0),
    total_elev: data.trips.reduce((s, t) => s + t.elev, 0),
    trips:      data.trips.length,
    countries:  new Set(regions).size,
    years:      [...new Set(data.trips.map(t => t.year))].sort(),
  };

  // ── write ───────────────────────────────────────────────────────────────────
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n');
  console.log(`\n  \x1b[32m✓\x1b[0m Trip \x1b[1m"${title}"\x1b[0m (\x1b[33m${nextId}\x1b[0m) saved to roadbook.json\n`);
  rl.close();
}

main().catch(err => {
  console.error('\n  ✗', err.message);
  process.exit(1);
});
