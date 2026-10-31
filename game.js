/* =====================================================================
   SLICKS & SLIDES
   A dependency-free retro top-down racer, built for the browser.
   ===================================================================== */

(() => {
  'use strict';

  /* -------------------------------------------------------------------
     Constants and tiny helpers
     ------------------------------------------------------------------- */

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const WORLD_W = 3000;
  const WORLD_H = 2000;
  const STEP = 1 / 120;
  const STORE = 'slicksSlides.';

  const TAU = Math.PI * 2;
  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mod = (n, m) => ((n % m) + m) % m;
  const normAngle = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };
  const expo = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--.---';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  function ordinal(n) {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return 'TH';
    return n % 10 === 1 ? 'ST' : n % 10 === 2 ? 'ND' : n % 10 === 3 ? 'RD' : 'TH';
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function readStore(key, fallback) {
    try {
      const value = localStorage.getItem(STORE + key);
      return value === null ? fallback : value;
    } catch (err) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(STORE + key, String(value));
    } catch (err) {
      /* Private browsing / file protocol can refuse storage. */
    }
  }

  function getRecord(trackId) {
    const value = Number(readStore('best.' + trackId, 0));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function setRecord(trackId, value) {
    writeStore('best.' + trackId, value.toFixed(3));
  }

  function normalizeHexColor(value, fallback = PLAYER.color) {
    if (typeof value !== 'string') return fallback;
    const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
    return match ? `#${match[1].toLowerCase()}` : fallback;
  }

  function accentForPaint(hex) {
    const value = normalizeHexColor(hex);
    const r = parseInt(value.slice(1, 3), 16);
    const g = parseInt(value.slice(3, 5), 16);
    const b = parseInt(value.slice(5, 7), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.62 ? '#11181b' : '#fff3c7';
  }

  /* -------------------------------------------------------------------
     Themes
     ------------------------------------------------------------------- */

  const THEMES = {
    forest: {
      ground: '#23462f',
      groundDark: '#193824',
      groundLight: '#30583b',
      groundDetail: '#4b754d',
      runoff: '#635a39',
      runoffDark: '#4e472d',
      asphalt: '#3c4242',
      asphaltDark: '#333939',
      asphaltLight: '#4d5554',
      curbA: '#ebe6d2',
      curbB: '#c94337',
      line: '#dfe0cd',
      accent: '#ffd447',
      skid: 'rgba(10, 14, 13, 0.17)',
      dust: '#a8986d',
      smoke: 'rgba(221, 226, 215, 0.30)',
      scenery: 'forest',
      night: false,
    },
    desert: {
      ground: '#8a6942',
      groundDark: '#775735',
      groundLight: '#a17e50',
      groundDetail: '#b8945f',
      runoff: '#c0a170',
      runoffDark: '#a28556',
      asphalt: '#494440',
      asphaltDark: '#3e3935',
      asphaltLight: '#5a544d',
      curbA: '#f1e6cb',
      curbB: '#ce4c38',
      line: '#e8ddc3',
      accent: '#ffd447',
      skid: 'rgba(20, 16, 12, 0.16)',
      dust: '#cfb17e',
      smoke: 'rgba(238, 227, 204, 0.30)',
      scenery: 'desert',
      night: false,
    },
    harbor: {
      ground: '#4a5d57',
      groundDark: '#3c4e49',
      groundLight: '#5b6f66',
      groundDetail: '#718277',
      runoff: '#746e5a',
      runoffDark: '#5d5948',
      asphalt: '#3e4547',
      asphaltDark: '#353b3d',
      asphaltLight: '#4d5557',
      curbA: '#e9e5d2',
      curbB: '#cb473a',
      line: '#dce1d5',
      accent: '#ffd447',
      skid: 'rgba(11, 14, 14, 0.17)',
      dust: '#9e9b85',
      smoke: 'rgba(213, 222, 218, 0.28)',
      scenery: 'harbor',
      night: false,
    },
    midnight: {
      ground: '#121927',
      groundDark: '#0d1320',
      groundLight: '#1c273b',
      groundDetail: '#2c3a53',
      runoff: '#2d3445',
      runoffDark: '#232938',
      asphalt: '#252a34',
      asphaltDark: '#1e222b',
      asphaltLight: '#333b47',
      curbA: '#e6e1ce',
      curbB: '#d14940',
      line: '#dbe4ee',
      accent: '#63e2ef',
      skid: 'rgba(4, 6, 8, 0.23)',
      dust: '#606c7c',
      smoke: 'rgba(208, 223, 237, 0.20)',
      scenery: 'midnight',
      night: true,
    },
  };

  /* -------------------------------------------------------------------
     Tracks
     ------------------------------------------------------------------- */

  const TRACK_DEFS = [
    {
      id: 'pine',
      name: 'PINE VALLEY',
      location: 'FOREST CIRCUIT',
      distance: '3.1 KM',
      difficulty: 1,
      theme: 'forest',
      width: 198,
      seed: 7123,
      points: [
        [620, 980], [650, 650], [900, 430], [1300, 350], [1750, 380], [2120, 520],
        [2400, 760], [2450, 1120], [2250, 1450], [1900, 1620], [1450, 1680],
        [1050, 1600], [760, 1400], [590, 1200],
      ],
    },
    {
      id: 'sunburn',
      name: 'SUNBURN STRIP',
      location: 'DESERT CIRCUIT',
      distance: '3.4 KM',
      difficulty: 2,
      theme: 'desert',
      width: 188,
      seed: 8841,
      points: [
        [500, 1050], [560, 700], [850, 470], [1200, 430], [1500, 620], [1740, 420],
        [2100, 330], [2470, 450], [2600, 780], [2520, 1120], [2280, 1420],
        [1950, 1560], [1650, 1440], [1440, 1180], [1160, 1250], [980, 1520],
        [650, 1560], [470, 1370],
      ],
    },
    {
      id: 'dockside',
      name: 'DOCKSIDE',
      location: 'HARBOR CIRCUIT',
      distance: '3.6 KM',
      difficulty: 2,
      theme: 'harbor',
      width: 178,
      seed: 4319,
      points: [
        [520, 650], [900, 430], [1320, 500], [1580, 760], [1860, 590], [2200, 620],
        [2510, 880], [2540, 1250], [2300, 1570], [1920, 1640], [1670, 1420],
        [1380, 1510], [1080, 1670], [720, 1580], [480, 1280], [460, 920],
      ],
    },
    {
      id: 'midnight',
      name: 'MIDNIGHT RUN',
      location: 'NEON CIRCUIT',
      distance: '4.0 KM',
      difficulty: 3,
      theme: 'midnight',
      width: 178,
      seed: 9973,
      points: [
        [600, 430], [1080, 340], [1500, 410], [1720, 690], [1970, 470], [2300, 450],
        [2560, 700], [2500, 1080], [2240, 1210], [2360, 1520], [2000, 1660],
        [1670, 1500], [1440, 1670], [1080, 1690], [780, 1490], [500, 1200],
        [500, 780],
      ],
    },
  ];

  const DIFFICULTIES = {
    rookie: { label: 'ROOKIE', speed: 0.79, accel: 0.88, corner: 0.82, lane: 0.16 },
    pro: { label: 'PRO', speed: 0.92, accel: 0.98, corner: 0.90, lane: 0.20 },
    ace: { label: 'ACE', speed: 1.0, accel: 1.06, corner: 1.0, lane: 0.23 },
  };

  const RIVALS = [
    { name: 'BLAZE', color: '#ef5b4c', accent: '#ffb19f', type: 'rally' },
    { name: 'NITRO', color: '#58cbea', accent: '#b8f2ff', type: 'supra' },
    { name: 'VIPER', color: '#93d45f', accent: '#d7f5bb', type: 'lambo' },
  ];

  const PLAYER = { name: 'YOU', color: '#ffd447', accent: '#fff0a8' };

  const CAR_TYPES = {
    formula: {
      name: 'FORMULA',
      className: 'OPEN WHEEL',
      blurb: 'Light, frantic and glued down. The quickest way around a corner if you can keep your nerve.',
      maxSpeed: 520,
      accel: 342,
      brakeForce: 625,
      turnRate: 2.38,
      gripRoad: 9.7,
      gripGrass: 2.0,
      offroadSpeed: 0.43,
      offroadTraction: 0.3,
      handbrakeGrip: 1.3,
      stats: { speed: 5, accel: 5, grip: 5, brakes: 5 },
    },
    rally: {
      name: 'RALLY',
      className: 'ALL-ROAD',
      blurb: 'A short-wheelbase bruiser. It shrugs off the grass and can change direction on a coin.',
      maxSpeed: 458,
      accel: 338,
      brakeForce: 575,
      turnRate: 2.16,
      gripRoad: 8.3,
      gripGrass: 5.0,
      offroadSpeed: 0.71,
      offroadTraction: 0.61,
      handbrakeGrip: 1.5,
      stats: { speed: 3, accel: 4, grip: 4, brakes: 4 },
    },
    supra: {
      name: 'SUPRA MK4',
      className: 'SPORTS COUPE',
      blurb: 'A balanced rear-drive coupe. Happy to slide, happy to win. A proper all-rounder.',
      maxSpeed: 492,
      accel: 318,
      brakeForce: 560,
      turnRate: 2.2,
      gripRoad: 7.9,
      gripGrass: 2.4,
      offroadSpeed: 0.5,
      offroadTraction: 0.35,
      handbrakeGrip: 1.4,
      stats: { speed: 4, accel: 4, grip: 3, brakes: 4 },
    },
    lambo: {
      name: 'LAMBORGHINI',
      className: 'V12 SUPER',
      blurb: 'Wide, loud and devastatingly fast. The throttle is a suggestion; the rear tyres decide.',
      maxSpeed: 536,
      accel: 362,
      brakeForce: 620,
      turnRate: 2.28,
      gripRoad: 9.1,
      gripGrass: 2.2,
      offroadSpeed: 0.44,
      offroadTraction: 0.3,
      handbrakeGrip: 1.25,
      stats: { speed: 5, accel: 5, grip: 4, brakes: 5 },
    },
  };

  const CAR_COLORS = [
    '#ffd447', '#ef4e42', '#ff8a3d', '#f1e7d0',
    '#24282f', '#aeb7ba', '#4fbdec', '#38b8a8',
    '#9ad65c', '#9f72ed', '#f36cac', '#f8f7ee',
  ];

  const AIRFIELD_THEME = {
    ground: '#687052',
    groundDark: '#566044',
    groundLight: '#79815c',
    groundDetail: '#8c9468',
    runoff: '#8b8666',
    runoffDark: '#706c52',
    asphalt: '#73766f',
    asphaltDark: '#636760',
    asphaltLight: '#83867e',
    curbA: '#e9e3d1',
    curbB: '#c85543',
    line: '#e9e5d4',
    accent: '#63e2ef',
    skid: 'rgba(12, 15, 14, 0.2)',
    dust: '#b2a67a',
    smoke: 'rgba(226, 230, 220, 0.28)',
    scenery: 'airfield',
    night: false,
  };

  /* -------------------------------------------------------------------
     Track geometry
     ------------------------------------------------------------------- */

  function catmullPoint(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      y: 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
    };
  }

  function buildGeometry(def) {
    const control = def.points;
    const raw = [];
    const subdivisions = 24;
    for (let i = 0; i < control.length; i++) {
      const p0 = control[(i - 1 + control.length) % control.length];
      const p1 = control[i];
      const p2 = control[(i + 1) % control.length];
      const p3 = control[(i + 2) % control.length];
      for (let j = 0; j < subdivisions; j++) {
        raw.push(catmullPoint(p0, p1, p2, p3, j / subdivisions));
      }
    }

    let total = 0;
    const cumulative = [0];
    for (let i = 0; i < raw.length; i++) {
      const a = raw[i];
      const b = raw[(i + 1) % raw.length];
      total += Math.hypot(b.x - a.x, b.y - a.y);
      cumulative.push(total);
    }

    const sampleCount = Math.max(320, Math.round(total / 10));
    const spacing = total / sampleCount;
    const points = [];
    let seg = 0;

    for (let i = 0; i < sampleCount; i++) {
      const target = i * spacing;
      while (seg < raw.length - 1 && cumulative[seg + 1] < target) seg++;
      const a = raw[seg];
      const b = raw[(seg + 1) % raw.length];
      const span = cumulative[seg + 1] - cumulative[seg] || 1;
      const f = (target - cumulative[seg]) / span;
      points.push({
        x: lerp(a.x, b.x, f),
        y: lerp(a.y, b.y, f),
        tx: 0,
        ty: 0,
        nx: 0,
        ny: 0,
      });
    }

    for (let i = 0; i < points.length; i++) {
      const prev = points[(i - 1 + points.length) % points.length];
      const next = points[(i + 1) % points.length];
      let tx = next.x - prev.x;
      let ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      points[i].tx = tx;
      points[i].ty = ty;
      points[i].nx = -ty;
      points[i].ny = tx;
    }

    return {
      points,
      n: points.length,
      spacing,
      length: total,
      width: def.width,
    };
  }

  function distanceToTrackSq(x, y, points, step = 2) {
    let best = Infinity;
    for (let i = 0; i < points.length; i += step) {
      const dx = x - points[i].x;
      const dy = y - points[i].y;
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    return best;
  }

  /* -------------------------------------------------------------------
     Canvas drawing helpers
     ------------------------------------------------------------------- */

  function makeCanvas(width, height) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }

  function tracePath(g, points) {
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.closePath();
  }

  function traceOffsetPath(g, points, offset) {
    g.beginPath();
    g.moveTo(points[0].x + points[0].nx * offset, points[0].y + points[0].ny * offset);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x + points[i].nx * offset, points[i].y + points[i].ny * offset);
    }
    g.closePath();
  }

  function strokeTrack(g, points, width, color, dash = null, dashOffset = 0) {
    g.save();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.lineWidth = width;
    g.strokeStyle = color;
    if (dash) {
      g.setLineDash(dash);
      g.lineDashOffset = dashOffset;
    }
    tracePath(g, points);
    g.stroke();
    g.restore();
  }

  function strokeOffsetTrack(g, points, offset, width, color, dash = null) {
    g.save();
    g.lineJoin = 'round';
    g.lineCap = 'butt';
    g.lineWidth = width;
    g.strokeStyle = color;
    if (dash) g.setLineDash(dash);
    traceOffsetPath(g, points, offset);
    g.stroke();
    g.restore();
  }

  /* -------------------------------------------------------------------
     Static track artwork
     ------------------------------------------------------------------- */

  function drawGround(track, g, rng) {
    const theme = track.theme;
    g.fillStyle = theme.ground;
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    for (let i = 0; i < 430; i++) {
      const x = rng() * WORLD_W;
      const y = rng() * WORLD_H;
      const r = 16 + rng() * 130;
      g.globalAlpha = 0.035 + rng() * 0.065;
      g.fillStyle = rng() > 0.54 ? theme.groundLight : theme.groundDark;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.35 + rng() * 0.6), rng() * Math.PI, 0, TAU);
      g.fill();
    }

    g.globalAlpha = 0.28;
    g.strokeStyle = theme.groundDetail;
    g.lineWidth = 1.2;
    for (let i = 0; i < 3600; i++) {
      const x = rng() * WORLD_W;
      const y = rng() * WORLD_H;
      const len = 2 + rng() * 5;
      const a = -Math.PI * 0.65 + rng() * 0.8;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }

    if (theme.scenery === 'harbor') {
      g.globalAlpha = 0.08;
      g.strokeStyle = '#d7ded4';
      g.lineWidth = 2;
      for (let i = 0; i < 55; i++) {
        const x = rng() * WORLD_W;
        const y = rng() * WORLD_H;
        const len = 35 + rng() * 110;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + len, y);
        g.stroke();
      }
    }

    if (theme.scenery === 'midnight') {
      g.globalAlpha = 0.1;
      g.strokeStyle = '#3b4a65';
      for (let x = 0; x < WORLD_W; x += 120) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, WORLD_H);
        g.stroke();
      }
      for (let y = 0; y < WORLD_H; y += 120) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(WORLD_W, y);
        g.stroke();
      }
    }

    g.globalAlpha = 1;
  }

  function drawTrackSurface(track, g, rng) {
    const theme = track.theme;
    const geom = track.geometry;
    const points = geom.points;
    const width = geom.width;

    g.save();
    g.translate(7, 9);
    strokeTrack(g, points, width + 52, 'rgba(4, 8, 7, 0.30)');
    g.restore();

    strokeTrack(g, points, width + 48, theme.runoff);
    strokeTrack(g, points, width + 40, theme.runoffDark);

    g.save();
    g.lineJoin = 'round';
    g.lineCap = 'butt';
    g.lineWidth = width + 23;
    g.setLineDash([24, 24]);
    g.strokeStyle = theme.curbB;
    tracePath(g, points);
    g.stroke();
    g.lineDashOffset = 24;
    g.strokeStyle = theme.curbA;
    tracePath(g, points);
    g.stroke();
    g.restore();

    strokeTrack(g, points, width, theme.asphalt);

    // Subtle dark tyre lines.
    strokeOffsetTrack(g, points, width * 0.19, 25, 'rgba(8, 11, 11, 0.105)');
    strokeOffsetTrack(g, points, -width * 0.19, 25, 'rgba(8, 11, 11, 0.105)');

    // Asphalt speckle.
    for (let i = 0; i < 7600; i++) {
      const p = points[Math.floor(rng() * points.length)];
      const off = (rng() - 0.5) * width * 0.89;
      const x = p.x + p.nx * off;
      const y = p.y + p.ny * off;
      g.globalAlpha = 0.09 + rng() * 0.14;
      g.fillStyle = rng() > 0.5 ? theme.asphaltLight : theme.asphaltDark;
      g.fillRect(x, y, 1 + rng() * 2.5, 1 + rng() * 2.5);
    }
    g.globalAlpha = 1;

    // White edge lines.
    strokeOffsetTrack(g, points, width * 0.5 - 8, 3, 'rgba(240, 240, 223, 0.78)');
    strokeOffsetTrack(g, points, -width * 0.5 + 8, 3, 'rgba(240, 240, 223, 0.78)');

    drawStartLine(track, g);
  }

  function drawStartLine(track, g) {
    const geom = track.geometry;
    const p = geom.points[0];
    const angle = Math.atan2(p.ty, p.tx);
    const width = geom.width;
    const cell = 13;
    const startLength = cell * 2;

    g.save();
    g.translate(p.x, p.y);
    g.rotate(angle);

    // Checkered finish strip.
    const columns = 2;
    const rows = Math.ceil((width * 0.92) / cell);
    const half = (rows * cell) / 2;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        g.fillStyle = (row + col) % 2 === 0 ? '#efeada' : '#171b1b';
        g.fillRect(-startLength / 2 + col * cell, -half + row * cell, cell, cell);
      }
    }
    g.strokeStyle = 'rgba(247, 243, 225, 0.8)';
    g.lineWidth = 2;
    g.strokeRect(-startLength / 2, -half, startLength, rows * cell);

    // Starting grid slots.
    g.strokeStyle = 'rgba(240, 239, 224, 0.38)';
    g.lineWidth = 2;
    const gridSlots = [
      [-50, -width * 0.18],
      [-50, width * 0.18],
      [-106, -width * 0.18],
      [-106, width * 0.18],
    ];
    for (const [back, side] of gridSlots) {
      g.strokeRect(back - 18, side - 13, 36, 26);
    }

    // Start / finish flags at the edge of the track.
    for (const side of [-1, 1]) {
      const y = side * (width * 0.5 + 24);
      g.fillStyle = '#141a1b';
      g.fillRect(-2, y - 2, 4, 4);
      g.strokeStyle = '#e8e2d2';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(0, y + side * -21);
      g.stroke();
      const flagY = y + side * -21;
      for (let fy = 0; fy < 2; fy++) {
        for (let fx = 0; fx < 4; fx++) {
          g.fillStyle = (fx + fy) % 2 === 0 ? '#f1ecdb' : '#171b1b';
          g.fillRect(1 + fx * 6, flagY + fy * 6, 6, 6);
        }
      }
    }

    // Track name stencilled on the verge.
    g.rotate(0);
    g.font = '700 13px Consolas, monospace';
    g.fillStyle = 'rgba(245, 239, 218, 0.35)';
    g.textAlign = 'center';
    g.fillText(track.def.name, -28, -width * 0.5 - 58);
    g.textAlign = 'left';

    g.restore();
  }

  /* -------------------------------------------------------------------
     Track decorations
     ------------------------------------------------------------------- */

  function buildDecor(track) {
    const geom = track.geometry;
    const theme = track.theme;
    const rng = mulberry32(track.def.seed * 31 + 77);
    const items = [];
    const halfWidth = geom.width * 0.5;

    function place(count, extraClearance, factory) {
      let placed = 0;
      let attempts = 0;
      while (placed < count && attempts < count * 40) {
        attempts++;
        const x = 50 + rng() * (WORLD_W - 100);
        const y = 50 + rng() * (WORLD_H - 100);
        const clearance = halfWidth + extraClearance;
        if (distanceToTrackSq(x, y, geom.points) < clearance * clearance) continue;
        items.push(factory(x, y, rng));
        placed++;
      }
    }

    if (theme.scenery === 'forest') {
      place(125, 44, (x, y, r) => ({ type: 'tree', x, y, s: 0.8 + r() * 0.8, rot: r() * TAU }));
      place(88, 20, (x, y, r) => ({ type: 'bush', x, y, s: 0.7 + r() * 0.8, rot: r() * TAU }));
      place(30, 18, (x, y, r) => ({ type: 'stump', x, y, s: 0.8 + r() * 0.7, rot: r() * TAU }));
    } else if (theme.scenery === 'desert') {
      place(100, 32, (x, y, r) => ({ type: 'rock', x, y, s: 0.7 + r() * 1.15, rot: r() * TAU }));
      place(50, 25, (x, y, r) => ({ type: 'cactus', x, y, s: 0.75 + r() * 0.55, rot: 0 }));
      place(92, 18, (x, y, r) => ({ type: 'scrub', x, y, s: 0.7 + r() * 0.7, rot: r() * TAU }));
    } else if (theme.scenery === 'harbor') {
      place(48, 30, (x, y, r) => ({ type: 'crate', x, y, s: 0.75 + r() * 0.6, rot: (r() - 0.5) * 0.4 }));
      place(58, 22, (x, y, r) => ({ type: 'barrel', x, y, s: 0.8 + r() * 0.45, rot: r() * TAU }));
      place(28, 42, (x, y, r) => ({ type: 'palm', x, y, s: 0.8 + r() * 0.65, rot: r() * TAU }));
      place(22, 25, (x, y, r) => ({ type: 'puddle', x, y, s: 0.8 + r() * 1.2, rot: r() * TAU }));
    } else {
      place(24, 120, (x, y, r) => ({
        type: 'building',
        x, y,
        s: 0.8 + r() * 0.9,
        rot: Math.floor(r() * 4) * (Math.PI / 2),
        neon: r() > 0.42,
      }));
      place(44, 24, (x, y, r) => ({ type: 'bush', x, y, s: 0.6 + r() * 0.7, rot: r() * TAU }));
      place(30, 20, (x, y, r) => ({ type: 'barrel', x, y, s: 0.75 + r() * 0.45, rot: r() * TAU }));
    }

    // Trackside lamps at night.
    if (theme.night) {
      for (let i = 18; i < geom.n; i += 54) {
        const side = (i / 54) % 2 < 1 ? 1 : -1;
        const p = geom.points[i];
        items.push({
          type: 'lamp',
          x: p.x + p.nx * side * (halfWidth + 30),
          y: p.y + p.ny * side * (halfWidth + 30),
          s: 1,
          rot: 0,
        });
      }
    }

    return items;
  }

  function drawDecorations(track, g) {
    for (const item of track.decor) {
      g.save();
      g.translate(item.x, item.y);
      g.rotate(item.rot || 0);
      g.scale(item.s, item.s);
      const theme = track.theme;

      if (item.type === 'tree') {
        g.fillStyle = 'rgba(0, 0, 0, 0.23)';
        g.beginPath();
        g.ellipse(10, 13, 24, 12, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#4d3420';
        g.fillRect(-4, -2, 8, 15);
        g.fillStyle = '#163c24';
        g.beginPath();
        g.arc(-10, -7, 17, 0, TAU);
        g.arc(10, -8, 19, 0, TAU);
        g.arc(0, -22, 21, 0, TAU);
        g.fill();
        g.fillStyle = '#20502f';
        g.beginPath();
        g.arc(-11, -13, 12, 0, TAU);
        g.arc(8, -19, 12, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(93, 141, 83, 0.42)';
        g.beginPath();
        g.arc(-9, -22, 7, 0, TAU);
        g.fill();
      } else if (item.type === 'bush') {
        g.fillStyle = 'rgba(0, 0, 0, 0.18)';
        g.beginPath();
        g.ellipse(3, 5, 15, 8, 0, 0, TAU);
        g.fill();
        g.fillStyle = theme.scenery === 'midnight' ? '#1f4435' : '#2d6238';
        g.beginPath();
        g.arc(-7, 0, 9, 0, TAU);
        g.arc(5, -3, 10, 0, TAU);
        g.arc(1, 5, 8, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(117, 157, 91, 0.28)';
        g.beginPath();
        g.arc(0, -4, 5, 0, TAU);
        g.fill();
      } else if (item.type === 'stump') {
        g.fillStyle = 'rgba(0, 0, 0, 0.18)';
        g.beginPath();
        g.ellipse(3, 5, 10, 5, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#523821';
        g.beginPath();
        g.arc(0, 0, 8, 0, TAU);
        g.fill();
        g.strokeStyle = '#795532';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(0, 0, 5, 0, TAU);
        g.stroke();
      } else if (item.type === 'rock') {
        g.fillStyle = 'rgba(0, 0, 0, 0.2)';
        g.beginPath();
        g.ellipse(4, 5, 17, 8, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#786a55';
        g.beginPath();
        g.moveTo(-14, 6);
        g.lineTo(-8, -9);
        g.lineTo(3, -14);
        g.lineTo(15, -3);
        g.lineTo(11, 9);
        g.lineTo(-4, 12);
        g.closePath();
        g.fill();
        g.fillStyle = '#9b8b72';
        g.beginPath();
        g.moveTo(-8, -8);
        g.lineTo(2, -12);
        g.lineTo(9, -3);
        g.lineTo(-1, 1);
        g.closePath();
        g.fill();
      } else if (item.type === 'cactus') {
        g.fillStyle = 'rgba(0, 0, 0, 0.2)';
        g.beginPath();
        g.ellipse(5, 7, 11, 5, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#466b39';
        g.fillRect(-4, -22, 8, 30);
        g.fillRect(-13, -10, 8, 14);
        g.fillRect(5, -16, 8, 17);
        g.fillStyle = '#5d8750';
        g.fillRect(-3, -19, 2, 22);
      } else if (item.type === 'scrub') {
        g.strokeStyle = '#8f7448';
        g.lineWidth = 1.4;
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI + (i / 7) * Math.PI;
          g.beginPath();
          g.moveTo(0, 4);
          g.quadraticCurveTo(Math.cos(a) * 6, -4, Math.cos(a) * 12, -10);
          g.stroke();
        }
      } else if (item.type === 'crate') {
        g.fillStyle = 'rgba(0, 0, 0, 0.22)';
        g.fillRect(-16, -11, 35, 28);
        g.fillStyle = '#795329';
        g.fillRect(-18, -14, 36, 28);
        g.strokeStyle = '#9d753d';
        g.lineWidth = 2;
        g.strokeRect(-18, -14, 36, 28);
        g.beginPath();
        g.moveTo(-18, -14);
        g.lineTo(18, 14);
        g.moveTo(18, -14);
        g.lineTo(-18, 14);
        g.stroke();
      } else if (item.type === 'barrel') {
        g.fillStyle = 'rgba(0, 0, 0, 0.2)';
        g.beginPath();
        g.ellipse(3, 4, 8, 7, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#a74f39';
        g.beginPath();
        g.arc(0, 0, 8, 0, TAU);
        g.fill();
        g.strokeStyle = '#e3a65d';
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(0, 0, 5, 0, TAU);
        g.stroke();
      } else if (item.type === 'palm') {
        g.fillStyle = 'rgba(0, 0, 0, 0.2)';
        g.beginPath();
        g.ellipse(7, 8, 15, 8, 0, 0, TAU);
        g.fill();
        g.strokeStyle = '#5b462a';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(0, 16);
        g.lineTo(1, -5);
        g.stroke();
        g.strokeStyle = '#37683f';
        g.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          g.beginPath();
          g.moveTo(1, -7);
          g.quadraticCurveTo(Math.cos(a) * 9, -17 + Math.sin(a) * 3, Math.cos(a) * 17, -15 + Math.sin(a) * 9);
          g.stroke();
        }
      } else if (item.type === 'puddle') {
        g.fillStyle = 'rgba(92, 143, 153, 0.28)';
        g.beginPath();
        g.ellipse(0, 0, 20, 9, 0, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(194, 220, 216, 0.18)';
        g.lineWidth = 1;
        g.stroke();
      } else if (item.type === 'building') {
        g.fillStyle = 'rgba(0, 0, 0, 0.35)';
        g.fillRect(-45 + 8, -36 + 10, 90, 72);
        g.fillStyle = '#202838';
        g.fillRect(-45, -36, 90, 72);
        g.strokeStyle = '#39465e';
        g.lineWidth = 2;
        g.strokeRect(-45, -36, 90, 72);
        g.fillStyle = '#2d374a';
        g.fillRect(-33, -25, 30, 22);
        g.fillRect(7, 10, 25, 16);
        g.fillStyle = '#3c4b65';
        g.fillRect(-32, 17, 22, 9);
        g.fillStyle = item.neon ? 'rgba(94, 225, 238, 0.82)' : 'rgba(255, 205, 102, 0.6)';
        g.fillRect(-45, -36, 90, 3);
        g.fillStyle = 'rgba(255, 200, 93, 0.5)';
        g.fillRect(-37, -31, 5, 3);
        g.fillRect(20, -29, 5, 3);
      } else if (item.type === 'lamp') {
        const grad = g.createRadialGradient(0, 0, 4, 0, 0, 72);
        grad.addColorStop(0, 'rgba(255, 219, 137, 0.22)');
        grad.addColorStop(1, 'rgba(255, 219, 137, 0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(0, 0, 72, 0, TAU);
        g.fill();
        g.fillStyle = '#1a202c';
        g.beginPath();
        g.arc(0, 0, 5, 0, TAU);
        g.fill();
        g.fillStyle = '#ffe29b';
        g.beginPath();
        g.arc(0, 0, 2.3, 0, TAU);
        g.fill();
      }

      g.restore();
    }
  }

  /* -------------------------------------------------------------------
     Mini map
     ------------------------------------------------------------------- */

  function buildMiniMap(track) {
    const geom = track.geometry;
    const width = geom.width;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of geom.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    minX -= width * 0.5 + 90;
    minY -= width * 0.5 + 90;
    maxX += width * 0.5 + 90;
    maxY += width * 0.5 + 90;

    const c = makeCanvas(480, 300);
    const g = c.getContext('2d');
    const pad = 20;
    const scale = Math.min((c.width - pad * 2) / (maxX - minX), (c.height - pad * 2) / (maxY - minY));
    const ox = (c.width - (maxX - minX) * scale) / 2 - minX * scale;
    const oy = (c.height - (maxY - minY) * scale) / 2 - minY * scale;

    const pathPoints = geom.points.map((p) => ({ x: p.x * scale + ox, y: p.y * scale + oy }));
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.lineWidth = Math.max(7, width * scale);
    g.strokeStyle = 'rgba(4, 8, 9, 0.85)';
    tracePath(g, pathPoints);
    g.stroke();
    g.lineWidth = Math.max(5, width * scale - 3);
    g.strokeStyle = 'rgba(218, 220, 206, 0.88)';
    tracePath(g, pathPoints);
    g.stroke();

    const start = geom.points[0];
    g.fillStyle = track.theme.accent;
    g.beginPath();
    g.arc(start.x * scale + ox, start.y * scale + oy, 5, 0, TAU);
    g.fill();

    return {
      canvas: c,
      scale,
      ox,
      oy,
      minX,
      minY,
      toMapX: (x) => x * scale + ox,
      toMapY: (y) => y * scale + oy,
    };
  }

  /* -------------------------------------------------------------------
     Track construction
     ------------------------------------------------------------------- */

  function buildTrack(def) {
    const geom = buildGeometry(def);
    const theme = THEMES[def.theme];
    const bg = makeCanvas(WORLD_W, WORLD_H);
    const g = bg.getContext('2d');
    const rng = mulberry32(def.seed);

    const track = {
      def,
      theme,
      geometry: geom,
      bgCanvas: bg,
      skidCanvas: makeCanvas(WORLD_W, WORLD_H),
      skidCtx: null,
      map: null,
      decor: [],
    };

    drawGround(track, g, rng);
    drawTrackSurface(track, g, rng);
    track.decor = buildDecor(track);
    drawDecorations(track, g);

    track.map = buildMiniMap(track);
    track.skidCtx = track.skidCanvas.getContext('2d');
    track.skidCtx.lineCap = 'round';

    return track;
  }

  /* -------------------------------------------------------------------
     Airfield test facility
     ------------------------------------------------------------------- */

  function airfieldCutRect(g, x, y, w, h, cut, fill, stroke = null) {
    g.beginPath();
    g.moveTo(x + cut, y);
    g.lineTo(x + w - cut, y);
    g.lineTo(x + w, y + cut);
    g.lineTo(x + w, y + h - cut);
    g.lineTo(x + w - cut, y + h);
    g.lineTo(x + cut, y + h);
    g.lineTo(x, y + h - cut);
    g.lineTo(x, y + cut);
    g.closePath();
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.stroke();
    }
  }

  function drawAirfieldHangar(g, x, y, w, h) {
    g.save();
    g.fillStyle = 'rgba(0, 0, 0, 0.28)';
    g.fillRect(x + 11, y + 13, w, h);
    g.fillStyle = '#525a53';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#343b37';
    g.lineWidth = 3;
    g.strokeRect(x, y, w, h);
    g.fillStyle = '#465047';
    g.fillRect(x + 8, y + 9, w - 16, h - 30);
    for (let i = 1; i < 6; i++) {
      g.strokeStyle = 'rgba(170, 177, 160, 0.14)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x + 8, y + 9 + (i / 6) * (h - 30));
      g.lineTo(x + w - 8, y + 9 + (i / 6) * (h - 30));
      g.stroke();
    }
    g.fillStyle = '#2a302d';
    g.fillRect(x + 11, y + h - 18, w - 22, 13);
    g.fillStyle = 'rgba(206, 181, 92, 0.5)';
    g.fillRect(x + 11, y + h - 18, w - 22, 2);
    g.fillStyle = 'rgba(236, 233, 215, 0.32)';
    g.fillRect(x + 10, y + 7, 30, 3);
    g.restore();
  }

  function drawParkedPlane(g, x, y, angle, scale, color) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.scale(scale, scale);
    g.fillStyle = 'rgba(0, 0, 0, 0.24)';
    g.beginPath();
    g.ellipse(6, 9, 42, 15, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#e8e3d3';
    g.beginPath();
    g.ellipse(0, 0, 40, 7, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#d5d0bf';
    g.beginPath();
    g.moveTo(-1, -6);
    g.lineTo(13, -27);
    g.lineTo(22, -27);
    g.lineTo(13, -6);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-1, 6);
    g.lineTo(13, 27);
    g.lineTo(22, 27);
    g.lineTo(13, 6);
    g.closePath();
    g.fill();
    g.fillStyle = color;
    g.fillRect(-34, -6, 11, 12);
    g.fillRect(-33, -1.5, 32, 3);
    g.fillStyle = '#9fa8a0';
    g.beginPath();
    g.moveTo(-24, -2);
    g.lineTo(-34, -18);
    g.lineTo(-28, -18);
    g.lineTo(-19, -2);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-24, 2);
    g.lineTo(-34, 18);
    g.lineTo(-28, 18);
    g.lineTo(-19, 2);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(20, 31, 35, 0.75)';
    g.beginPath();
    g.ellipse(17, 0, 6, 4.5, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawCone(g, x, y, scale = 1) {
    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    g.fillStyle = 'rgba(0, 0, 0, 0.2)';
    g.beginPath();
    g.ellipse(2, 3, 5, 2.5, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#d55a38';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(4.5, 3);
    g.lineTo(-4.5, 3);
    g.closePath();
    g.fill();
    g.fillStyle = '#f0e6ce';
    g.fillRect(-3, -2, 6, 2);
    g.restore();
  }

  function drawWindsock(g, x, y) {
    g.save();
    g.translate(x, y);
    g.fillStyle = '#202725';
    g.fillRect(-3, 0, 6, 3);
    g.strokeStyle = '#d2d4c5';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 2);
    g.lineTo(0, 34);
    g.stroke();
    g.translate(0, 30);
    g.fillStyle = '#d7673d';
    g.beginPath();
    g.moveTo(0, -1);
    g.lineTo(34, 4);
    g.lineTo(34, 12);
    g.lineTo(0, 9);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(245, 239, 218, 0.8)';
    g.fillRect(9, 3, 5, 6);
    g.fillRect(23, 5, 5, 6);
    g.restore();
  }

  function drawAirfieldArt(track, g, rng) {
    const theme = track.theme;
    const apron = track.apron;
    const runway = track.runway;

    g.fillStyle = theme.ground;
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Mown grass bands and dry patches.
    for (let y = 0; y < WORLD_H; y += 90) {
      g.fillStyle = y % 180 === 0 ? 'rgba(255, 243, 190, 0.025)' : 'rgba(14, 25, 18, 0.04)';
      g.fillRect(0, y, WORLD_W, 90);
    }
    for (let i = 0; i < 520; i++) {
      const x = rng() * WORLD_W;
      const y = rng() * WORLD_H;
      const r = 20 + rng() * 110;
      g.globalAlpha = 0.035 + rng() * 0.055;
      g.fillStyle = rng() > 0.5 ? theme.groundLight : theme.groundDark;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.3 + rng() * 0.5), rng() * TAU, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 0.26;
    g.strokeStyle = theme.groundDetail;
    g.lineWidth = 1.1;
    for (let i = 0; i < 3100; i++) {
      const x = rng() * WORLD_W;
      const y = rng() * WORLD_H;
      const len = 2 + rng() * 4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - len * 0.4, y - len);
      g.stroke();
    }
    g.globalAlpha = 1;

    // Concrete apron.
    airfieldCutRect(g, apron.x + 10, apron.y + 12, apron.w, apron.h, 38, 'rgba(0, 0, 0, 0.24)');
    airfieldCutRect(g, apron.x, apron.y, apron.w, apron.h, 38, theme.asphalt, 'rgba(35, 39, 36, 0.8)');
    g.lineWidth = 2;

    // Expansion joints.
    g.strokeStyle = 'rgba(44, 48, 44, 0.24)';
    g.lineWidth = 1.5;
    for (let x = apron.x + 120; x < apron.x + apron.w - 40; x += 148) {
      g.beginPath();
      g.moveTo(x, apron.y + 35);
      g.lineTo(x, apron.y + apron.h - 35);
      g.stroke();
    }
    for (let y = apron.y + 110; y < apron.y + apron.h - 40; y += 128) {
      g.beginPath();
      g.moveTo(apron.x + 36, y);
      g.lineTo(apron.x + apron.w - 36, y);
      g.stroke();
    }

    // Runway.
    g.fillStyle = 'rgba(0, 0, 0, 0.28)';
    g.fillRect(runway.x + 11, runway.y + 12, runway.w, runway.h);
    g.fillStyle = '#3d4241';
    g.fillRect(runway.x, runway.y, runway.w, runway.h);
    g.strokeStyle = 'rgba(22, 26, 25, 0.8)';
    g.lineWidth = 3;
    g.strokeRect(runway.x, runway.y, runway.w, runway.h);
    g.fillStyle = 'rgba(225, 222, 205, 0.23)';
    g.fillRect(runway.x + 14, runway.y + 10, runway.w - 28, 3);
    g.fillRect(runway.x + 14, runway.y + runway.h - 13, runway.w - 28, 3);

    // Runway centre line.
    g.fillStyle = 'rgba(232, 227, 211, 0.62)';
    for (let x = runway.x + 80; x < runway.x + runway.w - 80; x += 76) {
      g.fillRect(x, runway.y + runway.h * 0.5 - 2.5, 42, 5);
    }

    // Threshold piano keys.
    for (const end of [0, 1]) {
      const baseX = end === 0 ? runway.x + 42 : runway.x + runway.w - 92;
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 === 0 ? 'rgba(239, 234, 216, 0.72)' : 'rgba(20, 25, 24, 0.65)';
        g.fillRect(baseX, runway.y + 26 + i * 28, 31, 18);
      }
    }

    // Runway designators.
    g.save();
    g.fillStyle = 'rgba(238, 233, 215, 0.72)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 62px Impact, Haettenschweiler, sans-serif';
    g.translate(runway.x + 150, runway.y + runway.h / 2);
    g.rotate(-Math.PI / 2);
    g.fillText('09', 0, 0);
    g.restore();
    g.save();
    g.fillStyle = 'rgba(238, 233, 215, 0.72)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 62px Impact, Haettenschweiler, sans-serif';
    g.translate(runway.x + runway.w - 150, runway.y + runway.h / 2);
    g.rotate(Math.PI / 2);
    g.fillText('27', 0, 0);
    g.restore();

    // Yellow taxi guidance lines across the apron.
    g.save();
    g.strokeStyle = 'rgba(219, 183, 77, 0.46)';
    g.lineWidth = 5;
    g.setLineDash([32, 20]);
    g.beginPath();
    g.moveTo(apron.x + 230, apron.y + apron.h - 180);
    g.lineTo(apron.x + 1100, apron.y + apron.h - 180);
    g.lineTo(apron.x + 1320, apron.y + apron.h - 430);
    g.lineTo(apron.x + 1320, runway.y + runway.h + 55);
    g.stroke();
    g.setLineDash([]);
    g.restore();

    // Skid pad.
    const padX = 2200;
    const padY = 1340;
    const padR = 142;
    g.strokeStyle = 'rgba(239, 234, 216, 0.66)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(padX, padY, padR, 0, TAU);
    g.stroke();
    g.strokeStyle = 'rgba(239, 234, 216, 0.26)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(padX, padY, padR - 23, 0, TAU);
    g.stroke();
    g.strokeStyle = 'rgba(239, 234, 216, 0.35)';
    g.beginPath();
    g.moveTo(padX - padR, padY);
    g.lineTo(padX + padR, padY);
    g.moveTo(padX, padY - padR);
    g.lineTo(padX, padY + padR);
    g.stroke();
    g.fillStyle = 'rgba(239, 234, 216, 0.42)';
    g.font = '700 12px Consolas, monospace';
    g.textAlign = 'center';
    g.fillText('SKID PAD', padX, padY + padR + 25);
    g.textAlign = 'left';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      drawCone(g, padX + Math.cos(a) * (padR + 16), padY + Math.sin(a) * (padR + 16), 1);
    }

    // Apron lettering.
    g.save();
    g.globalAlpha = 0.19;
    g.fillStyle = '#f0ead8';
    g.font = '700 58px Impact, Haettenschweiler, sans-serif';
    g.textAlign = 'center';
    g.fillText('TEST AIRFIELD', 1050, 1510);
    g.font = '700 17px Consolas, monospace';
    g.globalAlpha = 0.25;
    g.fillText('NO RIVALS  /  NO LAPS  /  NO EXCUSES', 1050, 1542);
    g.restore();

    // Windsock and perimeter cones.
    drawWindsock(g, 240, 1610);
    for (let i = 0; i < 17; i++) {
      drawCone(g, 340 + i * 140, apron.y + apron.h - 25, 0.9);
    }

    // Hangars along the north edge.
    drawAirfieldHangar(g, 390, 152, 330, 140);
    drawAirfieldHangar(g, 800, 166, 270, 126);
    drawAirfieldHangar(g, 1160, 144, 330, 148);
    drawAirfieldHangar(g, 2160, 1710, 330, 128);

    // Control tower.
    g.save();
    g.fillStyle = 'rgba(0, 0, 0, 0.25)';
    g.fillRect(2578, 160, 72, 116);
    g.fillStyle = '#48534a';
    g.fillRect(2570, 150, 72, 116);
    g.fillStyle = '#68756a';
    g.fillRect(2587, 166, 38, 32);
    g.fillStyle = 'rgba(142, 198, 210, 0.55)';
    for (let i = 0; i < 3; i++) {
      g.fillRect(2592 + i * 11, 172, 7, 20);
    }
    g.fillStyle = '#b5b5a1';
    g.fillRect(2580, 145, 52, 5);
    g.fillStyle = '#d65a3e';
    g.beginPath();
    g.arc(2606, 141, 5, 0, TAU);
    g.fill();
    g.restore();

    // Parked aircraft.
    drawParkedPlane(g, 540, 1795, -0.08, 1.0, '#c94e3d');
    drawParkedPlane(g, 2620, 1835, 0.08, 0.92, '#4f9ab3');
    drawParkedPlane(g, 1880, 203, -0.05, 0.8, '#8f9e8c');

    // Fuel tanks.
    for (let i = 0; i < 3; i++) {
      g.fillStyle = 'rgba(0, 0, 0, 0.22)';
      g.beginPath();
      g.ellipse(2660 + i * 55 + 4, 1568 + 6, 23, 23, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#687064';
      g.beginPath();
      g.arc(2660 + i * 55, 1568, 22, 0, TAU);
      g.fill();
      g.strokeStyle = '#3e473f';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = '#bac1a8';
      g.fillRect(2658 + i * 55, 1556, 4, 12);
    }

    // Simple perimeter fence.
    g.strokeStyle = 'rgba(201, 198, 177, 0.2)';
    g.lineWidth = 2;
    g.setLineDash([10, 12]);
    g.strokeRect(45, 45, WORLD_W - 90, WORLD_H - 90);
    g.setLineDash([]);

    // Rubber and wear marks on the concrete.
    for (let i = 0; i < 160; i++) {
      const x = apron.x + 30 + rng() * (apron.w - 60);
      const y = apron.y + 30 + rng() * (apron.h - 60);
      g.globalAlpha = 0.025 + rng() * 0.05;
      g.strokeStyle = '#222725';
      g.lineWidth = 1 + rng() * 4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 20 + rng() * 90, y + (rng() - 0.5) * 18);
      g.stroke();
    }
    g.globalAlpha = 1;

    // Grass tufts in front of the fence and around the edges.
    g.globalAlpha = 0.28;
    g.strokeStyle = theme.groundDetail;
    g.lineWidth = 1.2;
    for (let i = 0; i < 900; i++) {
      const x = 80 + rng() * (WORLD_W - 160);
      const y = 80 + rng() * (WORLD_H - 160);
      if (x > apron.x - 20 && x < apron.x + apron.w + 20 && y > apron.y - 20 && y < apron.y + apron.h + 20) continue;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 3, y - 5);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function buildAirfieldTrack() {
    const bg = makeCanvas(WORLD_W, WORLD_H);
    const g = bg.getContext('2d');
    const rng = mulberry32(8181);
    const apron = { x: 260, y: 340, w: 2480, h: 1300 };
    const runway = { x: 110, y: 795, w: 2780, h: 230 };
    const track = {
      isTest: true,
      def: {
        id: 'airfield',
        name: 'TEST AIRFIELD',
        location: 'FREE DRIVE FACILITY',
        distance: 'OPEN',
        difficulty: 0,
        theme: 'airfield',
      },
      theme: AIRFIELD_THEME,
      bgCanvas: bg,
      skidCanvas: makeCanvas(WORLD_W, WORLD_H),
      skidCtx: null,
      map: null,
      apron,
      runway,
      tarmac: [
        { x1: apron.x, y1: apron.y, x2: apron.x + apron.w, y2: apron.y + apron.h },
        { x1: runway.x, y1: runway.y, x2: runway.x + runway.w, y2: runway.y + runway.h },
      ],
      spawn: { x: 640, y: 908, angle: 0 },
    };

    drawAirfieldArt(track, g, rng);
    track.skidCtx = track.skidCanvas.getContext('2d');
    track.skidCtx.lineCap = 'round';
    return track;
  }

  function isOnAirfieldTarmac(x, y, track) {
    return track.tarmac.some((rect) => x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2);
  }

  /* -------------------------------------------------------------------
     Audio
     ------------------------------------------------------------------- */

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.engineGain = null;
      this.engineOsc = null;
      this.engineOsc2 = null;
      this.engineFilter = null;
      this.skidGain = null;
      this.skidFilter = null;
      this.skidSource = null;
      this.muted = false;
      this.started = false;
    }

    init() {
      if (this.started) {
        this.resume();
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      try {
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        this.master.connect(this.ctx.destination);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 480;
        this.engineFilter.Q.value = 3.5;

        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineOsc2.type = 'square';
        this.engineOsc2.frequency.value = 27.5;

        const engine2Gain = this.ctx.createGain();
        engine2Gain.gain.value = 0.32;
        this.engineOsc.connect(this.engineFilter);
        this.engineOsc2.connect(engine2Gain);
        engine2Gain.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);

        const noiseLength = Math.floor(this.ctx.sampleRate * 1.5);
        const buffer = this.ctx.createBuffer(1, noiseLength, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

        this.skidSource = this.ctx.createBufferSource();
        this.skidSource.buffer = buffer;
        this.skidSource.loop = true;
        this.skidFilter = this.ctx.createBiquadFilter();
        this.skidFilter.type = 'bandpass';
        this.skidFilter.frequency.value = 1350;
        this.skidFilter.Q.value = 1.4;
        this.skidGain = this.ctx.createGain();
        this.skidGain.gain.value = 0;
        this.skidSource.connect(this.skidFilter);
        this.skidFilter.connect(this.skidGain);
        this.skidGain.connect(this.master);

        this.engineOsc.start();
        this.engineOsc2.start();
        this.skidSource.start();
        this.started = true;
        this.resume();
      } catch (err) {
        this.ctx = null;
        this.started = false;
      }
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    }

    setMuted(value) {
      this.muted = value;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(value ? 0 : 0.55, this.ctx.currentTime, 0.02);
      }
    }

    updateEngine(ratio, throttle, active) {
      if (!this.started || !this.ctx) return;
      const now = this.ctx.currentTime;
      const freq = 48 + ratio * 138 + (throttle ? 5 : 0);
      this.engineOsc.frequency.setTargetAtTime(freq, now, 0.045);
      this.engineOsc2.frequency.setTargetAtTime(freq * 0.5, now, 0.055);
      this.engineFilter.frequency.setTargetAtTime(310 + ratio * 1450 + (throttle ? 170 : 0), now, 0.06);
      const volume = active ? 0.017 + ratio * 0.034 : 0;
      this.engineGain.gain.setTargetAtTime(volume, now, 0.07);
    }

    updateTires(amount, active) {
      if (!this.started || !this.ctx) return;
      const now = this.ctx.currentTime;
      this.skidGain.gain.setTargetAtTime(active ? clamp(amount, 0, 1) * 0.075 : 0, now, 0.045);
      this.skidFilter.frequency.setTargetAtTime(950 + amount * 900, now, 0.07);
    }

    tone(freq, duration = 0.1, type = 'square', volume = 0.08, delay = 0) {
      if (!this.started || !this.ctx) return;
      const start = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    }

    beep(kind = 'count') {
      if (kind === 'go') {
        this.tone(880, 0.22, 'square', 0.1);
        this.tone(1320, 0.18, 'square', 0.05, 0.03);
      } else if (kind === 'lap') {
        this.tone(660, 0.09, 'square', 0.065);
        this.tone(990, 0.13, 'square', 0.06, 0.085);
      } else if (kind === 'record') {
        this.tone(880, 0.09, 'square', 0.07);
        this.tone(1100, 0.09, 'square', 0.07, 0.1);
        this.tone(1320, 0.18, 'square', 0.07, 0.2);
      } else {
        this.tone(440, 0.1, 'square', 0.07);
      }
    }

    fanfare(place) {
      if (!this.started) return;
      if (place === 1) {
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, 'square', 0.08, i * 0.12));
      } else {
        [392, 523, 659].forEach((f, i) => this.tone(f, 0.18, 'square', 0.065, i * 0.13));
      }
    }

    impact(intensity = 1) {
      if (!this.started || !this.ctx) return;
      const now = this.ctx.currentTime;
      const duration = 0.13;
      const length = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500 + intensity * 600;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(clamp(0.06 * intensity, 0.01, 0.14), now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start(now);
      source.stop(now + duration + 0.02);
    }
  }

  const sound = new SoundEngine();

  /* -------------------------------------------------------------------
     Global game state
     ------------------------------------------------------------------- */

  const $ = (id) => document.getElementById(id);
  const menuScreen = $('menuScreen');
  const pauseScreen = $('pauseScreen');
  const resultsScreen = $('resultsScreen');
  const garageScreen = $('garageScreen');
  const trackListEl = $('trackList');
  const trackCountEl = $('trackCount');
  const trackRecordEl = $('trackRecord');
  const recordLabelEl = $('recordLabel');
  const startLabelEl = $('startLabel');
  const panelHintEl = $('panelHint');
  const testTrackButton = $('testTrackButton');
  const garageButton = $('garageButton');
  const garageCarName = $('garageCarName');
  const garageThumb = $('garageThumb');
  const toastEl = $('toast');

  let state = 'menu';
  let currentTrack = null;
  let selectedTrackIndex = 0;
  let selectedTest = false;
  let totalLaps = 3;
  let difficultyKey = 'pro';
  let playerCarType = 'supra';
  let playerColor = PLAYER.color;
  let playerAccent = PLAYER.accent;
  let garageOpen = false;
  let race = null;
  let muted = false;
  let toastTimer = 0;
  let lastFrame = performance.now();
  let accumulator = 0;

  const camera = { x: 1500, y: 1000, zoom: 0.78, shake: 0 };
  const menu = { index: 0 };

  const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    handbrake: false,
  };

  /* -------------------------------------------------------------------
     Setup / menu UI
     ------------------------------------------------------------------- */

  function buildTrackList() {
    trackListEl.innerHTML = '';
    TRACK_DEFS.forEach((def, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'track-card';
      button.dataset.index = String(index);
      button.setAttribute('aria-pressed', 'false');
      const pips = [1, 2, 3].map((n) => `<span class="pip ${n <= def.difficulty ? 'on' : ''}"></span>`).join('');
      button.innerHTML = `
        <span class="track-num">0${index + 1} / ${def.location}</span>
        <span class="track-name">${def.name}</span>
        <span class="track-meta"><span>${def.distance}</span><span class="difficulty-pips">${pips}</span></span>
      `;
      button.addEventListener('click', () => selectTrack(index));
      trackListEl.appendChild(button);
    });
  }

  function getPlayerCarSpec() {
    return CAR_TYPES[playerCarType] || CAR_TYPES.supra;
  }

  function syncTrackUI() {
    const buttons = trackListEl.querySelectorAll('.track-card');
    buttons.forEach((button) => {
      const active = !selectedTest && Number(button.dataset.index) === selectedTrackIndex;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    testTrackButton.classList.toggle('active', selectedTest);
    testTrackButton.setAttribute('aria-pressed', selectedTest ? 'true' : 'false');
    trackCountEl.textContent = selectedTest ? 'TEST MODE' : `0${selectedTrackIndex + 1} / 0${TRACK_DEFS.length}`;
  }

  function syncOptionUI() {
    document.querySelectorAll('#lapOptions button').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.laps) === totalLaps);
    });
    document.querySelectorAll('#difficultyOptions button').forEach((button) => {
      button.classList.toggle('active', button.dataset.difficulty === difficultyKey);
    });
  }

  function syncModeUI() {
    document.querySelectorAll('.race-only').forEach((row) => {
      row.classList.toggle('hidden', selectedTest);
    });
    startLabelEl.textContent = selectedTest ? 'ENTER AIRFIELD' : 'START ENGINE';
    $('setupTitle').textContent = selectedTest ? 'TEST SETUP' : 'RACE SETUP';
    testTrackButton.classList.toggle('active', selectedTest);
    testTrackButton.setAttribute('aria-pressed', selectedTest ? 'true' : 'false');
    panelHintEl.textContent = selectedTest
      ? 'TIP: THE AIRFIELD IS WIDE OPEN. USE IT TO TEST TOP SPEED, BRAKING AND DRIFT BALANCE.'
      : "TIP: THE HANDBRAKE TURNS, BUT IT DOESN'T STOP. USE IT BEFORE THE CORNER, NOT IN IT.";
    syncRecordUI();
  }

  function syncRecordUI() {
    if (selectedTest) {
      recordLabelEl.textContent = 'AIRFIELD MODE';
      trackRecordEl.textContent = 'FREE DRIVE';
      return;
    }
    const def = TRACK_DEFS[selectedTrackIndex];
    const record = getRecord(def.id);
    recordLabelEl.textContent = 'TRACK RECORD';
    trackRecordEl.textContent = record ? formatTime(record) : '--:--.---';
  }

  function syncCarUI() {
    const spec = getPlayerCarSpec();
    garageCarName.textContent = spec.name;
    garageThumb.style.background = playerColor;
  }

  function buildCarTypeList() {
    const list = $('carTypeList');
    list.innerHTML = '';
    Object.entries(CAR_TYPES).forEach(([id, spec]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'car-type-card';
      button.dataset.type = id;
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `
        <canvas width="190" height="58" aria-hidden="true"></canvas>
        <span class="type-name">${spec.name}</span>
        <span class="type-class">${spec.className}</span>
      `;
      button.addEventListener('click', () => setPlayerCarType(id));
      list.appendChild(button);
    });
    refreshCarTypeIcons();
  }

  function refreshCarTypeIcons() {
    document.querySelectorAll('.car-type-card').forEach((button) => {
      const canvas = button.querySelector('canvas');
      if (canvas) drawCarTypeIcon(canvas, button.dataset.type);
      button.classList.toggle('active', button.dataset.type === playerCarType);
      button.setAttribute('aria-pressed', button.dataset.type === playerCarType ? 'true' : 'false');
    });
  }

  function drawCarTypeIcon(canvas, type) {
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.save();
    g.translate(canvas.width / 2 + 3, canvas.height / 2 + 2);
    g.scale(1.5, 1.5);
    drawCarBody(g, {
      type,
      color: playerColor,
      accent: playerAccent,
      number: 1,
      steer: 0,
      control: { brake: false },
    });
    g.restore();
  }

  function buildColorSwatches() {
    const wrap = $('colorSwatches');
    wrap.innerHTML = '';
    CAR_COLORS.forEach((color) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-swatch';
      button.dataset.color = color;
      button.style.background = color;
      button.setAttribute('aria-label', `Paint ${color}`);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => setPlayerColor(color));
      wrap.appendChild(button);
    });
    $('customColor').addEventListener('input', (event) => setPlayerColor(event.target.value));
    syncColorSwatches();
  }

  function syncColorSwatches() {
    document.querySelectorAll('.color-swatch').forEach((button) => {
      const active = button.dataset.color.toLowerCase() === playerColor.toLowerCase();
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const custom = $('customColor');
    if (custom && custom.value.toLowerCase() !== playerColor.toLowerCase()) custom.value = playerColor;
  }

  function setPlayerCarType(type) {
    if (!CAR_TYPES[type]) return;
    playerCarType = type;
    writeStore('carType', type);
    syncCarUI();
    refreshCarTypeIcons();
    refreshGarage();
  }

  function setPlayerColor(color) {
    playerColor = normalizeHexColor(color, playerColor);
    playerAccent = accentForPaint(playerColor);
    writeStore('carColor', playerColor);
    syncCarUI();
    syncColorSwatches();
    refreshCarTypeIcons();
    refreshGarage();
  }

  function openGarage() {
    if (state !== 'menu' || garageOpen) return;
    garageOpen = true;
    garageScreen.classList.remove('hidden');
    syncCarUI();
    refreshGarage();
  }

  function closeGarage() {
    if (!garageOpen) return;
    garageOpen = false;
    garageScreen.classList.add('hidden');
  }

  function refreshGarage() {
    if (!garageOpen) return;
    const spec = getPlayerCarSpec();
    $('garagePreviewName').textContent = spec.name;
    $('garagePreviewClass').textContent = spec.className;
    $('garageBlurb').textContent = spec.blurb;
    refreshCarTypeIcons();
    syncColorSwatches();

    const statRows = [
      ['TOP SPEED', spec.stats.speed],
      ['ACCELERATION', spec.stats.accel],
      ['GRIP', spec.stats.grip],
      ['BRAKING', spec.stats.brakes],
    ];
    $('garageStats').innerHTML = statRows.map(([label, value]) => `
      <div class="garage-stat">
        <div class="garage-stat-head"><span>${label}</span><span>${value}/5</span></div>
        <div class="garage-stat-track"><i style="width:${value * 20}%"></i></div>
      </div>
    `).join('');

    drawGaragePreview();
  }

  function drawGaragePreview() {
    const canvas = $('carPreview');
    if (!canvas) return;
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);

    g.save();
    g.translate(canvas.width / 2 + 4, canvas.height / 2 + 4);
    g.scale(3.6, 3.6);
    g.rotate(-Math.PI / 2);
    drawCarBody(g, {
      type: playerCarType,
      color: playerColor,
      accent: playerAccent,
      number: 1,
      steer: -0.04,
      control: { brake: false },
    });
    g.restore();
  }

  function selectTrack(index) {
    if (index < 0 || index >= TRACK_DEFS.length) return;
    const changed = selectedTest || index !== selectedTrackIndex || !currentTrack || currentTrack.isTest;
    selectedTest = false;
    selectedTrackIndex = index;
    writeStore('track', TRACK_DEFS[index].id);
    syncTrackUI();
    syncModeUI();
    if (!changed && currentTrack) return;

    currentTrack = buildTrack(TRACK_DEFS[index]);
    resetMenuScene();
  }

  function selectTestTrack() {
    const changed = !selectedTest || !currentTrack || !currentTrack.isTest;
    selectedTest = true;
    writeStore('track', 'airfield');
    syncTrackUI();
    syncModeUI();
    if (!changed) return;
    currentTrack = buildAirfieldTrack();
    resetMenuScene();
  }

  function resetMenuScene() {
    if (!currentTrack) return;
    camera.shake = 0;
    if (currentTrack.isTest) {
      const spawn = currentTrack.spawn;
      camera.x = spawn.x + 120;
      camera.y = spawn.y - 20;
      camera.zoom = 0.75;
      camera.shake = 0;
      menu.index = 0;
      return;
    }
    menu.index = Math.floor(currentTrack.geometry.n * 0.18);
    const p = currentTrack.geometry.points[menu.index];
    const ahead = currentTrack.geometry.points[mod(menu.index + 48, currentTrack.geometry.n)];
    camera.x = lerp(p.x, ahead.x, 0.72);
    camera.y = lerp(p.y, ahead.y, 0.72);
    camera.zoom = 0.77;
  }

  function showToast(text, duration = 1500) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  function updateRecordUI() {
    syncRecordUI();
  }

  /* -------------------------------------------------------------------
     Car creation and race setup
     ------------------------------------------------------------------- */

  function findNearestGlobal(car, geom) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < geom.points.length; i++) {
      const p = geom.points[i];
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function applyTrackInfo(car, geom, initial = false) {
    const n = geom.n;
    const anchor = car.trackIndex || 0;
    let best = anchor;
    let bestD = Infinity;

    if (initial) {
      best = findNearestGlobal(car, geom);
    } else {
      for (let d = -84; d <= 84; d++) {
        const i = mod(anchor + d, n);
        const p = geom.points[i];
        const dx = car.x - p.x;
        const dy = car.y - p.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestD) {
          bestD = dist;
          best = i;
        }
      }
    }

    if (initial) {
      const p = geom.points[best];
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      bestD = dx * dx + dy * dy;
    }

    const p = geom.points[best];
    const dx = car.x - p.x;
    const dy = car.y - p.y;
    const lateral = dx * p.nx + dy * p.ny;

    if (!initial) {
      let delta = best - car.trackIndex;
      if (delta > n / 2) delta -= n;
      else if (delta < -n / 2) delta += n;
      if (Math.abs(delta) <= 100) car.raceDistance += delta;
    }

    car.trackIndex = best;
    car.lateral = lateral;
    car.distanceFromCenter = Math.abs(lateral);
    car.edgeDistance = geom.width * 0.5 - Math.abs(lateral);
    car.surface = Math.abs(lateral) < geom.width * 0.5 - 5 ? 'road' : Math.abs(lateral) < geom.width * 0.5 + 11 ? 'curb' : 'grass';
    car.offRoad = car.surface === 'grass';
  }

  function makeCar(options) {
    return {
      isPlayer: Boolean(options.isPlayer),
      name: options.name,
      type: options.type || 'supra',
      color: options.color,
      accent: options.accent,
      number: options.number,
      x: options.x,
      y: options.y,
      angle: options.angle,
      vx: 0,
      vy: 0,
      speed: 0,
      forwardSpeed: 0,
      lateralSpeed: 0,
      steer: 0,
      maxSpeed: options.maxSpeed,
      accel: options.accel,
      brakeForce: options.brakeForce,
      reverseAccel: options.reverseAccel || 165,
      maxReverse: 135,
      turnRate: options.turnRate || 2.1,
      gripRoad: options.gripRoad || 8.4,
      gripGrass: options.gripGrass || 2.35,
      offroadSpeed: options.offroadSpeed || 0.52,
      offroadTraction: options.offroadTraction || 0.37,
      handbrakeGrip: options.handbrakeGrip || 1.45,
      control: { throttle: false, brake: false, steer: 0, handbrake: false },
      trackIndex: 0,
      raceDistance: 0,
      lateral: 0,
      distanceFromCenter: 0,
      edgeDistance: 0,
      surface: 'road',
      offRoad: false,
      lapsDone: 0,
      lapStart: 0,
      lapTimes: [],
      bestLap: Infinity,
      finished: false,
      finishTime: 0,
      ghost: false,
      drifting: false,
      skid: { active: false, prevL: null, prevR: null, timer: 0 },
      dustTimer: 0,
      aiLane: options.aiLane || 0,
      aiCorner: options.aiCorner || 1,
      aiAccel: options.aiAccel || 1,
      stuckTime: 0,
      place: 1,
      lastLapMessage: 0,
    };
  }

  function playerPerformanceOptions() {
    const spec = getPlayerCarSpec();
    return {
      type: playerCarType,
      color: playerColor,
      accent: playerAccent,
      name: PLAYER.name,
      number: 1,
      maxSpeed: spec.maxSpeed,
      accel: spec.accel,
      brakeForce: spec.brakeForce,
      turnRate: spec.turnRate,
      gripRoad: spec.gripRoad,
      gripGrass: spec.gripGrass,
      offroadSpeed: spec.offroadSpeed,
      offroadTraction: spec.offroadTraction,
      handbrakeGrip: spec.handbrakeGrip,
    };
  }

  function setupRace() {
    const geom = currentTrack.geometry;
    const diff = DIFFICULTIES[difficultyKey];
    const start = geom.points[0];
    const tangentAngle = Math.atan2(start.ty, start.tx);
    const startAngle = tangentAngle;
    const width = geom.width;
    const gridBack = [52, 52, 108, 108];
    const gridSide = [-0.18, 0.18, -0.18, 0.18];
    const aiBaseSpeed = Math.max(455, getPlayerCarSpec().maxSpeed * 0.98);
    const cars = [];

    for (let i = 0; i < 3; i++) {
      const rival = RIVALS[i];
      const back = gridBack[i];
      const side = gridSide[i];
      const x = start.x - start.tx * back + start.nx * side * width;
      const y = start.y - start.ty * back + start.ny * side * width;
      const car = makeCar({
        isPlayer: false,
        name: rival.name,
        type: rival.type,
        color: rival.color,
        accent: rival.accent,
        number: i + 2,
        x,
        y,
        angle: startAngle,
        maxSpeed: aiBaseSpeed * diff.speed,
        accel: 292 * diff.accel,
        brakeForce: 510,
        turnRate: 2.08,
        aiLane: (i % 2 === 0 ? 1 : -1) * width * diff.lane * 0.7,
        aiCorner: diff.corner,
        aiAccel: diff.accel,
      });
      car.trackIndex = findNearestGlobal(car, geom);
      applyTrackInfo(car, geom, true);
      cars.push(car);
    }

    const playerBack = gridBack[3];
    const playerSide = gridSide[3];
    const player = makeCar({
      isPlayer: true,
      ...playerPerformanceOptions(),
      x: start.x - start.tx * playerBack + start.nx * playerSide * width,
      y: start.y - start.ty * playerBack + start.ny * playerSide * width,
      angle: startAngle,
    });
    player.trackIndex = findNearestGlobal(player, geom);
    applyTrackInfo(player, geom, true);
    cars.push(player);

    currentTrack.skidCtx.clearRect(0, 0, WORLD_W, WORLD_H);
    race = {
      cars,
      player,
      totalLaps,
      time: 0,
      countdown: 3,
      lastCountdown: 4,
      goTimer: 0,
      finishTimer: 0,
      resultsShown: false,
      messages: [],
      particles: [],
      newRecord: false,
      finalStandings: null,
      lastImpact: 0,
      recordAtStart: getRecord(currentTrack.def.id),
    };

    for (const car of cars) car.lapStart = 0;
    updateStandings();
    state = 'countdown';
    race.countdown = 3;
    race.lastCountdown = 4;
    accumulator = 0;
    keys.up = keys.down = keys.left = keys.right = keys.handbrake = false;

    const targetZoom = 0.98;
    camera.zoom = targetZoom;
    camera.x = player.x + player.vx * 0.2 + Math.cos(player.angle) * 35;
    camera.y = player.y + player.vy * 0.2 + Math.sin(player.angle) * 35;
    clampCamera();

    menuScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    resultsScreen.classList.add('hidden');
    $('pauseCopy').textContent = 'Engine idling. The rivals are not.';
    $('resumeButton').textContent = 'RESUME RACE';
    $('restartButton').textContent = 'RESTART RACE';

    sound.init();
    sound.resume();
    sound.beep('count');
    sound.updateEngine(0, 0, true);
  }

  function startTestDrive() {
    if (!currentTrack || !currentTrack.isTest) return;
    const spawn = currentTrack.spawn;
    const player = makeCar({
      isPlayer: true,
      ...playerPerformanceOptions(),
      x: spawn.x,
      y: spawn.y,
      angle: spawn.angle,
    });
    player.surface = isOnAirfieldTarmac(player.x, player.y, currentTrack) ? 'road' : 'grass';
    player.offRoad = player.surface === 'grass';

    currentTrack.skidCtx.clearRect(0, 0, WORLD_W, WORLD_H);
    race = {
      mode: 'test',
      cars: [player],
      player,
      totalLaps: 0,
      time: 0,
      countdown: 0,
      goTimer: 0,
      finishTimer: 0,
      resultsShown: false,
      messages: [],
      particles: [],
      newRecord: false,
      finalStandings: null,
      lastImpact: 0,
      topSpeed: 0,
      driftAngle: 0,
    };
    state = 'test';
    accumulator = 0;
    keys.up = keys.down = keys.left = keys.right = keys.handbrake = false;

    camera.zoom = 0.95;
    camera.x = player.x + Math.cos(player.angle) * 100;
    camera.y = player.y + Math.sin(player.angle) * 100;
    clampCamera();

    menuScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    resultsScreen.classList.add('hidden');
    $('pauseCopy').textContent = 'Empty tarmac. Nobody to blame but the setup.';
    $('resumeButton').textContent = 'RESUME SESSION';
    $('restartButton').textContent = 'RESTART SESSION';

    addMessage('AIRFIELD OPEN', 'NO RIVALS // FREE DRIVE', currentTrack.theme.accent, 2.8);
    sound.init();
    sound.resume();
    sound.beep('go');
    sound.updateEngine(0, 0, true);
  }

  function clampCamera() {
    const halfW = W / (2 * camera.zoom);
    const halfH = H / (2 * camera.zoom);
    if (halfW * 2 >= WORLD_W) camera.x = WORLD_W * 0.5;
    else camera.x = clamp(camera.x, halfW, WORLD_W - halfW);
    if (halfH * 2 >= WORLD_H) camera.y = WORLD_H * 0.5;
    else camera.y = clamp(camera.y, halfH, WORLD_H - halfH);
  }

  /* -------------------------------------------------------------------
     Race progression and physics
     ------------------------------------------------------------------- */

  function playerInput() {
    const p = race.player;
    if (!p) return;
    p.control.throttle = keys.up;
    p.control.brake = keys.down;
    p.control.steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    p.control.handbrake = keys.handbrake;
  }

  function aiInput(car) {
    if (car.finished) {
      car.control.throttle = true;
      car.control.brake = false;
      car.control.handbrake = false;
    }

    const geom = currentTrack.geometry;
    const n = geom.n;
    const idx = car.trackIndex;
    const speed = car.speed;
    let lane = car.aiLane;
    let blockedAhead = false;
    let blockDistance = Infinity;
    let blockSide = 0;

    // Give the grid a clean launch before traffic avoidance kicks in.
    if (race.time > 2.2) {
      for (const other of race.cars) {
        if (other === car || other.ghost) continue;
        const cos = Math.cos(car.angle);
        const sin = Math.sin(car.angle);
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = dx * cos + dy * sin;
        const side = -dx * sin + dy * cos;
        if (ahead > 4 && ahead < 100 && Math.abs(side) < 29) {
          blockedAhead = true;
          if (ahead < blockDistance) {
            blockDistance = ahead;
            blockSide = side >= 0 ? -1 : 1;
          }
        }
      }
    }

    if (blockedAhead) {
      lane = blockSide * geom.width * 0.25;
    }

    if (car.surface === 'grass') lane *= 0.2;

    const lookAhead = clamp(Math.round(9 + speed / 38), 9, 23);
    const targetIndex = mod(idx + lookAhead, n);
    const tp = geom.points[targetIndex];
    const tx = tp.x + tp.nx * lane;
    const ty = tp.y + tp.ny * lane;
    const desired = Math.atan2(ty - car.y, tx - car.x);
    const diffAngle = normAngle(desired - car.angle);
    let steer = clamp(diffAngle * 2.25, -1, 1);

    const farIndex = mod(idx + 30, n);
    const far = geom.points[farIndex];
    const curve = Math.abs(normAngle(Math.atan2(far.ty, far.tx) - Math.atan2(tp.ty, tp.tx)));
    let targetSpeed = car.maxSpeed * clamp(1 - curve * 0.63, 0.38, 1);

    if (car.surface === 'grass') targetSpeed *= 0.58;

    const gap = car.raceDistance - race.player.raceDistance;
    if (gap > n * 0.55) targetSpeed *= 0.94;
    else if (gap < -n * 0.35) targetSpeed *= 1.045;

    let brake = false;
    if (blockedAhead) {
      // Never fully stop for a rival: at low speed keep rolling and steer around.
      if (blockDistance < 72) {
        targetSpeed = Math.min(targetSpeed, Math.max(105, speed + 20));
      }
      if (blockDistance < 44 && speed > 55) {
        targetSpeed = Math.min(targetSpeed, Math.max(70, speed * 0.72));
        brake = true;
      }
      steer += blockSide * 0.48;
    }

    if (car.stuckTime > 1.4) {
      targetSpeed = Math.max(targetSpeed, 110);
      brake = false;
    }

    car.control.steer = clamp(steer, -1, 1);
    car.control.throttle = speed < targetSpeed * 0.97;
    brake = brake || speed > targetSpeed * 1.11;
    car.control.handbrake = false;

    if (Math.abs(diffAngle) > 1.05 && speed > 150) {
      car.control.throttle = false;
      brake = true;
    }
    if (car.finished) {
      brake = false;
      car.control.throttle = true;
    }

    car.control.brake = brake;
  }

  function updateCarPhysics(car, dt) {
    const cos = Math.cos(car.angle);
    const sin = Math.sin(car.angle);
    let forward = car.vx * cos + car.vy * sin;
    let lateral = -car.vx * sin + car.vy * cos;
    const onRoad = car.surface !== 'grass';
    const topSpeed = onRoad ? car.maxSpeed : car.maxSpeed * car.offroadSpeed;

    if (car.control.throttle && forward < topSpeed) {
      const traction = onRoad ? 1 : car.offroadTraction;
      const handFactor = car.control.handbrake ? 0.55 : 1;
      forward += car.accel * car.aiAccel * traction * handFactor * dt;
    }

    if (car.control.brake) {
      if (forward > 4) forward -= car.brakeForce * dt;
      else if (forward > -car.maxReverse) forward -= car.reverseAccel * dt;
    }

    const drag = onRoad ? 0.68 : 3.0;
    forward *= Math.exp(-drag * dt);

    if (!car.control.throttle && !car.control.brake) {
      forward = forward > 0 ? Math.max(0, forward - 24 * dt) : Math.min(0, forward + 24 * dt);
    }

    if (car.control.handbrake) forward *= Math.exp(-1.15 * dt);

    if (forward > topSpeed) forward -= (forward - topSpeed) * Math.min(1, 3.2 * dt);
    if (forward < -car.maxReverse) forward = -car.maxReverse;

    let grip = onRoad ? car.gripRoad : car.gripGrass;
    if (car.control.handbrake) grip = onRoad ? car.handbrakeGrip : Math.max(1.05, car.handbrakeGrip * 0.72);
    if (car.finished) grip *= 1.25;

    lateral *= Math.exp(-grip * dt);

    car.vx = cos * forward - sin * lateral;
    car.vy = sin * forward + cos * lateral;

    const speedFactor = clamp(Math.abs(forward) / 135, 0, 1);
    const speedSteer = 1 - 0.24 * clamp(Math.abs(forward) / Math.max(1, car.maxSpeed), 0, 1);
    const handSteer = car.control.handbrake ? 1.38 : 1;
    const steerTarget = car.control.steer;
    const steerRate = car.isPlayer ? 12 : 15;
    car.steer += (steerTarget - car.steer) * Math.min(1, steerRate * dt);

    if (Math.abs(forward) > 4) {
      car.angle += car.steer * car.turnRate * speedSteer * speedFactor * handSteer * Math.sign(forward) * dt;
    }

    car.x += car.vx * dt;
    car.y += car.vy * dt;

    car.speed = Math.hypot(car.vx, car.vy);
    car.forwardSpeed = forward;
    car.lateralSpeed = lateral;
    car.drifting = onRoad && Math.abs(lateral) > 56 && car.speed > 78;
    if (car.control.handbrake && car.speed > 60) car.drifting = true;
  }

  function addSkidMarks(car, dt) {
    if (!car.drifting || car.surface === 'grass') {
      car.skid.active = false;
      car.skid.prevL = car.skid.prevR = null;
      return;
    }

    const cos = Math.cos(car.angle);
    const sin = Math.sin(car.angle);
    const point = (localX, localY) => ({
      x: car.x + cos * localX - sin * localY,
      y: car.y + sin * localX + cos * localY,
    });
    const wheel = getCarWheelGeometry(car.type);
    const left = point(wheel.rearX, -wheel.skidY);
    const right = point(wheel.rearX, wheel.skidY);

    if (!car.skid.active || !car.skid.prevL || !car.skid.prevR) {
      car.skid.active = true;
      car.skid.prevL = left;
      car.skid.prevR = right;
      car.skid.timer = 0;
      return;
    }

    car.skid.timer += dt;
    if (car.skid.timer < 0.014) return;
    car.skid.timer = 0;

    const g = currentTrack.skidCtx;
    g.strokeStyle = currentTrack.theme.skid;
    g.lineWidth = 4.3;
    g.beginPath();
    g.moveTo(car.skid.prevL.x, car.skid.prevL.y);
    g.lineTo(left.x, left.y);
    g.moveTo(car.skid.prevR.x, car.skid.prevR.y);
    g.lineTo(right.x, right.y);
    g.stroke();

    car.skid.prevL = left;
    car.skid.prevR = right;
  }

  function spawnParticle(x, y, vx, vy, options) {
    if (!race || race.particles.length > 320) return;
    race.particles.push({
      x, y, vx, vy,
      life: options.life || 0.5,
      maxLife: options.life || 0.5,
      size: options.size || 4,
      grow: options.grow || 10,
      color: options.color || 'rgba(200, 200, 190, 0.5)',
    });
  }

  function spawnCarEffects(car, dt) {
    if (car.surface === 'grass' && car.speed > 75) {
      car.dustTimer += dt;
      if (car.dustTimer > 0.035) {
        car.dustTimer = 0;
        const cos = Math.cos(car.angle);
        const sin = Math.sin(car.angle);
        const backX = car.x - cos * 17;
        const backY = car.y - sin * 17;
        const spread = (Math.random() - 0.5) * 20;
        spawnParticle(
          backX - sin * spread,
          backY + cos * spread,
          -car.vx * 0.16 + (Math.random() - 0.5) * 24,
          -car.vy * 0.16 + (Math.random() - 0.5) * 24,
          {
            life: 0.42 + Math.random() * 0.35,
            size: 3 + Math.random() * 7,
            grow: 15,
            color: currentTrack.theme.dust,
          }
        );
      }
    }

    if (car.drifting && car.speed > 100) {
      car.dustTimer += dt;
      if (car.dustTimer > 0.045) {
        car.dustTimer = 0;
        const cos = Math.cos(car.angle);
        const sin = Math.sin(car.angle);
        const backX = car.x - cos * 17;
        const backY = car.y - sin * 17;
        spawnParticle(
          backX + (Math.random() - 0.5) * 20,
          backY + (Math.random() - 0.5) * 20,
          -car.vx * 0.09 + (Math.random() - 0.5) * 16,
          -car.vy * 0.09 + (Math.random() - 0.5) * 16,
          {
            life: 0.45 + Math.random() * 0.35,
            size: 4 + Math.random() * 6,
            grow: 23,
            color: currentTrack.theme.smoke,
          }
        );
      }
    }
  }

  function updateParticles(dt) {
    if (!race) return;
    const list = race.particles;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-1.7 * dt);
      p.vy *= Math.exp(-1.7 * dt);
      p.size += p.grow * dt;
    }
  }

  function resolveCollisions() {
    const list = race.cars;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.ghost || b.ghost) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 29;
        if (dist <= 0 || dist >= minDist) continue;

        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        a.x -= nx * overlap * 0.52;
        a.y -= ny * overlap * 0.52;
        b.x += nx * overlap * 0.48;
        b.y += ny * overlap * 0.48;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const impulse = (-(1.22) * vn) / 2;
          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
          b.vx += impulse * nx;
          b.vy += impulse * ny;

          const strength = Math.min(1.2, Math.abs(vn) / 220);
          if ((a.isPlayer || b.isPlayer) && strength > 0.15 && race.time - race.lastImpact > 0.12) {
            race.lastImpact = race.time;
            sound.impact(0.5 + strength);
            camera.shake = Math.max(camera.shake, 2 + strength * 5);
          }

          if (strength > 0.25) {
            for (let k = 0; k < 7; k++) {
              const angle = Math.random() * TAU;
              const speed = 30 + Math.random() * 90;
              spawnParticle(
                (a.x + b.x) / 2,
                (a.y + b.y) / 2,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                {
                  life: 0.22 + Math.random() * 0.25,
                  size: 1.5 + Math.random() * 2.4,
                  grow: -3,
                  color: 'rgba(255, 214, 110, 0.85)',
                }
              );
            }
          }
        }
      }
    }
  }

  function processProgress(car) {
    if (car.finished) return;
    const n = currentTrack.geometry.n;
    const completed = Math.floor(car.raceDistance / n);
    if (completed <= car.lapsDone) return;

    const maxNew = Math.min(completed, race.totalLaps) - car.lapsDone;
    for (let i = 0; i < maxNew; i++) {
      car.lapsDone++;
      const lapTime = race.time - car.lapStart;
      car.lapStart = race.time;
      if (car.lapsDone <= race.totalLaps) {
        car.lapTimes.push(lapTime);
        if (lapTime < car.bestLap) car.bestLap = lapTime;
      }

      if (car.isPlayer && !car.finished) {
        if (car.lapsDone >= race.totalLaps) {
          addMessage('FINISH', 'CHEQUERED FLAG', currentTrack.theme.accent, 2.5);
        } else if (car.lapsDone === race.totalLaps - 1) {
          addMessage('FINAL LAP', formatTime(lapTime), '#ffd447', 2.2);
        } else {
          addMessage(`LAP ${car.lapsDone + 1} / ${race.totalLaps}`, formatTime(lapTime), '#f4ecd9', 1.8);
        }
        if (lapTime === car.bestLap && car.lapTimes.length > 1) {
          sound.beep('lap');
        }
      }
    }

    if (car.lapsDone >= race.totalLaps) finishCar(car);
  }

  function finishCar(car) {
    car.finished = true;
    car.finishTime = race.time;

    if (car.isPlayer) {
      const oldRecord = race.recordAtStart;
      if (car.bestLap < Infinity && (!oldRecord || car.bestLap < oldRecord - 0.002)) {
        setRecord(currentTrack.def.id, car.bestLap);
        race.newRecord = true;
      }
      state = 'finished';
      race.finishTimer = 0;
      race.resultsShown = false;
      race.finalStandings = getStandings();
      race.playerPlace = race.finalStandings.indexOf(car) + 1;
      sound.fanfare(race.playerPlace);
      sound.updateEngine(0, 0, false);
      sound.updateTires(0, false);
    } else {
      car.ghost = true;
    }
  }

  function getStandings() {
    return race.cars.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.raceDistance - a.raceDistance;
    });
  }

  function addMessage(text, sub, color, life = 2) {
    if (!race) return;
    race.messages.push({ text, sub, color, life, maxLife: life });
    if (race.messages.length > 3) race.messages.shift();
  }

  function updateMessages(dt) {
    if (!race) return;
    for (let i = race.messages.length - 1; i >= 0; i--) {
      const message = race.messages[i];
      message.life -= dt;
      if (message.life <= 0) race.messages.splice(i, 1);
    }
  }

  function resetPlayerCar() {
    if (!race || (state !== 'racing' && state !== 'test')) return;
    const car = race.player;
    if (state === 'test' && currentTrack.isTest) {
      const spawn = currentTrack.spawn;
      car.x = spawn.x;
      car.y = spawn.y;
      car.angle = spawn.angle;
      updateTestSurface(car);
    } else {
      const p = currentTrack.geometry.points[car.trackIndex];
      car.x = p.x;
      car.y = p.y;
      car.angle = Math.atan2(p.ty, p.tx);
      applyTrackInfo(car, currentTrack.geometry, true);
    }
    car.vx = 0;
    car.vy = 0;
    car.steer = 0;
    car.skid.active = false;
    showToast('CAR RESET');
    sound.beep('count');
    camera.shake = 2;
  }

  function updateStandings() {
    const standings = getStandings();
    standings.forEach((car, index) => {
      car.place = index + 1;
    });
  }

  function updateRaceCamera(dt) {
    if (!race) return;
    const p = race.player;
    const speedRatio = clamp(p.speed / p.maxSpeed, 0, 1);
    const targetX = p.x + p.vx * 0.24 + Math.cos(p.angle) * 32;
    const targetY = p.y + p.vy * 0.24 + Math.sin(p.angle) * 32;
    const targetZoom = (race.mode === 'test' ? 0.91 : 0.985) - speedRatio * 0.12;

    camera.x = expo(camera.x, targetX, 4.2, dt);
    camera.y = expo(camera.y, targetY, 4.2, dt);
    camera.zoom = expo(camera.zoom, targetZoom, 2.2, dt);
    camera.shake *= Math.exp(-7 * dt);
    if (camera.shake < 0.02) camera.shake = 0;
    clampCamera();
  }

  function updateMenu(dt) {
    if (!currentTrack) return;
    if (currentTrack.isTest) {
      menu.index += dt * 0.24;
      const spawn = currentTrack.spawn;
      const targetX = spawn.x + 180 + Math.sin(menu.index) * 115;
      const targetY = spawn.y - 30 + Math.cos(menu.index * 0.8) * 55;
      camera.x = expo(camera.x, targetX, 1.4, dt);
      camera.y = expo(camera.y, targetY, 1.4, dt);
      camera.zoom = expo(camera.zoom, 0.72, 1.6, dt);
      clampCamera();
      return;
    }
    const geom = currentTrack.geometry;
    menu.index = mod(menu.index + dt * 21, geom.n);
    const idx = Math.floor(menu.index);
    const p = geom.points[idx];
    const ahead = geom.points[mod(idx + 42, geom.n)];
    const targetX = lerp(p.x, ahead.x, 0.54) + p.tx * 60;
    const targetY = lerp(p.y, ahead.y, 0.54) + p.ty * 60;
    camera.x = expo(camera.x, targetX, 1.6, dt);
    camera.y = expo(camera.y, targetY, 1.6, dt);
    camera.zoom = expo(camera.zoom, 0.76, 1.8, dt);
    clampCamera();
  }

  function updateCountdown(dt) {
    if (!race) return;
    const before = Math.ceil(race.countdown);
    race.countdown -= dt;
    const after = Math.ceil(race.countdown);

    if (after !== before && after > 0) sound.beep('count');

    if (race.countdown <= 0) {
      race.countdown = 0;
      state = 'racing';
      race.goTimer = 0.9;
      sound.beep('go');
    }
    updateRaceCamera(dt);
  }

  function updateRacing(dt) {
    if (!race) return;
    race.time += dt;
    race.goTimer = Math.max(0, race.goTimer - dt);
    playerInput();

    for (const car of race.cars) {
      if (!car.isPlayer) aiInput(car);
    }

    for (const car of race.cars) {
      updateCarPhysics(car, dt);
      applyTrackInfo(car, currentTrack.geometry, false);
      if (car.speed < 6) car.stuckTime += dt;
      else car.stuckTime = 0;
      addSkidMarks(car, dt);
      spawnCarEffects(car, dt);
      processProgress(car);
      if (state === 'finished') break;
    }

    resolveCollisions();
    updateParticles(dt);
    updateMessages(dt);
    updateStandings();
    updateRaceCamera(dt);
  }

  function updateTestSurface(car) {
    const onTarmac = isOnAirfieldTarmac(car.x, car.y, currentTrack);
    car.surface = onTarmac ? 'road' : 'grass';
    car.offRoad = !onTarmac;
  }

  function updateTest(dt) {
    if (!race) return;
    race.time += dt;
    playerInput();
    const car = race.player;
    updateCarPhysics(car, dt);
    updateTestSurface(car);
    addSkidMarks(car, dt);
    spawnCarEffects(car, dt);
    updateParticles(dt);
    updateMessages(dt);

    race.topSpeed = Math.max(race.topSpeed || 0, Math.round(Math.abs(car.forwardSpeed) * 0.465));
    race.driftAngle = Math.atan2(Math.abs(car.lateralSpeed), Math.max(12, Math.abs(car.forwardSpeed))) * (180 / Math.PI);
    updateRaceCamera(dt);
  }

  /* -------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------- */

  function getCarWheelGeometry(type) {
    if (type === 'formula') return { frontX: 16, rearX: -17, y: 13.5, length: 11, width: 5.6, skidY: 11.5 };
    if (type === 'rally') return { frontX: 13, rearX: -14, y: 12.2, length: 10.5, width: 6, skidY: 10.5 };
    if (type === 'lambo') return { frontX: 15, rearX: -16, y: 12.3, length: 10.5, width: 5.8, skidY: 10.8 };
    return { frontX: 14, rearX: -15, y: 11.5, length: 10, width: 5.2, skidY: 10 };
  }

  function drawCarShadow(g, length, width) {
    g.save();
    g.translate(5, 7);
    g.fillStyle = 'rgba(0, 0, 0, 0.33)';
    g.beginPath();
    g.moveTo(-length / 2 + 2, -width / 2 + 2);
    g.lineTo(length / 2 - 7, -width / 2);
    g.lineTo(length / 2, 0);
    g.lineTo(length / 2 - 7, width / 2);
    g.lineTo(-length / 2 + 2, width / 2 - 2);
    g.lineTo(-length / 2, 0);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawWheel(g, x, y, steer, length, width) {
    g.save();
    g.translate(x, y);
    g.rotate(steer);
    g.fillStyle = '#111416';
    g.fillRect(-length / 2, -width / 2, length, width);
    g.fillStyle = 'rgba(255, 255, 255, 0.1)';
    g.fillRect(-length / 2 + 2, -width / 2 + 1, length - 4, 1);
    g.restore();
  }

  function drawCarLights(g, frontX, rearX, y, brake) {
    g.fillStyle = '#ffe7a2';
    g.fillRect(frontX, -y - 1.5, 2.6, 3);
    g.fillRect(frontX, y - 1.5, 2.6, 3);
    if (brake) {
      g.fillStyle = '#ff3b2e';
      g.fillRect(rearX, -y - 1.6, 2.7, 3.2);
      g.fillRect(rearX, y - 1.6, 2.7, 3.2);
    }
  }

  function drawCarNumber(g, number, x, y, size = 9) {
    g.fillStyle = '#0e1416';
    g.font = `700 ${size}px Consolas, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(number), x, y);
  }

  function drawSupraBody(g, car, wheel) {
    drawCarShadow(g, 53, 28);
    drawWheel(g, wheel.frontX, -wheel.y, car.steer * 0.28, wheel.length, wheel.width);
    drawWheel(g, wheel.frontX, wheel.y, car.steer * 0.28, wheel.length, wheel.width);
    drawWheel(g, wheel.rearX, -wheel.y, 0, wheel.length, wheel.width);
    drawWheel(g, wheel.rearX, wheel.y, 0, wheel.length, wheel.width);

    g.fillStyle = car.color;
    g.strokeStyle = 'rgba(9, 13, 14, 0.92)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-27, -8.2);
    g.lineTo(-16, -12);
    g.lineTo(8, -12);
    g.lineTo(23, -8.5);
    g.lineTo(27, -3.5);
    g.lineTo(27, 3.5);
    g.lineTo(23, 8.5);
    g.lineTo(8, 12);
    g.lineTo(-16, 12);
    g.lineTo(-27, 8.2);
    g.closePath();
    g.fill();
    g.stroke();

    g.fillStyle = 'rgba(255, 255, 255, 0.16)';
    g.beginPath();
    g.moveTo(8, -10.5);
    g.lineTo(21, -7);
    g.lineTo(25, -2.5);
    g.lineTo(9, -4.5);
    g.closePath();
    g.fill();

    g.fillStyle = car.accent;
    g.globalAlpha = 0.82;
    g.fillRect(-20, -2, 39, 4);
    g.globalAlpha = 1;

    g.fillStyle = '#1b2b32';
    g.strokeStyle = 'rgba(7, 11, 13, 0.75)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-8, -8);
    g.lineTo(6, -7);
    g.lineTo(11, -3.2);
    g.lineTo(11, 3.2);
    g.lineTo(6, 7);
    g.lineTo(-8, 8);
    g.closePath();
    g.fill();
    g.stroke();

    g.fillStyle = 'rgba(106, 194, 214, 0.58)';
    g.beginPath();
    g.moveTo(6, -5.8);
    g.lineTo(11, -2.2);
    g.lineTo(11, 2.2);
    g.lineTo(6, 5.8);
    g.closePath();
    g.fill();

    // Rear wing.
    g.fillStyle = '#151c1e';
    g.fillRect(-28, -11, 4, 22);
    g.fillRect(-24, -9, 5, 2);
    g.fillRect(-24, 7, 5, 2);

    drawCarLights(g, 25, -27, 6, car.control.brake);
    drawCarNumber(g, car.number, -1, 0, 9);
  }

  function drawLamboBody(g, car, wheel) {
    drawCarShadow(g, 56, 32);
    drawWheel(g, wheel.frontX, -wheel.y, car.steer * 0.25, wheel.length, wheel.width);
    drawWheel(g, wheel.frontX, wheel.y, car.steer * 0.25, wheel.length, wheel.width);
    drawWheel(g, wheel.rearX, -wheel.y, 0, wheel.length, wheel.width);
    drawWheel(g, wheel.rearX, wheel.y, 0, wheel.length, wheel.width);

    g.fillStyle = car.color;
    g.strokeStyle = 'rgba(8, 12, 13, 0.94)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-29, -8.5);
    g.lineTo(-18, -12.5);
    g.lineTo(2, -13.5);
    g.lineTo(20, -9);
    g.lineTo(29, -2.5);
    g.lineTo(29, 2.5);
    g.lineTo(20, 9);
    g.lineTo(2, 13.5);
    g.lineTo(-18, 12.5);
    g.lineTo(-29, 8.5);
    g.closePath();
    g.fill();
    g.stroke();

    g.fillStyle = 'rgba(255, 255, 255, 0.19)';
    g.beginPath();
    g.moveTo(4, -11.5);
    g.lineTo(23, -7.5);
    g.lineTo(27, -2.5);
    g.lineTo(4, -4.5);
    g.closePath();
    g.fill();

    // Side intakes.
    g.fillStyle = 'rgba(8, 12, 13, 0.8)';
    g.beginPath();
    g.moveTo(-1, -10);
    g.lineTo(11, -7.5);
    g.lineTo(7, -4);
    g.lineTo(-4, -6);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-1, 10);
    g.lineTo(11, 7.5);
    g.lineTo(7, 4);
    g.lineTo(-4, 6);
    g.closePath();
    g.fill();

    g.fillStyle = car.accent;
    g.globalAlpha = 0.9;
    g.fillRect(-18, -1.6, 40, 3.2);
    g.globalAlpha = 1;

    g.fillStyle = '#17272d';
    g.strokeStyle = 'rgba(8, 12, 13, 0.8)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-5, -8.5);
    g.lineTo(7, -7.2);
    g.lineTo(13, -3);
    g.lineTo(13, 3);
    g.lineTo(7, 7.2);
    g.lineTo(-5, 8.5);
    g.closePath();
    g.fill();
    g.stroke();

    g.fillStyle = 'rgba(103, 197, 218, 0.5)';
    g.beginPath();
    g.moveTo(7, -5.7);
    g.lineTo(13, -2);
    g.lineTo(13, 2);
    g.lineTo(7, 5.7);
    g.closePath();
    g.fill();

    // Big rear wing.
    g.fillStyle = '#141b1d';
    g.fillRect(-31, -13, 4.5, 26);
    g.fillRect(-26, -10.5, 4, 2.2);
    g.fillRect(-26, 8.3, 4, 2.2);

    drawCarLights(g, 27, -29, 6.2, car.control.brake);
    drawCarNumber(g, car.number, -2, 0, 9);
  }

  function drawRallyBody(g, car, wheel) {
    drawCarShadow(g, 49, 30);
    drawWheel(g, wheel.frontX, -wheel.y, car.steer * 0.3, wheel.length, wheel.width);
    drawWheel(g, wheel.frontX, wheel.y, car.steer * 0.3, wheel.length, wheel.width);
    drawWheel(g, wheel.rearX, -wheel.y, 0, wheel.length, wheel.width);
    drawWheel(g, wheel.rearX, wheel.y, 0, wheel.length, wheel.width);

    // Mud flaps.
    g.fillStyle = 'rgba(16, 21, 21, 0.85)';
    g.fillRect(-19, -14.5, 7, 3.5);
    g.fillRect(-19, 11, 7, 3.5);

    g.fillStyle = car.color;
    g.strokeStyle = 'rgba(9, 13, 14, 0.94)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-24, -10);
    g.lineTo(-14, -13);
    g.lineTo(13, -13);
    g.lineTo(22, -9);
    g.lineTo(25, 0);
    g.lineTo(22, 9);
    g.lineTo(13, 13);
    g.lineTo(-14, 13);
    g.lineTo(-24, 10);
    g.closePath();
    g.fill();
    g.stroke();

    g.fillStyle = 'rgba(255, 255, 255, 0.15)';
    g.beginPath();
    g.moveTo(12, -11);
    g.lineTo(21, -7.5);
    g.lineTo(23, -2);
    g.lineTo(8, -4);
    g.closePath();
    g.fill();

    g.fillStyle = car.accent;
    g.globalAlpha = 0.82;
    g.fillRect(-18, -5.5, 37, 3);
    g.fillRect(-18, 2.5, 37, 3);
    g.globalAlpha = 1;

    // Upright hatch glass and roof.
    g.fillStyle = '#1b2c32';
    g.strokeStyle = 'rgba(7, 11, 13, 0.75)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-8, -9);
    g.lineTo(8, -8.5);
    g.lineTo(12, -3);
    g.lineTo(12, 3);
    g.lineTo(8, 8.5);
    g.lineTo(-8, 9);
    g.lineTo(-11, 5);
    g.lineTo(-11, -5);
    g.closePath();
    g.fill();
    g.stroke();

    g.fillStyle = 'rgba(105, 192, 213, 0.5)';
    g.beginPath();
    g.moveTo(8, -6);
    g.lineTo(12, -2.3);
    g.lineTo(12, 2.3);
    g.lineTo(8, 6);
    g.closePath();
    g.fill();

    // Roof light pod.
    g.fillStyle = '#12191a';
    g.fillRect(0, -10.5, 8, 4);
    g.fillStyle = '#ffe39a';
    for (let i = 0; i < 3; i++) g.fillRect(1.5 + i * 2.2, -9.8, 1.4, 2.6);

    drawCarLights(g, 23, -24, 7.5, car.control.brake);
    drawCarNumber(g, car.number, -1, 0, 9);
  }

  function drawFormulaBody(g, car, wheel) {
    drawCarShadow(g, 61, 34);

    // Suspension arms.
    g.strokeStyle = 'rgba(15, 20, 20, 0.9)';
    g.lineWidth = 2;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(wheel.frontX - 5, side * 5);
      g.lineTo(wheel.frontX, side * wheel.y);
      g.moveTo(wheel.rearX + 5, side * 5);
      g.lineTo(wheel.rearX, side * wheel.y);
      g.stroke();
    }

    drawWheel(g, wheel.frontX, -wheel.y, car.steer * 0.35, wheel.length, wheel.width);
    drawWheel(g, wheel.frontX, wheel.y, car.steer * 0.35, wheel.length, wheel.width);
    drawWheel(g, wheel.rearX, -wheel.y, 0, wheel.length, wheel.width);
    drawWheel(g, wheel.rearX, wheel.y, 0, wheel.length, wheel.width);

    // Wings.
    g.fillStyle = '#161e20';
    g.fillRect(24, -17, 5, 34);
    g.fillRect(-31, -15, 5, 30);
    g.fillStyle = car.accent;
    g.fillRect(27, -16, 1.3, 32);
    g.fillRect(-31, -14, 1.2, 28);

    g.fillStyle = car.color;
    g.strokeStyle = 'rgba(8, 12, 13, 0.94)';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(-25, -5);
    g.lineTo(-14, -8);
    g.lineTo(4, -8.5);
    g.lineTo(23, -4.5);
    g.lineTo(31, 0);
    g.lineTo(23, 4.5);
    g.lineTo(4, 8.5);
    g.lineTo(-14, 8);
    g.lineTo(-25, 5);
    g.closePath();
    g.fill();
    g.stroke();

    g.fillStyle = 'rgba(255, 255, 255, 0.2)';
    g.beginPath();
    g.moveTo(7, -6.5);
    g.lineTo(23, -3.5);
    g.lineTo(29, 0);
    g.lineTo(9, 0);
    g.closePath();
    g.fill();

    g.fillStyle = car.accent;
    g.globalAlpha = 0.85;
    g.fillRect(-16, -1.5, 39, 3);
    g.globalAlpha = 1;

    // Cockpit opening and helmet.
    g.fillStyle = '#17272d';
    g.strokeStyle = 'rgba(7, 11, 13, 0.8)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(-4, 0, 9, 5.5, 0, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = '#e8e2ce';
    g.beginPath();
    g.arc(-4, 0, 2.8, 0, TAU);
    g.fill();
    g.fillStyle = '#d9583f';
    g.fillRect(-7, -2.8, 5, 1.4);

    drawCarLights(g, 29, -27, 3.5, car.control.brake);
    drawCarNumber(g, car.number, 14, 0, 8);
  }

  function drawCarBody(g, car) {
    const type = CAR_TYPES[car.type] ? car.type : 'supra';
    const wheel = getCarWheelGeometry(type);
    if (type === 'formula') drawFormulaBody(g, car, wheel);
    else if (type === 'rally') drawRallyBody(g, car, wheel);
    else if (type === 'lambo') drawLamboBody(g, car, wheel);
    else drawSupraBody(g, car, wheel);
  }

  function drawCar(car, alpha = 1) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.globalAlpha = alpha;
    drawCarBody(ctx, car);

    if (car.isPlayer) {
      ctx.fillStyle = '#f8f3e2';
      ctx.beginPath();
      ctx.moveTo(-9, -16.5);
      ctx.lineTo(-4, -20);
      ctx.lineTo(1, -16.5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function drawHeadlights(cars) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const car of cars) {
      const cos = Math.cos(car.angle);
      const sin = Math.sin(car.angle);
      const lightX = car.x + cos * 62;
      const lightY = car.y + sin * 62;
      const grad = ctx.createRadialGradient(lightX, lightY, 8, lightX, lightY, 112);
      grad.addColorStop(0, 'rgba(255, 239, 185, 0.15)');
      grad.addColorStop(0.45, 'rgba(255, 226, 151, 0.055)');
      grad.addColorStop(1, 'rgba(255, 226, 151, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(lightX, lightY, 112, 88, car.angle, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    if (!race) return;
    for (const p of race.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld(cars) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = currentTrack ? currentTrack.theme.groundDark : '#111';
    ctx.fillRect(0, 0, W, H);

    const shakeX = camera.shake ? (Math.random() - 0.5) * camera.shake : 0;
    const shakeY = camera.shake ? (Math.random() - 0.5) * camera.shake : 0;

    ctx.save();
    ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    if (currentTrack) {
      ctx.drawImage(currentTrack.bgCanvas, 0, 0);
      if (currentTrack.theme.night) drawHeadlights(cars);
      ctx.drawImage(currentTrack.skidCanvas, 0, 0);
      if (race) drawParticles();
      const sorted = cars.slice().sort((a, b) => a.y - b.y);
      for (const car of sorted) drawCar(car, car.ghost ? 0.68 : 1);
    }

    ctx.restore();
  }

  function drawDemoCars() {
    if (!currentTrack) return [];
    if (currentTrack.isTest) {
      const spawn = currentTrack.spawn;
      return [{
        x: spawn.x,
        y: spawn.y,
        angle: spawn.angle,
        type: playerCarType,
        color: playerColor,
        accent: playerAccent,
        number: 1,
        steer: -0.04,
        control: { brake: false },
        isPlayer: true,
        ghost: false,
      }];
    }
    const geom = currentTrack.geometry;
    const idx = Math.floor(menu.index);
    const specs = [
      { offset: 0, lane: -0.17, color: '#ef5b4c', accent: '#ffb19f', number: 2, type: 'rally' },
      { offset: -24, lane: 0.17, color: '#58cbea', accent: '#b8f2ff', number: 3, type: 'supra' },
      { offset: 27, lane: 0.04, color: '#93d45f', accent: '#d7f5bb', number: 4, type: 'lambo' },
    ];
    return specs.map((spec) => {
      const p = geom.points[mod(idx + spec.offset, geom.n)];
      return {
        x: p.x + p.nx * spec.lane * geom.width,
        y: p.y + p.ny * spec.lane * geom.width,
        angle: Math.atan2(p.ty, p.tx),
        type: spec.type,
        color: spec.color,
        accent: spec.accent,
        number: spec.number,
        steer: Math.sin(menu.index * 0.05 + spec.offset) * 0.24,
        control: { brake: false },
        isPlayer: false,
        ghost: false,
      };
    });
  }

  function drawPanel(x, y, w, h, accent, alpha = 0.76) {
    const cut = 9;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
    ctx.fillStyle = `rgba(6, 11, 14, ${alpha})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 236, 217, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (accent) {
      ctx.fillStyle = accent;
      ctx.fillRect(x + 1, y + 1, 3, h - 2);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x + cut, y + 1, 32, 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawSpeedPanel(p) {
    const speedKmh = Math.round(Math.abs(p.forwardSpeed) * 0.465);
    const ratio = clamp(Math.abs(p.forwardSpeed) / p.maxSpeed, 0, 1);
    const gear = p.forwardSpeed < -5 ? 'R' : Math.abs(p.forwardSpeed) < 8 ? 'N' : String(1 + Math.min(4, Math.floor(ratio * 5)));

    drawPanel(24, H - 24 - 102, 254, 102, '#ffd447');
    ctx.fillStyle = 'rgba(199, 207, 199, 0.7)';
    ctx.font = '700 8px Consolas, monospace';
    ctx.fillText('SPEED', 40, H - 24 - 80);
    ctx.fillStyle = '#f4ecd9';
    ctx.font = '700 44px Impact, Haettenschweiler, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(speedKmh).padStart(3, '0'), 210, H - 24 - 38);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(199, 207, 199, 0.7)';
    ctx.font = '700 8px Consolas, monospace';
    ctx.fillText('KM/H', 218, H - 24 - 51);

    ctx.fillStyle = 'rgba(244, 236, 217, 0.08)';
    ctx.fillRect(244, H - 24 - 72, 23, 28);
    ctx.fillStyle = '#ffd447';
    ctx.font = '700 8px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GEAR', 255, H - 24 - 78);
    ctx.font = '700 17px Consolas, monospace';
    ctx.fillText(gear, 255, H - 24 - 51);
    ctx.textAlign = 'left';

    const segs = 16;
    const segW = 10;
    const segGap = 3;
    const barY = H - 24 - 22;
    for (let i = 0; i < segs; i++) {
      const x = 40 + i * (segW + segGap);
      const active = i / segs < ratio;
      ctx.fillStyle = active ? (i > 11 ? '#f0523d' : i > 7 ? '#ffd447' : '#9bdd74') : 'rgba(244, 236, 217, 0.1)';
      ctx.fillRect(x, barY, segW, 5);
    }

    if (p.drifting) {
      ctx.fillStyle = '#ffd447';
      ctx.font = '700 8px Consolas, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('DRIFT', 278, H - 24 - 43);
      ctx.textAlign = 'left';
    }
  }

  function drawTestHUD() {
    const p = race.player;
    const spec = getPlayerCarSpec();
    const surface = p.surface === 'grass' ? 'GRASS' : 'TARMAC';
    const drift = Math.round(race.driftAngle || 0);

    ctx.save();
    ctx.textBaseline = 'alphabetic';

    drawPanel(24, 22, 292, 94, currentTrack.theme.accent);
    ctx.fillStyle = 'rgba(199, 207, 199, 0.7)';
    ctx.font = '700 8px Consolas, monospace';
    ctx.fillText('LOCATION // FREE DRIVE', 40, 44);
    ctx.fillStyle = '#f4ecd9';
    ctx.font = '700 27px Impact, Haettenschweiler, sans-serif';
    ctx.fillText('TEST AIRFIELD', 39, 72);
    ctx.fillStyle = 'rgba(101, 215, 232, 0.8)';
    ctx.font = '700 7px Consolas, monospace';
    ctx.fillText('NO RIVALS // NO LAPS // NO TRAFFIC', 40, 91);

    drawPanel(W / 2 - 138, 20, 276, 82, 'rgba(244, 236, 217, 0.38)');
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(210, 215, 205, 0.74)';
    ctx.font = '700 9px Consolas, monospace';
    ctx.fillText('TEST SESSION', W / 2, 43);
    ctx.fillStyle = '#f4ecd9';
    ctx.font = '700 25px Consolas, monospace';
    ctx.fillText(formatTime(race.time), W / 2, 72);
    ctx.fillStyle = 'rgba(101, 215, 232, 0.8)';
    ctx.font = '700 7px Consolas, monospace';
    ctx.fillText('OPEN TARMAC // DRIVER: YOU', W / 2, 91);

    drawPanel(W - 24 - 258, 22, 258, 94, 'rgba(244, 236, 217, 0.38)');
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(199, 207, 199, 0.7)';
    ctx.font = '700 8px Consolas, monospace';
    ctx.fillText('YOUR CAR', W - 24 - 244, 44);
    ctx.fillStyle = '#f4ecd9';
    ctx.font = '700 17px Consolas, monospace';
    ctx.fillText(spec.name, W - 24 - 244, 69);
    ctx.fillStyle = 'rgba(116, 130, 123, 0.9)';
    ctx.font = '700 7px Consolas, monospace';
    ctx.fillText(`${spec.className} // ${playerColor.toUpperCase()}`, W - 24 - 244, 91);
    ctx.fillStyle = playerColor;
    ctx.fillRect(W - 24 - 40, 34, 24, 24);
    ctx.strokeStyle = 'rgba(244, 236, 217, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(W - 24 - 40, 34, 24, 24);

    drawSpeedPanel(p);

    const panelX = W - 24 - 260;
    const panelY = H - 24 - 165;
    drawPanel(panelX, panelY, 260, 165, 'rgba(101, 215, 232, 0.7)');
    ctx.fillStyle = 'rgba(199, 207, 199, 0.7)';
    ctx.font = '700 8px Consolas, monospace';
    ctx.fillText('TEST DATA', panelX + 16, panelY + 23);

    const rows = [
      ['TOP SPEED', `${String(race.topSpeed || 0).padStart(3, '0')} KM/H`],
      ['DRIFT ANGLE', `${String(drift).padStart(2, '0')}°`],
      ['SURFACE', surface],
      ['CAR TYPE', spec.name],
    ];
    rows.forEach(([label, value], index) => {
      const y = panelY + 47 + index * 27;
      ctx.fillStyle = index === 3 ? 'rgba(116, 130, 123, 0.9)' : 'rgba(210, 215, 205, 0.7)';
      ctx.font = '700 7px Consolas, monospace';
      ctx.fillText(label, panelX + 16, y);
      ctx.fillStyle = index === 2 && p.surface === 'grass' ? '#d8b96d' : '#f4ecd9';
      ctx.font = '700 11px Consolas, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(value, panelX + 244, y);
      ctx.textAlign = 'left';
    });

    if (race.time < 12) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = clamp((12 - race.time) / 2.2, 0, 1);
      ctx.fillStyle = 'rgba(8, 13, 15, 0.72)';
      ctx.fillRect(W / 2 - 290, H - 55, 580, 28);
      ctx.fillStyle = 'rgba(222, 225, 211, 0.78)';
      ctx.font = '700 9px Consolas, monospace';
      ctx.fillText('W / ↑ THROTTLE    S / ↓ BRAKE    A D / ← → STEER    SPACE HANDBRAKE    R RESET    M MUTE', W / 2, H - 37);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    drawMessages();
    ctx.restore();
  }

  function drawHUD() {
    if (!race) return;
    if (race.mode === 'test') {
      drawTestHUD();
      return;
    }
    const p = race.player;
    const lap = Math.min(p.lapsDone + (p.finished ? 0 : 1), race.totalLaps);

    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // Position.
    drawPanel(24, 22, 216, 94, currentTrack.theme.accent);
    ctx.fillStyle = 'rgba(199, 207, 199, 0.7)';
    ctx.font = '700 8px Consolas, monospace';
    ctx.fillText('POSITION', 40, 44);
    ctx.fillStyle = currentTrack.theme.accent;
    ctx.font = '700 44px Impact, Haettenschweiler, sans-serif';
    ctx.fillText(String(p.place), 39, 92);
    ctx.fillStyle = 'rgba(230, 231, 217, 0.62)';
    ctx.font = '700 13px Consolas, monospace';
    ctx.fillText(`/ ${race.cars.length}`, 80, 90);
    ctx.fillStyle = 'rgba(117, 130, 124, 0.9)';
    ctx.font = '700 7px Consolas, monospace';
    ctx.fillText(`${ordinal(p.place)} PLACE`, 150, 44);

    // Lap and timer.
    drawPanel(W / 2 - 138, 20, 276, 82, 'rgba(244, 236, 217, 0.38)');
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(210, 215, 205, 0.74)';
    ctx.font = '700 9px Consolas, monospace';
    ctx.fillText(`LAP ${lap} / ${race.totalLaps}`, W / 2, 43);
    ctx.fillStyle = '#f4ecd9';
    ctx.font = '700 25px Consolas, monospace';
    ctx.fillText(formatTime(race.time), W / 2, 72);
    ctx.fillStyle = 'rgba(240, 82, 61, 0.85)';
    ctx.font = '700 7px Consolas, monospace';
    ctx.fillText(currentTrack.def.name, W / 2, 91);

    // Best lap.
    drawPanel(W - 24 - 246, 22, 246, 94, 'rgba(244, 236, 217, 0.38)');
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(199, 207, 199, 0.7)';
    ctx.font = '700 8px Consolas, monospace';
    ctx.fillText('BEST LAP', W - 24 - 232, 44);
    ctx.fillStyle = p.bestLap < Infinity ? '#f4ecd9' : 'rgba(116, 130, 123, 0.7)';
    ctx.font = '700 18px Consolas, monospace';
    ctx.fillText(p.bestLap < Infinity ? formatTime(p.bestLap) : '--:--.---', W - 24 - 232, 70);
    ctx.fillStyle = 'rgba(116, 130, 123, 0.8)';
    ctx.font = '700 7px Consolas, monospace';
    ctx.fillText(`${DIFFICULTIES[difficultyKey].label} RIVALS // ${race.totalLaps} LAPS`, W - 24 - 232, 91);

    drawSpeedPanel(p);
    drawMiniMap();

    // Controls hint.
    if (race.time < 10 && state === 'racing') {
      ctx.textAlign = 'center';
      ctx.globalAlpha = clamp((10 - race.time) / 2.2, 0, 1);
      ctx.fillStyle = 'rgba(8, 13, 15, 0.72)';
      ctx.fillRect(W / 2 - 290, H - 55, 580, 28);
      ctx.fillStyle = 'rgba(222, 225, 211, 0.78)';
      ctx.font = '700 9px Consolas, monospace';
      ctx.fillText('W / ↑ THROTTLE    S / ↓ BRAKE    A D / ← → STEER    SPACE HANDBRAKE    R RESET    M MUTE', W / 2, H - 37);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    drawMessages();
    drawCountdownAndFlags();
    ctx.restore();
  }

  function drawMiniMap() {
    if (!currentTrack || !race) return;
    const m = currentTrack.map;
    const x = W - 24 - 260;
    const y = H - 24 - 180;
    const w = 260;
    const h = 180;
    drawPanel(x, y, w, h, 'rgba(244, 236, 217, 0.28)', 0.8);

    ctx.fillStyle = 'rgba(199, 207, 199, 0.68)';
    ctx.font = '700 8px Consolas, monospace';
    ctx.fillText(`CIRCUIT // ${currentTrack.def.name}`, x + 16, y + 22);

    const padX = 15;
    const padY = 32;
    const innerW = w - padX * 2;
    const innerH = h - padY - 12;
    const scale = Math.min(innerW / m.canvas.width, innerH / m.canvas.height);
    const dw = m.canvas.width * scale;
    const dh = m.canvas.height * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + padY + (innerH - dh) / 2;

    ctx.globalAlpha = 0.92;
    ctx.drawImage(m.canvas, dx, dy, dw, dh);
    ctx.globalAlpha = 1;

    const mapScaleX = dw / m.canvas.width;
    const mapScaleY = dh / m.canvas.height;
    const dots = race.cars.slice().sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
    for (const car of dots) {
      const mx = dx + m.toMapX(car.x) * mapScaleX;
      const my = dy + m.toMapY(car.y) * mapScaleY;
      if (car.isPlayer) {
        ctx.fillStyle = 'rgba(255, 212, 71, 0.2)';
        ctx.beginPath();
        ctx.arc(mx, my, 7 + Math.sin(race.time * 4) * 1.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = playerColor;
        ctx.beginPath();
        ctx.arc(mx, my, 4.2, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#fff5cc';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = car.color;
        ctx.globalAlpha = car.ghost ? 0.55 : 1;
        ctx.beginPath();
        ctx.arc(mx, my, 3.1, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawMessages() {
    if (!race || !race.messages.length) return;
    const message = race.messages[0];
    const alpha = clamp(message.life / 0.4, 0, 1) * clamp((message.maxLife - message.life) / 0.12, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(5, 9, 11, 0.58)';
    ctx.fillRect(W / 2 - 210, 144, 420, 54);
    ctx.fillStyle = message.color;
    ctx.font = '700 24px Impact, Haettenschweiler, sans-serif';
    ctx.fillText(message.text, W / 2, 177);
    if (message.sub) {
      ctx.fillStyle = 'rgba(228, 229, 213, 0.72)';
      ctx.font = '700 9px Consolas, monospace';
      ctx.fillText(message.sub, W / 2, 192);
    }
    ctx.restore();
  }

  function drawCountdownAndFlags() {
    if (!race) return;

    if (state === 'countdown') {
      const n = Math.ceil(race.countdown);
      const phase = 1 - mod(race.countdown, 1);
      const scale = 1.15 - phase * 0.13;
      ctx.save();
      ctx.fillStyle = 'rgba(4, 8, 10, 0.18)';
      ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2 - 8);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.font = '700 138px Impact, Haettenschweiler, sans-serif';
      ctx.fillText(String(n), 7, 10);
      ctx.fillStyle = '#ffd447';
      ctx.fillText(String(n), 0, 0);
      ctx.fillStyle = 'rgba(244, 236, 217, 0.72)';
      ctx.font = '700 10px Consolas, monospace';
      ctx.fillText('HOLD THE SLIDE', 0, 100);
      ctx.restore();
    } else if (race.goTimer > 0) {
      const a = clamp(race.goTimer / 0.9, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(W / 2, H / 2 - 12);
      const scale = 0.95 + (1 - a) * 0.14;
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.font = '700 130px Impact, Haettenschweiler, sans-serif';
      ctx.fillText('GO!', 7, 9);
      ctx.fillStyle = '#9bdd74';
      ctx.fillText('GO!', 0, 0);
      ctx.restore();
    }

    if (state === 'finished' && race.finishTimer < 0.8 && !race.resultsShown) {
      const a = 1 - race.finishTimer / 0.8;
      ctx.save();
      ctx.globalAlpha = Math.min(1, a * 1.7);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, H / 2 - 74, W, 148);
      ctx.fillStyle = '#ffd447';
      ctx.font = '700 78px Impact, Haettenschweiler, sans-serif';
      ctx.fillText('FINISH', W / 2, H / 2 + 22);
      ctx.fillStyle = 'rgba(244, 236, 217, 0.74)';
      ctx.font = '700 10px Consolas, monospace';
      ctx.fillText(`${ordinal(race.playerPlace || 1)} PLACE`, W / 2, H / 2 + 48);
      ctx.restore();
    }
  }

  function render(time) {
    if (state === 'menu') {
      drawWorld(drawDemoCars());
      return;
    }
    drawWorld(race ? race.cars : []);
    drawHUD();
  }

  /* -------------------------------------------------------------------
     Results
     ------------------------------------------------------------------- */

  function showResults() {
    if (!race || race.resultsShown) return;
    race.resultsShown = true;
    const player = race.player;
    const place = race.playerPlace || 1;
    const standings = race.finalStandings || getStandings();

    $('resultKicker').textContent = place === 1 ? 'CHEQUERED FLAG // VICTORY' : 'CHEQUERED FLAG // RACE COMPLETE';
    $('resultTitle').textContent = place === 1 ? 'VICTORY' : 'FINISHED';
    $('finishPosition').innerHTML = `${place}<span>${ordinal(place)}</span>`;
    $('resultTrack').textContent = currentTrack.def.name;
    $('resultTime').textContent = formatTime(player.finishTime);
    $('resultBest').textContent = formatTime(player.bestLap);

    const rows = $('resultsRows');
    rows.innerHTML = '';
    standings.forEach((car, index) => {
      const row = document.createElement('div');
      row.className = 'results-row' + (car.isPlayer ? ' player' : '');
      const total = car.finished ? formatTime(car.finishTime) : `LAP ${Math.min(car.lapsDone + 1, race.totalLaps)}/${race.totalLaps}`;
      const best = car.bestLap < Infinity ? formatTime(car.bestLap) : '--:--.---';
      row.innerHTML = `
        <span class="pos">${String(index + 1).padStart(2, '0')}</span>
        <span class="driver"><span class="driver-swatch" style="background:${car.color}"></span>${car.name}</span>
        <span class="time-cell ${car.finished ? '' : 'dim'}">${total}</span>
        <span class="time-cell">${best}</span>
      `;
      rows.appendChild(row);
    });

    $('recordBanner').classList.toggle('hidden', !race.newRecord);
    resultsScreen.classList.remove('hidden');
    syncRecordUI();
  }

  function goToMenu() {
    state = 'menu';
    if (race) {
      sound.updateEngine(0, 0, false);
      sound.updateTires(0, false);
    }
    resultsScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    if (currentTrack) {
      currentTrack.skidCtx.clearRect(0, 0, WORLD_W, WORLD_H);
      resetMenuScene();
    }
    race = null;
    syncRecordUI();
  }

  function restartRace() {
    if (!currentTrack) return;
    resultsScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    menuScreen.classList.add('hidden');
    if (selectedTest || currentTrack.isTest) startTestDrive();
    else setupRace();
  }

  function startRace() {
    if (!currentTrack || garageOpen) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    resultsScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    menuScreen.classList.add('hidden');
    if (selectedTest || currentTrack.isTest) startTestDrive();
    else setupRace();
  }

  function pauseRace() {
    if (state !== 'racing' && state !== 'countdown' && state !== 'test') return;
    race.pausedFrom = state;
    state = 'paused';
    pauseScreen.classList.remove('hidden');
    sound.updateEngine(0, 0, false);
    sound.updateTires(0, false);
  }

  function resumeRace() {
    if (state !== 'paused' || !race) return;
    state = race.pausedFrom || 'racing';
    pauseScreen.classList.add('hidden');
    sound.resume();
  }

  /* -------------------------------------------------------------------
     Audio update
     ------------------------------------------------------------------- */

  function updateAudio() {
    if (!race || state === 'menu' || state === 'paused' || state === 'finished') {
      sound.updateEngine(0, 0, false);
      sound.updateTires(0, false);
      return;
    }
    const p = race.player;
    const ratio = clamp(p.speed / p.maxSpeed, 0, 1);
    const active = state === 'racing' || state === 'countdown' || state === 'test';
    sound.updateEngine(state === 'countdown' ? 0.025 : ratio, p.control.throttle, active);
    const tireAmount = p.drifting ? clamp((Math.abs(p.lateralSpeed) - 35) / 150, 0.2, 1) : 0;
    sound.updateTires(tireAmount, active && tireAmount > 0);
  }

  /* -------------------------------------------------------------------
     Main loop
     ------------------------------------------------------------------- */

  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0);
    lastFrame = now;

    if (state === 'menu') {
      updateMenu(dt);
    } else if (state === 'countdown' || state === 'racing' || state === 'test') {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= STEP && steps < 8) {
        if (state === 'countdown') updateCountdown(STEP);
        else if (state === 'racing') updateRacing(STEP);
        else if (state === 'test') updateTest(STEP);
        accumulator -= STEP;
        steps++;
        if (state === 'finished') {
          accumulator = 0;
          break;
        }
      }
    } else if (state === 'finished' && race) {
      race.finishTimer += dt;
      if (!race.resultsShown && race.finishTimer > 0.82) showResults();
    }

    updateAudio();
    render(now / 1000);
    requestAnimationFrame(frame);
  }

  /* -------------------------------------------------------------------
     Input
     ------------------------------------------------------------------- */

  const handledKeys = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyM', 'Escape', 'Enter',
  ]);

  window.addEventListener('keydown', (event) => {
    if (handledKeys.has(event.code)) {
      if (state !== 'menu' || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    }

    if (event.repeat) return;

    if (garageOpen) {
      if (event.code === 'Escape' || event.code === 'Enter') {
        event.preventDefault();
        closeGarage();
      }
      return;
    }

    if (event.code === 'Escape') {
      if (state === 'racing' || state === 'countdown' || state === 'test') pauseRace();
      else if (state === 'paused') resumeRace();
      return;
    }

    if (event.code === 'KeyM') {
      muted = !muted;
      sound.setMuted(muted);
      writeStore('muted', muted);
      showToast(muted ? 'SOUND OFF' : 'SOUND ON', 1100);
      return;
    }

    if (state === 'menu' || state === 'finished') {
      if (event.code === 'Enter') {
        if (state === 'menu') startRace();
        else if (race && race.resultsShown) restartRace();
      }
      if (event.code === 'Escape' && state === 'finished') goToMenu();
      return;
    }

    if (event.code === 'KeyR' && (state === 'racing' || state === 'test')) {
      resetPlayerCar();
      return;
    }

    if (state === 'paused') {
      if (event.code === 'Enter') resumeRace();
      return;
    }

    if (event.code === 'ArrowUp' || event.code === 'KeyW') keys.up = true;
    if (event.code === 'ArrowDown' || event.code === 'KeyS') keys.down = true;
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') keys.left = true;
    if (event.code === 'ArrowRight' || event.code === 'KeyD') keys.right = true;
    if (event.code === 'Space') keys.handbrake = true;
  });

  window.addEventListener('keyup', (event) => {
    if (event.code === 'ArrowUp' || event.code === 'KeyW') keys.up = false;
    if (event.code === 'ArrowDown' || event.code === 'KeyS') keys.down = false;
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') keys.left = false;
    if (event.code === 'ArrowRight' || event.code === 'KeyD') keys.right = false;
    if (event.code === 'Space') keys.handbrake = false;
  });

  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = keys.handbrake = false;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (state === 'racing' || state === 'countdown' || state === 'test')) pauseRace();
  });

  /* -------------------------------------------------------------------
     UI wiring
     ------------------------------------------------------------------- */

  $('startButton').addEventListener('click', startRace);
  $('resumeButton').addEventListener('click', resumeRace);
  $('restartButton').addEventListener('click', restartRace);
  $('quitButton').addEventListener('click', goToMenu);
  $('raceAgainButton').addEventListener('click', restartRace);
  $('changeTrackButton').addEventListener('click', goToMenu);
  $('garageButton').addEventListener('click', openGarage);
  $('garageClose').addEventListener('click', closeGarage);
  $('garageDone').addEventListener('click', closeGarage);
  $('testTrackButton').addEventListener('click', selectTestTrack);
  garageScreen.addEventListener('click', (event) => {
    if (event.target === garageScreen) closeGarage();
  });

  document.querySelectorAll('#lapOptions button').forEach((button) => {
    button.addEventListener('click', () => {
      totalLaps = Number(button.dataset.laps);
      writeStore('laps', totalLaps);
      syncOptionUI();
    });
  });

  document.querySelectorAll('#difficultyOptions button').forEach((button) => {
    button.addEventListener('click', () => {
      difficultyKey = button.dataset.difficulty;
      writeStore('difficulty', difficultyKey);
      syncOptionUI();
    });
  });

  /* -------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------- */

  function boot() {
    muted = readStore('muted', 'false') === 'true';
    sound.muted = muted;

    const storedLaps = Number(readStore('laps', '3'));
    totalLaps = [2, 3, 5].includes(storedLaps) ? storedLaps : 3;

    const storedDifficulty = readStore('difficulty', 'pro');
    difficultyKey = DIFFICULTIES[storedDifficulty] ? storedDifficulty : 'pro';

    const storedCarType = readStore('carType', 'supra');
    playerCarType = CAR_TYPES[storedCarType] ? storedCarType : 'supra';
    playerColor = normalizeHexColor(readStore('carColor', PLAYER.color), PLAYER.color);
    playerAccent = accentForPaint(playerColor);

    const storedTrack = readStore('track', TRACK_DEFS[0].id);
    const trackIndex = TRACK_DEFS.findIndex((def) => def.id === storedTrack);
    selectedTrackIndex = trackIndex >= 0 ? trackIndex : 0;
    selectedTest = storedTrack === 'airfield';

    buildTrackList();
    buildCarTypeList();
    buildColorSwatches();
    syncCarUI();
    syncOptionUI();

    currentTrack = selectedTest ? buildAirfieldTrack() : buildTrack(TRACK_DEFS[selectedTrackIndex]);
    resetMenuScene();
    syncTrackUI();
    syncModeUI();

    lastFrame = performance.now();
    requestAnimationFrame(frame);
  }

  boot();
})();
