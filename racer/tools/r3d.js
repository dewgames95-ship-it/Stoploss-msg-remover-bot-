  // =========================================================================
  // 7b. THREE.JS (WebGL) RACE RENDERER — draws the same cars[] / trackObjects[]
  //     the simulation owns. If WebGL or the library is unavailable a short
  //     message is shown over the race view instead.
  // =========================================================================
  const R3D = { status: 'pending', overlayDirty: true };
  const R3D_XS = 4.1;   // metres per lane-space unit (road half-width = 1.0)
  const R3D_ZS = 0.29;  // metres per track-distance unit (kept low for a steady sense of speed)

  // ---- shared with the simulation ----
  // Obstacle footprints in metres as drawn: half-width, half-depth, height a jumping car must clear.
  const R3D_OBJ = {
    cone: { hw: 1.05, hd: 0.55, h: 0.9 }, barrel: { hw: 0.95, hd: 0.5, h: 1.1 }, barrier: { hw: 1.35, hd: 0.4, h: 1.1 },
    crates: { hw: 0.95, hd: 0.5, h: 1.5 }, barricade: { hw: 0.8, hd: 0.35, h: 1.0 }, tyres: { hw: 0.85, hd: 0.6, h: 0.9 },
    roadblock: { hw: 1.3, hd: 0.4, h: 1.1 }, brokentruck: { hw: 1.12, hd: 2.45, h: 9 }, brokencar: { hw: 1.0, hd: 2.2, h: 9 }
  };
  const R3D_CAR = { hl: 2.3, hw: 0.95 };
  const R3D_FX = { railHits: [] }; // { side, z, t } pushed by the simulation when a car hits the guard rail
  // Route for this race, re-rolled from the obstacle layout (so it is the same for everyone in a room):
  //   bends    gentle S-waves in every race; most races add full left / right sweeps and S-curve sections
  //   hills    some races have slow rises and falls
  //   squeeze  some races close one outer lane for about five seconds (3 -> 2 -> 3 lanes, long tapers)
  //   city     some races drive through a street of tall buildings (one smooth S-turn, no flora)
  //   bridge   some races cross a gorge on a bridge (always on a straight)
  //   tunnel   about a third of the races (never on the lake) drive through a tunnel, near-straight
  //   map      highway (all of the above), city (one long street), mountain (ghat road: cliff + valley), lake (long bridge over open water), desert
  // The simulation stays a straight strip; bends and hills are drawn by the vertex shader, cars feel a bend as drift.
  let r3dRouteFor = null, r3dRoute = null, r3dPathCache = null, r3dRouteMap = '', r3dRouteEnd = 0, r3dRouteFlags = 0, r3dSeedFor = null, r3dSeed = 7;
  const SQ_TAPER = 230, SQ_HOLD = 440, SQ_SHIFT = 0.75; // track units; how far the wall moves the car limit inwards
  const BR_LEN = 250; // track units (about 72 m): the bridge over the gorge
  const LAKE_MOD = 28; // metres: one repeating module of the long lake bridge
  // Maps: the page says which one is selected (`currentMap`); tests can force one with window._trRouteForce.map.
  const R3D_MAPS = ['highway', 'city', 'mountain', 'lake', 'desert'];
  function r3dMapKey() {
    let k = null;
    try { const F = window._trRouteForce; k = (F && F.map) || (typeof currentMap !== 'undefined' ? currentMap : null); } catch (e) { k = null; }
    return R3D_MAPS.indexOf(k) >= 0 ? k : 'highway';
  }
  function r3dEndZ() { try { if (typeof FINISH_LINE_Z === 'number') return FINISH_LINE_Z; } catch (e) {} return 4000; } // the race length changes with the timer: never cached
  // smooth 0..1 "how close to a stretch" (1 inside it and `pad` around it, fading out over `fade` units)
  function r3dNear(z, z0, z1, pad, fade) { const d = z < z0 - pad ? z0 - pad - z : (z > z1 + pad ? z - z1 - pad : 0), t = Math.max(0, 1 - d / fade); return t * t * (3 - 2 * t); }
  function raceRoute() {
    const mapK = r3dMapKey(), endZ = r3dEndZ(), F = window._trRouteForce || {};
    const fl = (F.tunnel ? 1 : 0) | (F.city ? 2 : 0) | (F.bridge ? 4 : 0) | (F.twisty ? 8 : 0) | (F.hills ? 16 : 0) | (F.squeeze ? 32 : 0);
    if (r3dRoute && r3dRouteFor === trackObjects && r3dRouteMap === mapK && r3dRouteEnd === endZ && r3dRouteFlags === fl) return r3dRoute;
    r3dRouteFor = trackObjects; r3dPathCache = null; r3dRouteMap = mapK; r3dRouteEnd = endZ; r3dRouteFlags = fl;
    const hs = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    // the seed comes from the obstacle layout as it was first seen (the squeeze below removes objects later)
    if (r3dSeedFor !== trackObjects) { let q = 7; for (let i = 4; i < Math.min(trackObjects.length, 20); i++) q = (q * 31 + Math.round(trackObjects[i].z * 10) + trackObjects[i].lane * 7) % 100003; r3dSeedFor = trackObjects; r3dSeed = q; }
    const sd = r3dSeed;
    let k = 0; const rnd = () => hs(sd * 0.731 + (++k) * 19.19);
    let k2 = 0; const rnd2 = () => hs(sd * 1.913 + (++k2) * 23.17 + 0.5); // map features only: the stream above stays the same on every map
    const R = { map: mapK, base: { bias: (hs(sd + 1) - 0.5) * 0.0011, a1: 0.0007 + hs(sd + 2) * 0.0005, f1: 210 + hs(sd + 3) * 190, p1: hs(sd + 4) * 6.283, a2: 0.0004 + hs(sd + 5) * 0.0004, f2: 85 + hs(sd + 6) * 75, p2: hs(sd + 7) * 6.283 }, events: [], hills: null, squeeze: null, city: null, bridge: null, lake: null, tunnel: null, cliff: rnd2() < 0.5 ? -1 : 1, style: 'gentle' };
    if (rnd() < 0.75 || F.twisty) { // sweeps and S-curves, spaced out, never the same twice
      R.style = 'twisty';
      let z = 420 + rnd() * 380;
      while (z < endZ - 650) {
        const dir = rnd() < 0.5 ? -1 : 1;
        if (rnd() < 0.55) { const len = 620 + rnd() * 520; R.events.push({ type: 'sweep', z0: z, len, amp: dir * (0.0019 + rnd() * 0.0009) }); z += len; }
        else { const len = 880 + rnd() * 520; R.events.push({ type: 's', z0: z, len, amp: dir * (0.0018 + rnd() * 0.0008), waves: rnd() < 0.5 ? 1 : 1.5 }); z += len; }
        z += 180 + rnd() * 620;
      }
    }
    if (rnd() < 0.45 || F.hills) R.hills = { a1: 0.00020 + rnd() * 0.00016, f1: 250 + rnd() * 210, p1: rnd() * 6.283, a2: 0.00008 + rnd() * 0.0001, f2: 110 + rnd() * 90, p2: rnd() * 6.283 };
    if ((rnd() < 0.5 || F.squeeze) && typeof LANE_CENTERS !== 'undefined' && LANE_CENTERS.length === 3 && endZ > 2600) {
      const z0 = 850 + rnd() * (endZ - 850 - 1500);
      R.squeeze = { z0, zA: z0 + SQ_TAPER, zB: z0 + SQ_TAPER + SQ_HOLD, z1: z0 + SQ_TAPER * 2 + SQ_HOLD, side: rnd() < 0.5 ? -1 : 1 };
      // the stretch is hard enough on its own: no obstacles or ramps inside it, and no pads in the closed lane
      const closed = R.squeeze.side > 0 ? 2 : 0;
      for (let i = trackObjects.length - 1; i >= 0; i--) {
        const o = trackObjects[i];
        if (o.z > z0 - 110 && o.z < R.squeeze.z1 + 60 && (o.type !== 'boost' || o.lane === closed || o.lane2 === closed)) trackObjects.splice(i, 1);
      }
    }
    // City street and gorge bridge: drawn after the other features so the random numbers above are unchanged.
    {
      const cRoll = rnd(), cLen = rnd(), cPos = rnd(), cDir = rnd(), cAmp = rnd(), bRoll = rnd();
      const bTry = []; for (let i = 0; i < 12; i++) bTry.push(rnd());
      if (mapK === 'highway' && (cRoll < 0.45 || F.city) && endZ > 2600) {
        const len = 560 + cLen * 240, z0 = 700 + cPos * (endZ - 700 - len - 600), z1 = z0 + len;
        R.city = { z0, z1 };
        R.events = R.events.filter((ev) => !(ev.z0 < z1 + 120 && ev.z0 + ev.len > z0 - 120)); // the street gets its own S-turn
        R.events.push({ type: 's', z0: z0 + 50, len: len - 100, amp: (cDir < 0.5 ? -1 : 1) * (0.0019 + cAmp * 0.0005), waves: 1 });
      }
      if (mapK === 'highway' && (bRoll < 0.4 || F.bridge) && endZ > 2600) {
        for (const t of bTry) {
          const z0 = 600 + t * (endZ - 600 - BR_LEN - 450), z1 = z0 + BR_LEN;
          if (R.city && z1 > R.city.z0 - 260 && z0 < R.city.z1 + 260) continue;
          if (R.squeeze && z1 > R.squeeze.z0 - 200 && z0 < R.squeeze.z1 + 200) continue;
          R.bridge = { z0, z1 }; break;
        }
        if (!R.bridge && F.bridge) { // forced (tests): scan for any free stretch instead of giving up
          for (let z0 = 600; z0 < endZ - BR_LEN - 450 && !R.bridge; z0 += 40) {
            const z1 = z0 + BR_LEN;
            if ((R.city && z1 > R.city.z0 - 260 && z0 < R.city.z1 + 260) || (R.squeeze && z1 > R.squeeze.z0 - 200 && z0 < R.squeeze.z1 + 200)) continue;
            R.bridge = { z0, z1 };
          }
        }
      }
    }
    // ---- map routes (own random stream) ----
    const sweepsAndS = (z, zEnd, o) => { // o: sweep chance, lenS [min, span], ampS, lenW, ampW, gap [min, span], waves
      while (z < zEnd) {
        const dir = rnd2() < 0.5 ? -1 : 1;
        if (rnd2() < o.sweep) { const len = o.lenW[0] + rnd2() * o.lenW[1]; R.events.push({ type: 'sweep', z0: z, len, amp: dir * (o.ampW[0] + rnd2() * o.ampW[1]) }); z += len; }
        else { const len = o.lenS[0] + rnd2() * o.lenS[1]; R.events.push({ type: 's', z0: z, len, amp: dir * (o.ampS[0] + rnd2() * o.ampS[1]), waves: o.waves[Math.floor(rnd2() * o.waves.length)] }); z += len; }
        z += o.gap[0] + rnd2() * o.gap[1];
      }
    };
    if (mapK === 'city') {
      R.events = []; R.style = 'twisty';
      sweepsAndS(380 + rnd2() * 200, endZ - 330, { sweep: 0.5, lenW: [520, 380], ampW: [0.0012, 0.0007], lenS: [700, 400], ampS: [0.0012, 0.0007], waves: [1, 1.5], gap: [60, 200] });
      R.city = { z0: 250, z1: Math.max(900, endZ - 150) };
    } else if (mapK === 'mountain') {
      R.events = []; R.style = 'twisty';
      sweepsAndS(260 + rnd2() * 120, endZ - 260, { sweep: 0.5, lenW: [380, 340], ampW: [0.0015, 0.0008], lenS: [560, 320], ampS: [0.0014, 0.0008], waves: [1, 1.5], gap: [40, 140] });
      R.hills = { a1: 0.00032 + rnd2() * 0.00014, f1: 200 + rnd2() * 120, p1: rnd2() * 6.283, a2: 0.00014 + rnd2() * 0.00012, f2: 90 + rnd2() * 60, p2: rnd2() * 6.283 };
    } else if (mapK === 'lake') {
      R.events = []; R.style = 'gentle'; R.hills = null;
      sweepsAndS(520 + rnd2() * 200, endZ - 260, { sweep: 1, lenW: [800, 400], ampW: [0.0006, 0.0005], lenS: [800, 300], ampS: [0.0006, 0.0004], waves: [1], gap: [260, 400] });
      const z0 = 250, lenM = Math.floor((Math.max(700, endZ - 200) - z0) * R3D_ZS / LAKE_MOD) * LAKE_MOD;
      R.lake = { z0, z1: z0 + lenM / R3D_ZS };
    }
    {
      // tunnel: some races, 200-300 units long, away from the street, the bridge, the squeeze and the lake
      const tRoll = rnd2(), tLen = rnd2(), tTry = []; for (let i = 0; i < 12; i++) tTry.push(rnd2());
      if ((tRoll < (mapK === 'highway' ? 0.10 : 0.35) || F.tunnel) && mapK !== 'lake' && endZ > 1500) {
        const len = 200 + tLen * 100, free = (z0) => {
          const z1 = z0 + len;
          if (R.bridge && z1 > R.bridge.z0 - 260 && z0 < R.bridge.z1 + 260) return false;
          if (R.squeeze && z1 > R.squeeze.z0 - 200 && z0 < R.squeeze.z1 + 200) return false;
          if (mapK === 'highway' && R.city && z1 > R.city.z0 - 260 && z0 < R.city.z1 + 260) return false;
          return true;
        };
        for (const t of tTry) { const z0 = 650 + t * (endZ - 650 - len - 420); if (free(z0)) { R.tunnel = { z0, z1: z0 + len }; break; } }
        if (!R.tunnel && F.tunnel) for (let z0 = 600; z0 < endZ - len - 380 && !R.tunnel; z0 += 40) if (free(z0)) R.tunnel = { z0, z1: z0 + len };
      }
    }
    return (r3dRoute = R);
  }
  function trackBendAt(z) {
    const R = raceRoute(), c = R.base, e = Math.min(1, Math.max(0, (z - 40) / 260)), cS = e * e * (3 - 2 * e);
    let b = cS * (c.bias + c.a1 * Math.sin(z / c.f1 + c.p1) + c.a2 * Math.sin(z / c.f2 + c.p2)) * (R.events.length ? 0.6 : 1);
    for (const ev of R.events) {
      const u = (z - ev.z0) / ev.len;
      if (u <= 0 || u >= 1) continue;
      if (ev.type === 'sweep') { const w = Math.sin(Math.PI * u); b += ev.amp * w * w; }
      else { const edge = Math.min(1, u / 0.14, (1 - u) / 0.14), w = edge * edge * (3 - 2 * edge); b += ev.amp * Math.sin(Math.PI * 2 * ev.waves * u) * w; }
    }
    const br = R.bridge; // the bridge always sits on a straight: the bend fades out well before it and back in after it
    if (br) b *= 1 - r3dNear(z, br.z0, br.z1, 20, 140);
    if (R.tunnel) b *= 1 - r3dNear(z, R.tunnel.z0, R.tunnel.z1, 20, 140); // near-straight through a tunnel
    if (R.lake) b *= 1 - 0.6 * r3dNear(z, R.lake.z0, R.lake.z1, 0, 140); // open water: at most 40% of a bend
    return b;
  }
  // Vertical bend of the road ahead (rise > 0, crest < 0); 0 in races without hills.
  function trackHillAt(z) {
    const h = raceRoute().hills;
    if (!h) return 0;
    const e = Math.min(1, Math.max(0, (z - 120) / 320)), cS = e * e * (3 - 2 * e);
    const v = cS * (h.a1 * Math.sin(z / h.f1 + h.p1) + h.a2 * Math.sin(z / h.f2 + h.p2));
    return v < 0 ? v * 0.7 : v;
  }
  // Lane squeeze at track position z: { w: 0..1 how far the wall has moved in, side: -1 left / +1 right lane closed }.
  const R3D_NOSQ = { w: 0, side: 0 };
  function trackSqueezeAt(z) {
    const q = raceRoute().squeeze;
    if (!q || z <= q.z0 || z >= q.z1) return R3D_NOSQ;
    const u = z < q.zA ? (z - q.z0) / SQ_TAPER : (z > q.zB ? (q.z1 - z) / SQ_TAPER : 1);
    return { w: u * u * (3 - 2 * u), side: q.side };
  }
  // Side limits for a car centre at z (lane-space units), guard rail or squeeze wall.
  function trackLimitsAt(z, railX) {
    const q = trackSqueezeAt(z);
    return { lo: -railX + (q.side < 0 ? SQ_SHIFT * q.w : 0), hi: railX - (q.side > 0 ? SQ_SHIFT * q.w : 0), side: q.side, w: q.w };
  }
  // Index of the lane that is (about to be) closed for a car at z looking `look` units ahead, or -1.
  function trackClosedLaneAhead(z, look) {
    const q = raceRoute().squeeze;
    if (!q || z + look < q.z0 + 30 || z > q.zB + 30) return -1;
    return q.side > 0 ? 2 : 0;
  }
  // Top-down centre line of the real route (metres), for the mini-map: heading turns by 2 * bend per metre.
  function trackPath() {
    raceRoute();
    if (r3dPathCache) return r3dPathCache;
    const pts = [], STEP = 12; let x = 0, y = 0, th = 0, minX = 0, maxX = 0;
    for (let z = 0; z <= FINISH_LINE_Z + STEP; z += STEP) {
      pts.push([x, y]); if (x < minX) minX = x; if (x > maxX) maxX = x;
      const dm = STEP * R3D_ZS; th += 2 * trackBendAt(z + STEP / 2) * dm; x += Math.sin(th) * dm; y += Math.cos(th) * dm;
    }
    return (r3dPathCache = { pts, step: STEP, minX, maxX, len: y });
  }

  // ---- HUD layout: race id + time as a see-through card on the sky, smaller right-hand buttons, camera toggle ----
  (function r3dHud() {
    const st = document.createElement('style');
    st.textContent = `
.viewport-wrap > .status-strip { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: max-content; max-width: 60%; display: grid; grid-template-columns: auto auto; gap: 0; padding: 0; background: none; box-shadow: 0 3px 10px rgba(0,0,0,0.3); border-radius: 12px; z-index: 14; zoom: 0.8; pointer-events: none; }
.viewport-wrap > .status-strip .status-card { background: rgba(8,13,24,0.66); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); padding: 3px 9px; }
.viewport-wrap > .status-strip .status-card:nth-last-child(2) { border-radius: 0 12px 12px 0; border-right-width: 1px; }
.viewport-wrap > .top-position-banner { top: 44px; left: 50%; background: rgba(8,13,24,0.7); }
.right-hud-stack .icon-toggle-btn { zoom: 0.8; }
#cameraToggleBtn { cursor: pointer; }
.console-car-bet-grid { align-items: stretch; }
.console-car-bet-grid .console-car-card { display: flex; flex-direction: column; justify-content: space-between; }
`;
    document.head.appendChild(st);
    const strip = document.querySelector('.status-strip'), vp = document.querySelector('.viewport-wrap');
    if (strip && vp) vp.insertBefore(strip, vp.firstChild);
    // Car Bet and Manual Drive keep the same console height, so the 3D view is the Drive size in both.
    const bet = document.getElementById('consoleCarBetGrid'), man = document.getElementById('manualControlsGrid');
    const syncConsole = () => {
      if (!bet || !man) return;
      const bd = bet.style.display, md = man.style.display;
      bet.style.minHeight = ''; bet.style.display = 'none'; man.style.display = 'grid';
      const h = man.offsetHeight;
      man.style.display = md; bet.style.display = bd;
      if (h > 0) bet.style.minHeight = h + 'px';
    };
    syncConsole(); setTimeout(syncConsole, 400); setTimeout(syncConsole, 1500);
    window.addEventListener('resize', syncConsole);
    document.addEventListener('click', () => setTimeout(syncConsole, 0));
    // camera: TPP (behind the car) / FPP (driver's seat); usable at any time, in both play modes
    const camBtn = document.getElementById('cameraToggleBtn'), camTxt = document.getElementById('cameraBtnText');
    try { R3D.fpp = localStorage.getItem('tr_cam') === 'fpp'; } catch (e) {}
    const CAM_ICON = '<svg viewBox="0 0 24 24" fill="none"><rect x="2.500" y="6.500" width="13" height="11" rx="2.500" fill="#ffffff"/><path d="M15.500 10.500l5.500-3.200v9.400l-5.500-3.200z" fill="#ffffff"/><circle cx="9" cy="12" r="2.300" fill="#0e2a1c"/></svg>';
    const label = () => { if (camTxt) camTxt.innerHTML = CAM_ICON + 'CAMERA'; if (camBtn) camBtn.title = R3D.fpp ? 'Camera: driver seat (FPP)' : 'Camera: behind the car (TPP)'; };
    label();
    if (camBtn) camBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      R3D.fpp = !R3D.fpp; label();
      try { localStorage.setItem('tr_cam', R3D.fpp ? 'fpp' : 'tpp'); } catch (err) {}
      if (typeof triggerHaptic === 'function') triggerHaptic(25);
    });
  })();

  function r3dFail(reason) {
    if (R3D.status === 'failed') return;
    R3D.status = 'failed';
    if (R3D.glCanvas) R3D.glCanvas.style.display = 'none';
    const cb = document.getElementById('cameraToggleBtn'); if (cb) cb.style.display = 'none';
    try { console.warn('[race3d] 3D renderer unavailable:', reason); } catch (e) {}
    // No 2D fallback any more: tell the player plainly what is wrong.
    try {
      const host = canvas.parentNode;
      if (!host || document.getElementById('r3dNoWebgl')) return;
      Array.from(host.children).forEach((el) => { if (el !== canvas && el.style && el.style.zIndex === '40' && /LOADING/.test(el.textContent || '')) el.remove(); });
      const box = document.createElement('div');
      box.id = 'r3dNoWebgl';
      box.style.cssText = 'position:absolute;inset:0;z-index:41;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px;text-align:center;background:radial-gradient(circle at 50% 40%,#12305a 0%,#0b1528 70%);color:#e2f3ff;font:600 13px/1.45 system-ui,sans-serif;';
      box.innerHTML = '<div style="font-size:19px;font-weight:900;font-style:italic;letter-spacing:.06em">MONEY RACER</div>'
        + '<div style="font-size:15px;font-weight:800">3D graphics are not available on this device</div>'
        + '<div style="opacity:.8;max-width:300px">The race needs WebGL. Please update Telegram or your browser, turn on hardware acceleration, and open the game again.</div>'
        + '<button type="button" style="margin-top:6px;padding:9px 22px;border:0;border-radius:10px;background:#22c55e;color:#06210f;font:900 13px system-ui,sans-serif;letter-spacing:.06em">RELOAD</button>';
      box.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); location.reload(); });
      host.appendChild(box);
    } catch (e) {}
  }

  async function r3dInit() {
    const T = window.THREE;
    const glCanvas = document.createElement('canvas');
    glCanvas.id = 'raceCanvas3D';
    glCanvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;';
    canvas.parentNode.insertBefore(glCanvas, canvas);
    canvas.style.position = 'relative';
    R3D.glCanvas = glCanvas;

    const renderer = new T.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); r3dFail('context lost'); });

    // ---------- assets (each one is optional: a built-in stand-in is used if it fails) ----------
    const ADD = window.__trThreeAddons || {};
    const ASSET_BASE = './assets/game3d/', ASSET_V = '?v=r19';
    // Gentle road curves without touching the straight-line simulation: every vertex is pushed
    // sideways by (distance ahead)^2. The bend amount rides in an otherwise-zero projection
    // matrix cell so all built-in materials pick it up with no per-material uniforms.
    if (!T.ShaderChunk.project_vertex.includes('trHill')) {
      T.ShaderChunk.project_vertex = T.ShaderChunk.project_vertex.replace('gl_Position = projectionMatrix * mvPosition;',
        'float trBend = projectionMatrix[1][0];\n\tfloat trHill = projectionMatrix[0][1];\n\tmat4 trProj = projectionMatrix; trProj[1][0] = 0.0; trProj[0][1] = 0.0;\n\tfloat trD2 = min(mvPosition.z * mvPosition.z, 160000.0);\n\tmvPosition.x += trBend * trD2;\n\tmvPosition.y += trHill * trD2;\n\tgl_Position = trProj * mvPosition;');
    }
    // Full loading screen over the race view: the game cannot be started until every asset is in.
    const loadPill = document.createElement('div');
    loadPill.style.cssText = 'position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:radial-gradient(ellipse at 50% 34%,#1b3f78 0%,#0f2347 42%,#070d1c 100%);color:#e2f3ff;font:800 13px/1 system-ui,sans-serif;overflow:hidden;';
    loadPill.innerHTML = '<style>.r3dl-trio{position:relative;width:min(92vw,380px);height:min(33vw,130px);margin-bottom:6px}.r3dl-trio img{position:absolute;bottom:0;width:50%;height:auto;filter:drop-shadow(0 10px 10px rgba(0,0,0,.55))}.r3dl-trio .l{left:-3%;transform:scale(.9);filter:drop-shadow(0 8px 8px rgba(0,0,0,.5)) brightness(.8)}.r3dl-trio .r{right:-3%;transform:scale(.9);filter:drop-shadow(0 8px 8px rgba(0,0,0,.5)) brightness(.8)}.r3dl-trio .c{left:24%;width:52%;z-index:2;animation:r3dlf 2.4s ease-in-out infinite}.r3dl-glow{position:absolute;left:50%;top:60%;width:90%;height:70%;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(47,123,255,.45),rgba(47,123,255,0) 70%);animation:r3dlg 2.4s ease-in-out infinite}.r3dl-shine{position:absolute;inset:0;z-index:3;overflow:hidden;pointer-events:none}.r3dl-shine:after{content:\'\';position:absolute;top:0;bottom:0;width:30%;left:-40%;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.28),rgba(255,255,255,0));transform:skewX(-18deg);animation:r3dls 2.6s ease-in-out infinite}@keyframes r3dlf{50%{transform:translateY(-3px)}}@keyframes r3dlg{50%{opacity:.55}}@keyframes r3dls{0%{left:-40%}60%,100%{left:120%}}#r3dLoadBar i{box-shadow:0 0 10px rgba(34,224,122,.8)}</style><div class="r3dl-trio"><div class="r3dl-glow"></div><img class="l" alt="" src="./assets/ui/car_f8_red.webp"><img class="r" alt="" src="./assets/ui/car_f8_yellow.webp"><img class="c" alt="" src="./assets/ui/car_f8_blue.webp"><div class="r3dl-shine"></div></div><div style="font-size:26px;font-style:italic;font-weight:900;letter-spacing:.08em;text-shadow:0 2px 14px rgba(47,123,255,.6)">MONEY <span style="color:#FFC83D">RACER</span></div><span id="r3dLoadBar" style="display:block;width:68%;max-width:280px;height:10px;border-radius:6px;background:rgba(255,255,255,0.12);overflow:hidden;box-shadow:0 0 0 1px rgba(34,224,122,.35),inset 0 1px 2px rgba(0,0,0,.5);margin-top:8px"><i style="display:block;height:100%;width:2%;background:linear-gradient(90deg,#16a34a,#22E07A,#a7f3c8);border-radius:6px;transition:width .2s linear"></i></span><div id="r3dLoadTxt" style="font-size:14px;letter-spacing:.04em;font-variant-numeric:tabular-nums">Loading…</div><div style="opacity:.6;font-size:11px;font-weight:600;letter-spacing:.08em">Loading track…</div><div id="r3dLoadPct" style="opacity:.7;font-size:10px">0%</div>';
    canvas.parentNode.appendChild(loadPill);
    // Assets are fetched once, stored with the Cache API under a versioned key and served from there on
    // later opens. Bump ASSET_V whenever a file in assets/game3d changes: the cache key follows it and
    // older caches are deleted.
    const CACHE_KEY = 'tr-assets-' + ASSET_V.slice(3), LOAD_TOTAL = 11;
    const ASSET_BYTES = { 'car_f8.glb': 1579088, 'car_ao.png': 21407, 'flora.webp': 707288, 'sky.jpg': 44948, 'sky_front.jpg': 153383, 'trees_maple.glb': 761184, 'trees_pine.glb': 599524, 'city_a.glb': 3782056, 'city_b.glb': 2852780, 'tower.glb': 129028, 'grass.glb': 177332 };
    const loadProg = {}, loadT0 = performance.now();
    let loadedCount = 0, netBytes = 0, shownEta = -1;
    let assetCache = null;
    try {
      if (window.caches) {
        assetCache = await caches.open(CACHE_KEY);
        caches.keys().then((ks) => ks.forEach((k) => { if (k.startsWith('tr-assets-') && k !== CACHE_KEY) caches.delete(k); })).catch(() => {});
      }
    } catch (e) { assetCache = null; }
    // Returns a URL the loaders can read: a blob URL (from the cache, or freshly downloaded with byte
    // progress), or the plain file URL if anything about caching/streaming is unavailable.
    const assetUrl = async (file) => {
      const url = ASSET_BASE + file + ASSET_V, pr = loadProg[file] = { got: 0, total: ASSET_BYTES[file] || 200000 };
      try {
        let resp = assetCache ? await assetCache.match(url) : null;
        if (resp) { const blob = await resp.blob(); pr.got = pr.total; return URL.createObjectURL(blob); }
        resp = await fetch(url);
        if (!resp.ok || !resp.body) throw new Error('fetch');
        const len = +resp.headers.get('content-length');
        if (len > 0 && !resp.headers.get('content-encoding')) pr.total = len;
        const reader = resp.body.getReader(), chunks = [];
        for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); pr.got += value.length; netBytes += value.length; if (pr.got > pr.total) pr.total = pr.got; }
        const type = resp.headers.get('content-type') || '', blob = new Blob(chunks, { type });
        pr.total = pr.got = blob.size || pr.total;
        if (assetCache) assetCache.put(url, new Response(blob, { headers: { 'content-type': type } })).catch(() => {});
        return URL.createObjectURL(blob);
      } catch (e) { pr.got = pr.total; return url; }
    };
    const freeUrl = (u) => { if (u && u.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(u), 4000); };
    // Progress = real bytes received (90%) + assets decoded (10%); the countdown is bytes left / measured speed.
    const loadUi = setInterval(() => {
      let got = 0, total = 0;
      for (const f in ASSET_BYTES) { const pr = loadProg[f]; total += pr ? pr.total : ASSET_BYTES[f]; got += pr ? Math.min(pr.got, pr.total) : 0; }
      const left = LOAD_TOTAL - loadedCount, secs = (performance.now() - loadT0) / 1000;
      const pc = Math.min(100, Math.round((got / total) * 90 + (loadedCount / LOAD_TOTAL) * 10));
      const speed = netBytes > 0 ? netBytes / Math.max(0.25, secs) : 0;
      // Short friendly countdown: 5.6 s down to 1.0 s, following progress and never going back up.
      const want = 1 + 4.6 * (1 - pc / 100);
      const eta = shownEta < 0 ? 5.6 : Math.max(1, Math.min(shownEta, Math.max(want, shownEta - 0.1)));
      shownEta = eta;
      const bar = loadPill.querySelector('i'), txt = loadPill.querySelector('#r3dLoadTxt'), pct = loadPill.querySelector('#r3dLoadPct');
      if (!bar) return;
      bar.style.width = Math.max(2, pc) + '%'; pct.textContent = pc + '%';
      txt.textContent = left > 0 ? 'Loading… ' + eta.toFixed(1) + ' s' : 'Starting…';
    }, 100);
    const tick = (v) => { loadedCount++; return v; };
    const within = (pr, ms) => Promise.race([pr, new Promise((r) => setTimeout(() => r(null), ms))]).then(tick, () => tick(null));
    const loadTex = (file) => assetUrl(file).then((u) => new Promise((res) => new T.TextureLoader().load(u, (t) => { freeUrl(u); res(t); }, undefined, () => res(null))));
    const loadGlb = (file) => assetUrl(file).then((u) => new Promise((res) => {
      if (!ADD.GLTFLoader) return res(null);
      const loader = new ADD.GLTFLoader();
      loader.setResourcePath(ASSET_BASE);
      if (ADD.DRACOLoader) loader.setDRACOLoader(new ADD.DRACOLoader().setDecoderPath(ADD.dracoPath));
      loader.load(u, (g) => { freeUrl(u); res(g.scene); }, undefined, () => res(null));
    }));
    const loadCar = () => loadGlb('car_f8.glb');
    const treePacks = Promise.all([within(loadGlb('trees_maple.glb'), 30000), within(loadGlb('trees_pine.glb'), 30000), within(loadGlb('city_a.glb'), 40000), within(loadGlb('city_b.glb'), 40000), within(loadGlb('tower.glb'), 30000), within(loadGlb('grass.glb'), 30000)]);
    const [carModel, carAoTex, floraTex, skyEq, skyFront] = await Promise.all([within(loadCar(), 15000), within(loadTex('car_ao.png'), 15000), within(loadTex('flora.webp'), 15000), within(loadTex('sky.jpg'), 15000), within(loadTex('sky_front.jpg'), 15000)]);
    const [mapleScene, pineScene, cityAScene, cityBScene, towerScene, grassScene] = await treePacks;
    clearInterval(loadUi); loadPill.remove();
    if (R3D.status !== 'pending') return;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(50, 1, 0.3, 2800);
    scene.fog = new T.Fog(0xcfe9fb, 120, 1900);

    const hemi = new T.HemisphereLight(0xfff8ec, 0x6b8f5a, 1.35);
    const sun = new T.DirectionalLight(0xffe7c2, 2.5); // warm sunshine
    sun.position.set(0.553, 0.743, 0.376); // matches the sun in sky.jpg (behind-right of the camera)
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5; sun.shadow.blurSamples = 12;
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 26, bottom: -14, near: 1, far: 120 });
    const SUN_DIR = new T.Vector3(0.553, 0.743, 0.376).normalize();
    scene.add(hemi, sun, sun.target);

    // ---------- helpers ----------
    const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    const col = (hex) => new T.Color(hex);
    const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const canvasTex = (c, opts = {}) => {
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      Object.assign(t, opts);
      return t;
    };
    const rr = (g, x, y, w, h, r) => {
      g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
      g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
      g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
    };
    // Bake a colour + transform into a geometry so many parts can merge into one draw call.
    const part = (geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      if (rx || ry || rz) g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(rx, ry, rz)));
      g.translate(x, y, z);
      const c = col(hex), n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new T.BufferAttribute(arr, 3));
      return g;
    };
    const merge = (parts) => {
      let n = 0; for (const g of parts) n += g.attributes.position.count;
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
      let o = 0;
      for (const g of parts) {
        P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3);
        o += g.attributes.position.count; g.dispose();
      }
      const out = new T.BufferGeometry();
      out.setAttribute('position', new T.BufferAttribute(P, 3));
      out.setAttribute('normal', new T.BufferAttribute(N, 3));
      out.setAttribute('color', new T.BufferAttribute(C, 3));
      return out;
    };
    const matVC = new T.MeshLambertMaterial({ vertexColors: true });
    // long pieces are sliced along the road so the curved-world bend has vertices to act on
    const flatOnRoad = (w, d, wSeg = 1) => { const g = new T.PlaneGeometry(w, d, wSeg, Math.max(1, Math.round(d / 6))); g.rotateX(-Math.PI / 2); return g; };

    // ---------- sky ----------
    const SKY = {
      sunny:  { stops: [[0, '#0a5fd0'], [0.17, '#2f92ff'], [0.31, '#8fd0ff'], [0.37, '#d9f1ff'], [1, '#d9f1ff']], fog: '#cfe8f8', grass: '#55a636', grass2: '#43902c', hemi: ['#fff8ec', '#6b8f5a', 1.35], sun: ['#ffe7c2', 2.5], cloud: '#ffffff', city: '#ffffff', road: '#ffffff', leaf: '#ffffff', glow: 0.5 },
      rain:   { stops: [[0, '#0b1220'], [0.2, '#18212f'], [0.36, '#3e4a5c'], [1, '#3e4a5c']], fog: '#4a5666', grass: '#1c6b3a', grass2: '#18603a', hemi: ['#a9b8cf', '#33403f', 0.88], sun: ['#c9d6ea', 0.5], cloud: '#6f7a8c', city: '#6f7d94', road: '#858e9d', leaf: '#a2b0aa', glow: 0 },
      snow:   { stops: [[0, '#1e3a8a'], [0.19, '#60a5fa'], [0.35, '#e2e8f0'], [1, '#e2e8f0']], fog: '#e3eaf3', grass: '#587f5a', grass2: '#4d7152', hemi: ['#f2f6ff', '#aebbd0', 1.15], sun: ['#eef3ff', 1.1], cloud: '#ffffff', city: '#dbe7f5', road: '#aab2be', leaf: '#cfe2d6', glow: 0.25 },
      night:  { stops: [[0, '#02040c'], [0.2, '#050b1e'], [0.36, '#101d40'], [1, '#101d40']], fog: '#14214a', grass: '#2d5a3a', grass2: '#264c33', hemi: ['#9db2f0', '#34426e', 1.9], sun: ['#a9c0ff', 1.5], cloud: '#1c2748', city: '#4a5a8c', road: '#8a94aa', leaf: '#6e88b8', glow: 0 },
      sunset: { stops: [[0, '#311042'], [0.15, '#b91c1c'], [0.28, '#f97316'], [0.37, '#fde047'], [1, '#fde047']], fog: '#f2a35c', grass: '#557f17', grass2: '#4b7214', hemi: ['#ffd1a6', '#4c4a2a', 1.0], sun: ['#ffae66', 1.7], cloud: '#ffd3a8', city: '#e2703a', road: '#f0c7a8', leaf: '#e9c98a', glow: 0.9 }
    };
    const skyTexCache = {};
    const skyTex = (key) => {
      if (skyTexCache[key]) return skyTexCache[key];
      const c = makeCanvas(4, 512), g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 512);
      for (const [o, cl] of SKY[key].stops) gr.addColorStop(o, cl);
      g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
      return (skyTexCache[key] = canvasTex(c));
    };

    let skyEnv = null;
    if (skyEq) {
      skyEq.mapping = T.EquirectangularReflectionMapping; skyEq.colorSpace = T.SRGBColorSpace;
      const pm = new T.PMREMGenerator(renderer); skyEnv = pm.fromEquirectangular(skyEq).texture; pm.dispose();
      scene.environment = skyEnv;
    }
    // Sharp photo sky for the part of the sky the fixed chase camera can see (150° wide, -4°..66° high).
    let skyDome = null, tintSky = () => {};
    if (skyFront) {
      skyFront.colorSpace = T.SRGBColorSpace;
      const d2r = Math.PI / 180;
      const geo = new T.SphereGeometry(900, 40, 20, (90 - 75) * d2r, 150 * d2r, (90 - 66) * d2r, 70 * d2r);
      // vertex tint over the photo clouds: each climate gets its own horizon -> zenith gradient (linear RGB)
      geo.setAttribute('color', new T.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
      const SKY_TINT = { sunny: [[1.04, 1.04, 1.06], [0.125, 0.345, 0.93]], rain: [[0.42, 0.43, 0.46], [0.4, 0.35, 0.28]], night: [[0.05, 0.075, 0.17], [0.006, 0.012, 0.045]], snow: [[1.1, 1.12, 1.15], [0.62, 0.78, 1.0]], sunset: [[2.5, 1.05, 0.38], [0.62, 0.3, 0.72]] };
      tintSky = (key) => {
        const [lo, hi] = SKY_TINT[key] || SKY_TINT.sunny, pos = geo.attributes.position, a = geo.attributes.color;
        for (let i = 0; i < pos.count; i++) { const e = Math.pow(Math.max(0, Math.min(1, pos.getY(i) / 900 / 0.75)), 0.8); a.setXYZ(i, lo[0] + (hi[0] - lo[0]) * e, lo[1] + (hi[1] - lo[1]) * e, lo[2] + (hi[2] - lo[2]) * e); }
        a.needsUpdate = true;
      };
      tintSky('sunny');
      skyDome = new T.Mesh(geo, new T.MeshBasicMaterial({ map: skyFront, vertexColors: true, side: T.DoubleSide, fog: false, depthWrite: false }));
      skyDome.scale.z = -1; skyDome.renderOrder = -10; skyDome.frustumCulled = false;
      SKY.sunny.fog = '#bccbe2';
    }

    // Everything in backdrop follows the camera so it reads as "at the horizon".
    const backdrop = new T.Group();
    scene.add(backdrop);
    const skylineObjs = []; // photo skyline pieces riding with the camera: hidden on the maps without a city on the horizon
    if (skyDome) backdrop.add(skyDome);

    const glowC = makeCanvas(128, 128);
    {
      const g = glowC.getContext('2d'), gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    const glowTex = canvasTex(glowC);
    const sunGlow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, depthTest: false, fog: false, blending: T.AdditiveBlending }));
    sunGlow.scale.set(520, 520, 1); sunGlow.position.set(0, 190, -800); sunGlow.renderOrder = -9;
    backdrop.add(sunGlow);

    // ---------- skyline (one merged mesh, repeating window texture) ----------
    // Facade tile: 4 x 4 windows (one tile = 4 floors). Glass with a vertical gradient and a diagonal reflection, frame, sill
    // shadow, a few windows with blinds, and (opt.lit) a few warm lit windows that also go into an emissive map.
    const paintFacade = (S, opt) => {
      const c = makeCanvas(S, S), g = c.getContext('2d'), cell = S / 4, k = S / 256;
      const e = opt.lit ? makeCanvas(S, S) : null, ge = e ? e.getContext('2d') : null;
      g.fillStyle = opt.frame; g.fillRect(0, 0, S, S);                          // facade panels + mullions
      if (ge) { ge.fillStyle = '#000000'; ge.fillRect(0, 0, S, S); }
      for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
        const x = q * cell, y = r * cell, gx = x + 7 * k, gy = y + 8 * k, gw = cell - 14 * k, gh = cell - 21 * k;
        const lit = !!opt.lit && opt.lit.some((l) => l[0] === r && l[1] === q), pal = ((r * 3 + q * 5) % 7) / 7 > 0.6, blind = !lit && ((r * 5 + q * 3) % 7 === 2);
        const gr = g.createLinearGradient(0, gy, 0, gy + gh);
        if (lit) { gr.addColorStop(0, '#ffe2a8'); gr.addColorStop(1, '#f2a85c'); }
        else { gr.addColorStop(0, pal ? opt.glassA[0] : opt.glassB[0]); gr.addColorStop(1, pal ? opt.glassA[1] : opt.glassB[1]); }
        g.fillStyle = gr; g.fillRect(gx, gy, gw, gh);
        g.save(); g.beginPath(); g.rect(gx, gy, gw, gh); g.clip();
        if (blind) {                                                              // roller blind, drawn part way down
          g.fillStyle = opt.blind; g.fillRect(gx, gy, gw, gh * (0.42 + ((r + q) % 3) * 0.14));
          g.fillStyle = 'rgba(90,100,112,0.22)'; for (let yy = gy + 3 * k; yy < gy + gh * 0.8; yy += 4 * k) g.fillRect(gx, yy, gw, 1 * k);
        }
        g.fillStyle = 'rgba(255,255,255,' + opt.streak + ')';                    // diagonal reflection streaks
        g.beginPath(); g.moveTo(gx + gw * 0.1, gy + gh); g.lineTo(gx + gw * 0.42, gy + gh); g.lineTo(gx + gw * 0.92, gy); g.lineTo(gx + gw * 0.6, gy); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(gx + gw * 0.5, gy + gh); g.lineTo(gx + gw * 0.62, gy + gh); g.lineTo(gx + gw * 1.0, gy + gh * 0.25); g.lineTo(gx + gw * 0.88, gy + gh * 0.25); g.closePath(); g.fill();
        g.restore();
        if ((r + q) % 2 === 0) { g.fillStyle = opt.mullion; g.fillRect(gx + gw / 2 - 1 * k, gy, 2 * k, gh); }
        g.strokeStyle = opt.edge; g.lineWidth = 2.5 * k; g.strokeRect(gx, gy, gw, gh);   // frame
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(gx, gy - 1.5 * k, gw, 1.5 * k);  // light top edge
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(gx - 1 * k, gy + gh + 1 * k, gw + 2 * k, 2 * k); // sill
        g.fillStyle = 'rgba(60,72,90,0.32)'; g.fillRect(gx - 1 * k, gy + gh + 3 * k, gw + 2 * k, 4 * k);   // sill shadow
        if (ge && lit) { const eg = ge.createLinearGradient(0, gy, 0, gy + gh); eg.addColorStop(0, '#ffd9a0'); eg.addColorStop(1, '#f0a050'); ge.fillStyle = eg; ge.fillRect(gx, gy, gw, gh); }
      }
      return { c, e };
    };
    const winC = paintFacade(256, { frame: '#b8c6d6', glassA: ['#f4f9ff', '#dfeaf6'], glassB: ['#e7f0fa', '#d3e1f0'], blind: 'rgba(246,249,252,0.9)', mullion: 'rgba(160,176,196,0.8)', edge: 'rgba(150,166,186,0.9)', streak: 0.14 }).c;
    const winTex = canvasTex(winC, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping });
    const cityMat = new T.MeshStandardMaterial({ map: winTex, vertexColors: true, fog: true, metalness: 0.7, roughness: 0.1, envMapIntensity: 1.5 });
    {
      const P = [], N = [], U = [], C = [];
      const quad = (a, b, c, d, n, uw, uh, cl) => {
        const uv = [[0, 0], [uw, 0], [uw, uh], [0, uh]], v = [a, b, c, d];
        for (const i of [0, 1, 2, 0, 2, 3]) { P.push(...v[i]); N.push(...n); U.push(...uv[i]); C.push(cl.r, cl.g, cl.b); }
      };
      const tower = (x, z, w, d, h, hex, cap) => {
        const cl = col(hex), dk = col(hex).multiplyScalar(0.72), x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
        const uw = Math.max(1, Math.round(w / 14)), uh = Math.max(1, Math.round(h / 14));
        quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], uw, uh, cl);
        quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], Math.max(1, Math.round(d / 14)), uh, dk);
        quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], Math.max(1, Math.round(d / 14)), uh, dk);
        quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0], 0.02, 0.02, dk);
        if (cap === 1) { // stepped crown
          const cw2 = w * 0.62, ch2 = h * 0.07;
          quad([x - cw2 / 2, h, z1 - 1], [x + cw2 / 2, h, z1 - 1], [x + cw2 / 2, h + ch2, z1 - 1], [x - cw2 / 2, h + ch2, z1 - 1], [0, 0, 1], 0.02, 0.02, dk);
        } else if (cap === 2) { // spire
          const lt = col('#dfe8f3'), sw = w * 0.05, sh = h * 0.3;
          for (const i of [0, 1, 2]) { P.push(...[[x - sw, h, z1 - 1], [x + sw, h, z1 - 1], [x, h + sh, z1 - 1]][i]); N.push(0, 0, 1); U.push(0.01, 0.01); C.push(lt.r, lt.g, lt.b); }
        }
      };
      const palette = ['#3f86d8', '#58a4ee', '#2f6fbe', '#4b93e0', '#6fb4f6', '#2c63aa'];
      const ALT = ['#35b3c4', '#8fa0b8', '#d5e3f3', '#2e9c8f', '#5b6f9e'];
      const paletteFar = ['#9cc6f0', '#a9cff4', '#8fbbe8'];
      let x = -560, i = 0;
      while (x < 560) { // far row: pale, tall
        const w = 26 + hash(i * 3.1) * 22, h = 70 + hash(i * 5.3) * 95;
        tower(x + w / 2, -650, w, 24, h * 0.8, paletteFar[i % 3], hash(i * 9.1) < 0.3 ? 2 : 0);
        x += w + 4 + hash(i * 2.2) * 16; i++;
      }
      x = -520; i = 40;
      while (x < 520) { // near row: saturated, taller toward the sides (frames the road)
        const w = 20 + hash(i * 3.7) * 20, edge = Math.min(1, Math.abs(x + w / 2) / 300);
        const h = 34 + edge * 62 + hash(i * 4.9) * 46;
        const capR = hash(i * 8.3);
        const kind = hash(i * 12.7), cx = x + w / 2, tone = hash(i * 14.9) < 0.3 ? ALT[i % ALT.length] : palette[i % palette.length];
        if (kind < 0.25) {            // stepped tower: three tiers
          tower(cx, -560, w, 22, h * 0.62, tone, 0); tower(cx, -559.5, w * 0.72, 18, h * 0.9, tone, 0); tower(cx, -559, w * 0.42, 12, h * 1.12, tone, 2);
        } else if (kind < 0.42) {     // slim needle
          tower(cx, -560, w * 0.5, 14, h * 1.35, tone, 2);
        } else if (kind < 0.58) {     // wide slab with a roof block
          tower(cx, -560, w * 1.25, 24, h * 0.55, tone, 0); tower(cx - w * 0.25, -559.5, w * 0.4, 12, h * 0.68, tone, 0);
        } else if (kind < 0.72) {     // twin towers
          tower(cx - w * 0.27, -560, w * 0.42, 18, h, tone, 1); tower(cx + w * 0.27, -560, w * 0.42, 18, h * 0.86, tone, 1);
        } else tower(cx, -560, w, 22, h, tone, capR < 0.22 ? 2 : (capR < 0.5 ? 1 : 0));
        x += w + 2 + hash(i * 1.9) * 9; i++;
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
      g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
      if (!cityAScene && !cityBScene) { const bm = new T.Mesh(g, cityMat); backdrop.add(bm); skylineObjs.push(bm); } // built-in skyline only as a stand-in
    }
    // Owner's city models: one photo-textured skyline on the horizon, plus city blocks and glass towers
    // anchored in the world on both sides so they grow and pass by as you drive (recycled ahead).
    const fitModel = (root, scale) => {
      root.scale.setScalar(scale); root.updateMatrixWorld(true);
      const bb = new T.Box3().setFromObject(root), c = bb.getCenter(new T.Vector3());
      root.position.set(-c.x, -bb.min.y, -c.z);
      root.traverse((o) => { if (o.isMesh && o.material) { o.material.envMapIntensity = 1.2; if (o.material.map) o.material.map.anisotropy = 4; } });
      const g = new T.Group(); g.add(root);
      return { group: g, size: bb.getSize(new T.Vector3()) };
    };
    // The whole city is a fixed distant skyline: it rides with the camera (never comes closer, never
    // rushes past) and is left out of the curved-road bend, so it cannot swing, stretch or pop in turns.
    const noBend = (mat, k = 0) => { // k: share of the road's bend / hill this material still follows (0 = steady)
      if (!mat || mat.userData.trNoBend) return;
      mat.userData.trNoBend = true;
      const f = k.toFixed(3);
      mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', T.ShaderChunk.project_vertex.replace('float trBend = projectionMatrix[1][0];', 'float trBend = projectionMatrix[1][0] * ' + f + ';').replace('float trHill = projectionMatrix[0][1];', 'float trHill = projectionMatrix[0][1] * ' + f + ';')); };
      mat.customProgramCacheKey = () => 'trNoBend' + f;
    };
    if (skyDome) noBend(skyDome.material); // the sky never swings with the road
    const skylinePiece = (group, crisp) => group.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach((m) => { noBend(m); if (crisp) { m.fog = false; m.envMapIntensity = 1.5; } }); });
    // Bake a whole model into one mesh per material (a city is ~100 separate meshes otherwise), centred
    // on x/z with its base at y = 0. Materials become simple sun-lit ones that keep the facade textures.
    const bakeModel = (root, scale, skip) => {
      root.scale.setScalar(scale); root.updateMatrixWorld(true);
      const byMat = new Map(), v = new T.Vector3(), nm = new T.Matrix3(), box = new T.Box3();
      root.traverse((o) => {
        if (!o.isMesh || Array.isArray(o.material) || (skip && skip.test(o.material.name))) return;
        const g = o.geometry, pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ix = g.index, cnt = ix ? ix.count : pa.count;
        let e = byMat.get(o.material); if (!e) byMat.set(o.material, e = { P: [], N: [], U: [] });
        nm.getNormalMatrix(o.matrixWorld);
        for (let k = 0; k < cnt; k++) {
          const q = ix ? ix.getX(k) : k;
          v.fromBufferAttribute(pa, q).applyMatrix4(o.matrixWorld); e.P.push(v.x, v.y, v.z); box.expandByPoint(v);
          if (na) { v.fromBufferAttribute(na, q).applyMatrix3(nm).normalize(); e.N.push(v.x, v.y, v.z); } else e.N.push(0, 1, 0);
          if (ua) e.U.push(ua.getX(q), ua.getY(q)); else e.U.push(0, 0);
        }
      });
      const c = box.getCenter(new T.Vector3()), parts = [];
      for (const [src, e] of byMat) {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(e.P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(e.N, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(e.U, 2));
        g.translate(-c.x, -box.min.y, -c.z);
        if (src.map) src.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        parts.push({ geo: g, map: src.map || null, color: src.color ? src.color.clone() : col('#ffffff') });
      }
      return { parts, size: box.getSize(new T.Vector3()) };
    };
    // one object from a baked model; `far` pieces belong to the fixed skyline (no bend, no haze wash-out)
    const cityMats = [];
    const cityObject = (baked, far) => {
      const g = new T.Group();
      for (const pt of baked.parts) {
        const m = new T.MeshLambertMaterial({ map: pt.map, color: pt.color.clone().multiplyScalar(far ? 0.8 : 0.86), fog: !far }); // a touch deeper so facades and windows read in full sun
        noBend(m, far ? 0 : 0.12); // skyline: steady. passing blocks: only a slow drift with the bend, never a swing
        cityMats.push({ m, base: m.color.clone() });
        const mesh = new T.Mesh(pt.geo, m); mesh.frustumCulled = false; g.add(mesh);
      }
      return g;
    };
    // Skyline = the two varied city models (offices, mixed towers, different silhouettes).
    const MID_GAP = 380, WORLD_DRIFT = 0.8, midBlocks = []; let midBase = null;
    if (cityAScene) {
      const a = bakeModel(cityAScene, 0.0132), g = cityObject(a, true);
      g.position.set(0, -1.5, -(410 + a.size.z / 2)); backdrop.add(g); skylineObjs.push(g);
    }
    if (cityBScene) {
      const b = bakeModel(cityBScene, 80, /^ground$/);
      [[-265, -500, 0.4, 1], [280, -470, 0.5, 3], [-40, -640, 0.42, 2]].forEach(([x, z, sc, r]) => { const g = cityObject(b, true); g.scale.setScalar(sc); g.position.set(x, 0, z); g.rotation.y = r * Math.PI / 2; backdrop.add(g); skylineObjs.push(g); });
      // mid-ground: an occasional small city block standing on the grass, well back from the road
      for (let i = 0; i < 4; i++) { const g = cityObject(b, false); scene.add(g); midBlocks.push(g); }
    }
    const layoutMidBlocks = (base) => {
      midBlocks.forEach((g, k) => {
        const row = base + k - 1, side = (row & 1) ? 1 : -1, sc = side < 0 ? 0.15 + hash(row * 3.1) * 0.03 : 0.19 + hash(row * 3.1) * 0.05;
        g.scale.setScalar(sc);
        g.userData.z0 = -(row * MID_GAP + 120 + hash(row * 7.7) * 140);
        g.position.set(side * (165 + hash(row * 5.3) * 50), -0.2, g.userData.z0);
        g.rotation.y = Math.floor(hash(row * 9.1) * 4) * Math.PI / 2;
      });
    };
    // The glass tower appears once, as a landmark.
    if (towerScene) {
      const t = fitModel(towerScene, 0.55);
      skylinePiece(t.group, true);
      t.group.scale.setScalar(118 / (t.size.y || 1)); t.group.position.set(150, 0, -610); backdrop.add(t.group); skylineObjs.push(t.group);
    }
    const treeLineMat = new T.MeshBasicMaterial({ color: 0x2f8a3c, fog: true }); // (no tree-line mound at the end of the road any more)

    // ---------- ground + road ----------
    const grassC = makeCanvas(1024, 1024);
    const grassTex = canvasTex(grassC, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping });
    const GRASS_LEN = 2600, GRASS_PERIOD = 46;
    grassTex.repeat.set(GRASS_LEN / GRASS_PERIOD, GRASS_LEN / GRASS_PERIOD);
    let curMap = 'highway', cliffSide = 1, groundKind = 'grass'; // the map being drawn (see applyMap)
    const paintGrass = (a, b, snowy) => {
      const g = grassC.getContext('2d'), ca = col(a), cb = col(b);
      const S = 1024, hx = (c, k) => '#' + c.clone().multiplyScalar(k).getHexString(), wrap = [-S, 0, S];
      const dry = '#' + ca.clone().lerp(col('#c2b25a'), 0.4).getHexString(), deep = hx(cb, 0.62);
      const each = (x, y, m, fn) => { for (const ox of wrap) for (const oy of wrap) { const X = x + ox, Y = y + oy; if (X > -m && X < S + m && Y > -m && Y < S + m) fn(X, Y); } };
      g.fillStyle = a; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 150; i++) {                                          // big patches: darker growth, worn/dry areas, lush spots
        const x = hash(i * 1.37) * S, y = hash(i * 2.11) * S, r = 40 + hash(i * 3.3) * 120, k = hash(i * 4.7), rot = hash(i * 6.5) * 3.1;
        g.fillStyle = k < 0.42 ? deep : (k < 0.7 ? dry : (k < 0.88 ? hx(ca, 1.16) : b));
        g.globalAlpha = 0.09 + hash(i * 5.9) * 0.12;
        each(x, y, r * 1.2, (X, Y) => { g.beginPath(); g.ellipse(X, Y, r, r * (0.45 + hash(i * 7.3) * 0.4), rot, 0, 6.283); g.fill(); });
      }
      for (let i = 0; i < 2400; i++) {                                         // mottled turf
        const x = hash(i * 1.71 + 2) * S, y = hash(i * 2.93 + 5) * S, r = 6 + hash(i * 3.3) * 20, k = hash(i * 4.7);
        g.fillStyle = k < 0.5 ? hx(cb, 0.8) : (k < 0.8 ? hx(ca, 1.12) : dry);
        g.globalAlpha = 0.07 + hash(i * 5.9) * 0.1;
        each(x, y, r, (X, Y) => { g.beginPath(); g.ellipse(X, Y, r, r * 0.6, 0, 0, 6.283); g.fill(); });
      }
      g.lineCap = 'round';
      for (let i = 0; i < 9000; i++) {                                         // blades
        const x = hash(i * 1.93 + 7) * S, y = hash(i * 2.57 + 3) * S, k = hash(i * 3.71), len = 3 + hash(i * 4.9) * 6, lean = (hash(i * 6.1) - 0.5) * 4;
        g.strokeStyle = k < 0.45 ? deep : (k < 0.82 ? hx(ca, 1.2) : dry);
        g.globalAlpha = 0.25 + hash(i * 7.3) * 0.3; g.lineWidth = 1.2 + hash(i * 8.7) * 1.2;
        each(x, y, 8, (X, Y) => { g.beginPath(); g.moveTo(X, Y); g.lineTo(X + lean, Y - len); g.stroke(); });
      }
      g.globalAlpha = 1;
      for (let i = 0; i < 46; i++) {                                           // low bushes + stones baked into the turf
        const x = hash(i * 7.7) * S, y = hash(i * 8.9) * S, rock = hash(i * 3.3) < 0.55, r = rock ? 3 + hash(i * 9.1) * 6 : 7 + hash(i * 9.1) * 9;
        each(x, y, 30, (X, Y) => {
          g.fillStyle = 'rgba(15,45,15,0.28)'; g.beginPath(); g.ellipse(X + r * 0.35, Y + r * 0.3, r * 1.05, r * 0.7, 0, 0, 6.283); g.fill();
          g.fillStyle = rock ? 'rgba(122,122,116,0.95)' : 'rgba(44,120,40,0.85)'; g.beginPath(); g.ellipse(X, Y, r, r * 0.72, 0, 0, 6.283); g.fill();
          g.fillStyle = rock ? 'rgba(200,200,192,0.9)' : 'rgba(120,190,70,0.7)'; g.beginPath(); g.ellipse(X - r * 0.2, Y - r * 0.25, r * 0.6, r * 0.4, 0, 0, 6.283); g.fill();
        });
      }
      if (snowy) {                                                             // irregular light snow patches (~40%), soft edges
        for (let i = 0; i < 22; i++) {
          const x = hash(i * 1.91 + 11) * S, y = hash(i * 2.37 + 4) * S, r = 34 + hash(i * 3.13) * 90, sq = 0.4 + hash(i * 4.1) * 0.45, rot = hash(i * 5.3) * 3.1;
          each(x, y, r * 1.3, (X, Y) => {
            g.save(); g.translate(X, Y); g.rotate(rot); g.scale(1, sq);
            const gr = g.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
            gr.addColorStop(0, 'rgba(240,246,252,0.96)'); gr.addColorStop(0.6, 'rgba(236,243,250,0.9)'); gr.addColorStop(1, 'rgba(232,240,248,0)');
            g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.fill(); g.restore();
          });
        }
        for (let i = 0; i < 700; i++) {                                        // wind-blown specks and the odd bare tuft inside a patch
          const x = hash(i * 1.17 + 3) * S, y = hash(i * 2.9 + 8) * S, r = 3 + hash(i * 3.7) * 9;
          g.fillStyle = hash(i * 4.4) < 0.7 ? 'rgba(244,248,253,0.55)' : 'rgba(80,110,80,0.35)';
          each(x, y, r, (X, Y) => { g.beginPath(); g.ellipse(X, Y, r, r * 0.55, 0, 0, 6.283); g.fill(); });
        }
        g.globalAlpha = 1;
      }
      grassTex.needsUpdate = true;
    };
    // Desert ground: soft dunes, wind ripples, pebbles and dry cracks (same canvas and the same 46 m tile as the grass)
    const paintSand = (a, b) => {
      const g = grassC.getContext('2d'), ca = col(a), cb = col(b), S = 1024, wrap = [-S, 0, S];
      const hx = (c, k) => '#' + c.clone().multiplyScalar(k).getHexString();
      const each = (x, y, m, fn) => { for (const ox of wrap) for (const oy of wrap) { const X = x + ox, Y = y + oy; if (X > -m && X < S + m && Y > -m && Y < S + m) fn(X, Y); } };
      g.fillStyle = a; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 70; i++) {                                           // dunes: long soft ridges, light crest and a darker lee
        const x = hash(i * 1.37) * S, y = hash(i * 2.11) * S, rx = 80 + hash(i * 3.3) * 190, ry = 16 + hash(i * 4.7) * 42, rot = 0.5 + (hash(i * 6.5) - 0.5) * 0.7;
        g.globalAlpha = 0.1 + hash(i * 5.9) * 0.1;
        g.fillStyle = hash(i * 7.9) < 0.5 ? hx(ca, 1.1) : hx(cb, 0.86);
        each(x, y, rx, (X, Y) => { g.beginPath(); g.ellipse(X, Y, rx, ry, rot, 0, 6.283); g.fill(); });
      }
      g.lineCap = 'round';
      for (let i = 0; i < 1500; i++) {                                         // wind ripples
        const x = hash(i * 1.71 + 2) * S, y = hash(i * 2.93 + 5) * S, len = 12 + hash(i * 3.3) * 34, bend = (hash(i * 4.9) - 0.5) * 10;
        g.strokeStyle = hash(i * 5.7) < 0.5 ? hx(ca, 1.16) : hx(cb, 0.78); g.globalAlpha = 0.1 + hash(i * 6.1) * 0.13; g.lineWidth = 1 + hash(i * 7.3) * 1.2;
        each(x, y, len, (X, Y) => { g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + len / 2, Y + bend, X + len, Y + bend * 0.3); g.stroke(); });
      }
      for (let i = 0; i < 5500; i++) {                                         // grain
        const x = hash(i * 1.93 + 7) * S, y = hash(i * 2.57 + 3) * S;
        g.fillStyle = hash(i * 3.71) < 0.5 ? 'rgba(255,240,200,0.9)' : 'rgba(110,80,40,0.9)'; g.globalAlpha = 0.07 + hash(i * 4.9) * 0.08;
        each(x, y, 2, (X, Y) => g.fillRect(X, Y, 2, 2));
      }
      g.globalAlpha = 0.28; g.strokeStyle = hx(cb, 0.5); g.lineWidth = 1.3;
      for (let i = 0; i < 26; i++) {                                           // dry cracked patches
        let x = hash(i * 9.1) * S, y = hash(i * 11.3) * S, ang = hash(i * 13.7) * 6.283;
        for (let b = 0; b < 7; b++) {
          let px = x, py = y, a2 = ang + b * 0.9;
          for (let st = 0; st < 5; st++) { const nx = px + Math.cos(a2) * (6 + hash(i * 3 + b * 7 + st) * 9), ny = py + Math.sin(a2) * (6 + hash(i * 5 + b * 3 + st) * 9); each(px, py, 20, (X, Y) => { g.beginPath(); g.moveTo(X, Y); g.lineTo(X + nx - px, Y + ny - py); g.stroke(); }); px = nx; py = ny; a2 += (hash(i + b * 17 + st * 5) - 0.5) * 1.2; }
        }
      }
      g.globalAlpha = 1;
      const PEB = ['#9a7a55', '#b8956a', '#7d6347', '#c7a574'];
      for (let i = 0; i < 150; i++) {                                          // pebbles
        const x = hash(i * 7.7 + 1) * S, y = hash(i * 8.9 + 2) * S, r = 1.6 + hash(i * 9.1) * 4.2;
        each(x, y, 14, (X, Y) => {
          g.fillStyle = 'rgba(70,45,20,0.3)'; g.beginPath(); g.ellipse(X + r * 0.4, Y + r * 0.35, r, r * 0.65, 0, 0, 6.283); g.fill();
          g.fillStyle = PEB[i % 4]; g.beginPath(); g.ellipse(X, Y, r, r * 0.7, 0.4, 0, 6.283); g.fill();
          g.fillStyle = 'rgba(255,240,210,0.35)'; g.beginPath(); g.ellipse(X - r * 0.25, Y - r * 0.25, r * 0.5, r * 0.3, 0, 0, 6.283); g.fill();
        });
      }
      grassTex.needsUpdate = true;
    };
    const paintGround = (a, b, snowy) => { if (groundKind === 'sand') paintSand(a, b); else paintGrass(a, b, snowy); };
    // Holes in the ground: the gorge / lake under a bridge (fragments whose world z lies inside uTrGap.xy are discarded;
    // with uTrWob the lake shore wobbles in x), and the valley side of the mountain road (everything beyond uTrCut.y on side uTrCut.x).
    const trGap = { value: new T.Vector2(1, 0) }; // (zMin, zMax); the default is an empty range
    const trWob = { value: 0 }, trCut = { value: new T.Vector3(0, 0, 0) };
    const shoreOff = (ax) => (Math.sin(ax * 0.045 + 1.3) * 9 + Math.sin(ax * 0.13) * 4 + 14) * smooth01(10, 60, ax); // metres the land reaches into the water, mirrored left / right
    const grassMat = new T.MeshLambertMaterial({ map: grassTex });
    grassMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTrGap = trGap; sh.uniforms.uTrWob = trWob; sh.uniforms.uTrCut = trCut;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vTrXZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTrXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vTrXZ;\nuniform vec2 uTrGap;\nuniform float uTrWob;\nuniform vec3 uTrCut;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat trAx = abs(vTrXZ.x);\nfloat trSo = uTrWob * (sin(trAx * 0.045 + 1.3) * 9.0 + sin(trAx * 0.13) * 4.0 + 14.0) * smoothstep(10.0, 60.0, trAx);\nif (vTrXZ.y > uTrGap.x + trSo && vTrXZ.y < uTrGap.y - trSo) discard;\nif (uTrCut.z > 0.5 && vTrXZ.x * uTrCut.x > uTrCut.y) discard;');
    };
    grassMat.customProgramCacheKey = () => 'trGrassGap2';
    const grass = new T.Mesh(flatOnRoad(GRASS_LEN, GRASS_LEN, 2), grassMat);
    grass.position.y = -0.03;
    scene.add(grass);

    const ROAD_W = 2.2 * R3D_XS; // asphalt + both shoulders
    const ROAD_LEN = 3000, ROAD_PERIOD = 14;
    const roadC = makeCanvas(1024, 256);
    {
      const g = roadC.getContext('2d'), W = 1024, Hh = 256, u = (x) => (x + 1.1) / 2.2 * W;
      g.fillStyle = '#7f8896'; g.fillRect(0, 0, W, Hh);                        // shoulders
      g.fillStyle = '#27292d'; g.fillRect(u(-1), 0, u(1) - u(-1), Hh);         // asphalt
      for (let i = 0; i < 5200; i++) {                                         // aggregate speckle
        const x = u(-1) + hash(i * 1.13) * (u(1) - u(-1)), y = hash(i * 2.71) * Hh, k = hash(i * 3.9);
        g.fillStyle = k < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.16)'; g.fillRect(x, y, 2, 2);
      }
      for (const lc of LANE_CENTERS) {                                         // tyre-worn lane centres
        const gr = g.createLinearGradient(u(lc - 0.17), 0, u(lc + 0.17), 0);
        gr.addColorStop(0, 'rgba(14,16,20,0)'); gr.addColorStop(0.5, 'rgba(14,16,20,0.26)'); gr.addColorStop(1, 'rgba(14,16,20,0)');
        g.fillStyle = gr; g.fillRect(u(lc - 0.17), 0, u(lc + 0.17) - u(lc - 0.17), Hh);
      }
      g.fillStyle = '#f4f6f8';
      g.fillRect(u(-1) - 2, 0, 16, Hh); g.fillRect(u(1) - 14, 0, 16, Hh);       // solid edge lines
    }
    const roadTex = canvasTex(roadC, { wrapT: T.RepeatWrapping });
    roadTex.repeat.set(1, ROAD_LEN / ROAD_PERIOD);
    // slightly wet, glossy asphalt that picks up the sky
    const roadMat = new T.MeshStandardMaterial({ map: roadTex, roughness: 0.34, metalness: 0.05, envMapIntensity: 1.0 });
    const road = new T.Mesh(flatOnRoad(ROAD_W, ROAD_LEN), roadMat);
    road.receiveShadow = true;
    scene.add(road);

    // Lane dashes: world-anchored instances re-used as the camera moves.
    const DASH_PERIOD = 19, DASH_ROWS = 160;
    const dashGeo = flatOnRoad(0.26, DASH_PERIOD * 0.5 * R3D_ZS);
    const dashes = new T.InstancedMesh(dashGeo, new T.MeshBasicMaterial({ color: 0xffffff }), DASH_ROWS * 3);
    dashes.frustumCulled = false; dashes.position.y = 0.012;
    {
      const cY = col('#ffd21f'), cW = col('#f8fafc');
      for (let r = 0; r < DASH_ROWS; r++) for (let l = 0; l < 3; l++) dashes.setColorAt(r * 3 + l, cW);
    }
    scene.add(dashes);

    // Guard rails
    const RAIL_X = 1.13 * R3D_XS;
    const railMat = new T.MeshStandardMaterial({ color: 0xa9b1bb, metalness: 0.6, roughness: 0.48, envMapIntensity: 0.6 });
    const rails = new T.Group();
    {
      // W-beam profile extruded along the road
      const sh = new T.Shape([[0, 0], [0.05, 0.035], [0.05, 0.085], [0, 0.13], [0, 0.17], [0.05, 0.215], [0.05, 0.265], [0, 0.3], [-0.02, 0.3], [-0.02, 0]].map(([x, y]) => new T.Vector2(x, y)));
      const beamGeo = new T.ExtrudeGeometry(sh, { depth: ROAD_LEN, bevelEnabled: false, steps: Math.round(ROAD_LEN / 6) });
      beamGeo.scale(1.6, 1.35, 1); beamGeo.translate(0, 0.42, -ROAD_LEN / 2);
      for (const s of [-1, 1]) { const beam = new T.Mesh(beamGeo, railMat); beam.position.x = s * RAIL_X; beam.scale.x = -s; rails.add(beam); }
    }
    railMat.side = T.DoubleSide;
    {
      const kerbC = makeCanvas(8, 64), g = kerbC.getContext('2d');
      g.fillStyle = '#e5e7eb'; g.fillRect(0, 0, 8, 64); g.fillStyle = '#9ca3af'; g.fillRect(0, 30, 8, 4);
      const kt = canvasTex(kerbC, { wrapT: T.RepeatWrapping }); kt.repeat.set(1, ROAD_LEN / 2.4);
      const kerbMat = new T.MeshLambertMaterial({ map: kt });
      for (const sd of [-1, 1]) { const k = new T.Mesh(new T.BoxGeometry(0.34, 0.16, ROAD_LEN, 1, 1, Math.round(ROAD_LEN / 6)), kerbMat); k.position.set(sd * (RAIL_X - 0.02), 0.06, 0); rails.add(k); }
    }
    scene.add(rails);
    const POST_GAP = 2.6, POST_ROWS = 400;
    const posts = new T.InstancedMesh(new T.BoxGeometry(0.13, 0.86, 0.16), new T.MeshStandardMaterial({ color: 0x9aa3ae, metalness: 0.8, roughness: 0.4 }), POST_ROWS * 2);
    posts.frustumCulled = false;
    scene.add(posts);
    // blue marker lights along both rails
    const LIGHT_GAP = POST_GAP * 3, LIGHT_ROWS = 130;
    const railLightPos = new Float32Array(LIGHT_ROWS * 2 * 3);
    const railLightGeo = new T.BufferGeometry(); railLightGeo.setAttribute('position', new T.BufferAttribute(railLightPos, 3));
    const railLights = new T.Points(railLightGeo, new T.PointsMaterial({ color: 0x4fb4ff, size: 1.5, map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    railLights.frustumCulled = false; railLights.visible = false;
    scene.add(railLights);

    // rail impact: a row of steel spikes snaps out of the guard rail on the side that was hit
    const spikeGeo = merge([-1.25, -0.75, -0.25, 0.25, 0.75, 1.25].flatMap((z, i) => {
      const c = new T.ConeGeometry(0.09, 1, 7); c.rotateZ(-Math.PI / 2); c.translate(0.5, 0, 0);
      const b = new T.BoxGeometry(0.06, 0.22, 0.22);
      return [part(c, i % 2 ? '#f8fafc' : '#ef4444', 0, 0, z), part(b, '#475569', 0, 0, z)];
    }));
    const railSpikes = [0, 1, 2, 3].map(() => { const m = new T.Mesh(spikeGeo, matVC); m.visible = false; m.userData.t = 9; scene.add(m); return m; });

    // street lights (one merged lamp post, instanced along both sides)
    const LAMP_GAP = 34, LAMP_ROWS = 32;
    const lampGeo = merge([
      part(new T.CylinderGeometry(0.07, 0.11, 7.2, 8), '#59626e', 0, 3.6, 0),
      part(new T.CylinderGeometry(0.16, 0.2, 0.5, 8), '#3f4650', 0, 0.25, 0),
      part(new T.CylinderGeometry(0.05, 0.06, 2.3, 6), '#59626e', -1.05, 7.3, 0, 0, 0, Math.PI / 2 - 0.16),
      part(new T.BoxGeometry(0.85, 0.12, 0.34), '#2f353d', -2.3, 7.42, 0),
      part(new T.BoxGeometry(0.7, 0.05, 0.26), '#fff6d8', -2.3, 7.34, 0)
    ]);
    const lamps = new T.InstancedMesh(lampGeo, matVC, LAMP_ROWS * 2);
    lamps.frustumCulled = false; scene.add(lamps);
    const qFlip = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI);
    let lampBase = null;

    // ---------- roadside flora (instanced, world-anchored by segment index) ----------
    const FLORA_SEG = 22, FLORA_ROWS = 120; // v17: window about 770 m (was 48 rows / 306 m)
    const trunkGeo = new T.CylinderGeometry(0.15, 0.22, 1, 6); trunkGeo.translate(0, 0.5, 0);
    const trunks = new T.InstancedMesh(trunkGeo, new T.MeshLambertMaterial({ color: 0x7a4a26 }), FLORA_ROWS * 6);
    const leafMat = new T.MeshLambertMaterial({ color: 0xffffff });
    const blobs = new T.InstancedMesh(new T.SphereGeometry(1, 10, 7), leafMat, FLORA_ROWS * 16);
    const coneGeo = new T.ConeGeometry(1, 1, 7); coneGeo.translate(0, 0.5, 0);
    const cones = new T.InstancedMesh(coneGeo, leafMat, FLORA_ROWS * 12);
    const dots = new T.InstancedMesh(new T.SphereGeometry(1, 6, 4), new T.MeshBasicMaterial({ color: 0xffffff }), FLORA_ROWS * 10);
    for (const m of [trunks, blobs, cones, dots]) { m.frustumCulled = false; scene.add(m); }
    const LEAF = { a: col('#23a845'), b: col('#4fd066'), c: col('#1b8f3a'), pine: col('#1f7d3c'), pine2: col('#2a9448'), bush: col('#2c9c44'), bush2: col('#256f2b'), bush3: col('#2f8a32') };
    const FLOWER = [col('#ffffff'), col('#ffd84a'), col('#ff6b6b'), col('#c59bff')];
    const m4 = new T.Matrix4(), q0 = new T.Quaternion(), v3a = new T.Vector3(), v3b = new T.Vector3();
    const put = (mesh, i, x, y, z, sx, sy, sz) => { mesh.setMatrixAt(i, m4.compose(v3a.set(x, y, z), q0, v3b.set(sx, sy, sz))); };
    let floraBase = null;
    const layoutFloraBuiltIn = (base) => {
      let ti = 0, bi = 0, ci = 0, di = 0;
      const round = (x, z, s, tint) => {
        if (clearAt(z, Math.abs(x))) return;
        put(trunks, ti++, x, 0, z, s, 1.7 * s, s);
        put(blobs, bi, x, 2.75 * s, z, 1.55 * s, 1.45 * s, 1.55 * s); blobs.setColorAt(bi++, tint ? LEAF.c : LEAF.a);
        put(blobs, bi, x - 0.35 * s, 3.2 * s, z + 0.55 * s, 0.95 * s, 0.85 * s, 0.95 * s); blobs.setColorAt(bi++, LEAF.b);
      };
      const pine = (x, z, s) => {
        if (clearAt(z, Math.abs(x))) return;
        put(trunks, ti++, x, 0, z, s, 1.3 * s, s);
        put(cones, ci, x, 1.0 * s, z, 1.7 * s, 2.5 * s, 1.7 * s); cones.setColorAt(ci++, LEAF.pine);
        put(cones, ci, x, 2.3 * s, z, 1.3 * s, 2.2 * s, 1.3 * s); cones.setColorAt(ci++, LEAF.pine2);
        put(cones, ci, x, 3.5 * s, z, 0.9 * s, 1.9 * s, 0.9 * s); cones.setColorAt(ci++, LEAF.pine);
      };
      for (let k = 0; k < FLORA_ROWS; k++) {
        const s = base + k - 3, z = -(s * FLORA_SEG) * R3D_ZS;
        for (const side of [-1, 1]) {
          const n = s * 2 + (side > 0 ? 1 : 0);
          round(side * (10.9 + hash(n) * 0.7), z, 0.92 + hash(n + 0.5) * 0.3, false);
          const bx = side * (15.5 + hash(n * 1.7) * 7), bz = z - 3 - hash(n * 2.3) * 5, bs = 1.15 + hash(n * 3.1) * 0.5;
          if (hash(n * 4.3) < 0.62) pine(bx, bz, bs); else round(bx, bz, bs, true);
          pine(side * (27 + hash(n * 5.9) * 16), z - hash(n * 6.1) * 9, 1.6 + hash(n * 7.7) * 0.9);
          // flowering bush between the rail and the trees
          const fx = side * 9.2, fz = z - 4.2, fs = 0.5 + hash(n * 9.3) * 0.22;
          if (clearAt(fz, 9.2)) continue;
          put(blobs, bi, fx, fs * 0.55, fz, fs * 1.25, fs * 0.9, fs * 1.1); blobs.setColorAt(bi++, LEAF.bush);
          const fc = FLOWER[Math.floor(hash(n * 11.9) * FLOWER.length)];
          for (let f = 0; f < 3; f++) {
            put(dots, di, fx + (f - 1) * fs * 0.6, fs * (1.0 + (f % 2) * 0.22), fz + fs * 0.75 - Math.abs(f - 1) * 0.2, 0.13, 0.13, 0.13);
            dots.setColorAt(di++, fc);
          }
        }
      }
      trunks.count = ti; blobs.count = bi; cones.count = ci; dots.count = di;
      for (const m of [trunks, blobs, cones, dots]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    };

    // Photo-real trees and rocks: crossed cut-out planes from one atlas (renders of CC0 Poly Haven models).
    const FLORA_META = {"fir0":{"u0":0.00098,"u1":0.17041,"v0":0.00293,"v1":0.99219,"aspect":0.3425},"fir1":{"u0":0.17139,"u1":0.33203,"v0":0.00293,"v1":0.71875,"aspect":0.4488},"fir2":{"u0":0.33301,"u1":0.48828,"v0":0.00293,"v1":0.72852,"aspect":0.428},"pines":{"u0":0.48926,"u1":0.79688,"v0":0.40918,"v1":0.99414,"aspect":1.0518},"leafy0":{"u0":0.79785,"u1":0.99609,"v0":0.40918,"v1":0.99414,"aspect":0.6778},"leafy1":{"u0":0.48926,"u1":0.75195,"v0":0.00293,"v1":0.40039,"aspect":1.3219},"leafy2":{"u0":0.75293,"u1":0.93799,"v0":0.00293,"v1":0.40039,"aspect":0.9312},"rock0":{"u0":0.93896,"u1":0.99561,"v0":0.00293,"v1":0.10449,"aspect":1.1154},"rock1":{"u0":0.93896,"u1":0.99561,"v0":0.10742,"v1":0.19727,"aspect":1.2609},"rock2":{"u0":0.93896,"u1":0.99561,"v0":0.2002,"v1":0.28125,"aspect":1.3976}};
    const floraMat = new T.MeshBasicMaterial({ map: floraTex, alphaTest: 0.42, side: T.DoubleSide });
    const species = {};
    const treeShade = new T.InstancedMesh(new T.CircleGeometry(1, 14).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x0b2410, transparent: true, opacity: 0.16, depthWrite: false }), FLORA_ROWS * 10);
    treeShade.frustumCulled = false; treeShade.position.y = 0.01; treeShade.count = 0;
    if (floraTex) {
      floraTex.colorSpace = T.SRGBColorSpace; floraTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      for (const name in FLORA_META) {
        const m = FLORA_META[name], a = m.aspect / 2, g = new T.BufferGeometry();
        const quad = (ax) => ax === 'x' ? [[-a, 0, 0], [a, 0, 0], [a, 1, 0], [-a, 1, 0]] : [[0, 0, -a], [0, 0, a], [0, 1, a], [0, 1, -a]];
        const P = [], U = [], uv = [[m.u0, m.v0], [m.u1, m.v0], [m.u1, m.v1], [m.u0, m.v1]];
        for (const ax of (name.startsWith('rock') ? ['x'] : ['x', 'z'])) { const q = quad(ax); for (const i of [0, 1, 2, 0, 2, 3]) { P.push(...q[i]); U.push(...uv[i]); } }
        g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
        const mesh = new T.InstancedMesh(g, floraMat, FLORA_ROWS * 10);
        mesh.frustumCulled = false; mesh.count = 0; scene.add(mesh);
        species[name] = { mesh, n: 0 };
      }
      scene.add(treeShade);
    }
    const tuftC = makeCanvas(128, 64);
    {
      const g = tuftC.getContext('2d');
      for (let i = 0; i < 46; i++) {
        const x = 8 + hash(i * 1.7) * 112, hgt = 22 + hash(i * 2.9) * 38, lean = (hash(i * 4.1) - 0.5) * 22;
        g.strokeStyle = ['#2f9e3c', '#46b84f', '#237a30', '#5fca5e'][i % 4]; g.lineWidth = 2.2 + hash(i * 5.3) * 2;
        g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x + lean * 0.3, 64 - hgt * 0.6, x + lean, 64 - hgt); g.stroke();
      }
    }
    const tuftGeo = new T.BufferGeometry();
    {
      const P = [], U = [];
      for (const q of [[[-1, 0, 0], [1, 0, 0], [1, 1, 0], [-1, 1, 0]], [[0, 0, -1], [0, 0, 1], [0, 1, 1], [0, 1, -1]]]) for (const i of [0, 1, 2, 0, 2, 3]) { P.push(...q[i]); U.push([0, 1, 1, 0][i], [0, 0, 1, 1][i]); }
      tuftGeo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); tuftGeo.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
    }
    const GRASS_PER_SIDE = 64, TUFT_CAP = 48 * 2 * GRASS_PER_SIDE; // grass tufts stay near the camera (cap as before)
    const TUFT_TINTS = ['#ffffff', '#d9f2b0', '#a8d68a', '#f0e6a0', '#7fbf6a', '#c8f0c0'].map((c) => col(c));
    const tuftMat = new T.MeshBasicMaterial({ map: canvasTex(tuftC), alphaTest: 0.4, side: T.DoubleSide });
    const tufts = new T.InstancedMesh(tuftGeo, tuftMat, TUFT_CAP);
    tufts.frustumCulled = false; tufts.count = 0; scene.add(tufts);
    // Real 3D trees (maple + pine LOD2 meshes from the owner's packs) for the rows nearest the road.
    const treeKits = [], leafMats = [];
    const TREE_CAP = 320;
    const makeKits = (root, prefix, kind) => {
      if (!root) return;
      root.updateMatrixWorld(true);
      const roots = [];
      root.traverse((o) => { if (o.name && o.name.startsWith(prefix) && !/_LOD|_Billboard|_Mat/.test(o.name)) roots.push(o); });
      for (const o of roots) {
        const meshes = []; o.traverse((m) => { if (m.isMesh && !/Billboard/.test(m.material.name)) meshes.push(m); });
        if (!meshes.length) continue;
        const box = new T.Box3(); meshes.forEach((m) => box.expandByObject(m));
        const size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
        const norm = new T.Matrix4().makeScale(1 / size.y, 1 / size.y, 1 / size.y).multiply(new T.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
        const parts = meshes.map((m) => {
          const g = m.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(norm, m.matrixWorld));
          const src = m.material, leaf = src.transparent || src.alphaTest > 0 || /Cluster/.test(src.name);
          if (src.map) src.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          const mat = new T.MeshLambertMaterial({ map: src.map || null, color: 0xffffff, side: T.DoubleSide, alphaTest: leaf ? 0.5 : 0 });
          mat.name = src.name;
          if (leaf) leafMats.push(mat);
          const im = new T.InstancedMesh(g, mat, TREE_CAP); im.count = 0; im.frustumCulled = false; scene.add(im);
          return im;
        });
        treeKits.push({ kind, parts, n: 0 });
      }
    };
    makeKits(mapleScene, 'Acer_', 'leafy');
    makeKits(pineScene, 'Pine_', 'pine');
    const qy = new T.Quaternion(), upY = new T.Vector3(0, 1, 0), tmpTint = new T.Color();
    const plant3d = (kind, x, z, h, seed, y = -0.05) => {
      const list = treeKits.filter((t) => t.kind === kind); if (!list.length) return false;
      const kit = list[Math.floor(hash(seed) * list.length)]; if (kit.n >= TREE_CAP) return false;
      qy.setFromAxisAngle(upY, hash(seed * 1.7) * Math.PI * 2);
      m4.compose(v3a.set(x, y, z), qy, v3b.set(h, h, h));
      // every tree gets its own leaf tone (fresh, deep, slightly yellow) so neighbours never look copied
      const tk = hash(seed * 2.9), tb = 0.86 + hash(seed * 4.3) * 0.24;
      tmpTint.setRGB((tk < 0.3 ? 0.84 : (tk < 0.6 ? 1.0 : 1.1)) * tb, tb, (tk < 0.3 ? 0.82 : (tk < 0.6 ? 0.9 : 0.72)) * tb);
      for (const im of kit.parts) { im.setMatrixAt(kit.n, m4); im.setColorAt(kit.n, tmpTint); }
      kit.n++;
      return true;
    };
    // Owner's grass pack: every patch/clump mesh becomes an instanced kit.
    const grassKits = [], GRASS_CAP = 3000;
    // natural mix of grass tones: fresh, deep, olive, dry-yellow, blue-green
    const GRASS_TINTS = ['#ffffff', '#dff2c4', '#b9dc96', '#93c47a', '#c9cf86', '#e6dc9a', '#a7d3a0', '#86b566', '#d6e8a8'].map((c) => col(c));
    if (grassScene) {
      grassScene.updateMatrixWorld(true);
      grassScene.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld); g.computeBoundingBox();
        const bb = g.boundingBox, c = bb.getCenter(new T.Vector3()); g.translate(-c.x, -bb.min.y, -c.z);
        const mat = o.material.clone(); mat.side = T.DoubleSide; mat.alphaTest = Math.max(mat.alphaTest || 0, 0.4); mat.transparent = false;
        mat.color.set(/yellow/.test(o.material.name) ? '#c3dc80' : '#8fd464'); leafMats.push(mat); mat.userData.baseTint = mat.color.clone();
        const im = new T.InstancedMesh(g, mat, GRASS_CAP); im.count = 0; im.frustumCulled = false; scene.add(im);
        grassKits.push({ im, n: 0 });
      });
    }
    const layoutFloraPhoto = (base) => {
      let di = 0, si = 0, gi = 0, bi = 0;
      for (const kit of grassKits) kit.n = 0;
      for (const k in species) species[k].n = 0;
      for (const kit of treeKits) kit.n = 0;
      const MT = curMap === 'mountain', gY = (x) => (MT ? valleyY(Math.abs(x)) : 0); // on the valley slope everything stands on the falling ground
      const plant = (name, x, z, h, flip, shade) => {
        if (clearAt(z, Math.abs(x))) return;
        const sp = species[name]; if (sp.n >= FLORA_ROWS * 10) return;
        h *= 0.58 + hash(x * 3.7 + z * 1.3) * 0.42;
        put(sp.mesh, sp.n++, x, -0.05 + gY(x), z, flip ? -h : h, h, h);
        if (shade && !MT && si < FLORA_ROWS * 10) put(treeShade, si++, x + shade * 0.5, 0, z + shade * 0.2, shade * 1.5, 1, shade);
      };
      const FIRS = ['fir0', 'fir1', 'fir2'], LEAFY = ['leafy0', 'leafy2', 'leafy1'], ROCKS = ['rock0', 'rock1', 'rock2'];
      const segLen = FLORA_SEG * R3D_ZS, EDGE = RAIL_X + 3.4; // open verge between the rail and the first trees
      for (let k = 0; k < FLORA_ROWS; k++) {
        const s = base + k - 2, z = -(s * FLORA_SEG) * R3D_ZS;
        for (const side of [-1, 1]) {
          if (MT && side === cliffSide) continue; // the rock wall stands there
          const n = s * 2 + (side > 0 ? 1 : 0), r = (q) => hash(n * q);
          // stretches of dense planting alternate with open gaps
          const dens = MT ? 0.4 + hash(Math.floor(s / 4) * 7.13 + (side > 0 ? 3.1 : 0)) * 0.6 : hash(Math.floor(s / 4) * 7.13 + (side > 0 ? 3.1 : 0));
          // real 3D trees everywhere (cut-out sprites only if the tree packs failed to load)
          const pineZone = MT || hash(Math.floor(s / 6) * 3.7 + (side > 0 ? 1.9 : 0)) < 0.32;
          const tree = (x, zz, h, pineBias) => {
            if (clearAt(zz, Math.abs(x))) return;
            const kind = r(2.7 + x) < (pineZone ? (MT ? 0.94 : 0.75) : pineBias) ? 'pine' : 'leafy', gy = gY(x) - 0.05;
            if (plant3d(kind, x, zz, kind === 'pine' ? h * 1.2 : h * 1.15, n * 3.3 + x, gy) || plant3d(kind === 'pine' ? 'leafy' : 'pine', x, zz, h * 1.15, n * 3.3 + x, gy)) {
              if (!MT && si < FLORA_ROWS * 10) put(treeShade, si++, x + h * 0.14, 0, zz + 0.4, h * (kind === 'pine' ? 0.34 : 0.52), 1, h * (kind === 'pine' ? 0.26 : 0.38));
              return;
            }
            if (kind === 'pine') plant(FIRS[Math.floor(r(2.1 + x) * 3)], x, zz, h * 1.2, r(5.3 + x) < 0.5, h * 0.25);
            else plant(LEAFY[Math.floor(r(2.1 + x) * 3)], x, zz, h, r(5.3 + x) < 0.5, h * 0.36);
          };
          // front row: one tree every other segment (about 13 m apart), with whole stretches left open
          if (dens > 0.34 && !(s & 1)) tree(side * (EDGE + r(3.7) * 2.4), z, 5.2 + r(4.9) * 3.2, 0.2);
          if (dens > 0.58 && (s & 1) && r(10.1) < 0.7) tree(side * (EDGE + 7 + r(10.3) * 7), z - segLen * r(10.9), 6 + r(11.3) * 3.4, 0.3);
          // saplings near the verge, tall trees further back, a loose tree line beyond: all with gaps
          if (r(30.1) < 0.5) tree(side * (EDGE - 1.2 + r(30.7) * 5), z - segLen * r(31.3), 2.5 + r(31.9) * 1.5, 0.25);
          if (r(38.1) < 0.45) tree(side * (EDGE + 1.5 + r(38.7) * 9), z - segLen * r(39.3), 2.2 + r(39.9) * 1.9, 0.2);   // more young trees
          if (r(40.3) < 0.3) tree(side * (EDGE + 11 + r(40.9) * 14), z - segLen * r(41.7), 3 + r(42.1) * 2.4, 0.3);
          if (r(32.3) < 0.26) tree(side * (EDGE + 9 + r(32.9) * 10), z - segLen * r(33.1), 10 + r(33.7) * 4, 0.3);
          if (r(12.1) < 0.3) tree(side * (EDGE + 16 + r(12.7) * 11), z - segLen * r(13.1), 8 + r(13.7) * 4.5, 0.4);
          if (r(15.3) < 0.26) tree(side * (EDGE + 30 + r(15.7) * 30), z - segLen * r(16.3), 11 + r(16.9) * 6, 0.45);
          if (r(34.1) < 0.16) plant(ROCKS[Math.floor(r(34.7) * 3)], side * (RAIL_X + 2.2 + r(35.1) * 6), z - segLen * r(35.9), 1.4 + r(36.3) * 0.9, r(36.9) < 0.5, 0.7); // boulders
          // low round bushes on the open lawn
          if (r(24.1) < 0.4 && bi + 5 <= FLORA_ROWS * 16) {
            const bx = side * (RAIL_X + 1.6 + r(24.7) * 7.5), bz = z - segLen * r(25.3), bs = 0.42 + r(25.9) * 0.34;
            for (let f = 0; f < 5 && !clearAt(bz, Math.abs(bx)); f++) {
              const a = f * 1.257 + r(26.1) * 6, rad = f ? bs * 0.62 : 0, fs = bs * (f ? 0.5 + hash(n * 29.3 + f) * 0.28 : 0.9);
              put(blobs, bi, bx + Math.cos(a) * rad, fs * (f ? 0.62 : 0.8) + gY(bx), bz + Math.sin(a) * rad * 0.8, fs, fs * (f ? 0.82 : 0.95), fs);
              blobs.setColorAt(bi++, f === 0 ? LEAF.bush3 : (f % 2 ? LEAF.bush2 : LEAF.bush));
            }
            if (!MT && si < FLORA_ROWS * 10 && !clearAt(bz, Math.abs(bx))) put(treeShade, si++, bx + 0.25, 0, bz + 0.1, bs * 1.5, 1, bs * 1.15);
          }
          if (r(18.1) < 0.9) plant(ROCKS[Math.floor(r(18.7) * 3)], side * (RAIL_X + 0.9 + r(19.3) * 2.6), z - segLen * 0.3, 0.55 + r(19.9) * 0.75, r(20.3) < 0.5, 0);
          if (r(26.3) < 0.55) plant(ROCKS[Math.floor(r(26.9) * 3)], side * (RAIL_X + 4 + r(27.1) * 9), z - segLen * r(27.7), 0.5 + r(28.3) * 0.6, r(28.9) < 0.5, 0); // pebbles further out
          for (let f = 0; f < GRASS_PER_SIDE && gi < TUFT_CAP && k < 56; f++) {
            const far = hash(n * 31.7 + f), sz = 0.16 + hash(n * 33.1 + f) * 0.18;
            const kind = hash(n * 37.9 + f), tall = kind > 0.85 ? 1.25 : (kind < 0.3 ? 0.6 : 0.85);
            if (clearAt(z - segLen * hash(n * 35.3 + f), grassKits.length ? RAIL_X + 0.6 + far * (8 + far * 20) : RAIL_X + 0.5 + far * far * 16)) continue;
            if (grassKits.length) {
              const kit = grassKits[Math.floor(hash(n * 41.3 + f) * grassKits.length)];
              if (kit.n < GRASS_CAP) {
                const gs = f >= 30 ? 0.45 + hash(n * 43.7 + f) * 0.55 : (f % 5 === 0 ? 2.1 : 1.0) + hash(n * 43.7 + f) * 1.2; // every fifth one is a big patch; the extra ones are small tufts
                qy.setFromAxisAngle(upY, hash(n * 45.1 + f) * 6.283);
                kit.im.setColorAt(kit.n, GRASS_TINTS[Math.floor(hash(n * 51.7 + f * 1.3) * GRASS_TINTS.length)]);
                kit.im.setMatrixAt(kit.n++, m4.compose(v3a.set(side * (RAIL_X + 0.6 + far * (8 + far * 20)), -0.02 + gY(RAIL_X + 0.6 + far * (8 + far * 20)), z - segLen * hash(n * 35.3 + f)), qy, v3b.set(gs, gs * (0.55 + hash(n * 47.9 + f) * 0.35), gs)));
              }
              continue;
            }
            put(tufts, gi, side * (RAIL_X + 0.5 + far * far * 16), 0, z - segLen * hash(n * 35.3 + f), sz * (kind < 0.25 ? 2.4 : 1.5), sz * tall, sz * 1.5);
            tufts.setColorAt(gi++, TUFT_TINTS[Math.floor(hash(n * 39.1 + f) * TUFT_TINTS.length)]);
          }
          // wildflower specks on the verge
          const fc = FLOWER[Math.floor(r(21.1) * FLOWER.length)];
          for (let f = 0; f < 4; f++) {
            if (clearAt(z - segLen * hash(n * 23.9 + f), RAIL_X + 0.5 + hash(n * 22.3 + f) * 3.4)) continue;
            put(dots, di, side * (RAIL_X + 0.5 + hash(n * 22.3 + f) * 3.4), 0.07 + gY(RAIL_X + 2), z - segLen * hash(n * 23.9 + f), 0.07, 0.07, 0.07);
            dots.setColorAt(di++, f % 2 ? fc : FLOWER[0]);
          }
        }
      }
      for (const k in species) { species[k].mesh.count = species[k].n; species[k].mesh.instanceMatrix.needsUpdate = true; }
      treeShade.count = si; treeShade.instanceMatrix.needsUpdate = true;
      for (const kit of treeKits) for (const im of kit.parts) { im.count = kit.n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
      for (const kit of grassKits) { kit.im.count = kit.n; kit.im.instanceMatrix.needsUpdate = true; if (kit.im.instanceColor) kit.im.instanceColor.needsUpdate = true; }
      tufts.count = gi; tufts.instanceMatrix.needsUpdate = true; if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
      trunks.count = cones.count = 0; dots.count = di; blobs.count = bi;
      blobs.instanceMatrix.needsUpdate = true; if (blobs.instanceColor) blobs.instanceColor.needsUpdate = true;
      dots.instanceMatrix.needsUpdate = true; if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
    };
    const layoutFlora = floraTex ? layoutFloraPhoto : layoutFloraBuiltIn;

    // ---------- start / finish ----------
    const chkC = makeCanvas(256, 32);
    {
      const g = chkC.getContext('2d');
      for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) { g.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : '#0f172a'; g.fillRect(c * 16, r * 16, 16, 16); }
    }
    const chkTex = canvasTex(chkC, { magFilter: T.NearestFilter });
    const lineDepth = 1.5;
    const roadText = (text) => {
      const c = makeCanvas(1024, 256), g = c.getContext('2d');
      g.font = '900 210px "Segoe UI", "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(248,250,252,0.94)'; g.fillText(text, 512, 138, 980);
      const m = new T.Mesh(flatOnRoad(R3D_XS * 0.6, 1.9), new T.MeshBasicMaterial({ map: canvasTex(c), transparent: true, depthWrite: false }));
      m.position.y = 0.016; m.renderOrder = 2;
      return m;
    };
    const makeLine = (trackZ, text) => {
      const g = new T.Group();
      const strip = new T.Mesh(flatOnRoad(2 * R3D_XS, lineDepth), new T.MeshBasicMaterial({ map: chkTex }));
      strip.position.set(0, 0.014, -lineDepth / 2); strip.renderOrder = 1;
      const txt = roadText(text); txt.position.z = -lineDepth - 3.4;
      g.add(strip, txt);
      g.position.z = -trackZ * R3D_ZS;
      scene.add(g);
      return g;
    };
    const START_TRACK_Z = 8.6; // just ahead of the car noses on the grid
    makeLine(START_TRACK_Z, 'START');
    const finishGroup = makeLine(r3dEndZ(), 'FINISH'); // moved to the current race length every frame
    {
      const banC = makeCanvas(1024, 128), g = banC.getContext('2d');
      g.fillStyle = '#0f172a'; g.fillRect(0, 0, 1024, 128);
      for (let c = 0; c < 64; c++) for (let r = 0; r < 2; r++) { g.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : '#0f172a'; g.fillRect(c * 16, r * 12, 16, 12); g.fillRect(c * 16, 104 + r * 12, 16, 12); }
      g.font = '900 italic 70px "Segoe UI", "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#f8fafc'; g.fillText('FINISH', 512, 66);
      const span = RAIL_X * 2 + 1.2;
      const banner = new T.Mesh(new T.PlaneGeometry(span, span / 8), new T.MeshBasicMaterial({ map: canvasTex(banC) }));
      banner.position.set(0, 6.6, 0);
      const gantry = new T.Mesh(merge([
        part(new T.BoxGeometry(0.36, 7.6, 0.36), '#cbd5e1', -span / 2, 3.8, -0.1),
        part(new T.BoxGeometry(0.36, 7.6, 0.36), '#cbd5e1', span / 2, 3.8, -0.1),
        part(new T.BoxGeometry(span + 0.36, 0.3, 0.3), '#94a3b8', 0, 7.6, -0.1),
        part(new T.BoxGeometry(span + 0.36, 0.2, 0.3), '#94a3b8', 0, 5.6, -0.1)
      ]), matVC);
      finishGroup.add(banner, gantry);
    }

    // ---------- cars ----------
    const envRT = (() => { // small procedural sky so the paint has something to reflect
      const s = new T.Scene(), g = new T.SphereGeometry(10, 96, 48), n = g.attributes.position.count, c = new Float32Array(n * 3);
      const top = col('#5aa8ff'), hor = col('#ffffff'), gnd = col('#3a4048'), tmp = new T.Color(), sd = new T.Vector3(0.553, 0.743, 0.376).normalize();
      for (let i = 0; i < n; i++) {
        const y = g.attributes.position.getY(i) / 10;
        if (y >= 0) tmp.copy(hor).lerp(top, Math.min(1, y * 1.6)); else tmp.copy(hor).lerp(gnd, Math.min(1, -y * 5));
        // bright, sharp horizon band and a crisp sun hotspot (HDR values: the paint picks them up as hard highlights)
        const band = Math.exp(-Math.pow(y / 0.11, 2)) * 0.55;
        const dot = (g.attributes.position.getX(i) * sd.x + g.attributes.position.getY(i) * sd.y + g.attributes.position.getZ(i) * sd.z) / 10;
        const sun = Math.pow(Math.max(0, dot), 380) * 9 + Math.pow(Math.max(0, dot), 40) * 0.7;
        tmp.multiplyScalar(1 + band * (y >= 0 ? 1 : 0.4)).addScalar(sun);
        tmp.multiplyScalar(0.94); // keeps the overall brightness about where it was
        c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b;
      }
      g.setAttribute('color', new T.BufferAttribute(c, 3));
      s.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
      const pm = new T.PMREMGenerator(renderer), rt = pm.fromScene(s, 0.04);
      pm.dispose(); g.dispose();
      return rt;
    })();
    const envMap = skyEnv || envRT.texture;

    // ---------- route features: city street + gorge bridge (laid out when the route changes, drawn only when near) ----------
    // clearAt(worldZ, |x|): true where no trees / bushes / grass may stand (inside the street, and over the gorge).
    let cityM0 = Infinity, cityM1 = -Infinity, brM0 = Infinity, brM1 = -Infinity, tnM0 = Infinity, tnM1 = -Infinity, sceneryFor = null, sceneryWarm = false;
    const clearAt = (z, ax) => { const m = -z; return (m > cityM0 - 4 && m < cityM1 + 4 && ax < 78) || (m > brM0 - 4 && m < brM1 + 4) || (m > tnM0 - 8 && m < tnM1 + 8 && ax < 42); };
    const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const rgbOf = (hex) => { const c = col(hex); return [c.r, c.g, c.b]; };
    const grey = (k) => [k, k, k];
    const cityGroup = new T.Group(); cityGroup.visible = false; scene.add(cityGroup);

    // facade texture: one tile = 12.8 m x 12.8 m = 4 x 4 windows (3.2 m each), plus an emissive twin with the lit windows
    const facade = paintFacade(256, { frame: '#e4e9ef', glassA: ['#9cc4ea', '#6a95c0'], glassB: ['#86b2dc', '#5683b0'], blind: 'rgba(242,240,230,0.92)', mullion: 'rgba(214,222,232,0.9)', edge: 'rgba(120,134,152,0.95)', streak: 0.26, lit: [[1, 2], [2, 0], [3, 3]] });
    const facadeTex = canvasTex(facade.c, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping, anisotropy: Math.min(4, renderer.capabilities.getMaxAnisotropy()) });
    const facadeEmi = canvasTex(facade.e, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping, anisotropy: Math.min(4, renderer.capabilities.getMaxAnisotropy()) });
    const bldMat = new T.MeshStandardMaterial({ map: facadeTex, emissiveMap: facadeEmi, emissive: 0xffffff, emissiveIntensity: 0.5, vertexColors: true, metalness: 0.35, roughness: 0.3, envMapIntensity: 1.0 });
    if (!skyEnv) bldMat.envMap = envRT.texture;

    // ---- building geometry: custom quads, UVs in metres / 12.8 so the windows keep their real size ----
    const FLAT_UV = [0.004, 0.004]; // a plain facade pixel, used for roofs and trims
    const mkBuilder = () => {
      const P = [], N = [], U = [], C = [];
      const lerp3 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
      const lerp2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      // a, b, c, d counter-clockwise from outside; the quad is cut into `segs` strips along a->b so the road bend can shear it
      const quad = (a, b, c, d, n, ua, ub, uc, ud, cl, segs) => {
        for (let i = 0; i < segs; i++) {
          const t0 = i / segs, t1 = (i + 1) / segs;
          const v = [lerp3(a, b, t0), lerp3(a, b, t1), lerp3(d, c, t1), lerp3(d, c, t0)], uv = [lerp2(ua, ub, t0), lerp2(ua, ub, t1), lerp2(ud, uc, t1), lerp2(ud, uc, t0)];
          for (const k of [0, 1, 2, 0, 2, 3]) { P.push(...v[k]); N.push(...n); U.push(...uv[k]); C.push(...cl); }
        }
      };
      const F = FLAT_UV;
      // axis-aligned block (front = +z, no bottom, no back); win: window UVs, otherwise a flat colour
      const solid = (x0, y0, z0, x1, y1, z1, cl, win, opt = {}) => {
        const W = 12.8, sx = Math.max(1, Math.ceil((x1 - x0) / 6));
        const uvs = (u1, v0, v1) => win ? [[0, v0], [u1, v0], [u1, v1], [0, v1]] : [F, F, F, F];
        let q = uvs((x1 - x0) / W, y0 / W, y1 / W);
        quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], q[0], q[1], q[2], q[3], cl, sx);
        q = uvs((z1 - z0) / W, y0 / W, y1 / W);
        quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], q[0], q[1], q[2], q[3], cl, 1);
        quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], q[0], q[1], q[2], q[3], cl, 1);
        if (!opt.noTop) quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], F, F, F, F, opt.top || grey(0.55), sx);
      };
      const build = () => {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
        return g;
      };
      return { solid, build };
    };
    const WALL = grey(1), SHOP = [0.4, 0.45, 0.52], ROOF = [0.52, 0.5, 0.47], TRIM = grey(0.84), UNIT = grey(0.66);
    const body = (b, w, d, h) => { // dark shopfront band (one floor), then the upper floors
      b.solid(-w / 2, 0, -d / 2, w / 2, 3.2, d / 2, SHOP, true, { noTop: true });
      b.solid(-w / 2, 3.2, -d / 2, w / 2, h, d / 2, WALL, true, { top: ROOF });
    };
    const parapet = (b, w, d, h) => {
      const t = 0.45, y1 = h + 0.9;
      b.solid(-w / 2, h, d / 2 - t, w / 2, y1, d / 2, TRIM, false); b.solid(-w / 2, h, -d / 2, w / 2, y1, -d / 2 + t, TRIM, false);
      b.solid(-w / 2, h, -d / 2 + t, -w / 2 + t, y1, d / 2 - t, TRIM, false); b.solid(w / 2 - t, h, -d / 2 + t, w / 2, y1, d / 2 - t, TRIM, false);
    };
    const awnings = (b, w, d, c1, c2) => {
      const aw = w * 0.42;
      for (const [cx, hex] of [[-w * 0.24, c1], [w * 0.24, c2]]) b.solid(cx - aw / 2, 2.55, d / 2, cx + aw / 2, 2.95, d / 2 + 1.3, rgbOf(hex), false);
    };
    const ARCH = [
      { w: 16, d: 12.8, h: 19.2, make: (b) => { body(b, 16, 12.8, 19.2); parapet(b, 16, 12.8, 19.2); b.solid(-5, 19.2, -2.5, -2.4, 20.8, 0.2, UNIT, false); b.solid(2.5, 19.2, -3.5, 5.5, 20.4, -0.5, UNIT, false); awnings(b, 16, 12.8, '#d1432f', '#f2c230'); } },
      { w: 19.2, d: 16, h: 35.2, make: (b) => { body(b, 19.2, 16, 35.2); b.solid(-6.4, 35.2, -7.2, 6.4, 44.8, 2.4, WALL, true, { top: ROOF }); b.solid(-8, 35.2, 4, -4.5, 36.5, 6.8, UNIT, false); b.solid(5, 35.2, 3.5, 8, 36.2, 7, UNIT, false); awnings(b, 19.2, 16, '#1f7a8c', '#e8e1d4'); } },
      { w: 12.8, d: 12.8, h: 51.2, make: (b) => { body(b, 12.8, 12.8, 51.2); b.solid(-4.8, 51.2, -4.8, 4.8, 54.4, 4.8, [0.4, 0.46, 0.56], true, { top: ROOF }); b.solid(-0.3, 54.4, -0.3, 0.3, 64.4, 0.3, grey(0.85), false); b.solid(-2.5, 54.4, -1.5, 0.5, 55.6, 1.5, UNIT, false); awnings(b, 12.8, 12.8, '#e07a1f', '#2f5d9e'); } },
      { w: 22.4, d: 16, h: 28.8, make: (b) => { body(b, 22.4, 16, 28.8); parapet(b, 22.4, 16, 28.8); b.solid(-7, 28.8, -4.5, -0.6, 31.8, 1.5, UNIT, false); b.solid(3.5, 28.8, -5.5, 8.5, 31.2, -0.5, UNIT, false); awnings(b, 22.4, 16, '#3a9d5d', '#d1432f'); } },
      { w: 16, d: 16, h: 70.4, make: (b) => { body(b, 16, 16, 70.4); b.solid(-6.4, 70.4, -6.4, 6.4, 76.8, 6.4, WALL, true, { top: ROOF }); b.solid(-0.5, 76.8, -0.5, 0.5, 84, 0.5, grey(0.92), false); b.solid(-0.22, 84, -0.22, 0.22, 91, 0.22, grey(0.92), false); awnings(b, 16, 16, '#7b4fb3', '#f2c230'); } }
    ];
    const CITY_CAP = 110, CITY_AHEAD = 1100, CITY_BEHIND = 60; // buildings are laid out in a window around the camera (whole street for a short one)
    const cityMeshes = ARCH.map((a) => {
      const b = mkBuilder(); a.make(b);
      const m = new T.InstancedMesh(b.build(), bldMat, CITY_CAP);
      m.frustumCulled = false; m.count = 0; m.setColorAt(0, col('#ffffff')); cityGroup.add(m);
      return m;
    });
    const CITY_TINTS = ['#ffffff', '#e6f2ff', '#dcf6f1', '#fff0da', '#e4e8ee', '#d6ecfb', '#f6f1ea'].map((h) => col(h));

    // pavement: two strips, unit length, scaled to the street (z segments stay under 6 m for the longest street)
    const PAVE_X0 = ROAD_W / 2 - 0.05, PAVE_X1 = 75, PAVE_N = 110, PAVE_LEN = 660;
    const payC = makeCanvas(128, 128);
    {
      const g = payC.getContext('2d');
      g.fillStyle = '#c9c5bb'; g.fillRect(0, 0, 128, 128);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        const k = 0.94 + hash(r * 3.1 + c * 7.7) * 0.1;
        g.fillStyle = 'rgba(' + Math.round(210 * k) + ',' + Math.round(206 * k) + ',' + Math.round(196 * k) + ',1)'; g.fillRect(c * 64 + 2, r * 64 + 2, 60, 60);
      }
      g.fillStyle = 'rgba(120,116,106,0.9)'; g.fillRect(0, 0, 128, 2); g.fillRect(0, 62, 128, 4); g.fillRect(0, 126, 128, 2); g.fillRect(0, 0, 2, 128); g.fillRect(62, 0, 4, 128); g.fillRect(126, 0, 2, 128);
      for (let i = 0; i < 260; i++) { g.fillStyle = hash(i * 1.7) < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'; g.fillRect(hash(i * 2.3) * 128, hash(i * 3.9) * 128, 2, 2); }
    }
    const payTex = canvasTex(payC, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping });
    const payMat = new T.MeshLambertMaterial({ map: payTex, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const paveGeo = (sign) => {
      const g = new T.PlaneGeometry(1, 1, 2, PAVE_N); g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position, uv = g.attributes.uv, cArr = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i) + 0.5, f = px < 0.25 ? 0 : (px < 0.75 ? 0.17 : 1), k = f === 0 ? 1 : (f < 0.5 ? 0.93 : 0.72);
        pos.setX(i, sign * f); uv.setX(i, f); cArr[i * 3] = cArr[i * 3 + 1] = cArr[i * 3 + 2] = k;
      }
      g.setAttribute('color', new T.BufferAttribute(cArr, 3));
      if (sign < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
      return g;
    };
    const paveMeshes = [-1, 1].map((sg) => { const m = new T.Mesh(paveGeo(sg), payMat); m.position.set(sg * PAVE_X0, -0.015, 0); m.scale.x = PAVE_X1 - PAVE_X0; m.scale.z = PAVE_LEN; m.frustumCulled = false; cityGroup.add(m); return m; });

    // warm glow at the street-lamp heads inside the street (lamp positions follow the ones laid out in R3D.render)
    const CITY_LIGHT_MAX = 40, cityLightPos = new Float32Array(CITY_LIGHT_MAX * 3);
    const cityLightGeo = new T.BufferGeometry(); cityLightGeo.setAttribute('position', new T.BufferAttribute(cityLightPos, 3)); cityLightGeo.setDrawRange(0, 0);
    const cityLights = new T.Points(cityLightGeo, new T.PointsMaterial({ color: 0xffd28c, size: 3.4, map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    cityLights.frustumCulled = false; cityGroup.add(cityLights);

    const qCityL = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 2), qCityR = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -Math.PI / 2);
    // Where the street is (metres); the buildings themselves are placed by layoutCity for the window around the camera.
    const setCityRange = (city) => { if (!city) { cityM0 = Infinity; cityM1 = -Infinity; } else { cityM0 = city.z0 * R3D_ZS; cityM1 = city.z1 * R3D_ZS; } };
    // Every row walks the street from its start with the same random numbers, so a building keeps its place and look
    // as the window moves: only the ones inside [camM - CITY_BEHIND, camM + CITY_AHEAD] get an instance.
    const layoutCity = (city, camM) => {
      for (const m of cityMeshes) m.count = 0;
      if (!city) return;
      const m0 = city.z0 * R3D_ZS, m1 = city.z1 * R3D_ZS, seed = Math.floor(city.z0), n = [0, 0, 0, 0, 0];
      const wLo = camM - CITY_BEHIND, wHi = camM + CITY_AHEAD, rampLen = Math.min(0.16 * (m1 - m0), 40);
      for (let row = 0; row < 2; row++) for (const side of [-1, 1]) {
        const hs = (i, q) => hash(seed * 0.173 + row * 131.7 + (side > 0 ? 57.3 : 0) + i * 9.17 + q * 1.37);
        let m = m0 + 5 + hs(0, 0) * 6, i = 1;
        while (m < m1 - 5 && m < wHi) {
          const ramp = smooth01(0, rampLen, Math.min(m - m0, m1 - m)), r = hs(i, 1);
          let k;
          if (row === 0) k = ramp < 0.55 ? (r < 0.5 ? 0 : (r < 0.8 ? 3 : 1)) : (r < 0.22 ? 0 : (r < 0.44 ? 1 : (r < 0.62 ? 2 : (r < 0.82 ? 3 : 4))));
          else k = [1, 2, 4, 4, 2, 3][Math.floor(r * 6) % 6];
          const sx = 0.9 + hs(i, 2) * 0.25, sz = 0.9 + hs(i, 3) * 0.25;
          const sy = row === 0 ? (0.8 + hs(i, 4) * 0.45) * (0.5 + 0.5 * ramp) : (0.75 + hs(i, 4) * 0.75) * (0.3 + 0.7 * ramp);
          const a = ARCH[k], len = a.w * sx;
          if (m + len > wLo && (row === 0 || hs(i, 6) > 0.35) && n[k] < CITY_CAP && m + len < m1 - 2) {
            const front = RAIL_X + 5.0 + hs(i, 5) * 1.5 + (row ? 23 + hs(i, 8) * 4 : 0);
            m4.compose(v3a.set(side * (front + a.d * sz / 2), 0, -(m + len / 2)), side < 0 ? qCityL : qCityR, v3b.set(sx, sy, sz));
            cityMeshes[k].setMatrixAt(n[k], m4); cityMeshes[k].setColorAt(n[k], CITY_TINTS[Math.floor(hs(i, 9) * CITY_TINTS.length)]); n[k]++;
          }
          m += len + 1 + hs(i, 7) * 2 + (hs(i, 10) < 0.1 ? 6 : 0); i++;
        }
      }
      cityMeshes.forEach((mesh, k) => { mesh.count = n[k]; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; });
      // pavement: a fixed strip that follows the window, clipped to the street; the tile stays pinned to the world
      const a0 = Math.max(m0 - 8, wLo), a1 = Math.min(m1 + 8, a0 + PAVE_LEN), len = a1 - a0;
      for (const m of paveMeshes) { m.visible = len > 1; m.position.z = -(a0 + a1) / 2; m.scale.z = Math.max(0.01, len); }
      payTex.repeat.set((PAVE_X1 - PAVE_X0) / 2.2, len / 2.2); payTex.offset.y = (a0 / 2.2) % 1; // v = 0 is the near end (z = -a0)
    };

    // ---- bridge over a gorge: the grass has a hole (trGap), the banks fall away to a river, the deck carries road + pavements ----
    const BR_L = BR_LEN * R3D_ZS, DECK_HW = RAIL_X + 4.2, GORGE_Y = -8.5, WATER_Y = -7.2, LIP_Y = -0.08, SLOPE_L = 9;
    const bridgeGroup = new T.Group(); bridgeGroup.visible = false; scene.add(bridgeGroup);
    // river bed + banks: cross-section along the road (s metres from the start of the gap), extruded across x like the grass
    const bankY = (s) => { const d = Math.min(s, BR_L - s); return d <= 0 ? LIP_Y : (d >= SLOPE_L ? GORGE_Y : LIP_Y + (GORGE_Y - LIP_Y) * (d / SLOPE_L)); };
    {
      const S = [-3, 0]; for (let k = 1; k <= 4; k++) S.push(SLOPE_L * k / 4);
      const nm = Math.ceil((BR_L - 2 * SLOPE_L) / 5); for (let k = 1; k <= nm; k++) S.push(SLOPE_L + (BR_L - 2 * SLOPE_L) * k / nm);
      for (let k = 1; k <= 4; k++) S.push(BR_L - SLOPE_L + SLOPE_L * k / 4);
      S.push(BR_L + 3);
      const XS = [-1300, 0, 1300], P = [], C = [], I = [], cg = col('#58a03a'), ce = col('#8a6a46'), cr = col('#6e6a62'), cb = col('#515a60'), tc = new T.Color();
      for (const s of S) {
        const y = bankY(s), dep = (LIP_Y - y) / (LIP_Y - GORGE_Y);
        if (dep < 0.08) tc.copy(cg); else if (dep < 0.3) tc.copy(cg).lerp(ce, (dep - 0.08) / 0.22); else if (dep < 0.7) tc.copy(ce).lerp(cr, (dep - 0.3) / 0.4); else tc.copy(cr).lerp(cb, (dep - 0.7) / 0.3);
        const jit = 0.92 + hash(s * 3.7) * 0.16;
        for (const x of XS) { P.push(x, y, -s); C.push(tc.r * jit, tc.g * jit, tc.b * jit); }
      }
      for (let r = 0; r < S.length - 1; r++) for (let c = 0; c < 2; c++) { const a = r * 3 + c, b = a + 1, d = a + 3, e = d + 1; I.push(a, d, b, b, d, e); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
      const banks = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })); banks.frustumCulled = false; bridgeGroup.add(banks);
    }
    // water
    const rippleC = makeCanvas(128, 128);
    {
      const g = rippleC.getContext('2d'); g.fillStyle = '#b4dfe8'; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 90; i++) {
        const x = hash(i * 1.9) * 128, y = hash(i * 2.7) * 128, rx = 4 + hash(i * 3.3) * 12, k = hash(i * 4.1);
        g.strokeStyle = k < 0.5 ? 'rgba(255,255,255,0.32)' : 'rgba(80,140,170,0.26)'; g.lineWidth = 1 + hash(i * 5.3) * 1.4;
        for (const ox of [-128, 0, 128]) for (const oy of [-128, 0, 128]) { g.beginPath(); g.ellipse(x + ox, y + oy, rx, rx * 0.28, 0, 0, Math.PI * 1.35); g.stroke(); }
      }
    }
    const rippleTex = canvasTex(rippleC, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping });
    {
      const g = new T.PlaneGeometry(2600, BR_L - 8, 2, Math.ceil((BR_L - 8) / 5)); g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 9, pos.getZ(i) / 9);
      const water = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x3b97aa, map: rippleTex, roughness: 0.16, metalness: 0.25, envMapIntensity: 1.3 }));
      water.position.set(0, WATER_Y, -BR_L / 2); water.frustumCulled = false; bridgeGroup.add(water);
    }
    // deck, piers, parapet, arches: all merged into one vertex-coloured mesh (z in the group is -s)
    {
      const parts = [];
      const box = (x0, x1, y0, y1, s0, s1, hex) => parts.push(part(new T.BoxGeometry(x1 - x0, y1 - y0, s1 - s0, 1, 1, Math.max(1, Math.ceil((s1 - s0) / 6))), hex, (x0 + x1) / 2, (y0 + y1) / 2, -(s0 + s1) / 2));
      const RW = ROAD_W / 2;
      box(-RW, RW, -1.2, -0.3, -2, BR_L + 2, '#80868f');                                  // under the road
      for (const sg of [-1, 1]) {
        box(sg > 0 ? RW : -DECK_HW, sg > 0 ? DECK_HW : -RW, -1.22, -0.02, -2, BR_L + 2, '#b6bac1'); // pavements
        const px = sg * (DECK_HW - 0.3);
        for (let s = 0; s <= BR_L + 0.01; s += 2.5) box(px - 0.09, px + 0.09, -0.02, 1.1, Math.max(0, s - 0.09), s + 0.09, '#d9dde3'); // parapet posts
        box(px - 0.07, px + 0.07, 0.5, 0.62, 0, BR_L, '#d9dde3'); box(px - 0.07, px + 0.07, 0.98, 1.1, 0, BR_L, '#d9dde3'); // parapet rails
        // red arch with hangers
        const ax = sg * (DECK_HW - 1.0), N = 20, arch = (u) => 0.3 + 9 * 4 * u * (1 - u);
        for (let i = 0; i < N; i++) {
          const ua = i / N, ub = (i + 1) / N, sa = ua * BR_L, sb = ub * BR_L, ya = arch(ua), yb = arch(ub), len = Math.hypot(sb - sa, yb - ya) * 1.08;
          parts.push(part(new T.BoxGeometry(0.45, 0.45, len), '#c94f3a', ax, (ya + yb) / 2, -(sa + sb) / 2, Math.atan2(yb - ya, sb - sa), 0, 0));
        }
        for (let s = 4.5; s < BR_L - 2; s += 4.5) { const top = arch(s / BR_L) - 0.2; box(ax - 0.05, ax + 0.05, -0.02, top, s - 0.05, s + 0.05, '#e4e1dc'); }
      }
      for (let i = 0; i < 3; i++) {                                                          // piers: cross-beam + two columns each
        const s = (i + 0.5) * BR_L / 3;
        box(-7.4, 7.4, -2.4, -1.2, s - 0.9, s + 0.9, '#9ea4ac');
        for (const sg of [-1, 1]) box(sg * 6 - 0.65, sg * 6 + 0.65, -8.7, -2.4, s - 0.65, s + 0.65, '#a7adb5');
      }
      const mesh = new T.Mesh(merge(parts), new T.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      mesh.frustumCulled = false; bridgeGroup.add(mesh);
    }
    const placeBridge = (br) => {
      if (!br) { brM0 = Infinity; brM1 = -Infinity; trGap.value.set(1, 0); return; }
      brM0 = br.z0 * R3D_ZS; brM1 = brM0 + BR_L;
      bridgeGroup.position.z = -brM0;
      trGap.value.set(-brM1, -brM0);
    };
    // test hooks (used by the browser tests only): move every car so the player stands at track position z; pad positions
    window._trObjList = (type) => trackObjects.filter((o) => !type || o.type === type).map((o) => ({ type: o.type, z: o.z, x: o.x })); // test hook
    window._trTeleport = (z) => { const p = cars.find((c) => c.isPlayer) || cars[0]; if (!p) return false; const d = z - p.z; for (const c of cars) c.z += d; return true; };
    window._trSetEnd = (z) => { try { FINISH_LINE_Z = z; return true; } catch (e) { return false; } }; // works once FINISH_LINE_Z is a `let`
    window._trBoosts = () => trackObjects.filter((o) => o.type === 'boost').map((o) => o.z);
    window._trRouteInfo = () => { const R = raceRoute(), p = cars.find((c) => c.isPlayer) || cars[0]; return { map: R.map, city: R.city, bridge: R.bridge, lake: R.lake, tunnel: R.tunnel, cliff: R.cliff, endZ: r3dEndZ(), z: p ? p.z : 0, state: gameState, frames: frameCount, quality }; };

    // =====================================================================================================
    // MAPS: tunnel (every map but the lake), mountain (rock wall + valley + ridges), lake (long bridge over
    // open water), desert. Everything map-specific is built once here, laid out when the route changes and
    // recycled in a window around the camera while driving; applyMap / applyWeather switch it on and off.
    // =====================================================================================================
    const tintMats = []; // materials that follow the climate tint (applyWeather sets .color from the climate's city tint)
    const vcMat = (opts, tint = true) => { const m = new T.MeshLambertMaterial(Object.assign({ vertexColors: true }, opts)); if (tint) tintMats.push(m); return m; };
    const basicVC = (opts) => { const m = new T.MeshBasicMaterial(Object.assign({ vertexColors: true, side: T.DoubleSide }, opts)); tintMats.push(m); return m; };
    const indexed = (P, C, I, normals = true) => { // a plain vertex-coloured indexed mesh geometry
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.setIndex(I);
      if (normals) g.computeVertexNormals();
      return g;
    };

    // ---------- tunnel ----------
    // Half-ellipse bore, 13.2 m wide and 10.1 m under the crown (the chase camera sits 5.7 m up, 11.8 m behind the car), lined with
    // concrete, a retro-reflective band on the walls, two rows of warm ceiling lights (emissive + glow points for the bloom). The inside
    // is unlit vertex colour with the light pools baked in; while the camera is in the tunnel the scene lights dim (tunK).
    const TN_A = 6.6, TN_B = 10.4, TN_Y0 = -0.3;
    const TN_PHI = (() => { const A = [0, 0.0963, 0.1205, 0.1272, 0.1568, 0.1628, 0.1739, 0.2896, 0.4753, 0.7, 0.95, 1.2, 1.4], out = []; for (const a of A) out.push(Math.PI - a); out.push(Math.PI / 2); for (let i = A.length - 1; i >= 0; i--) out.push(A[i]); return out; })();
    const TN_NP = TN_PHI.length;
    const tnPt = (a, b, y0, k) => [a * Math.cos(TN_PHI[k]), y0 + b * Math.sin(TN_PHI[k])];
    const tunnelGroup = new T.Group(); tunnelGroup.visible = false; scene.add(tunnelGroup);
    const tnLining = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide }));
    const tnOuterSmooth = vcMat({ side: T.DoubleSide }), tnOuterRock = vcMat({ side: T.DoubleSide, flatShading: true });
    const tnOuter = new T.Mesh(new T.BufferGeometry(), tnOuterSmooth);
    const tnDark = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    tnDark.renderOrder = 8;
    const poolC = makeCanvas(128, 128);
    {
      const g = poolC.getContext('2d');
      for (const cx of [43, 85]) { const gr = g.createRadialGradient(cx, 64, 2, cx, 64, 54); gr.addColorStop(0, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.3)'); gr.addColorStop(0.65, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.save(); g.translate(cx, 64); g.scale(0.45, 1); g.translate(-cx, -64); g.fillRect(0, 0, 128, 128); g.restore(); }
    }
    const poolTex = canvasTex(poolC, { wrapT: T.RepeatWrapping });
    const tnPool = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ map: poolTex, color: 0xffc98a, transparent: true, opacity: 0.21, depthWrite: false, blending: T.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 }));
    tnPool.renderOrder = 9;
    const tnFloorMat = new T.MeshBasicMaterial({ color: 0x4d5258, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const tnFloors = [new T.Mesh(new T.BufferGeometry(), tnFloorMat), new T.Mesh(new T.BufferGeometry(), tnFloorMat)];
    const tnFix = new T.InstancedMesh(new T.BoxGeometry(0.34, 0.1, 1.9), new T.MeshBasicMaterial({ color: new T.Color(2.8, 2.3, 1.5), fog: false }), 64);
    const tnGlowPos = new Float32Array(64 * 3), tnGlowGeo = new T.BufferGeometry(); tnGlowGeo.setAttribute('position', new T.BufferAttribute(tnGlowPos, 3)); tnGlowGeo.setDrawRange(0, 0);
    const tnGlow = new T.Points(tnGlowGeo, new T.PointsMaterial({ color: 0xffc27a, size: 5.5, map: glowTex, transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    for (const o of [tnLining, tnOuter, tnDark, tnPool, tnFloors[0], tnFloors[1], tnFix, tnGlow]) { o.frustumCulled = false; tunnelGroup.add(o); }
    tnFix.count = 0;
    const TN_CFG = {
      highway:  { a0: 9.8, a1: 24, h0: 12.8, h1: 19, y0: -0.8, skirt: 0, c: ['#3f8a2c', '#6db447'], lump: 0.05 },
      desert:   { a0: 9.8, a1: 26, h0: 12.8, h1: 17, y0: -0.8, skirt: 0, c: ['#c19859', '#e0bc82'], lump: 0.05 },
      mountain: { a0: 11, a1: 30, h0: 14.5, h1: 27, y0: -1.0, skirt: 26, c: ['#5f574e', '#9d907f'], lump: 0.13 },
      city:     { a0: 8.0, a1: 8.0, h0: 11.4, h1: 11.4, y0: -0.8, skirt: 0, c: ['#868a91', '#b3b7bd'], lump: 0 }
    };
    const buildTunnel = (tn, mapK) => {
      tnM0 = tn ? tn.z0 * R3D_ZS : Infinity; tnM1 = tn ? tn.z1 * R3D_ZS : -Infinity;
      tnFix.count = 0; tnGlowGeo.setDrawRange(0, 0);
      if (!tn) { tunnelGroup.visible = false; return; }
      const L = (tn.z1 - tn.z0) * R3D_ZS, nr = Math.round(L), step = L / nr, cfg = TN_CFG[mapK] || TN_CFG.highway, sd = Math.floor(tn.z0);
      // lining: a ring every metre so the light pools bake into the vertex colours
      {
        const P = [], C = [], I = [];
        for (let j = 0; j <= nr; j++) {
          const s = j * step, d0 = ((s - 3) % 6 + 6) % 6, d = Math.min(d0, 6 - d0), pool = 0.45 + 0.55 * Math.exp(-(d * d) / 2.6);
          for (let k = 0; k < TN_NP; k++) {
            const [x, y] = tnPt(TN_A, TN_B, TN_Y0, k), tone = 0.075 + 0.07 * Math.min(1, Math.max(0, y) / 9), bnd = y > 1.0 && y < 1.35 ? 1 : 0; // v17: thin wall stripe (about 0.3 m) between extra profile rings, dark fine edge either side
            const r = (tone * 0.97 * (1 - bnd) + 0.5 * bnd) * pool, g2 = (tone * 0.99 * (1 - bnd) + 0.27 * bnd) * pool, b2 = (tone * 1.03 * (1 - bnd) + 0.05 * bnd) * pool;
            P.push(x, y, -s); C.push(r, g2, b2);
          }
        }
        for (let j = 0; j < nr; j++) for (let k = 0; k < TN_NP - 1; k++) { const a = j * TN_NP + k, b = a + 1, c = a + TN_NP, d = c + 1; I.push(a, b, d, a, d, c); }
        tnLining.geometry.dispose(); tnLining.geometry = indexed(P, C, I, false);
      }
      // outer shell: a hill (or a thin concrete box in the city) with tapering ends, and the two portal faces
      {
        const P = [], C = [], I = [], NP2 = TN_NP + 2, mr = Math.max(2, Math.round(L / 2)), sk = cfg.skirt, c0 = col(cfg.c[0]), c1 = col(cfg.c[1]), cc = new T.Color();
        for (let j = 0; j <= mr; j++) {
          const s = L * j / mr, e = smooth01(0, 24, Math.min(s, L - s)), a = cfg.a0 + (cfg.a1 - cfg.a0) * e, h = cfg.h0 + (cfg.h1 - cfg.h0) * e;
          const ring = [];
          for (let k = 0; k < TN_NP; k++) {
            let [x, y] = tnPt(a, h, cfg.y0, k);
            if (cfg.lump && k > 0 && k < TN_NP - 1) { const f = 1 + cfg.lump * e * (hash(sd * 0.01 + j * 13.7 + k * 5.1) - 0.5) * 2; x *= f; y = cfg.y0 + (y - cfg.y0) * f; }
            ring.push([x, y]);
          }
          const put2 = (x, y) => { cc.copy(c0).lerp(c1, Math.min(1, Math.max(0, (y - cfg.y0) / h))).multiplyScalar(0.88 + hash(sd * 0.03 + j * 3.3 + x * 0.7) * 0.24); P.push(x, y, -s); C.push(cc.r, cc.g, cc.b); };
          put2(ring[0][0], cfg.y0 - sk); for (const [x, y] of ring) put2(x, y); put2(ring[TN_NP - 1][0], cfg.y0 - sk);
        }
        for (let j = 0; j < mr; j++) for (let k = 0; k < NP2 - 1; k++) { const a = j * NP2 + k, b = a + 1, c = a + NP2, d = c + 1; I.push(a, b, d, a, d, c); }
        // portal frames (concrete): ring between the bore and the shell outline at both ends
        const conc = col('#a9acb1'), conD = col('#6f7378');
        for (const s of [0, L]) {
          const base = P.length / 3;
          for (let k = 0; k < TN_NP; k++) {
            const [xi, yi] = tnPt(TN_A, TN_B, TN_Y0, k), [xo, yo] = tnPt(cfg.a0, cfg.h0, cfg.y0, k), sh = 0.92 + hash(k * 2.3 + (s ? 5 : 0)) * 0.12;
            P.push(xi, yi, -s, xo, yo, -s); C.push(conD.r, conD.g, conD.b, conc.r * sh, conc.g * sh, conc.b * sh);
          }
          for (let k = 0; k < TN_NP - 1; k++) { const a = base + k * 2, b = a + 1, c = a + 2, d = a + 3; I.push(a, b, d, a, d, c); }
        }
        tnOuter.geometry.dispose(); tnOuter.geometry = indexed(P, C, I, true);
        tnOuter.material = mapK === 'mountain' ? tnOuterRock : tnOuterSmooth;
      }
      // dark + pooled light overlay on the road, floor strips beside the rails
      {
        const slab = (w, y, rows) => { const g = new T.PlaneGeometry(w, L, 1, rows); g.rotateX(-Math.PI / 2); g.translate(0, y, -L / 2); return g; };
        tnDark.geometry.dispose(); tnDark.geometry = slab(13.4, 0.03, Math.ceil(L / 5));
        tnPool.geometry.dispose(); tnPool.geometry = slab(13.4, 0.034, Math.ceil(L / 5));
        poolTex.repeat.set(1, L / 12); poolTex.offset.set(0, (1 - ((L / 12) % 1)) % 1);
        tnFloors.forEach((m, i) => { m.geometry.dispose(); const g = new T.PlaneGeometry(2.3, L, 1, Math.ceil(L / 6)); g.rotateX(-Math.PI / 2); g.translate((i ? 1 : -1) * 5.6, 0.004, -L / 2); m.geometry = g; });
      }
      // ceiling lights: two rows, one fixture every 6 m
      {
        let n = 0, nl = 0; const lx = 2.2, ly = TN_Y0 + TN_B * Math.sqrt(1 - (lx / TN_A) * (lx / TN_A)) - 0.16;
        for (let s = 3; s < L - 1 && n < 62; s += 6) for (const sg of [-1, 1]) {
          tnFix.setMatrixAt(n++, m4.compose(v3a.set(sg * lx, ly, -s), q0, v3b.set(1, 1, 1)));
          tnGlowPos[nl * 3] = sg * lx; tnGlowPos[nl * 3 + 1] = ly - 0.3; tnGlowPos[nl * 3 + 2] = -s; nl++;
        }
        tnFix.count = n; tnFix.instanceMatrix.needsUpdate = true; tnGlowGeo.setDrawRange(0, nl); tnGlowGeo.attributes.position.needsUpdate = true;
      }
      tunnelGroup.position.z = -tnM0;
    };

    // scene light level: 1 in the open, lower inside the tunnel (applyWeather stores the climate's own values)
    let tunK = 1, tunKApplied = 1, baseHemi = 1.35, baseSun = 2.5, baseEnv = 1;
    const applyLightK = () => { hemi.intensity = baseHemi * tunK; sun.intensity = baseSun * tunK; scene.environmentIntensity = baseEnv * (0.35 + 0.65 * tunK); tunKApplied = tunK; };

    // ---------- mountain: rock wall on one side, valley on the other, ridges on the horizon ----------
    const CLIFF_MOD = 40, CLIFF_AHEAD = 760, CLIFF_BEHIND = 70, CLIFF_VAR = 4, CLIFF_CAP = 24;
    const mtGroup = new T.Group(); mtGroup.visible = false; scene.add(mtGroup);
    const ROCK_TONES = ['#8a7560', '#9c8468', '#76665a', '#a8927a', '#6a5a4c', '#917c66'].map((h) => col(h));
    const cliffMat = vcMat({ side: T.DoubleSide }), cliffHH = [];
    // one 40 m wall module: a faceted face with strata bands, a ledge on top and a back that drops to the ground; both ends are 13 m
    // high with a plain profile, so any two modules (also mirrored) meet without a seam
    const buildCliff = (v) => {
      const NZ = 12, NY = 8, NR = NY + 4, DZ = CLIFF_MOD / NZ, X0 = RAIL_X + 2.6, P = [], C = [], I = [], hh = [];
      for (let i = 0; i <= NZ; i++) hh.push(i === 0 || i === NZ ? 13 : 8 + Math.pow(hash(v * 17.3 + i * 3.71), 1.1) * 22);
      for (let i = 1; i < NZ; i++) hh[i] = hh[i] * 0.75 + (hh[i - 1] + hh[i + 1]) * 0.125;
      const cc = new T.Color(), moss = col('#5c8a3c'); cliffHH[v] = hh;
      for (let r = 0; r < NR; r++) for (let i = 0; i <= NZ; i++) {
        const end = i === 0 || i === NZ, hv = (q) => hash(v * 31.7 + i * 5.3 + r * 1.7 + q);
        let x, y;
        if (r <= NY) {
          y = r === 0 ? -0.3 : hh[i] * r / NY * (end ? 1 : 1 + (hv(1.3) - 0.5) * 0.14);
          x = 0.2 * y + (end || r === 0 ? 0 : (hv(0) - 0.5) * 1.2 + Math.sin(i * 1.9 + v * 2.3) * 0.5);
        } else {
          const xf = 0.2 * hh[i];
          if (r === NY + 1) { x = xf + 3.2 + (end ? 0 : hv(2.1) * 2); y = hh[i] + (end ? 0 : (hv(3.1) - 0.4) * 1.5); }
          else if (r === NY + 2) { x = xf + 9 + (end ? 0 : hv(4.1) * 4); y = hh[i] * 0.85 + (end ? 0 : hv(5.1) * 1.5); }
          else { x = xf + 16; y = -0.5; }
        }
        P.push(X0 + x, y, -i * DZ);
        const ck = end ? 0 : v * 7.1 + i * 0.5; // the two end columns look the same on every module: no colour seams
        cc.copy(ROCK_TONES[(Math.floor(r / 2) + Math.floor(hash(ck) * 3)) % 6]).multiplyScalar((r === 0 ? 0.45 : (r === 1 ? 0.65 : 0.82)) + (end ? 0.2 : hv(6.7) * 0.4) + (r % 2 ? -0.1 : 0.06) + (!end && (i * 7 + v * 3) % 5 === 0 && r > 1 && r <= NY ? -0.2 : 0) + (r === 1 ? -0.1 : 0)); // strata bands, dark vertical gullies, dark damp foot
        if (r >= NY + 1) cc.lerp(moss, r === NY + 1 ? 0.8 : 0.55); else if (r === NY) cc.lerp(moss, 0.25 + hv(8.8) * 0.3);
        C.push(cc.r, cc.g, cc.b);
      }
      for (let r = 0; r < NR - 1; r++) for (let i = 0; i < NZ; i++) { const a = r * (NZ + 1) + i, b = a + 1, c = a + NZ + 1, d = c + 1; I.push(a, c, b, b, c, d); }
      const g = indexed(P, C, I, true), nA = g.attributes.normal; // smooth faces; the two end columns get a plain x/y normal so modules (also mirrored) light the same at the joint
      for (let r = 0; r < NR; r++) for (const i of [0, NZ]) { const k = r * (NZ + 1) + i, nx = nA.getX(k), ny = nA.getY(k), l = Math.hypot(nx, ny) || 1; nA.setXYZ(k, nx / l, ny / l, 0); }
      return g;
    };
    // bushes + pines on the cliff top and trees on the valley slope (instanced, laid out with the cliff)
    const capGeo = merge([part(new T.ConeGeometry(0.9, 3.2, 6), '#2f5a2e', 0, 1.9, 0), part(new T.SphereGeometry(1.0, 6, 5), '#4a7a38', 1.3, 0.55, 0.4), part(new T.CylinderGeometry(0.1, 0.14, 0.7, 5), '#5a3f26', 0, 0.3, 0)]);
    const CAP_N = 4, capTrees = new T.InstancedMesh(capGeo, vcMat(), CLIFF_CAP * 5 * CAP_N); capTrees.frustumCulled = false; capTrees.count = 0; mtGroup.add(capTrees);
    const VT_N = 16, vTreeGeo = new T.ConeGeometry(1.7, 7.5, 6).translate(0, 3.7, 0), vTreeMat = new T.MeshLambertMaterial({ color: 0xffffff }); tintMats.push(vTreeMat);
    const vTrees = new T.InstancedMesh(vTreeGeo, vTreeMat, CLIFF_CAP * 5 * VT_N); vTrees.frustumCulled = false; vTrees.count = 0; mtGroup.add(vTrees);
    const VT_COLS = ['#244a2a', '#2c5530', '#1f4026', '#33612f', '#3b6a36'].map((h) => col(h));
    const cliffMeshes = Array.from({ length: CLIFF_VAR }, (_, v) => { const m = new T.InstancedMesh(buildCliff(v), cliffMat, CLIFF_CAP); m.frustumCulled = false; m.count = 0; mtGroup.add(m); return m; });
    // valley: the ground beyond the rail falls away (the grass plane is cut there, see trCut); one extruded profile, no noise, so it can follow the camera in 6 m steps
    const VAL_X = [0, 1.2, 3.5, 8, 15, 26, 44, 80, 150, 300, 600, 1000], VAL_Y = [-0.03, -0.12, -1.0, -5.5, -13, -26, -44, -60, -68, -64, -50, -40];
    const VAL_COL = ['#5d8f3e', '#5a8a3e', '#4a7a36', '#36602e', '#2d5430', '#2a4e2e', '#2f5733', '#3e6446', '#5f8a80', '#86a8ae', '#9cbcc4', '#a9c8d0'];
    const valleyY = (ax) => {
      const d = ax - (RAIL_X + 0.45);
      if (d <= 0) return -0.03;
      for (let i = 1; i < VAL_X.length; i++) if (d <= VAL_X[i]) { const t = (d - VAL_X[i - 1]) / (VAL_X[i] - VAL_X[i - 1]); return VAL_Y[i - 1] + (VAL_Y[i] - VAL_Y[i - 1]) * t; }
      return VAL_Y[VAL_Y.length - 1];
    };
    const VAL_ROWS = 124, VAL_BACK = 100;
    const valleyMat = vcMat({ side: T.DoubleSide });
    const valley = (() => {
      const P = [], C = [], I = [], NPV = VAL_X.length;
      for (let j = 0; j <= VAL_ROWS; j++) for (let i = 0; i < NPV; i++) { P.push(RAIL_X + 0.45 + VAL_X[i], VAL_Y[i], VAL_BACK - j * 6); const c = col(VAL_COL[i]); C.push(c.r, c.g, c.b); }
      for (let j = 0; j < VAL_ROWS; j++) for (let i = 0; i < NPV - 1; i++) { const a = j * NPV + i, b = a + 1, c = a + NPV, d = c + 1; I.push(a, b, d, a, d, c); }
      const m = new T.Mesh(indexed(P, C, I, true), valleyMat); m.frustumCulled = false; mtGroup.add(m); return m;
    })();
    // low parapet stones along the valley edge (every 10th one painted)
    const STONE_GAP = 2.4, STONE_ROWS = 170;
    const stones = new T.InstancedMesh(merge([part(new T.BoxGeometry(0.9, 0.62, 1.5), '#a8a59d', 0, 0.31, 0), part(new T.BoxGeometry(0.96, 0.08, 1.56), '#c9c6bd', 0, 0.64, 0)]), vcMat(), STONE_ROWS);
    stones.frustumCulled = false; stones.count = 0; mtGroup.add(stones);
    const STONE_TINTS = [col('#ffffff'), col('#e9e6df'), col('#d6d2c8'), col('#f6f3ec')], STONE_RED = col('#e2484a');
    let stoneBase = null;
    const layoutStones = (base) => {
      const side = -cliffSide;
      for (let r = 0; r < STONE_ROWS; r++) {
        const i = base + r - 6, z = -i * STONE_GAP, hv = hash(i * 1.7 + 3);
        m4.compose(v3a.set(side * (RAIL_X + 0.9 + hv * 0.12), -0.02, z), q0, (-z > tnM0 - 2 && -z < tnM1 + 2) ? v3b.set(0, 0, 0) : v3b.set(1, 0.9 + hash(i * 2.9) * 0.3, 1)); // none inside the tunnel
        stones.setMatrixAt(r, m4); stones.setColorAt(r, i % 10 === 0 ? STONE_RED : STONE_TINTS[Math.floor(hash(i * 4.3) * 4)]);
      }
      stones.count = STONE_ROWS; stones.instanceMatrix.needsUpdate = true; stones.instanceColor.needsUpdate = true;
    };
    // rocks (shared by the cliff foot and the desert): low-poly boulders with a flat-shaded jitter
    const rockGeo = (() => { const g = new T.IcosahedronGeometry(1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.8 + hash(p.getX(i) * 9.1 + p.getY(i) * 7.7 + p.getZ(i) * 5.3) * 0.4; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.72, p.getZ(i) * k * 0.9); } g.computeVertexNormals(); return g; })();
    const rockMat = new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }); tintMats.push(rockMat);
    const ROCK_CAP = FLORA_ROWS * 8;
    const scree = new T.InstancedMesh(rockGeo, rockMat, 160); scree.frustumCulled = false; scree.count = 0; mtGroup.add(scree);
    const SCREE_TINTS = ['#8d8478', '#756d63', '#a09686', '#6a625a'].map((h) => col(h));
    let cliffBase = null;
    const layoutCliff = (camM) => {
      const i0 = Math.floor((camM - CLIFF_BEHIND) / CLIFF_MOD), i1 = Math.floor((camM + CLIFF_AHEAD) / CLIFF_MOD), n = [0, 0, 0, 0];
      let ns = 0, nc = 0, nv = 0;
      for (let i = i0; i <= i1; i++) {
        const z0 = i * CLIFF_MOD, v = Math.min(CLIFF_VAR - 1, Math.floor(hash(i * 3.17 + 0.4) * CLIFF_VAR)), mir = hash(i * 5.9 + 1.1) < 0.5 ? -1 : 1;
        if (n[v] < CLIFF_CAP) { m4.compose(v3a.set(0, 0, -z0 - (mir < 0 ? CLIFF_MOD : 0)), q0, v3b.set(cliffSide, 1, mir)); cliffMeshes[v].setMatrixAt(n[v]++, m4); }
        const hh = cliffHH[v], tun = (z0 > tnM0 - 60 && z0 < tnM1 + 60);
        for (let q = 0; q < CAP_N && !tun && nc < capTrees.instanceMatrix.count; q++) { // bushes / pines on the grass cap
          const hv = (w) => hash(i * 9.7 + q * 6.1 + w), k = 1 + Math.floor(hv(1) * 10), zz = -z0 - (mir < 0 ? CLIFF_MOD : 0) + mir * -(k + hv(2) * 0.8) * (CLIFF_MOD / 12), sc = 0.6 + hv(3) * 1.1;
          qy.setFromAxisAngle(upY, hv(4) * 6.28);
          m4.compose(v3a.set(cliffSide * (RAIL_X + 2.6 + 0.2 * hh[k] + 4.5 + hv(5) * 3), hh[k] - 0.2, zz), qy, v3b.set(sc, sc * (0.7 + hv(6) * 0.8), sc)); capTrees.setMatrixAt(nc++, m4);
        }
        for (let q = 0; q < VT_N && !tun && nv < vTrees.instanceMatrix.count; q++) { // forest on the valley slope
          const hv = (w) => hash(i * 5.3 + q * 8.9 + w), d = 14 + Math.pow(hv(1), 1.4) * 150, ax = RAIL_X + 0.45 + d, sc = 0.7 + hv(2) * 0.9 + d * 0.004;
          m4.compose(v3a.set(-cliffSide * ax, valleyY(ax) - 0.4, -(z0 + hv(3) * CLIFF_MOD)), q0, v3b.set(sc, sc * (0.8 + hv(4) * 0.6), sc)); vTrees.setMatrixAt(nv, m4); vTrees.setColorAt(nv++, VT_COLS[Math.floor(hv(5) * 5)]);
        }
        for (let q = 0; q < 8 && ns < 160; q++) { // boulders at the foot of the wall
          const hv = (w) => hash(i * 13.1 + q * 4.7 + w), sc = 0.35 + Math.pow(hv(1), 2) * 1.5;
          if (hv(2) < 0.55) continue;
          qy.setFromAxisAngle(upY, hv(3) * 6.28);
          m4.compose(v3a.set(cliffSide * (RAIL_X + 1.7 + hv(4) * 2.4), sc * 0.25 - 0.1, -(z0 + hv(5) * CLIFF_MOD)), qy, v3b.set(sc * 1.2, sc, sc));
          scree.setMatrixAt(ns, m4); scree.setColorAt(ns++, SCREE_TINTS[Math.floor(hv(6) * 4)]);
        }
      }
      cliffMeshes.forEach((m, v) => { m.count = n[v]; m.instanceMatrix.needsUpdate = true; });
      capTrees.count = nc; capTrees.instanceMatrix.needsUpdate = true; vTrees.count = nv; vTrees.instanceMatrix.needsUpdate = true; if (vTrees.instanceColor) vTrees.instanceColor.needsUpdate = true;
      scree.count = ns; scree.instanceMatrix.needsUpdate = true; if (scree.instanceColor) scree.instanceColor.needsUpdate = true;
    };
    // layered ridges (with snow caps) on the horizon: ride with the camera like the skyline, hazed by their own vertex colours
    const ridgeMat = basicVC({ fog: false });
    const ridgeMesh = (() => {
      // 4 procedural height-field layers (fractal + ridged noise): sun-shaded rock strata, forest on the gentle low slopes, snow above an irregular line, haze growing with distance
      const P = [], C = [], I = [], fogc = col('#a8c0dc'), snow = col('#f6f9fd'), forest = col('#27472b'), forest2 = col('#3a5b30'), cc = new T.Color(), rk = new T.Color();
      const sm = (t) => t * t * (3 - 2 * t), clamp01 = (t) => Math.max(0, Math.min(1, t));
      const vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy), h = (a, b) => hash(a * 12.9 + b * 78.2 + 5.1); return (h(ix, iy) * (1 - fx) + h(ix + 1, iy) * fx) * (1 - fy) + (h(ix, iy + 1) * (1 - fx) + h(ix + 1, iy + 1) * fx) * fy; };
      const fbm = (x, y, o) => { let a = 0.5, f = 1, t = 0; for (let k = 0; k < o; k++) { t += a * vn(x * f + k * 17, y * f + k * 31); a *= 0.5; f *= 2.05; } return t / 0.9375; };
      const rid = (x, y, o) => { let a = 0.5, f = 1, t = 0; for (let k = 0; k < o; k++) { t += a * (1 - Math.abs(vn(x * f + k * 7, y * f + k * 13) * 2 - 1)); a *= 0.5; f *= 2.1; } return t / 0.9375; };
      const LAY = [{ z: -520, base: 20, amp: 130, sn: 0.82, haze: 0.1, fs: 0.0100 }, { z: -690, base: 40, amp: 190, sn: 0.76, haze: 0.28, fs: 0.0075 }, { z: -880, base: 60, amp: 260, sn: 0.7, haze: 0.42, fs: 0.0058 }, { z: -1080, base: 80, amp: 330, sn: 0.66, haze: 0.55, fs: 0.0046 }];
      const NX = 250, NR = 8, DX = 8, DD = 16, SY = -40;
      LAY.forEach((L, li) => {
        // tall distinct peaks: a low-frequency mask lifts some summits far above the saddles between them
        const Hf = (x, d) => { const u = x * L.fs + li * 11.3, v = d * 0.012 + li * 5.7, mask = Math.pow(fbm(u * 0.5 + 2, v * 0.5, 3), 1.6) * 1.9; return L.base + L.amp * (0.12 * fbm(u * 1.3, v, 5) + 0.88 * Math.pow(rid(u, v, 4), 2.1) * (0.2 + mask)) + 5 * fbm(x * 0.05, d * 0.05, 2); };
        const start = P.length / 3, haze = L.haze, top = L.base + L.amp * 0.9;
        for (let r = 0; r < NR; r++) for (let i = 0; i <= NX; i++) {
          const x = -1000 + i * DX, d = r * DD, h = Hf(x, d);
          const hx = (Hf(x + 5, d) - Hf(x - 5, d)) / 10, hd = (Hf(x, d + 5) - Hf(x, d - 5)) / 10, sl = Math.sqrt(hx * hx + hd * hd);
          const nl = 1 / Math.sqrt(hx * hx + 1 + hd * hd), lit = Math.max(0, (-hx * SUN_DIR.x + SUN_DIR.y + hd * SUN_DIR.z) * nl);
          const hn = h / top, gul = rid(x * 0.045, h * 0.07 + d * 0.02, 3), strata = 0.8 + 0.3 * Math.sin(h * 0.55 + vn(x * 0.03, d * 0.03) * 6);
          rk.set(vn(x * 0.02, h * 0.04) > 0.5 ? '#7a6a58' : '#6c6358').multiplyScalar(strata * (0.65 + 0.7 * gul));
          const tree = (1 - sm(clamp01((hn - 0.22) / 0.3))) * (1 - sm(clamp01((sl - 0.55) / 0.7)));
          cc.copy(rk).lerp(vn(x * 0.07, d * 0.07 + h * 0.05) > 0.5 ? forest : forest2, tree);
          const sline = L.sn + (vn(x * 0.02 + 3, d * 0.02) - 0.5) * 0.3, sn = sm(clamp01((hn - sline) / 0.1)) * (1 - sm(clamp01((sl - 1.1) / 0.8)) * 0.6);
          cc.lerp(snow, sn);
          cc.multiplyScalar(0.3 + 1.0 * lit).lerp(fogc, haze);
          P.push(x, h, L.z - d); C.push(cc.r, cc.g, cc.b);
        }
        for (let r = 0; r < NR - 1; r++) for (let i = 0; i < NX; i++) { const a = start + r * (NX + 1) + i, b = a + 1, c = a + NX + 1, e = c + 1; I.push(a, b, c, b, e, c); }
        // skirt: the front row drops below the ground; dark forest green, hazed like the layer
        const sk = P.length / 3; cc.copy(forest).lerp(fogc, haze);
        for (let i = 0; i <= NX; i++) { P.push(-1000 + i * DX, SY, L.z); C.push(cc.r, cc.g, cc.b); }
        for (let i = 0; i < NX; i++) { const a = start + i, b = a + 1, c = sk + i, e = c + 1; I.push(a, c, b, b, c, e); }
      });
      const m = new T.Mesh(indexed(P, C, I, false), ridgeMat); m.frustumCulled = false; m.visible = false; backdrop.add(m); noBend(ridgeMat); return m;
    })();

    // ---------- lake: a long bridge over open water (modules recycled around the camera), shore, islands, far shore ----------
    const LAKE_WY = -6.2, LAKE_AHEAD = 1000, LAKE_BEHIND = 56, LAKE_NMOD = Math.ceil((LAKE_AHEAD + LAKE_BEHIND) / LAKE_MOD) + 1;
    const lakeGroup = new T.Group(); lakeGroup.visible = false; scene.add(lakeGroup);
    const lakeDeckMat = vcMat({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    // one 28 m module: slab, pavements, parapet, a red arch with hangers on each side, and a pier (cross-beam + two columns into the water)
    const lakeDeck = (() => {
      const parts = [], MOD = LAKE_MOD, RW = ROAD_W / 2;
      const box = (x0, x1, y0, y1, s0, s1, hex) => parts.push(part(new T.BoxGeometry(x1 - x0, y1 - y0, s1 - s0, 1, 1, Math.max(1, Math.ceil((s1 - s0) / 6))), hex, (x0 + x1) / 2, (y0 + y1) / 2, -(s0 + s1) / 2));
      box(-RW, RW, -1.2, -0.3, 0, MOD, '#80868f');
      for (const sg of [-1, 1]) {
        box(sg > 0 ? RW : -DECK_HW, sg > 0 ? DECK_HW : -RW, -1.22, -0.02, 0, MOD, '#b6bac1');
        const px = sg * (DECK_HW - 0.3);
        for (let i = 0; i < 6; i++) { const s = i * MOD / 6; box(px - 0.09, px + 0.09, -0.02, 1.1, s, s + 0.18, '#d9dde3'); }
        box(px - 0.07, px + 0.07, 0.5, 0.62, 0, MOD, '#d9dde3'); box(px - 0.07, px + 0.07, 0.98, 1.1, 0, MOD, '#d9dde3');
        const ax = sg * (DECK_HW - 1.0), N = 10, arch = (u) => 0.35 + 5.0 * 4 * u * (1 - u);
        for (let i = 0; i < N; i++) {
          const ua = i / N, ub = (i + 1) / N, sa = ua * MOD, sb = ub * MOD, ya = arch(ua), yb = arch(ub), len = Math.hypot(sb - sa, yb - ya) * 1.08;
          parts.push(part(new T.BoxGeometry(0.42, 0.42, len), '#c94f3a', ax, (ya + yb) / 2, -(sa + sb) / 2, Math.atan2(yb - ya, sb - sa), 0, 0));
        }
        for (let s = 2.8; s < MOD - 1; s += 2.8) { const top = arch(s / MOD) - 0.2; box(ax - 0.05, ax + 0.05, -0.02, top, s - 0.05, s + 0.05, '#e4e1dc'); }
        box(sg * 6 - 0.65, sg * 6 + 0.65, -9.8, -2.4, MOD / 2 - 0.65, MOD / 2 + 0.65, '#a7adb5');
        parts.push(part(new T.CylinderGeometry(1.9, 2.2, 0.08, 16), '#eef7f8', sg * 6, LAKE_WY + 0.03, -MOD / 2)); // foam ring around the pier
      }
      box(-7.4, 7.4, -2.4, -1.2, MOD / 2 - 0.9, MOD / 2 + 0.9, '#9ea4ac');
      const m = new T.InstancedMesh(merge(parts), lakeDeckMat, LAKE_NMOD); m.frustumCulled = false; m.count = 0; lakeGroup.add(m); return m;
    })();
    // water: one big plane that follows the camera (the grass has a hole over the water stretch), ripples scroll slowly
    const lakeTex = rippleTex.clone(); lakeTex.needsUpdate = true;
    const lakeWaterMat = new T.MeshStandardMaterial({ color: 0x1f78a0, map: lakeTex, roughness: 0.12, metalness: 0.3, envMapIntensity: 1.4 });
    // v17: wave-normal shading (sun glints through the scene's sun/moon light), sky tint at grazing angles, darker deep water with distance
    const lakeU = { t: { value: 0 }, sky: { value: new T.Color(0xcfe9fb) } };
    lakeWaterMat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = lakeU.t; sh.uniforms.uSky = lakeU.sky;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uT; uniform vec3 uSky; varying vec3 vWP;
        vec2 lkGrad(vec2 p, float t) {
          vec2 g = vec2(0.0);
          g += vec2(0.80, 0.60) * cos(dot(p, vec2(0.80, 0.60)) * 0.55 + t * 1.30) * 0.30;
          g += vec2(-0.55, 0.83) * cos(dot(p, vec2(-0.55, 0.83)) * 1.10 + t * 1.90) * 0.17;
          g += vec2(0.95, -0.30) * cos(dot(p, vec2(0.95, -0.30)) * 2.30 + t * 2.60) * 0.09;
          g += vec2(-0.30, -0.95) * cos(dot(p, vec2(-0.30, -0.95)) * 4.70 + t * 3.40) * 0.045;
          return g;
        }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float dd = length(vViewPosition); float fade = 1.0 - smoothstep(180.0, 700.0, dd) * 0.75;
          vec2 g = lkGrad(vWP.xz, uT) * fade;
          vec3 nw = normalize(vec3(-g.x, 1.0, -g.y));
          normal = normalize(mix(normal, normalize((viewMatrix * vec4(nw, 0.0)).xyz), 0.9)); }`)
        .replace('#include <fog_fragment>', `{ float dd = length(vViewPosition); vec3 vd = normalize(vViewPosition);
          float fr = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 3.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.55, 0.72, 0.85), smoothstep(90.0, 650.0, dd) * 0.55);
          gl_FragColor.rgb += uSky * fr * 0.38; }
        #include <fog_fragment>`);
    };
    const lakeWater = (() => {
      const g = new T.PlaneGeometry(2600, 2600, 2, Math.round(2600 / 6)); g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 9, pos.getZ(i) / 9);
      const m = new T.Mesh(g, lakeWaterMat); m.position.y = LAKE_WY; m.frustumCulled = false; lakeGroup.add(m); return m;
    })();
    // shore: slopes at both ends of the water stretch, following the wobbling edge of the grass hole (shoreOff)
    const shoreMat = vcMat({ side: T.DoubleSide });
    const shoreGeo = (() => {
      const XS = []; for (let x = 0; x <= 400; x += x < 16 ? 8 : 10) XS.push(x); for (let x = 440; x <= 1300; x += 40) XS.push(x);
      const full = []; for (let i = XS.length - 1; i > 0; i--) full.push(-XS[i]); for (const x of XS) full.push(x);
      const TT = [-2, 0, 3, 6, 10, 14, 19], P = [], C = [], I = [], cg = col('#5a9a3c'), cs = col('#dac690'), cw = col('#7e8a72'), tc = new T.Color();
      for (const x of full) {
        const off = shoreOff(Math.abs(x));
        for (const t of TT) {
          const y = t <= 0 ? -0.1 : -0.1 + (LAKE_WY - 0.4 + 0.1) * smooth01(0, 16, t);
          P.push(x, y, -(off + t));
          if (t === 3) tc.set('#eef6f4'); else if (t <= 0) tc.copy(cg); else if (t < 5) tc.copy(cg).lerp(cs, t / 5); else if (t < 11) tc.copy(cs).lerp(cw, (t - 5) / 6); else tc.copy(cw);
          const jit = 0.94 + hash(x * 0.37 + t) * 0.12; C.push(tc.r * jit, tc.g * jit, tc.b * jit);
        }
      }
      const NT = TT.length;
      for (let c = 0; c < full.length - 1; c++) for (let r = 0; r < NT - 1; r++) { const a = c * NT + r, b = a + 1, d = a + NT, e = d + 1; I.push(a, b, e, a, e, d); }
      return indexed(P, C, I, true);
    })();
    const shores = [new T.Mesh(shoreGeo, shoreMat), new T.Mesh(shoreGeo, shoreMat)];
    for (const m of shores) { m.frustumCulled = false; lakeGroup.add(m); }
    // islands (two shapes, scattered over the water, recycled by segment)
    const islandMat = vcMat({ side: T.DoubleSide });
    const buildIsland = (v) => {
      const RN = 6, AN = 16, R = 38, H = 7 + v * 5, P = [0, H, 0], C = [], I = [], tc = new T.Color();
      const cols = ['#4a8a3a', '#5f9a40', '#7aa24c', '#dcc992', '#b0a37a', '#8a8f78'].map((h) => col(h));
      C.push(cols[0].r, cols[0].g, cols[0].b);
      const yAt = (r) => (r >= RN ? -2.2 : H * (1 - Math.pow(r / RN, 2.3)) - 0.2);
      for (let r = 1; r <= RN; r++) for (let a = 0; a < AN; a++) {
        const ang = a / AN * 6.2832, rad = R * (r / RN) * (1 + (hash(v * 7.7 + a * 3.3 + r * 1.1) - 0.5) * 0.3 * (r / RN)), y = yAt(r) + (r < RN ? (hash(v * 3.1 + a * 2.7 + r) - 0.5) * 0.8 : 0);
        P.push(Math.cos(ang) * rad, y, Math.sin(ang) * rad); tc.copy(cols[Math.min(5, r - 1 + (r > 2 ? 1 : 0))]).multiplyScalar(0.92 + hash(a * 1.3 + r * 0.7 + v) * 0.16); C.push(tc.r, tc.g, tc.b);
      }
      for (let a = 0; a < AN; a++) I.push(0, 1 + (a + 1) % AN, 1 + a);
      for (let r = 1; r < RN; r++) for (let a = 0; a < AN; a++) { const a0 = 1 + (r - 1) * AN + a, a1 = 1 + (r - 1) * AN + (a + 1) % AN, b0 = a0 + AN, b1 = a1 + AN; I.push(a0, a1, b1, a0, b1, b0); }
      const body = indexed(P, C, I, true).toNonIndexed(), trees = [];
      for (let i = 0; i < 9; i++) {
        const r = 0.8 + hash(v * 5.1 + i * 2.3) * 2.0, ang = hash(v * 8.3 + i * 4.1) * 6.283, rad = R * r / RN, y = yAt(r), s = 0.8 + hash(i * 3.3 + v) * 0.7;
        trees.push(part(new T.CylinderGeometry(0.25, 0.35, 1.6 * s, 6), '#6b4a2a', Math.cos(ang) * rad, y + 0.8 * s, Math.sin(ang) * rad));
        trees.push(part(new T.ConeGeometry(1.9 * s, 6.2 * s, 7), i % 3 ? '#2f6f3c' : '#3a8444', Math.cos(ang) * rad, y + 4.4 * s, Math.sin(ang) * rad));
      }
      const rocks = [];
      for (let i = 0; i < 6; i++) { const ang = hash(v * 9.1 + i * 3.7) * 6.283, rad = R * (0.85 + hash(i * 2.9 + v) * 0.3), sz = 0.8 + hash(i * 4.4 + v) * 1.3; rocks.push(part(new T.DodecahedronGeometry(sz, 0).scale(1.2, 0.8, 1), i % 2 ? '#8d9199' : '#a2a69f', Math.cos(ang) * rad, -0.2 + sz * 0.3, Math.sin(ang) * rad)); }
      return merge([body, ...trees, ...rocks]);
    };
    const islandMeshes = [0, 1].map((v) => { const m = new T.InstancedMesh(buildIsland(v), islandMat, 14); m.frustumCulled = false; m.count = 0; lakeGroup.add(m); return m; });
    // far shore: a low hazy bank riding with the camera in front of the skyline, so the city stands on land across the water
    const shoreFarMat = basicVC({ fog: false });
    const shoreFar = (() => {
      // three layers across the water: a dark tree line, low hills, and hazy mountains behind them
      const grp = new T.Group(); const hz = col('#c3d6e4');
      const layer = (zc, hBase, hAmp, step, hazeK, cTop, cLow, trees, seed) => {
        const P = [], C = [], I = [], top = col(cTop).lerp(hz, hazeK), low = col(cLow).lerp(hz, hazeK * 0.9), deep = col('#7fa6ad').lerp(hz, hazeK * 0.5);
        for (let i = 0; i <= Math.round(1800 / step); i++) {
          const x = -900 + i * step, h = hBase + hAmp * Math.pow(Math.abs(Math.sin(x * 0.0071 + seed)), 1.2) + hAmp * 0.55 * Math.pow(Math.sin(x * 0.019 + seed * 2.3), 2) + hash(i * 1.7 + seed) * (trees ? 3.2 : 1.0), base = P.length / 3;
          P.push(x, h, zc, x, 0.4, zc, x, -8, zc); C.push(top.r, top.g, top.b, low.r, low.g, low.b, deep.r, deep.g, deep.b);
          if (i > 0) { const q = base - 3; I.push(q, q + 3, q + 1, q + 1, q + 3, q + 4, q + 1, q + 4, q + 2, q + 2, q + 4, q + 5); }
        }
        const m = new T.Mesh(indexed(P, C, I, false), shoreFarMat); m.frustumCulled = false; grp.add(m);
      };
      layer(-760, 26, 42, 24, 0.62, '#6d8aa0', '#9fb4c2', false, 2.1);   // hazy mountains
      layer(-560, 9, 20, 16, 0.4, '#5f8a66', '#cbbf8c', false, 0.7);     // low hills
      layer(-380, 2.6, 9, 6, 0.18, '#3f7a4c', '#cbbf8c', true, 0.3);     // shore + tree line
      grp.visible = false; backdrop.add(grp); noBend(shoreFarMat); return grp;
    })();
    let lakeM0 = Infinity, lakeM1 = -Infinity, lakeNMod = 0, lakeBase = null, islBase = null;
    const placeLake = (lake) => {
      if (!lake) { trWob.value = 0; lakeNMod = 0; lakeM0 = Infinity; lakeM1 = -Infinity; return; }
      lakeM0 = lake.z0 * R3D_ZS; lakeM1 = lake.z1 * R3D_ZS; lakeNMod = Math.round((lakeM1 - lakeM0) / LAKE_MOD);
      brM0 = lakeM0; brM1 = lakeM1; trGap.value.set(-lakeM1, -lakeM0); trWob.value = 1;
      shores[0].position.z = -lakeM0; shores[0].scale.z = 1;
      shores[1].position.z = -lakeM1; shores[1].scale.z = -1;
    };
    const layoutLake = (camM) => {
      const i0 = Math.max(0, Math.floor((camM - LAKE_BEHIND - lakeM0) / LAKE_MOD)), i1 = Math.min(lakeNMod - 1, Math.floor((camM + LAKE_AHEAD - lakeM0) / LAKE_MOD));
      let n = 0;
      for (let i = i0; i <= i1 && n < LAKE_NMOD; i++) lakeDeck.setMatrixAt(n++, m4.compose(v3a.set(0, 0, -(lakeM0 + i * LAKE_MOD)), q0, v3b.set(1, 1, 1)));
      lakeDeck.count = n; lakeDeck.instanceMatrix.needsUpdate = true;
    };
    const ISL_SEG = 190;
    const layoutIslands = (camM) => {
      const s0 = Math.floor((camM - 120) / ISL_SEG), s1 = Math.floor((camM + 680) / ISL_SEG), n = [0, 0];
      for (let s = s0; s <= s1; s++) for (const side of [-1, 1]) {
        if (hash(s * 3.1 + side * 7.7) > 0.7) continue;
        const zc = s * ISL_SEG + hash(s * 9.7 + side * 2.1) * 150;
        if (zc < lakeM0 + 40 || zc > lakeM1 - 40) continue;
        const v = hash(s * 1.9 + side) < 0.5 ? 0 : 1, sc = 0.4 + hash(s * 5.3 + side) * 1.0;
        if (n[v] >= 14) continue;
        qy.setFromAxisAngle(upY, hash(s * 2.3 + side * 5) * 6.28);
        islandMeshes[v].setMatrixAt(n[v]++, m4.compose(v3a.set(side * Math.max(30 + sc * 46, 50 + hash(s * 5.3 + side * 3) * 420), LAKE_WY, -zc), qy, v3b.set(sc, sc * (0.8 + hash(s * 6.1) * 0.5), sc)));
      }
      islandMeshes.forEach((m, v) => { m.count = n[v]; m.instanceMatrix.needsUpdate = true; });
    };

    // ---------- desert: cacti, rocks, dry bushes, dunes, mesas ----------
    const desertGroup = new T.Group(); desertGroup.visible = false; scene.add(desertGroup);
    const cactusMat = vcMat();
    const cactusGeos = (() => {
      const sph = (r, sx, sy, sz) => new T.SphereGeometry(r, 8, 6).scale(sx, sy, sz), cyl = (r, h) => new T.CylinderGeometry(r, r, h, 8);
      const saguaro = merge([
        part(cyl(0.36, 4.2), '#3f7a3c', 0, 2.1, 0), part(sph(0.36, 1, 1, 1), '#4a8a44', 0, 4.2, 0),
        part(cyl(0.22, 1.0), '#437f40', 0.62, 1.8, 0, 0, 0, Math.PI / 2), part(cyl(0.22, 1.5), '#4a8a44', 1.12, 2.55, 0), part(sph(0.22, 1, 1, 1), '#4f9048', 1.12, 3.3, 0),
        part(cyl(0.2, 0.9), '#437f40', -0.55, 2.6, 0, 0, 0, Math.PI / 2), part(cyl(0.2, 1.1), '#4a8a44', -1.0, 3.15, 0), part(sph(0.2, 1, 1, 1), '#4f9048', -1.0, 3.7, 0)
      ]);
      const barrel = merge([part(sph(0.55, 1, 0.9, 1), '#4a8a44', 0, 0.5, 0), part(sph(0.5, 1, 0.5, 1), '#3f7a3c', 0, 0.9, 0), part(sph(0.12, 1, 0.7, 1), '#e8628c', 0, 1.18, 0)]);
      const pear = merge([
        part(sph(0.55, 1, 1.15, 0.2), '#5a8f46', 0, 0.55, 0), part(sph(0.5, 1, 1.15, 0.2), '#64994c', 0.42, 1.2, 0, 0, 0, -0.45), part(sph(0.46, 1, 1.15, 0.2), '#5a8f46', -0.38, 1.15, 0, 0, 0, 0.5),
        part(sph(0.12, 1, 1, 1), '#c43a52', 0.75, 1.75, 0.05), part(sph(0.12, 1, 1, 1), '#c43a52', -0.7, 1.65, 0.05)
      ]);
      return [saguaro, barrel, pear];
    })();
    const CACTUS_CAP = FLORA_ROWS * 3;
    const cactusMeshes = cactusGeos.map((g) => { const m = new T.InstancedMesh(g, cactusMat, CACTUS_CAP); m.frustumCulled = false; m.count = 0; desertGroup.add(m); return m; });
    const desertRocks = new T.InstancedMesh(rockGeo, rockMat, ROCK_CAP); desertRocks.frustumCulled = false; desertRocks.count = 0; desertGroup.add(desertRocks);
    const duneMat = vcMat();
    const duneGeo = (() => {
      const g = new T.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position, c = new Float32Array(p.count * 3), lo = col('#cfa468'), hi = col('#ecca90'), tc = new T.Color();
      for (let i = 0; i < p.count; i++) { tc.copy(lo).lerp(hi, Math.min(1, p.getY(i) * 1.3)); c[i * 3] = tc.r; c[i * 3 + 1] = tc.g; c[i * 3 + 2] = tc.b; }
      g.setAttribute('color', new T.BufferAttribute(c, 3)); return g;
    })();
    const dunes = new T.InstancedMesh(duneGeo, duneMat, FLORA_ROWS * 2); dunes.frustumCulled = false; dunes.count = 0; desertGroup.add(dunes);
    const DRY = ['#8c7a45', '#a08d52', '#6d6a3a', '#b59a5c'].map((h) => col(h)), SANDROCK = ['#b88a5c', '#a06f48', '#c9a070', '#8f6a4a', '#d3b184'].map((h) => col(h));
    const layoutFloraDesert = (base) => {
      for (const k in species) species[k].mesh.count = 0;
      for (const kit of treeKits) for (const im of kit.parts) im.count = 0;
      for (const kit of grassKits) kit.im.count = 0;
      tufts.count = 0; treeShade.count = 0; trunks.count = cones.count = dots.count = 0;
      const cn = [0, 0, 0]; let rn = 0, bi = 0, dn = 0;
      const segLen = FLORA_SEG * R3D_ZS;
      for (let k = 0; k < FLORA_ROWS; k++) {
        const s = base + k - 2, z = -(s * FLORA_SEG) * R3D_ZS;
        for (const side of [-1, 1]) {
          const n = s * 2 + (side > 0 ? 1 : 0), r = (q) => hash(n * q);
          const cactus = (x, zz, sc) => {
            if (clearAt(zz, Math.abs(x))) return;
            const v = r(5.3 + x) < 0.4 ? 0 : (r(5.9 + x) < 0.6 ? 1 : 2);
            if (cn[v] >= CACTUS_CAP) return;
            qy.setFromAxisAngle(upY, r(6.7 + x) * 6.28); cactusMeshes[v].setMatrixAt(cn[v]++, m4.compose(v3a.set(x, -0.03, zz), qy, v3b.set(sc, sc, sc)));
          };
          if (r(3.1) < 0.5) cactus(side * (RAIL_X + 3.4 + r(3.7) * 14), z - segLen * r(4.1), 0.8 + r(6.1) * 0.7);
          if (r(7.7) < 0.35) cactus(side * (RAIL_X + 18 + r(8.3) * 40), z - segLen * r(8.9), 1.0 + r(9.5) * 0.9);
          const rock = (x, zz, sc, flat) => {
            if (clearAt(zz, Math.abs(x)) || rn >= ROCK_CAP) return;
            qy.setFromAxisAngle(upY, r(21.7 + x) * 6.28);
            desertRocks.setMatrixAt(rn, m4.compose(v3a.set(x, sc * 0.3 - 0.08, zz), qy, v3b.set(sc * 1.25, sc * flat, sc)));
            desertRocks.setColorAt(rn++, SANDROCK[Math.floor(r(22.3 + x) * 5)]);
          };
          if (r(9.1) < 0.55) rock(side * (RAIL_X + 1.5 + r(9.7) * 10), z - segLen * r(10.3), 0.4 + r(10.9) * 1.1, 0.8);
          if (r(11.3) < 0.14) rock(side * (RAIL_X + 10 + r(12.1) * 30), z - segLen * r(12.7), 2.2 + r(13.3) * 2.6, 1.15);
          if (r(14.1) < 0.7 && bi + 3 <= FLORA_ROWS * 16) { // dry bushes
            const bx = side * (RAIL_X + 1.2 + r(14.7) * 18), bz = z - segLen * r(15.3), bs = 0.35 + r(15.9) * 0.45;
            if (!clearAt(bz, Math.abs(bx))) for (let f = 0; f < 3; f++) { const fs = bs * (f ? 0.6 + hash(n * 7.1 + f) * 0.3 : 1); put(blobs, bi, bx + (f ? (f - 1.5) * bs * 0.9 : 0), fs * 0.55, bz + (f ? hash(n * 3.3 + f) * bs : 0), fs * 1.2, fs * 0.8, fs * 1.1); blobs.setColorAt(bi++, DRY[Math.floor(hash(n * 9.9 + f) * 4)]); }
          }
          if (!(s & 1) && r(16.3) < 0.7 && dn < FLORA_ROWS * 2) { // far dunes
            const sx = 30 + r(17.5) * 55, dx = side * (sx + 24 + r(16.9) * 140); // the whole mound stays at least 24 m from the road
            if (!clearAt(z, Math.abs(dx) - sx)) { qy.setFromAxisAngle(upY, (r(18.1) - 0.5) * 0.6); dunes.setMatrixAt(dn++, m4.compose(v3a.set(dx, -0.4, z - segLen * r(18.7)), qy, v3b.set(sx, 2.5 + r(19.3) * 6, sx * (0.5 + r(19.9) * 0.4)))); }
          }
        }
      }
      cactusMeshes.forEach((m, v) => { m.count = cn[v]; m.instanceMatrix.needsUpdate = true; });
      desertRocks.count = rn; desertRocks.instanceMatrix.needsUpdate = true; if (desertRocks.instanceColor) desertRocks.instanceColor.needsUpdate = true;
      dunes.count = dn; dunes.instanceMatrix.needsUpdate = true;
      blobs.count = bi; blobs.instanceMatrix.needsUpdate = true; if (blobs.instanceColor) blobs.instanceColor.needsUpdate = true;
    };
    // mesas and buttes on the horizon (three hazy layers, strata colours)
    const mesaMat = basicVC({ fog: false });
    const mesaMesh = (() => {
      const P = [], C = [], I = [], hz = col('#ecc89a'), STR = ['#b87a4e', '#c9845a', '#b0623a', '#d4915f', '#a8552f', '#d79a68'].map((h) => col(h)), tc = new T.Color();
      let g = 0;
      [{ z: -520, hm: 1, haze: 0.18 }, { z: -650, hm: 1.25, haze: 0.38 }, { z: -790, hm: 1.5, haze: 0.56 }].forEach((L, li) => {
        for (let m = 0; m < 6; m++) {
          const ix = li * 9 + m, w = 70 + hash(ix * 2.3) * 140, h = (26 + hash(ix * 3.7) * 70) * L.hm, cx = -520 + (m + hash(ix * 5.1) * 0.7) * 175 + li * 40;
          const ys = [-8, 0.12 * h, 0.3 * h, 0.5 * h, 0.72 * h, 0.9 * h, h], hw = [0.9, 0.62, 0.5, 0.48, 0.47, 0.46, 0.4];
          for (let j = 0; j < 7; j++) for (const sg of [-1, 1]) {
            P.push(cx + sg * w * hw[j] * (1 + (hash(ix * 7.7 + j + sg) - 0.5) * 0.05), ys[j], L.z);
            tc.copy(STR[(j + m) % 6]).lerp(hz, L.haze + (j === 0 ? 0.1 : 0)).multiplyScalar(0.92 + j * 0.03); C.push(tc.r, tc.g, tc.b);
          }
          for (let j = 0; j < 6; j++) { const a = g + j * 2, b = a + 1, c = a + 2, d = a + 3; I.push(a, b, d, a, d, c); }
          g += 14;
        }
      });
      const m = new T.Mesh(indexed(P, C, I, false), mesaMat); m.frustumCulled = false; m.visible = false; backdrop.add(m); noBend(mesaMat); return m;
    })();

    // ---------- per-map switches ----------
    const MAPS = {
      highway:  { ground: null, fog: [120, 1900], haze: null, hazeK: 0 },
      city:     { ground: null, fog: [100, 1100], haze: null, hazeK: 0 },
      mountain: { ground: ['#5a8a43', '#477a37'], fog: [60, 1000], haze: '#a9bdd0', hazeK: 0.4 },
      lake:     { ground: null, fog: [100, 1300], haze: '#bfe0ee', hazeK: 0.3 },
      desert:   { ground: ['#dcb77c', '#c69a5e'], sand: true, fog: [110, 1500], haze: '#efca94', hazeK: 0.5 }
    };
    const GTINT = { rain: { m: [0.62, 0.68, 0.74] }, snow: { mix: '#dfe8ee', k: 0.2 }, night: { m: [0.26, 0.31, 0.44] }, sunset: { m: [1.1, 0.8, 0.6] } };
    let mapApplied = '', cityBase = null;
    const applyMap = (key) => {
      mapApplied = key; curMap = key; groundKind = MAPS[key].sand ? 'sand' : 'grass';
      const sky = key === 'highway' || key === 'city' || key === 'lake';
      for (const o of skylineObjs) o.visible = sky;
      mtGroup.visible = ridgeMesh.visible = key === 'mountain';
      desertGroup.visible = mesaMesh.visible = key === 'desert';
      lakeGroup.visible = shoreFar.visible = key === 'lake';
      lamps.visible = key !== 'mountain' && key !== 'desert';
      if (key !== 'lake') { trWob.value = 0; lakeNMod = 0; }
      cityBase = null; cliffBase = null; stoneBase = null; lakeBase = null; islBase = null;
      floraBase = null; lampBase = null; weatherApplied = null;
    };
    // everything that depends on this race's route (new trackObjects, another map, another race length)
    const setRouteScenery = (RT) => {
      cliffSide = RT.cliff;
      setCityRange(RT.city); cityBase = null;
      brM0 = Infinity; brM1 = -Infinity; placeBridge(RT.bridge); placeLake(RT.lake);
      buildTunnel(RT.tunnel, RT.map);
      valley.scale.x = -cliffSide;
      trCut.value.set(-cliffSide, RAIL_X + 0.45, RT.map === 'mountain' ? 1 : 0);
      cliffBase = null; stoneBase = null; lakeBase = null; islBase = null; floraBase = null; lampBase = null;
    };

    const CAR_L = 4.5;
    const buildCarBody = () => {
      // station: [t (0 tail → 1 nose), half-width, floor y, widest-point y, shoulder y, cabin-base half-width, roof y, roof half-width]
      const S = [
        [0.000, 0.88, 0.38, 0.56, 0.78, 0.60, 0.80, 0.42],
        [0.030, 0.95, 0.25, 0.52, 0.84, 0.63, 0.86, 0.44],
        [0.100, 0.985, 0.19, 0.50, 0.87, 0.64, 0.90, 0.45],
        [0.200, 0.985, 0.18, 0.50, 0.86, 0.65, 0.955, 0.46],
        [0.300, 0.96, 0.18, 0.48, 0.81, 0.66, 1.01, 0.47],
        [0.400, 0.94, 0.18, 0.46, 0.77, 0.67, 1.06, 0.48],
        [0.480, 0.93, 0.18, 0.46, 0.75, 0.68, 1.08, 0.49],
        [0.570, 0.93, 0.18, 0.46, 0.73, 0.68, 1.05, 0.49],
        [0.660, 0.945, 0.18, 0.46, 0.71, 0.68, 0.88, 0.52],
        [0.735, 0.955, 0.18, 0.46, 0.70, 0.66, 0.725, 0.48],
        [0.820, 0.965, 0.18, 0.45, 0.67, 0.60, 0.68, 0.40],
        [0.900, 0.94, 0.19, 0.40, 0.57, 0.54, 0.58, 0.36],
        [0.960, 0.87, 0.21, 0.34, 0.45, 0.48, 0.46, 0.30],
        [1.000, 0.74, 0.26, 0.31, 0.36, 0.40, 0.37, 0.24]
      ];
      const RING = 15, pos = [];
      for (const [t, w, yb, ys, yh, wc, yr, wr] of S) {
        const z = (0.5 - t) * CAR_L, crown = 0.025;
        const half = [[0, yb], [w * 0.9, yb], [w, ys], [w * 0.96, yh], [wc, yh + (yr - yh) * 0.1 + 0.005], [wr, yr], [0.17, yr + crown], [0, yr + crown]];
        for (let k = 0; k < 8; k++) pos.push(half[k][0], half[k][1], z);
        for (let k = 6; k >= 0; k--) pos.push(-half[k][0], half[k][1], z);
      }
      const idx = [[], [], [], []]; // paint, glass, stripe, dark
      const matOf = (seg, e) => {
        const glassSeg = (seg >= 2 && seg <= 4) || seg === 7 || seg === 8; // fastback rear screen + windscreen
        if (e === 0) return 3;
        if (e === 4) return (seg >= 4 && seg <= 8) ? 1 : 0;
        if (e === 5) return glassSeg ? 1 : 0;
        if (e === 6) return glassSeg ? 1 : 2;
        return 0;
      };
      const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      const tri = (list, a, b, c, cx, cy, cz) => { // orient every triangle away from the body axis
        const A = P(a), B = P(b), Cc = P(c);
        const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = Cc[0] - A[0], vy = Cc[1] - A[1], vz = Cc[2] - A[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const mx = (A[0] + B[0] + Cc[0]) / 3 - cx, my = (A[1] + B[1] + Cc[1]) / 3 - cy, mz = (A[2] + B[2] + Cc[2]) / 3 - cz;
        if (nx * mx + ny * my + nz * mz >= 0) list.push(a, b, c); else list.push(a, c, b);
      };
      for (let s = 0; s < S.length - 1; s++) {
        const zc = (0.5 - (S[s][0] + S[s + 1][0]) / 2) * CAR_L;
        for (let m = 0; m < RING - 1; m++) {
          const e = m < 7 ? m : 13 - m, list = idx[matOf(s, e)];
          const a = s * RING + m, b = a + 1, c = a + RING, d = c + 1;
          tri(list, a, b, d, 0, 0.55, zc); tri(list, a, d, c, 0, 0.55, zc);
        }
      }
      for (const s of [0, S.length - 1]) { // flat end caps on their own vertices
        const base = pos.length / 3, z = pos[s * RING * 3 + 2];
        for (let m = 0; m < RING; m++) pos.push(pos[(s * RING + m) * 3], pos[(s * RING + m) * 3 + 1], z);
        pos.push(0, 0.55, z);
        for (let m = 0; m < RING - 1; m++) tri(idx[0], base + m, base + m + 1, base + RING, 0, 0.55, 0);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      let all = [], o = 0;
      idx.forEach((list, mi) => { g.addGroup(o, list.length, mi); all = all.concat(list); o += list.length; });
      g.setIndex(all);
      g.computeVertexNormals();
      return g;
    };
    const carBodyGeo = buildCarBody();
    const glassMat = new T.MeshStandardMaterial({ color: 0x0b1320, metalness: 0.5, roughness: 0.08, envMap, envMapIntensity: 1.5 });
    const darkMat = new T.MeshLambertMaterial({ color: 0x14171c });
    const wheelGeo = (() => {
      const cyl = (r, w, seg) => { const g = new T.CylinderGeometry(r, r, w, seg); g.rotateZ(Math.PI / 2); return g; };
      const parts = [part(cyl(0.345, 0.26, 18), '#17191d'), part(cyl(0.22, 0.27, 14), '#8a919b'), part(cyl(0.07, 0.285, 8), '#23262b')];
      for (let i = 0; i < 5; i++) parts.push(part(new T.BoxGeometry(0.275, 0.05, 0.4), '#7d848e', 0, 0, 0, i * Math.PI / 5, 0, 0));
      return merge(parts);
    })();
    const carTrimGeo = merge([
      part(new T.BoxGeometry(1.5, 0.24, 0.06), '#0d0f13', 0, 0.62, CAR_L / 2 + 0.005),      // tail fascia
      part(new T.BoxGeometry(1.36, 0.17, 0.2), '#0d0f13', 0, 0.3, CAR_L / 2 - 0.06),        // diffuser
      part(new T.BoxGeometry(0.46, 0.13, 0.03), '#e9edf2', 0, 0.44, CAR_L / 2 + 0.03),      // plate
      part(new T.CylinderGeometry(0.055, 0.055, 0.14, 10), '#b9c0c9', -0.2, 0.3, CAR_L / 2 + 0.05, Math.PI / 2, 0, 0),
      part(new T.CylinderGeometry(0.055, 0.055, 0.14, 10), '#b9c0c9', 0.2, 0.3, CAR_L / 2 + 0.05, Math.PI / 2, 0, 0),
      part(new T.BoxGeometry(0.05, 0.2, 0.5), '#0d0f13', -0.972, 0.52, 0.72), part(new T.BoxGeometry(0.05, 0.2, 0.5), '#0d0f13', 0.972, 0.52, 0.72), // side intakes
      part(new T.BoxGeometry(0.34, 0.035, 0.16), '#f2f6fb', -0.6, 0.6, -1.86, 0.3, 0.25, 0), part(new T.BoxGeometry(0.34, 0.035, 0.16), '#f2f6fb', 0.6, 0.6, -1.86, 0.3, -0.25, 0) // headlights
    ]);
    const tailLightGeo = (() => {
      const disc = (x) => { const g = new T.CylinderGeometry(0.088, 0.088, 0.05, 14); g.rotateX(Math.PI / 2); g.translate(x, 0.63, CAR_L / 2 + 0.035); return g; };
      return merge([-0.62, -0.42, 0.42, 0.62].map((x) => part(disc(x), '#ffffff')));
    })();
    const shadowC = makeCanvas(64, 128);
    {
      const g = shadowC.getContext('2d'), gr = g.createRadialGradient(32, 64, 6, 32, 64, 32);
      gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.translate(0, 64); g.scale(1, 2); g.translate(0, -64); g.fillStyle = gr; g.fillRect(0, 0, 64, 128); g.restore();
    }
    const shadowMat = new T.MeshBasicMaterial({ map: canvasTex(shadowC), transparent: true, depthWrite: false });
    const shadowGeo = flatOnRoad(2.9, 6.0);
    // very soft penumbra under every car (bigger than the contact shadow, pushed away from the sun)
    const penC = makeCanvas(64, 128);
    {
      const g = penC.getContext('2d'), gr = g.createRadialGradient(32, 64, 2, 32, 64, 32);
      for (let i = 0; i <= 8; i++) { const t = i / 8; gr.addColorStop(t, 'rgba(0,0,0,' + (Math.pow(Math.cos(t * Math.PI / 2), 2) * 0.95).toFixed(3) + ')'); }
      g.save(); g.translate(0, 64); g.scale(1, 2); g.translate(0, -64); g.fillStyle = gr; g.fillRect(0, 0, 64, 128); g.restore();
    }
    const penGeo = flatOnRoad(2.9 * 1.5, 5.9 * 1.5);
    const penMat = new T.MeshBasicMaterial({ map: canvasTex(penC), transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const newPen = () => { const m = new T.Mesh(penGeo, penMat); m.position.set(-0.55, 0.018, -0.35); m.renderOrder = 2; return m; };
    const flameGeo = new T.ConeGeometry(0.075, 1, 8); flameGeo.rotateX(Math.PI / 2); flameGeo.translate(0, 0, 0.5);

    const tagTexCache = {};
    const tagTex = (label, isYou, badge) => {
      const key = label + '|' + isYou + '|' + badge;
      if (tagTexCache[key]) return tagTexCache[key];
      const c = makeCanvas(384, 128), g = c.getContext('2d');
      g.fillStyle = isYou ? 'rgba(22,163,74,0.97)' : 'rgba(8,13,24,0.93)';
      g.strokeStyle = isYou ? '#bbf7d0' : badge; g.lineWidth = isYou ? 7 : 6;
      rr(g, 6, 6, 372, 92, 24); g.fill(); g.stroke();
      if (isYou) { g.fillStyle = '#4ade80'; g.beginPath(); g.moveTo(170, 100); g.lineTo(214, 100); g.lineTo(192, 126); g.closePath(); g.fill(); }
      g.fillStyle = badge; g.beginPath(); g.arc(58, 52, 25, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#ffffff'; g.font = '900 italic 50px "Segoe UI", system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(label, 222, 55, 250);
      return (tagTexCache[key] = canvasTex(c));
    };

    const makeRig = () => {
      const rig = { group: new T.Group(), tilt: new T.Group(), wheels: [], themeKey: null, tagKey: null, yaw: 0 };
      rig.paint = new T.MeshStandardMaterial({ color: 0xff0000, metalness: 0.42, roughness: 0.24, envMap, envMapIntensity: 1.35 });
      rig.stripe = new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.35, envMap, envMapIntensity: 0.9 });
      rig.body = new T.Mesh(carBodyGeo, [rig.paint, glassMat, rig.stripe, darkMat]);
      rig.tilt.add(rig.body, new T.Mesh(carTrimGeo, matVC));
      rig.tailMat = new T.MeshBasicMaterial({ color: 0xc81e1e });
      rig.tilt.add(new T.Mesh(tailLightGeo, rig.tailMat));
      const wing = new T.Mesh(new T.BoxGeometry(1.62, 0.045, 0.24), rig.paint); wing.position.set(0, 0.93, CAR_L / 2 - 0.1); wing.rotation.x = 0.22;
      rig.tilt.add(wing);
      for (const sx of [-1, 1]) {
        const mir = new T.Mesh(new T.BoxGeometry(0.2, 0.09, 0.13), rig.paint); mir.position.set(sx * 0.93, 0.86, -0.62); rig.tilt.add(mir);
        for (const [wz, sc] of [[1.36, 1.05], [-1.36, 1]]) {
          const w = new T.Mesh(wheelGeo, matVC); w.position.set(sx * 0.86, 0.345 * sc, wz); w.scale.setScalar(sc);
          rig.group.add(w); rig.wheels.push(w);
        }
      }
      rig.flameMat = new T.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
      rig.flames = [-0.2, 0.2].map((x) => { const f = new T.Mesh(flameGeo, rig.flameMat); f.position.set(x, 0.3, CAR_L / 2 + 0.1); f.visible = false; rig.tilt.add(f); return f; });
      rig.shadow = new T.Mesh(shadowGeo, shadowMat); rig.shadow.position.y = 0.02; rig.shadow.renderOrder = 3;
      rig.tag = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false }));
      rig.tag.center.set(0.5, 0); rig.tag.renderOrder = 20;
      rig.setBrake = (on) => { rig.tailMat.color.set(on ? 0xff3b30 : 0xa01818); };
      rig.pen = newPen();
      rig.group.add(rig.tilt, rig.shadow, rig.pen);
      scene.add(rig.group, rig.tag);
      return rig;
    };
    // 2020 Ferrari F8 Tributo (assets/game3d/car_f8.glb, prepared by tools/build-car.mjs: metres, nose to -z,
    // wheels on y = 0; parts: body, wheel0-3, interior, interiorLo, steer). There is one template: each car is a
    // clone that shares the geometry, the textures and every material except its own body paint.
    // See assets/game3d/CREDITS.md.
    const carKit = carModel ? (() => {
      const fs = new T.Box3().setFromObject(carModel).getSize(new T.Vector3());
      const K = 4.9 / fs.z; // the same length on the road as the previous car, so the framing is unchanged
      carModel.scale.setScalar(K);
      const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const glass = new T.MeshStandardMaterial({ name: 'Window', color: 0x0a0f16, metalness: 0.9, roughness: 0.05, envMapIntensity: 1.8, transparent: true, opacity: 0.4, depthWrite: false });
      // from the driver's seat the same panes are almost clear
      const glassIn = new T.MeshStandardMaterial({ name: 'Window', color: 0xbfd4e6, metalness: 0, roughness: 0.1, envMapIntensity: 0.25, transparent: true, opacity: 0.06, depthWrite: false, side: T.DoubleSide });
      const lens = new T.MeshStandardMaterial({ name: 'bodyRED_GLASS', color: 0x8a0808, emissive: 0xff1a10, emissiveIntensity: 0.5, metalness: 0.2, roughness: 0.15, envMapIntensity: 1.2 });
      const plain = {};
      carModel.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material, n = m.name;
        for (const k of ['map', 'normalMap', 'metalnessMap', 'roughnessMap']) if (m[k]) m[k].anisotropy = aniso;
        if (n === 'Window') o.material = glass;
        else if (n === 'bodyRED_GLASS') o.material = lens;
        else if (n !== 'Paint') {
          // the export marks everything as "physical"; plain standard materials look the same here and cost less on phones
          if (!plain[n]) {
            plain[n] = new T.MeshStandardMaterial({ name: n, color: m.color, map: m.map, normalMap: m.normalMap, metalness: m.metalness, roughness: m.roughness, metalnessMap: m.metalnessMap, roughnessMap: m.roughnessMap, envMapIntensity: 1.0 });
            if (n === 'BadgeA') { plain[n].alphaTest = 0.35; plain[n].polygonOffset = true; plain[n].polygonOffsetFactor = -2; }
            if (n === 'InteriorA') { plain[n].envMapIntensity = 0.7; plain[n].side = T.DoubleSide; }
          }
          o.material = plain[n];
        }
      });
      // rear-view mirror face: a polished plate that reflects the sky and horizon (no second scene render)
      const mirrorMat = new T.MeshStandardMaterial({ color: 0xdfe8f0, metalness: 1, roughness: 0.04, envMapIntensity: 1.25 });
      const mirrorGeo = new T.PlaneGeometry(0.2 * K, 0.05 * K);
      return { K, glass, glassIn, lens, mirrorMat, mirrorGeo, mirrorPos: new T.Vector3(-0.014 * K, 1.041 * K, -0.295 * K), rearZ: fs.z * K / 2, lampY: 0.73 * K, lampX: 0.71 * K, eye: new T.Vector3(-0.335 * K, 0.975 * K, 0.1 * K) };
    })() : null;
    const aoGeo = flatOnRoad(2.9, 5.9);
    const aoMat = carAoTex ? new T.MeshBasicMaterial({ map: carAoTex, blending: T.MultiplyBlending, toneMapped: false, transparent: true, premultipliedAlpha: true, depthWrite: false }) : shadowMat;
    const makeRigGLB = () => {
      const rig = { group: new T.Group(), tilt: new T.Group(), wheels: [], panes: [], themeKey: null, tagKey: null, yaw: 0, inside: null, steerSm: 0 };
      // only this material differs between the three cars; colour comes from the car's theme (same reds/blue/gold as before)
      rig.paint = new T.MeshPhysicalMaterial({ color: 0xff0000, metalness: 0.45, roughness: 0.11, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.5 });
      rig.stripe = { color: { set() {} } };
      const model = carModel.clone(true);
      model.traverse((o) => {
        if (/^wheel\d$/.test(o.name)) rig.wheels.push(o);
        if (o.name === 'interior') rig.cabin = o; else if (o.name === 'interiorLo') rig.cabinLo = o; else if (o.name === 'steer') rig.steer = o; // steer: the whole wheel, one part
        if (!o.isMesh) return;
        const mn = o.material.name;
        if (mn === 'Paint') { o.material = rig.paint; o.castShadow = true; }
        else if (mn === 'Window') { rig.panes.push(o); o.renderOrder = 5; }
        else if (mn === 'Wheel') o.castShadow = true;
      });
      // outside: light cabin behind tinted glass. inside (driver's seat): the full cabin, steering wheel and clear glass.
      rig.setView = (inside) => {
        if (rig.inside === inside) return;
        rig.inside = inside;
        if (rig.cabin) rig.cabin.visible = inside;
        if (rig.cabinLo) rig.cabinLo.visible = !inside;
        if (rig.mirror) rig.mirror.visible = inside;
        for (const p of rig.panes) p.material = inside ? carKit.glassIn : carKit.glass;
      };
      rig.setView(false);
      rig.tilt.add(model);
      // driver's eye and the point it looks at ride with the body, so jumps, roll and yaw move the view with the cabin
      rig.eyeNode = new T.Object3D(); rig.eyeNode.position.copy(carKit.eye);
      rig.aimNode = new T.Object3D(); rig.aimNode.position.set(carKit.eye.x + 0.3, carKit.eye.y - 1.15, carKit.eye.z - 10);
      rig.tilt.add(rig.eyeNode, rig.aimNode);
      rig.mirror = new T.Mesh(carKit.mirrorGeo, carKit.mirrorMat); rig.mirror.position.copy(carKit.mirrorPos); rig.mirror.rotation.set(-0.13, -0.28, 0); rig.mirror.visible = false; rig.tilt.add(rig.mirror);
      rig.flameMat = new T.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
      rig.flames = [-0.31, 0.31].map((x) => { const f = new T.Mesh(flameGeo, rig.flameMat); f.position.set(x * carKit.K, 0.3, carKit.rearZ - 0.05); f.visible = false; rig.tilt.add(f); return f; });
      rig.shadow = new T.Mesh(aoGeo, aoMat); rig.shadow.position.y = 0.022; rig.shadow.renderOrder = 3;
      rig.tag = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false }));
      rig.tag.center.set(0.5, 0); rig.tag.renderOrder = 20;
      rig.tailMat = new T.SpriteMaterial({ map: glowTex, color: 0xff2a1a, transparent: true, opacity: 0.2, depthWrite: false, blending: T.AdditiveBlending, fog: false });
      rig.exhMat = new T.SpriteMaterial({ map: glowTex, color: 0xff8a3d, transparent: true, opacity: 0.08, depthWrite: false, blending: T.AdditiveBlending, fog: false });
      rig.tailSprites = [];
      for (const sx of [-1, 1]) {
        for (const dx of [0, -0.2]) { const t = new T.Sprite(rig.tailMat); t.scale.set(0.24, 0.2, 1); rig.tailSprites.push(t); t.position.set(sx * (carKit.lampX + dx), carKit.lampY, carKit.rearZ + 0.02); rig.tilt.add(t); }
        const e = new T.Sprite(rig.exhMat); e.scale.set(0.15, 0.15, 1); e.position.set(sx * 0.31 * carKit.K, 0.3, carKit.rearZ + 0.04); rig.tilt.add(e);
      }
      // small, dim lamps unless braking: a wide red glow over blue paint read as a pink sheen
      rig.setBrake = (on) => { rig.tailMat.opacity = on ? 0.8 : 0.2; const k = on ? 1.7 : 1; for (const t of rig.tailSprites) t.scale.set(0.24 * k, 0.2 * k, 1); };
      rig.pen = newPen();
      rig.group.add(rig.tilt, rig.shadow, rig.pen);
      scene.add(rig.group, rig.tag);
      return rig;
    };
    const newRig = carKit ? makeRigGLB : makeRig;
    const rigs = [newRig(), newRig(), newRig()];
    const oncRig = newRig();
    oncRig.paint.color.set('#12b84a'); oncRig.tag.visible = false; oncRig.group.visible = false; oncRig.group.rotation.y = Math.PI; oncRig.pen.position.set(0.55, 0.018, 0.35); // (the car is turned round)
    oncRig.beamMat = new T.SpriteMaterial({ map: glowTex, color: 0xfff6d8, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending, fog: false });
    for (const sx of [-0.72, 0.72]) { const b = new T.Sprite(oncRig.beamMat); b.scale.set(1.5, 1.1, 1); b.position.set(sx, 0.66, -2.3); oncRig.tilt.add(b); }
    for (const f of oncRig.flames) f.visible = false;

    // ---------- taunt bubbles: situation-based car chat, one bubble at a time (reads the simulation, never writes to it) ----------
    const BUB_LIFE = 2, BUB_IN = 0.2, BUB_OUT = 0.6, BUB_MAX = 0.75, BUB_MAXCAR = 7;
    // every line from the design list, tagged by situation: win (leading / boasting), lose (behind / self-deprecating), hit (crash / attack / mistake), close (near miss / close finish / comeback), neutral
    const CHAT_SRC = "Hehe, I'm winning 😁 | I am the king | Catch me if you can 😂 | Not bad at all | Easy win bro 🏆 | That was close | Nobody can stop me 😎 | I'm just warming up | Boom! Got you 💥 | Nice try buddy | I'm on fire 🔥 | What a lucky shot | Too easy bro 😂 | That was unexpected | Victory is mine 👑 | I need more practice | Let's gooo 🚀 | This game is amazing | Haha, skill issue 🤣 | I almost had it | I'm unstoppable 😎 | Don't underestimate me | What a comeback 🔥 | I was so close | Bro, I'm too good 😂 | That was pure luck | One more win 🏆 | Okay, you got me | King of this game 👑 | I need a rematch | Watch me win 😏 | That was embarrassing | Mission accomplished ✅ | I got absolutely destroyed | What a champion 🥇 | I'm getting better | Haha, nice one 😂 | My luck is gone | Too strong today 💪 | I messed that up | Let's play again 🎮 | I need some luck | This is my moment ✨ | I wasn't ready | What a beast 🔥 | I got completely stuck | Winning feels amazing 😁 | Losing builds character | Bro, watch out 😂 | I'm coming for you | Haha, easy money 💰 | That was a disaster | Unbelievable comeback 🤯 | I can't believe it | I'm built different 😎 | My game is over | Let's get this win 🚀 | I made a mistake | Nobody saw that coming 😱 | I knew it already | Too lucky today 🍀 | My luck ran out | That's how it's done 👑 | Teach me your skills | I'm feeling unstoppable 🔥 | I need a break | GG, well played 🤝 | Not my best game | Boom, another victory 💥 | I got nothing left | This is too funny 😂 | Why does this happen | I'm the final boss 👹 | That was a tough one | Let's go, baby 🏆 | I'm out of luck | Gotcha, my friend 😜 | You almost got me | I'm winning today 😁 | I deserve that loss | What a crazy game 🤯 | This game hates me | My strategy worked 🧠 | I need a new plan | Haha, I'm rich now 💸 | There goes my money | Best game ever ❤️ | That was frustrating | I came to win 🏆 | I came to suffer | Feeling lucky today 🍀 | Luck is not on my side | I'm a legend 😎 | I need some training | That was beautiful ✨ | What did I just do | Nobody beats me 😂 | I got beaten badly | One step closer 🚀 | Back to the beginning | I'm flying today 🕊️ | That was a bad move | Hahaha, unbelievable 🤣 | I can't win today | I got the jackpot 💰 | Maybe next time | This is too easy 😏 | Don't celebrate yet | What a perfect round 🎯 | I missed everything | I'm feeling powerful 💪 | That was painful | Straight to the top 🥇 | Straight to the bottom | My best move ever 🧠 | My worst move ever | Haha, I'm laughing 😂 | I'm crying inside | The king returns 👑 | The king needs help | What a lucky day 🌟 | What an unlucky day | I am the winner 🏆 | I was the loser | Don't blink now 😉 | I blinked and lost | This is pure madness 🤪 | I have no words | I'm coming back 🔥 | I'm going offline | That was a masterstroke 🎯 | I made a silly mistake | You're too good bro 😅 | I need your luck | Let's make history 🚀 | I just made history | My fingers are too fast ⚡ | My brain is too slow | I'm enjoying this 😁 | I'm questioning my choices | What a stunning win 🤩 | What a shocking loss | I did it again 🥳 | I failed again | Bro, spare me 😂 | Please stop attacking me | I'm the lucky one 🍀 | I'm the unlucky one | Absolute cinema 🎬 | What a ridiculous match | Don't test my skills 😎 | I'm still learning | I feel like a pro 🎮 | I feel like a beginner | That was insane 🤯 | I need more time | Winning streak activated 🔥 | Losing streak activated | Haha, I'm too smooth 😏 | I slipped again | My heart is racing ❤️ | My patience is gone | That was legendary 👑 | That was terrible | I came, I played, I won 🏆 | I came, I lost | Nobody expects this 😂 | I expected better | This is my playground 🎮 | I'm completely lost | I'm taking the crown 👑 | Keep the crown for now | What a fantastic round ✨ | I need another chance | I'm a lucky machine 🍀 | My luck needs repair | Let's get serious 😎 | I was never serious | Another one bites the dust 💀 | Another one got away | I'm in beast mode 🐺 | I'm in panic mode";
    const CHAT_HIT = /Boom|Gotcha|watch out|destroyed|stuck|messed|mistake|disaster|slipped|bad move|dust|embarrassing|painful|frustrating|attacking|worst move|silly|What did I just do|Why does this happen/i;
    const CHAT_CLOSE = /close|almost|comeback|unexpected|rematch|Nobody saw|blink|Nobody expects|another chance|next time|celebrate yet|missed everything|got away|came, I lost|can't believe|lucky shot|pure luck/i;
    const CHAT_NEUT = /game|funny|history|cinema|madness|insane|ridiculous|play again|learning|crazy|no words|Teach me|enjoying|break|strategy|playground|serious|Absolute/i;
    const CHAT_LOSE = /need|my luck|lost|losing|loser|beaten|out of luck|not my best|nothing left|tough one|deserve|hates|crying|offline|unlucky|can't win|bottom|failed|patience|terrible|expected better|panic|Keep the crown|not on my side|Back to the beginning|Please stop|beginner|slow|questioning|shocking|over|I wasn't ready|king needs/i;
    const CHAT = { win: [], lose: [], hit: [], close: [], neutral: [] };
    CHAT_SRC.split(' | ').forEach((t, i) => {
      const tag = CHAT_HIT.test(t) ? 'hit' : CHAT_CLOSE.test(t) ? 'close' : CHAT_LOSE.test(t) ? 'lose' : CHAT_NEUT.test(t) ? 'neutral' : i % 2 === 1 ? 'lose' : 'win';
      if (/\d/.test(t)) { console.warn('[race3d] chat line has a digit, skipped: ' + t); return; }
      CHAT[tag].push(t);
    });
    const CHAT_NEW = {
      win: ['Eat my dust 😎', 'Too slow, buddy', 'Wave bye bye 👋', "You can't catch me", 'Is that all you got? 😏', 'See you at the finish!', 'Smell that? Victory 🏁', 'Catch up, if you dare 😜'],
      lose: ['Wait for me 😭', 'Not fair!', 'My car hates me', 'Why me?! 😤', 'Who stole my speed? 😩', 'Come back here!', 'Give me a push 🥺'],
      hit: ['Ouch! My paint 😱', 'Who taught you to drive?', 'Hey, watch it! 😡', "That's illegal!", 'Was that on purpose? 😤', 'My poor bumper 😢'],
      close: ['Photo finish! 📸', 'So close 😬', 'Move, move, move!', 'Right behind you 👀', 'Heart is racing 💓'],
      lose2: ['Unlucky, bro 😅', 'Nice try though', 'Next time maybe 🙏', 'Respect, well driven 🤝', 'Tough luck, friend 🫶']
    };
    for (const k in CHAT_NEW) for (const t of CHAT_NEW[k]) { if (/\d/.test(t)) { console.warn('[race3d] chat line has a digit, skipped: ' + t); continue; } CHAT[k === 'lose2' ? 'lose' : k].push(t); }
    const chatShuffle = () => { for (const k in CHAT) { const a = CHAT[k]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } } };
    chatShuffle();
    const bubMat = new T.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0 });
    const bubSprite = new T.Sprite(bubMat); bubSprite.center.set(0.5, 0); bubSprite.renderOrder = 21; bubSprite.visible = false; scene.add(bubSprite);
    const bubCache = new Map(), bubV = new T.Vector3();
    const bubbleTex = (text) => {
      let e = bubCache.get(text); if (e) return e;
      const font = '800 34px system-ui, "Segoe UI", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", Arial, sans-serif';
      const m = makeCanvas(8, 8).getContext('2d'); m.font = font;
      const tw = Math.ceil(m.measureText(text).width), W = tw + 44, H = 78, c = makeCanvas(W, H), g = c.getContext('2d');
      g.fillStyle = 'rgba(255,255,255,0.97)'; g.strokeStyle = 'rgba(15,23,42,0.18)'; g.lineWidth = 3;
      rr(g, 3, 3, W - 6, 58, 22); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(W / 2 - 10, 60); g.lineTo(W / 2 + 10, 60); g.lineTo(W / 2, 76); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(W / 2 - 9, 57, 18, 5);
      g.fillStyle = '#161b26'; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, 33);
      e = { tex: canvasTex(c), aspect: W / H }; bubCache.set(text, e);
      return e;
    };
    const bub = { on: false, t: 0, car: -1, e: null, last: 0, start: -99, nextAt: 0, ev: null, fin: 0, finWin: false, finLose: false, used: new Set(), count: [0, 0, 0, 0, 0, 0, 0, 0], init: false, manual: false, say: -99 };
    const bPrevHit = [false, false, false], bPair = new Int8Array(64);
    window._trBubble = ''; window._trBubbleLog = [];
    const bubReset = () => { bub.used.clear(); bub.count.fill(0); bub.ev = null; bub.fin = 0; bub.finWin = bub.finLose = false; bub.init = false; bub.start = -99; bub.nextAt = performance.now() / 1000 + 4 + Math.random() * 3; window._trBubbleLog = []; chatShuffle(); };
    const bubOff = () => { if (bub.on) { bub.on = false; bubSprite.visible = false; window._trBubble = ''; } };
    const bubPick = (tag) => {
      for (const k of [tag, 'neutral', tag === 'win' ? 'lose' : 'win']) { const t = CHAT[k].find((s) => !bub.used.has(s)); if (t) return { tag: k, text: t }; }
      return null;
    };
    const bubShow = (i, text, tag, manual) => {
      bub.on = true; bub.t = 0; bub.car = i; bub.manual = !!manual; bub.e = bubbleTex(text); bubMat.map = bub.e.tex; bubMat.needsUpdate = true;
      bubSprite.visible = true; window._trBubble = text; bub.start = performance.now() / 1000;
      if (!manual) { bub.used.add(text); bub.count[i]++; }
      window._trBubbleLog.push({ car: i, tag: manual ? 'manual' : tag, text });
    };
    // manual chat (Manual Drive button): shows over MY car for 2 s, 3 s cooldown; in first person nothing is drawn but it still counts
    window.trSay = (text) => {
      const nowS = performance.now() / 1000;
      if (gameState !== 'RACING' || nowS - bub.say < 3) return false;
      text = String(text || '').trim().slice(0, 48); if (!text) return false;
      const i = cars.findIndex((c) => c.isPlayer); if (i < 0) return false;
      bub.say = nowS; bub.nextAt = Math.max(bub.nextAt, nowS + 3);
      if (rigs[i] && rigs[i].tag.visible) bubShow(i, text, 'manual', true); else bubOff();
      return true;
    };
    const bubEligible = (i, camZ) => {
      const car = cars[i], rig = rigs[i];
      if (!car || !rig || (car.isPlayer && bub.fpp) || bub.count[i] >= BUB_MAXCAR || !rig.group.visible || !rig.tag.visible) return false;
      const ahead = camZ - rig.group.position.z; // metres in front of the camera
      if (!(ahead > (car.isPlayer ? 1 : 4) && ahead < 90)) return false;
      bubV.copy(rig.tag.position).project(camera); // keep clear of the HUD (top) and the screen edges
      if (car.isPlayer) return bubV.z < 1 && Math.abs(bubV.x) < 0.8 && bubV.y < 0.4 && bubV.y > -0.7;
      return bubV.z < 1 && Math.abs(bubV.x) < 0.8 && bubV.y < 0.4 && bubV.y > -0.55;
    };
    const updateBubbles = (frameDt, racing, fppOn, player, camZ) => {
      const nowMs = performance.now(), nowS = nowMs / 1000, dt = Math.min(0.6, (nowMs - (bub.last || nowMs)) / 1000); bub.last = nowMs; // (a slow device still shows the bubble for a few frames)
      const fin = gameState === 'FINISHED'; bub.fpp = !!fppOn;
      if (!racing && !fin) { bubOff(); if (gameState !== 'IDLE') bubReset(); else bub.init = false; return; }
      const n = Math.min(cars.length, rigs.length, 8);
      if (racing) { // events: a bot hit something, or somebody overtook somebody
        for (let i = 0; i < n; i++) { const c = cars[i], hit = c.hitSlowTimer > 0; if (bub.init && hit && !bPrevHit[i]) bub.ev = { car: i, tag: 'hit', at: nowS }; bPrevHit[i] = hit; }
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const d = cars[i].z - cars[j].z, k = i * 8 + j;
          if (d > 1.5) { if (bPair[k] === -1 && bub.init && (!bub.ev || bub.ev.tag !== 'hit')) { const pl = cars.findIndex((c) => c.isPlayer), me = Math.random() < 0.4; if (!cars[i].isPlayer) bub.ev = me && cars[j].isPlayer ? { car: j, tag: 'lose', at: nowS } : { car: i, tag: 'win', at: nowS }; else if (!cars[j].isPlayer) bub.ev = me && pl >= 0 ? { car: pl, tag: 'win', at: nowS } : { car: j, tag: 'lose', at: nowS }; } bPair[k] = 1; }
          else if (d < -1.5) bPair[k] = -1;
        }
        bub.init = true;
      }
      if (bub.on) { bub.t += dt; if (bub.t >= BUB_LIFE) bubOff(); }
      if (!bub.on) {
        let car = -1, tag = '';
        if (fin) { // after the finish: one winner line and one loser line
          if (!bub.fin) bub.fin = nowS;
          const order = cars.map((c, i) => i).sort((a, b) => cars[b].z - cars[a].z), w = order[0];
          if (!bub.finWin && nowS - bub.fin > 0.6 && nowS - bub.start > 1.2) { bub.finWin = true; if (!cars[w].isPlayer && bub.count[w] < BUB_MAXCAR) { car = w; tag = 'win'; } }
          else if (!bub.finLose && bub.finWin && nowS - bub.fin > 3 && nowS - bub.start > 1.2) { bub.finLose = true; const l = order.slice(1).filter((i) => !cars[i].isPlayer && bub.count[i] < BUB_MAXCAR); if (l.length) { car = l[Math.floor(Math.random() * l.length)]; tag = 'lose'; } }
        } else if (nowS - bub.start >= 3.5) {
          if (bub.ev && nowS - bub.ev.at < 1.5) { if (bubEligible(bub.ev.car, camZ)) { car = bub.ev.car; tag = bub.ev.tag; } bub.ev = null; }
          else if (nowS >= bub.nextAt) {
            const order = cars.map((c, i) => i).sort((a, b) => cars[b].z - cars[a].z), lead = cars[order[0]].z;
            const cand = []; for (let i = 0; i < n; i++) if (bubEligible(i, camZ)) cand.push(i);
            if (cand.length) {
              car = cand[Math.floor(Math.random() * cand.length)];
              const rank = order.indexOf(car), gap = order.length > 1 ? lead - cars[order[1]].z : 99;
              const lateClose = lead > FINISH_LINE_Z * 0.85 && order.length > 1 && rank < 2 && gap < FINISH_LINE_Z * 0.012;
              tag = lateClose ? 'close' : Math.random() < 0.15 ? 'neutral' : rank === 0 ? 'win' : 'lose';
            } else bub.nextAt = nowS + 1;
          }
        }
        if (car >= 0) { const pk = bubPick(tag); if (pk) { bubShow(car, pk.text, pk.tag, false); bub.nextAt = nowS + 5 + Math.random() * 3; } }
      }
      if (bub.on) {
        const rig = rigs[bub.car], ts = rig.ts || 1.3;
        if (!rig.tag.visible) { bubSprite.visible = false; return; }
        if (!bub.manual) { bubV.copy(rig.tag.position).project(camera); if (bubV.z >= 1 || Math.abs(bubV.x) > 0.9 || bubV.y > 0.45 || bubV.y < -0.7) { bubSprite.visible = false; return; } }
        bubSprite.visible = true;
        let h = ts * 0.5, w = h * bub.e.aspect; if (w > ts * 2.8) { w = ts * 2.8; h = w / bub.e.aspect; }
        bubSprite.scale.set(w, h, 1);
        bubSprite.position.set(rig.tag.position.x, rig.tag.position.y + ts / 3 + ts * 0.04, rig.tag.position.z);
        bubMat.opacity = Math.max(0, BUB_MAX * Math.min(1, bub.t / BUB_IN, (BUB_LIFE - bub.t) / BUB_OUT));
      }
    };

    // ---------- lane squeeze: barrier wall + hatched closed lane + warning boards (built for "right lane closed") ----------
    const SQ_M = (SQ_TAPER * 2 + SQ_HOLD) * R3D_ZS, SQ_WALL_IN = R3D_XS / 3 + 0.28;
    const sqWallX = (m) => { // wall centre line, metres along the stretch -> x
      const t = SQ_TAPER * R3D_ZS, u = m < t ? m / t : (m > SQ_M - t ? (SQ_M - m) / t : 1), w = Math.max(0, Math.min(1, u)), e = w * w * (3 - 2 * w);
      return RAIL_X - (RAIL_X - SQ_WALL_IN) * e;
    };
    const squeezeGroup = new T.Group(); squeezeGroup.visible = false; scene.add(squeezeGroup);
    {
      const side = new T.Group(); squeezeGroup.add(side); squeezeGroup.userData.side = side;
      const boxes = [];
      for (let m = 1.2, i = 0; m < SQ_M - 1; m += 2.3, i++) {
        const x = sqWallX(m), yaw = Math.atan2(sqWallX(m + 1) - sqWallX(m - 1), 2);
        boxes.push(part(new T.BoxGeometry(0.5, 0.82, 2.1), i % 2 ? '#f4f4f5' : '#e11d24', x, 0.41, -m, 0, yaw, 0));
        boxes.push(part(new T.BoxGeometry(0.62, 0.16, 2.1), '#2b2f36', x, 0.08, -m, 0, yaw, 0));
        if (i % 4 === 0) boxes.push(part(new T.SphereGeometry(0.13, 8, 6), '#ffb020', x, 0.95, -m));
      }
      side.add(new T.Mesh(merge(boxes), matVC));
      // closed lane behind the wall: dark surface with yellow hatching
      const hc = makeCanvas(128, 128), hg = hc.getContext('2d');
      hg.fillStyle = '#2a2d33'; hg.fillRect(0, 0, 128, 128); hg.strokeStyle = '#f5c518'; hg.lineWidth = 16;
      for (let i = -128; i < 256; i += 64) { hg.beginPath(); hg.moveTo(i, 128); hg.lineTo(i + 128, 0); hg.stroke(); }
      const hatchTex = canvasTex(hc, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping });
      const P = [], U = [], I = [], N = [];
      let n = 0;
      for (let m = 0; m <= SQ_M; m += 2.3, n++) { const x = sqWallX(m) + 0.3; P.push(x, 0.035, -m, RAIL_X, 0.035, -m); N.push(0, 1, 0, 0, 1, 0); U.push(x / 2.4, m / 2.4, RAIL_X / 2.4, m / 2.4); }
      for (let i = 0; i < n - 1; i++) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const hgeo = new T.BufferGeometry(); hgeo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); hgeo.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); hgeo.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); hgeo.setIndex(I);
      const hatch = new T.Mesh(hgeo, new T.MeshLambertMaterial({ map: hatchTex, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      side.add(hatch);
      // warning boards (text is redrawn for the side, so it is never mirrored)
      const boardTex = (dir) => {
        const c = makeCanvas(512, 256), g = c.getContext('2d');
        g.fillStyle = '#f5c518'; rr(g, 4, 4, 504, 248, 22); g.fill(); g.strokeStyle = '#111418'; g.lineWidth = 12; rr(g, 12, 12, 488, 232, 16); g.stroke();
        g.fillStyle = '#111418'; g.font = '900 60px "Segoe UI", system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('LANE CLOSED', 256, 78); g.font = '900 54px "Segoe UI", system-ui, Arial, sans-serif';
        g.fillText(dir < 0 ? '◀ MERGE LEFT' : 'MERGE RIGHT ▶', 256, 172);
        return canvasTex(c);
      };
      const texL = boardTex(-1), texR = boardTex(1);
      const boardMat = new T.MeshBasicMaterial({ map: texL });
      const boards = new T.Group(); squeezeGroup.add(boards);
      for (const m of [34, 4]) {
        const b = new T.Mesh(new T.PlaneGeometry(4.4, 2.2, 4, 2), boardMat); b.position.set(0, 3.6, m); boards.add(b);
        const post = new T.Mesh(new T.BoxGeometry(0.16, 2.6, 0.16), railMat); post.position.set(0, 1.3, m - 0.05); boards.add(post);
      }
      squeezeGroup.userData.setSide = (sd) => { side.scale.x = sd; boards.position.x = sd * (RAIL_X + 2.6); boardMat.map = sd > 0 ? texL : texR; boardMat.needsUpdate = true; };
    }

    // ---------- track objects (pooled) ----------
    const boostC = makeCanvas(128, 512);
    {
      const g = boostC.getContext('2d');
      const bg = g.createLinearGradient(0, 0, 0, 512); bg.addColorStop(0, '#1b7bff'); bg.addColorStop(1, '#0d55c4');
      g.fillStyle = bg; rr(g, 5, 5, 118, 502, 12); g.fill();
      g.shadowColor = '#5eead4'; g.shadowBlur = 14; g.strokeStyle = '#67e8f9'; g.lineWidth = 8; g.stroke(); g.shadowBlur = 0;
      g.fillStyle = '#082f6b'; rr(g, 14, 20, 100, 74, 8); g.fill(); g.strokeStyle = '#7dd3fc'; g.lineWidth = 3; g.stroke();
      g.font = '900 italic 31px "Segoe UI", system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = 6; g.strokeStyle = '#03204f'; g.strokeText('BOOST', 72, 59); g.fillStyle = '#ffffff'; g.fillText('BOOST', 72, 59);
      g.fillStyle = '#fde047'; g.beginPath(); g.moveTo(26, 40); g.lineTo(16, 62); g.lineTo(24, 62); g.lineTo(19, 80); g.lineTo(33, 54); g.lineTo(25, 54); g.closePath(); g.fill();
    }
    const chevC = makeCanvas(128, 128);
    {
      const g = chevC.getContext('2d');
      g.shadowColor = '#22d3ee'; g.shadowBlur = 12; g.strokeStyle = '#e0fbff'; g.lineWidth = 16; g.lineJoin = 'miter'; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(20, 96); g.lineTo(64, 46); g.lineTo(108, 96); g.stroke();
    }
    const chevTex = canvasTex(chevC, { wrapT: T.RepeatWrapping });
    chevTex.repeat.set(1, 3);
    const PAD_W = 0.5 * R3D_XS, PAD_L = 14.4 * R3D_ZS;
    const padMat = new T.MeshBasicMaterial({ map: canvasTex(boostC), transparent: true, depthWrite: false });
    const chevMat = new T.MeshBasicMaterial({ map: chevTex, transparent: true, depthWrite: false });
    const padGlowMat = new T.MeshBasicMaterial({ map: glowTex, color: 0x38bdf8, transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending });
    // v17: the pad is a low wedge (about 7 cm high at the exit end, no collision change) with a lit edge, bold BOOST text and moving chevrons
    const PAD_RISE = 0.07;
    const sloped = (w, d, y0, zOff = 0) => { const g = flatOnRoad(w, d); const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) pa.setY(i, y0 + PAD_RISE * (0.5 - (pa.getZ(i) + zOff) / PAD_L)); pa.needsUpdate = true; return g; };
    const padEdgeMat = new T.MeshBasicMaterial({ color: 0x7ef0ff, transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending });
    const makePad = () => {
      const g = new T.Group();
      const glow = new T.Mesh(flatOnRoad(PAD_W * 2.1, PAD_L * 1.35), padGlowMat); glow.position.y = 0.017; glow.renderOrder = 4;
      const base = new T.Mesh(sloped(PAD_W, PAD_L, 0.02), padMat); base.renderOrder = 5;
      const chev = new T.Mesh(sloped(PAD_W * 0.8, PAD_L * 0.76, 0.024, -PAD_L * 0.09), chevMat); chev.position.z = -PAD_L * 0.09; chev.renderOrder = 6;
      g.add(glow, base, chev);
      for (const sx of [-1, 1]) { const e = new T.Mesh(sloped(0.07, PAD_L, 0.03), padEdgeMat); e.position.x = sx * (PAD_W / 2 - 0.035); e.renderOrder = 7; g.add(e); }
      const bar = new T.Mesh(sloped(PAD_W, 0.12, 0.03, -(PAD_L / 2 - 0.06)), padEdgeMat); bar.position.z = -(PAD_L / 2 - 0.06); bar.renderOrder = 7; g.add(bar);
      return g;
    };
    const stripeTex = (() => {
      const c = makeCanvas(128, 32), g = c.getContext('2d');
      g.fillStyle = '#facc15'; g.fillRect(0, 0, 128, 32); g.fillStyle = '#111827';
      for (let i = -1; i < 9; i++) { g.beginPath(); g.moveTo(i * 32, 32); g.lineTo(i * 32 + 16, 32); g.lineTo(i * 32 + 32, 0); g.lineTo(i * 32 + 16, 0); g.closePath(); g.fill(); }
      return canvasTex(c);
    })();
    const coneOne = (x, z) => [
      part(new T.BoxGeometry(0.62, 0.06, 0.62), '#c2410c', x, 0.03, z),
      part(new T.CylinderGeometry(0.06, 0.27, 0.95, 12), '#ff5a00', x, 0.53, z),
      part(new T.CylinderGeometry(0.145, 0.195, 0.2, 12), '#f8fafc', x, 0.55, z)
    ];
    const barrelOne = (x, z) => [
      part(new T.CylinderGeometry(0.42, 0.42, 1.15, 14), '#f97316', x, 0.575, z),
      part(new T.CylinderGeometry(0.432, 0.432, 0.17, 14), '#f8fafc', x, 0.78, z),
      part(new T.CylinderGeometry(0.432, 0.432, 0.17, 14), '#f8fafc', x, 0.38, z),
      part(new T.CylinderGeometry(0.34, 0.34, 0.04, 14), '#9a3412', x, 1.16, z)
    ];
    const OBJ_GEO = {
      cone: merge([...coneOne(-0.75, 0.2), ...coneOne(0, -0.25), ...coneOne(0.75, 0.2)]),
      barrel: merge([...barrelOne(-0.5, 0), ...barrelOne(0.5, 0.1)]),
      barrierBase: merge([part(new T.BoxGeometry(2.7, 0.28, 0.7), '#9aa3af', 0, 0.14, 0), part(new T.BoxGeometry(0.16, 0.5, 0.16), '#ef4444', -1.15, 1.25, 0), part(new T.BoxGeometry(0.16, 0.5, 0.16), '#ef4444', 1.15, 1.25, 0)]),
      brokentruck: merge([
        part(new T.BoxGeometry(2.2, 1.9, 3.3), '#f1f5f9', 0, 1.55, 0.5), part(new T.BoxGeometry(2.22, 0.3, 3.32), '#f97316', 0, 1.2, 0.5),
        part(new T.BoxGeometry(2.05, 1.35, 1.25), '#38bdf8', 0, 1.15, -1.85), part(new T.BoxGeometry(1.8, 0.5, 0.06), '#0f172a', 0, 1.45, -2.49),
        part(new T.BoxGeometry(2.1, 0.25, 4.6), '#1f2937', 0, 0.5, -0.1),
        part(new T.BoxGeometry(2.0, 1.7, 0.05), '#cbd5e1', 0, 1.55, 2.16), part(new T.BoxGeometry(0.05, 1.7, 0.06), '#64748b', 0, 1.55, 2.19),   // rear doors
        part(new T.BoxGeometry(2.24, 0.16, 0.1), '#facc15', 0, 0.52, 2.2), part(new T.BoxGeometry(0.34, 0.16, 0.06), '#ef4444', -0.86, 0.72, 2.2), part(new T.BoxGeometry(0.34, 0.16, 0.06), '#ef4444', 0.86, 0.72, 2.2), // bumper + tail lamps
        ...[[-1, 1.3], [1, 1.3], [-1, -1.7], [1, -1.7]].map(([sx, z]) => { const g = new T.CylinderGeometry(0.44, 0.44, 0.3, 12); g.rotateZ(Math.PI / 2); return part(g, '#111318', sx * 1.0, 0.44, z); })
      ])
    };
    // jump ramp surfaces
    const jumpDeckMat = (() => {
      const c = makeCanvas(256, 512), g = c.getContext('2d');
      g.fillStyle = '#f5c518'; g.fillRect(0, 0, 256, 512);
      g.strokeStyle = '#141414'; g.lineWidth = 34; g.lineJoin = 'miter';
      for (const y of [150, 270, 390]) { g.beginPath(); g.moveTo(26, y + 60); g.lineTo(128, y - 30); g.lineTo(230, y + 60); g.stroke(); }
      g.fillStyle = '#141414'; g.fillRect(0, 0, 256, 96);
      g.fillStyle = '#f5c518'; g.font = '900 italic 64px "Segoe UI", system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('JUMP', 128, 50);
      g.strokeStyle = '#141414'; g.lineWidth = 12; g.strokeRect(6, 6, 244, 500);
      return new T.MeshStandardMaterial({ map: canvasTex(c), roughness: 0.55, metalness: 0.25 });
    })();
    const jumpBodyMat = new T.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.5 });
    const jumpEdgeMat = new T.MeshStandardMaterial({ color: 0xd9dee5, roughness: 0.3, metalness: 0.9 });
    // speed bump: rounded strip across the lane
    const bumpGeo = (() => { const g = new T.CylinderGeometry(0.34, 0.34, 2.5, 18, 1, false, 0, Math.PI); g.rotateZ(Math.PI / 2); g.rotateX(-Math.PI / 2); g.scale(1, 0.55, 1); return g; })();
    const tyre = (x, y, z) => { const g = new T.TorusGeometry(0.3, 0.14, 8, 14); g.rotateX(Math.PI / 2); return part(g, '#15171a', x, y, z); };
    OBJ_GEO.tyres = merge([0, 1, 2].flatMap((i) => [tyre(-0.5, 0.14 + i * 0.27, 0), tyre(0.5, 0.14 + i * 0.27, 0.05)]).concat([tyre(0, 0.14, 0.5), tyre(0, 0.41, 0.5)]));
    OBJ_GEO.barricade = merge([
      part(new T.BoxGeometry(1.5, 0.22, 0.06), '#f97316', 0, 0.82, 0), part(new T.BoxGeometry(1.5, 0.22, 0.06), '#f8fafc', 0, 0.5, 0),
      ...[-0.62, 0.62].flatMap((x) => [part(new T.BoxGeometry(0.07, 1.0, 0.07), '#d1d5db', x, 0.5, 0.16, 0.3, 0, 0), part(new T.BoxGeometry(0.07, 1.0, 0.07), '#d1d5db', x, 0.5, -0.16, -0.3, 0, 0)]),
      part(new T.SphereGeometry(0.09, 8, 6), '#fbbf24', -0.62, 1.03, 0), part(new T.SphereGeometry(0.09, 8, 6), '#fbbf24', 0.62, 1.03, 0)
    ]);
    OBJ_GEO.roadblockBase = merge([part(new T.BoxGeometry(0.5, 0.16, 0.6), '#4b5563', -0.85, 0.08, 0), part(new T.BoxGeometry(0.5, 0.16, 0.6), '#4b5563', 0.85, 0.08, 0), part(new T.BoxGeometry(0.1, 0.9, 0.1), '#e5e7eb', -0.85, 0.55, 0), part(new T.BoxGeometry(0.1, 0.9, 0.1), '#e5e7eb', 0.85, 0.55, 0)]);
    const roadblockPlank = new T.BoxGeometry(2.1, 0.32, 0.07); roadblockPlank.translate(0, 0.86, 0);
    const redStripeTex = (() => {
      const c = makeCanvas(128, 32), g = c.getContext('2d');
      g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 128, 32); g.fillStyle = '#dc2626';
      for (let i = -1; i < 9; i++) { g.beginPath(); g.moveTo(i * 32, 32); g.lineTo(i * 32 + 16, 32); g.lineTo(i * 32 + 32, 0); g.lineTo(i * 32 + 16, 0); g.closePath(); g.fill(); }
      return canvasTex(c);
    })();
    const roadblockMat = new T.MeshLambertMaterial({ map: redStripeTex });
    const oilC = makeCanvas(128, 128);
    {
      const g = oilC.getContext('2d'); g.fillStyle = 'rgba(6,7,10,0.92)';
      for (const [x, y, rx, ry] of [[64, 64, 44, 34], [40, 52, 22, 18], [88, 78, 26, 18], [70, 38, 20, 12]]) { g.beginPath(); g.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2); g.fill(); }
      const gr = g.createLinearGradient(30, 40, 100, 90); gr.addColorStop(0, 'rgba(120,90,200,0.35)'); gr.addColorStop(0.5, 'rgba(60,160,190,0.3)'); gr.addColorStop(1, 'rgba(200,170,80,0.25)');
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    const oilMat = new T.MeshStandardMaterial({ map: canvasTex(oilC), transparent: true, roughness: 0.08, metalness: 0.4, depthWrite: false });
    const bumpMat = new T.MeshStandardMaterial({ map: stripeTex, roughness: 0.7, metalness: 0.05 });
    const crate = (x, y, z, sz, ry) => {
      const parts = [part(new T.BoxGeometry(sz, sz, sz), '#b98545', x, y, z, 0, ry, 0)];
      for (const [dx, dy] of [[0, 0.5], [0, -0.5]]) parts.push(part(new T.BoxGeometry(sz * 1.04, sz * 0.12, sz * 1.04), '#7c5527', x, y + dy * sz * 0.86, z, 0, ry, 0));
      for (const sx of [-1, 1]) parts.push(part(new T.BoxGeometry(sz * 0.12, sz * 1.02, sz * 1.04), '#8b6230', x + Math.cos(ry) * sx * sz * 0.44, y, z - Math.sin(ry) * sx * sz * 0.44, 0, ry, 0));
      return parts;
    };
    OBJ_GEO.crates = merge([...crate(-0.5, 0.4, 0, 0.8, 0.12), ...crate(0.42, 0.4, 0.08, 0.8, -0.2), ...crate(-0.05, 1.18, 0.02, 0.74, 0.5)]);
    const barrierTop = new T.BoxGeometry(2.5, 0.72, 0.42); barrierTop.translate(0, 0.64, 0);
    const barrierMat = new T.MeshLambertMaterial({ map: stripeTex });
    const wreckMats = [new T.MeshLambertMaterial({ color: 0x8792a2 }), new T.MeshLambertMaterial({ color: 0x1b2330 }), new T.MeshLambertMaterial({ color: 0x6f7a8a }), darkMat];
    const OBJ_MAKE = {
      boost: makePad,
      cone: () => new T.Mesh(OBJ_GEO.cone, matVC),
      tyres: () => new T.Mesh(OBJ_GEO.tyres, matVC),
      barricade: () => new T.Mesh(OBJ_GEO.barricade, matVC),
      roadblock: () => { const g = new T.Group(); g.add(new T.Mesh(OBJ_GEO.roadblockBase, matVC), new T.Mesh(roadblockPlank, roadblockMat)); return g; },
      oil: () => { const m = new T.Mesh(flatOnRoad(2.2, 2.2), oilMat); m.position.y = 0.02; m.renderOrder = 2; const g = new T.Group(); g.add(m); return g; },
      barrel: () => new T.Mesh(OBJ_GEO.barrel, matVC),
      barrier: () => { const g = new T.Group(); g.add(new T.Mesh(OBJ_GEO.barrierBase, matVC), new T.Mesh(barrierTop, barrierMat)); return g; },
      brokentruck: () => { const g = new T.Group(); g.add(new T.Mesh(OBJ_GEO.brokentruck, matVC)); return g; }, // parked upright in its lane, tail toward the camera
      jump: () => {
        // sloped steel ramp: chevron deck with a JUMP marking, dark side plates, an arrow sign you can read from far
        const W = 2.3, L = 4.2, H = 1.05, slope = Math.hypot(L, H);
        const deck = new T.Mesh(new T.PlaneGeometry(W, slope), jumpDeckMat);
        deck.rotation.x = -Math.PI / 2 + Math.atan2(H, L); deck.position.set(0, H / 2 + 0.01, 0);
        const sideShape = new T.Shape([[0, 0], [L, 0], [L, H]].map(([a, b2]) => new T.Vector2(a, b2)));
        const body = new T.ExtrudeGeometry(sideShape, { depth: W, bevelEnabled: false }); body.rotateY(Math.PI / 2); body.translate(-W / 2, 0, L / 2);
        const lip = new T.Mesh(new T.BoxGeometry(W + 0.12, 0.09, 0.14), jumpEdgeMat); lip.position.set(0, H + 0.02, -L / 2);
        const g = new T.Group(); g.add(new T.Mesh(body, jumpBodyMat), deck, lip);
        return g;
      },
      bump: () => { const g = new T.Group(), m = new T.Mesh(bumpGeo, bumpMat); g.add(m); return g; },
      crates: () => new T.Mesh(OBJ_GEO.crates, matVC),
      brokencar: () => {
        const g = new T.Group(), body = new T.Mesh(carBodyGeo, wreckMats); body.rotation.set(0, 0.95, 0.07); body.position.y = -0.06;
        g.add(body);
        for (const [x, z] of [[-0.9, 1.0], [0.9, -1.0]]) { const w = new T.Mesh(wheelGeo, matVC); w.position.set(x, 0.3, z); w.rotation.y = 0.95; g.add(w); }
        return g;
      }
    };
    const pools = {};
    const acquire = (type, n) => {
      const pool = pools[type] || (pools[type] = []);
      if (!pool[n]) { const m = (OBJ_MAKE[type] || OBJ_MAKE.barrier)(); if (type !== 'boost' && type !== 'oil') m.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(m); pool[n] = m; }
      return pool[n];
    };

    // ---------- particles ----------
    const debris = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0xffffff }), 48);
    debris.frustumCulled = false; debris.count = 0; scene.add(debris);
    const smokeC = makeCanvas(64, 64);
    {
      const g = smokeC.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
      gr.addColorStop(0, 'rgba(226,232,240,0.95)'); gr.addColorStop(1, 'rgba(226,232,240,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    const smokeTex = canvasTex(smokeC);
    const smokes = Array.from({ length: 25 }, () => { const s = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false })); s.visible = false; scene.add(s); return s; });
    const streakMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false });
    const streaks = Array.from({ length: 6 }, () => { const m = new T.Mesh(flatOnRoad(0.07, 12), streakMat); m.position.y = 0.03; m.visible = false; scene.add(m); return m; });

    // rain / snow live in a box that travels with the camera
    const PRECIP_N = 420;
    const rainPos = new Float32Array(PRECIP_N * 6), snowPos = new Float32Array(PRECIP_N * 3);
    const seed = Array.from({ length: PRECIP_N }, (_, i) => ({ x: (hash(i) - 0.5) * 44, y: hash(i + 0.37) * 22, z: -hash(i + 0.71) * 70 + 6, v: 0.7 + hash(i + 0.13) * 0.6 }));
    const rainGeo = new T.BufferGeometry(); rainGeo.setAttribute('position', new T.BufferAttribute(rainPos, 3));
    const rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xbfe3fb, transparent: true, opacity: 0.55, fog: false }));
    const snowGeo = new T.BufferGeometry(); snowGeo.setAttribute('position', new T.BufferAttribute(snowPos, 3));
    const snow = new T.Points(snowGeo, new T.PointsMaterial({ color: 0xffffff, size: 0.4, map: glowTex, transparent: true, depthWrite: false, fog: false }));
    rain.frustumCulled = snow.frustumCulled = false; rain.visible = snow.visible = false;
    scene.add(rain, snow);

    // ---------- climate: night lights, wet road, snow caps ----------
    // The page's current climate (the test switch window._trRouteForce.weather overrides it).
    const wxNow = () => (window._trRouteForce && window._trRouteForce.weather) || currentWeather;
    const trFx = { snow: { value: 0 }, night: { value: 0 } }; // 0..1, driven by climateApply
    const GLSL_NOISE = 'float trH(vec2 p){ return fract(sin(dot(mod(p, 61.0), vec2(127.1, 311.7))) * 43758.5453); }\n'
      + 'float trNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(trH(i), trH(i + vec2(1.0, 0.0)), f.x), mix(trH(i + vec2(0.0, 1.0)), trH(i + vec2(1.0, 1.0)), f.x), f.y); }\n';
    // One shared shader patch (chained after whatever onBeforeCompile the material already has, e.g. noBend / the gorge hole):
    //   o.snow: 'up' = snow caps on upward-facing surfaces (+ irregular edge), 'road' = dusting on the shoulders only, 'grass' = extra dusting near the road
    //   o.lit: night self-light (share of the albedo added as emission, keeps hazard stripes readable)   o.win: night lit windows by world-scale cell
    const trPatch = (mat, o) => {
      if (!mat || mat.userData.trClimate || !(mat.isMeshLambertMaterial || mat.isMeshStandardMaterial || mat.isMeshPhongMaterial)) return;
      mat.userData.trClimate = true;
      const prev = mat.onBeforeCompile, prevKey = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey.bind(mat) : null;
      const tag = 'trClim' + (o.snow || '-') + (o.lit || 0) + (o.win ? 'w' : '');
      let frag = '';
      if (o.snow === 'up') frag += 'float trN = trNoise(vTrW.xz * 0.9 + vTrW.y * 0.7) - 0.5; float trS = smoothstep(0.42 + trN * 0.3, 0.7 + trN * 0.3, vTrWN.y) * uTrSnow; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), trS);\n';
      if (o.snow === 'road') frag += 'float trN = trNoise(vTrW.xz * vec2(0.5, 0.35)); float trS = clamp(smoothstep(' + (R3D_XS * 0.91).toFixed(2) + ', ' + (R3D_XS * 1.0).toFixed(2) + ', abs(vTrW.x)) * (0.4 + 0.6 * trN) + 0.05 * trN, 0.0, 1.0) * uTrSnow; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 1.0), trS);\n';
      if (o.snow === 'grass') frag += 'float trN = trNoise(vTrW.xz * 0.11) + 0.5 * trNoise(vTrW.xz * 0.37); float trS = smoothstep(0.92, 1.12, trN + (1.0 - smoothstep(4.0, 18.0, abs(vTrW.x))) * 0.16) * 0.5 * uTrSnow; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 0.98), trS);\n';
      let emi = '';
      if (o.lit) emi += 'totalEmissiveRadiance += diffuseColor.rgb * uTrNight * ' + o.lit.toFixed(2) + ';\n';
      if (o.win) emi += 'vec3 trn = normalize(vTrON + vec3(0.0001)); float trWall = 1.0 - smoothstep(0.25, 0.5, abs(trn.y)); vec2 trT = normalize(vec2(-trn.z, trn.x) + vec2(0.0001)); vec2 trUV = vec2(dot(vTrO.xz, trT) / 3.4, vTrO.y / 3.6); vec2 trC = floor(trUV), trF = fract(trUV);'
        + ' float trWin = step(0.58, trH(trC + vec2(7.0, 3.0))) * step(0.2, trF.x) * step(trF.x, 0.8) * step(0.25, trF.y) * step(trF.y, 0.8) * trWall; vec3 trWc = mix(vec3(1.0, 0.78, 0.4), vec3(0.72, 0.86, 1.0), step(0.82, trH(trC * 1.7 + 2.0)));'
        + ' totalEmissiveRadiance += trWc * trWin * uTrNight * 1.7;\n';
      mat.onBeforeCompile = (sh, r) => {
        if (prev) prev.call(mat, sh, r);
        sh.uniforms.uTrSnow = trFx.snow; sh.uniforms.uTrNight = trFx.night;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vTrW; varying vec3 vTrWN; varying vec3 vTrO; varying vec3 vTrON;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 trOn = objectNormal; vec3 trPo = transformed;\n#ifdef USE_INSTANCING\ntrOn = mat3(instanceMatrix) * trOn; trPo = (instanceMatrix * vec4(trPo, 1.0)).xyz;\n#endif\n'
            + 'vTrWN = normalize(mat3(modelMatrix) * trOn); vTrW = (modelMatrix * vec4(trPo, 1.0)).xyz; vTrO = trPo * length(modelMatrix[0].xyz); vTrON = trOn;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vTrW; varying vec3 vTrWN; varying vec3 vTrO; varying vec3 vTrON; uniform float uTrSnow; uniform float uTrNight;\n' + GLSL_NOISE)
          .replace('#include <color_fragment>', '#include <color_fragment>\n' + frag)
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + emi);
      };
      mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|' + tag;
    };
    {
      const done = new Set(), each = (m, o) => { if (m && !done.has(m)) { done.add(m); trPatch(m, o); } };
      const eachMat = (root, o) => root.traverse((x) => { if (x.isMesh) [].concat(x.material).forEach((m) => each(m, o)); });
      for (const kit of treeKits) for (const im of kit.parts) each(im.material, { snow: 'up' });
      for (const kit of grassKits) each(kit.im.material, { snow: 'up' });
      each(leafMat, { snow: 'up' });
      each(grassMat, { snow: 'grass' }); each(roadMat, { snow: 'road' });
      eachMat(rails, { snow: 'up', lit: 0.12 }); each(railMat, { snow: 'up', lit: 0.12 });
      each(lamps.material, { snow: 'up', lit: 0.35 }); each(matVC, { snow: 'up', lit: 0.35 });
      for (const m of [roadblockMat, barrierMat, jumpBodyMat, bumpMat, ...wreckMats.slice(0, 3)]) each(m, { snow: 'up', lit: 0.4 });
      each(bldMat, { snow: 'up' }); each(payMat, { snow: 'grass' }); // pavement: patchy dusting, never a white sheet
      for (const c of cityMats) each(c.m, { snow: 'up', win: true });
    }

    // night: stars + moon on the sky, lamp glows + light pools on the road, headlights / tail lights on the cars
    const skyNight = new T.Group(); skyNight.visible = false; backdrop.add(skyNight);
    {
      const N = 170, P = new Float32Array(N * 3), C = new Float32Array(N * 3), d2r = Math.PI / 180;
      for (let i = 0; i < N; i++) {
        const az = (hash(i * 1.7) - 0.5) * 150 * d2r, el = (6 + hash(i * 2.3) * 58) * d2r, k = 0.45 + hash(i * 3.1) * 0.55;
        P[i * 3] = 1100 * Math.sin(az) * Math.cos(el); P[i * 3 + 1] = 1100 * Math.sin(el); P[i * 3 + 2] = -1100 * Math.cos(az) * Math.cos(el);
        C[i * 3] = k * 0.9; C[i * 3 + 1] = k * 0.95; C[i * 3 + 2] = k;
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('color', new T.BufferAttribute(C, 3));
      const sm = new T.PointsMaterial({ size: 2.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false });
      noBend(sm);
      const stars = new T.Points(g, sm); stars.frustumCulled = false; skyNight.add(stars);
      const mc = makeCanvas(64, 64), mg = mc.getContext('2d');
      mg.fillStyle = '#eef3ff'; mg.beginPath(); mg.arc(32, 32, 24, 0, 6.283); mg.fill();
      mg.fillStyle = 'rgba(150,165,205,0.35)'; for (const [x, y, r] of [[24, 26, 6], [38, 36, 5], [30, 42, 3.5], [40, 22, 3]]) { mg.beginPath(); mg.arc(x, y, r, 0, 6.283); mg.fill(); }
      const moon = new T.Sprite(new T.SpriteMaterial({ map: canvasTex(mc), fog: false, depthWrite: false }));
      moon.scale.set(46, 46, 1); moon.position.set(-260, 430, -1000);
      const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0x9db4ff, opacity: 0.55, transparent: true, blending: T.AdditiveBlending, fog: false, depthWrite: false }));
      halo.scale.set(330, 330, 1); halo.position.copy(moon.position);
      skyNight.add(halo, moon);
    }
    const nightRoad = new T.Group(); nightRoad.visible = false; scene.add(nightRoad);
    const LAMP_HEAD_X = RAIL_X + 1.0 - 2.3;
    const lampGlow = (() => {
      const pos = new Float32Array(LAMP_ROWS * 2 * 3), g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
      const p = new T.Points(g, new T.PointsMaterial({ color: 0xffc680, size: 2.8, map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      p.frustumCulled = false; nightRoad.add(p); return { pos, g, p };
    })();
    const poolGeo = flatOnRoad(1, 1, 1);
    const lampPoolTex = (() => { const c = makeCanvas(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return canvasTex(c); })();
    const lampPools = new T.InstancedMesh(poolGeo, new T.MeshBasicMaterial({ map: lampPoolTex, color: 0xffcf98, transparent: true, opacity: 0.3, depthWrite: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), LAMP_ROWS * 2);
    lampPools.frustumCulled = false; lampPools.renderOrder = 2; nightRoad.add(lampPools);
    const nQ = new T.Quaternion(), nS = new T.Vector3(), nP = new T.Vector3(), nM = new T.Matrix4();
    // warm lamp light on cars / rails / road: two pooled point lights (no shadows), one per lamp side, each hopping to the nearest lamp of its parity
    const lampLt = [0, 1].map(() => { const l = new T.PointLight(0xffb468, 0, 15, 2); l.castShadow = false; scene.add(l); return l; });
    const lampLtOn = () => lampLt.some((l) => l.intensity > 0);
    let nightBase = null;
    const lampLightFrame = (pz) => {
      for (let p = 0; p < 2; p++) {
        const l = lampLt[p];
        if (!nightRoad.visible || !lamps.visible) { l.intensity = 0; continue; }
        const m = 2 * Math.round(((-pz - 9) / 17 - p) / 2) + p, z = -9 - 17 * m; // lamp index m: even = right side, odd = left
        const hide = -z > tnM0 - 2 && -z < tnM1 + 2;
        l.position.set((m % 2 === 0 ? 1 : -1) * LAMP_HEAD_X, 6.6, z);
        l.intensity = hide ? 0 : 150;
      }
    };
    const climateFrame = (cz) => {
      lampPools.visible = lampGlow.p.visible = lamps.visible;
      if (!nightRoad.visible) return;
      const lbk = Math.floor(-cz / LAMP_GAP), lb = lbk + (tnM0 === Infinity ? 0.5 : tnM0 * 1e-4 % 0.4); if (lb === nightBase) return; nightBase = lb;
      for (let r = 0; r < LAMP_ROWS; r++) {
        const zr = -(lbk + r - 1) * LAMP_GAP - 9, zl = zr + LAMP_GAP / 2;
        lampGlow.pos.set([LAMP_HEAD_X, 7.2, zr, -LAMP_HEAD_X, 7.2, zl], r * 6);
        const hr = -zr > tnM0 - 2 && -zr < tnM1 + 2, hl = -zl > tnM0 - 2 && -zl < tnM1 + 2; // no pools where the lamp is hidden (tunnel)
        lampPools.setMatrixAt(r * 2, nM.compose(nP.set(LAMP_HEAD_X * 0.8, 0.045, zr), nQ, hr ? nS.set(0, 0, 0) : nS.set(12, 1, 16)));
        lampPools.setMatrixAt(r * 2 + 1, nM.compose(nP.set(-LAMP_HEAD_X * 0.8, 0.045, zl), nQ, hl ? nS.set(0, 0, 0) : nS.set(12, 1, 16)));
      }
      lampGlow.g.attributes.position.needsUpdate = true; lampPools.instanceMatrix.needsUpdate = true;
    };
    // roadside reflectors: amber on the left rail, blue on the right (the markers along the rails are hidden by day)
    {
      const col3 = new Float32Array(LIGHT_ROWS * 2 * 3);
      for (let i = 0; i < LIGHT_ROWS * 2; i++) { const left = i % 2 === 0; col3[i * 3] = left ? 1 : 0.31; col3[i * 3 + 1] = left ? 0.69 : 0.71; col3[i * 3 + 2] = left ? 0.25 : 1; }
      railLightGeo.setAttribute('color', new T.BufferAttribute(col3, 3)); railLights.material.vertexColors = true; railLights.material.color.set(0xffffff); railLights.material.size = 1.2;
    }
    // headlight beams on the road + lens glows, and brighter tail lights, per car (the oncoming car too)
    const beamTex = (() => {
      const c = makeCanvas(128, 256), g = c.getContext('2d');
      for (const cx of [34, 94]) {
        g.save(); g.translate(cx, 236); g.scale(0.5, 3.6);
        const gr = g.createRadialGradient(0, 0, 2, 0, 0, 52); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 52, 0, 6.283); g.fill(); g.restore();
      }
      return canvasTex(c);
    })();
    const beamGeo = flatOnRoad(3.8, 26, 1);
    const beamMat = new T.MeshBasicMaterial({ map: beamTex, color: 0xfff0c8, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const lensMat = new T.SpriteMaterial({ map: glowTex, color: 0xfff4d6, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false });
    let nightOn = false;
    for (const rig of [...rigs, oncRig]) {
      const fz = carKit ? -carKit.rearZ : -CAR_L / 2, lx = carKit ? carKit.lampX : 0.62, ly = carKit ? carKit.lampY * 0.9 : 0.62;
      const beam = new T.Mesh(beamGeo, beamMat); beam.position.set(0, 0.045, fz - 12); beam.renderOrder = 2; beam.frustumCulled = false; rig.group.add(beam);
      rig.nightObjs = [beam];
      for (const sx of [-1, 1]) { const l = new T.Sprite(lensMat); l.scale.set(0.62, 0.5, 1); l.position.set(sx * lx, ly, fz - 0.05); rig.tilt.add(l); rig.nightObjs.push(l); }
      for (const o of rig.nightObjs) o.visible = false;
      const sb = rig.setBrake;
      rig.setBrake = (on) => { // night: tail lights stay lit, brake lights flare
        sb(on); if (!nightOn) return;
        if (rig.tailSprites) { rig.tailMat.opacity = on ? 1 : 0.85; const k = (on ? 1.9 : 1.35); for (const t of rig.tailSprites) t.scale.set(0.24 * k, 0.2 * k, 1); } else rig.tailMat.color.set(on ? 0xff5040 : 0xe02020);
      };
    }
    // everything climate-specific is switched here, from the key alone, so cycling back to sunny restores the identical look
    const FOG_NEAR = { rain: 60, night: 80, snow: 80 }, FOG_FAR = { rain: 1000, night: 1250, snow: 1500 }, SHADOW_K = { rain: 0.45, night: 0.3, snow: 0.7 };
    const climateApply = (key) => {
      const night = key === 'night';
      nightOn = night; nightBase = null;
      trFx.snow.value = key === 'snow' ? (curMap === 'desert' ? 0.4 : 1) : 0; // the desert only gets a light dusting trFx.night.value = night ? 1 : 0;
      scene.fog.near = Math.min(scene.fog.near, FOG_NEAR[key] || 120); scene.fog.far = Math.min(scene.fog.far, FOG_FAR[key] || 1900); // the map sets its own range first; the climate can only pull it in
      sun.shadow.intensity = SHADOW_K[key] || 1;
      skyNight.visible = night; nightRoad.visible = night; railLights.visible = night;
      for (const rig of [...rigs, oncRig]) for (const o of rig.nightObjs) o.visible = night;
      bldMat.emissiveIntensity = night ? 2.4 : 0.5; bldMat.envMapIntensity = night ? 0.25 : 1;
      cityLights.material.size = night ? 3.6 : 3.4;
      if (night) { roadMat.envMapIntensity = 0.3; roadMat.roughness = 0.3; }
      if (key === 'rain') { roadMat.envMapIntensity = 2.6; roadMat.roughness = 0.07; } // wet, mirror-like asphalt
    };

    // ---------- weather ----------
    let weatherApplied = null;
    const applyWeather = (key) => {
      const w = SKY[key] || SKY.sunny;
      weatherApplied = key;
      const photoSky = !!skyDome; // every climate uses the same photo-cloud dome, recoloured
      tintSky(key);
      if (photoSky && key !== 'sunny') w.fog = { rain: '#4a5666', snow: '#dfe7f1', sunset: '#e9a070', night: '#0b1430' }[key] || w.fog;
      scene.background = skyTex(SKY[key] ? key : 'sunny');
      if (skyDome) skyDome.visible = photoSky;
      floraMat.color.set(w.leaf); tuftMat.color.set(w.leaf); for (const m of leafMats) {
        m.color.set(w.leaf); if (m.userData.baseTint) m.color.multiply(m.userData.baseTint);
        // sunny: lift the dark grass clumps and tree leaves so the roadside reads as sunlit
        const clump = !!m.userData.baseTint;
        if (key === 'sunny') m.color.multiplyScalar(clump ? 1.34 : 1.15);
        if (m.emissive) { m.emissive.set(key === 'sunny' ? (clump ? '#3f8a28' : '#2c651c') : '#000000'); m.emissiveIntensity = clump ? 0.6 : 0.4; }
      }
      scene.fog.color.set(w.fog);
      const mp = MAPS[mapApplied] || MAPS.highway;
      if (mp.ground) { // per-map ground palette, tinted by the climate (the climate keeps its own tint on every map)
        const gt = GTINT[key], cols = mp.ground.map((hex) => { const c = col(hex); if (gt) { if (gt.mix) c.lerp(tmpColor.set(gt.mix), gt.k); else c.multiply(tmpColor.setRGB(gt.m[0], gt.m[1], gt.m[2])); } return '#' + c.getHexString(); });
        paintGround(cols[0], cols[1], key === 'snow');
      } else paintGround(w.grass, w.grass2, key === 'snow');
      if (mp.haze) scene.fog.color.lerp(tmpColor.set(mp.haze), mp.hazeK * (key === 'night' ? 0.08 : (key === 'rain' ? 0.5 : 1)));
      scene.fog.near = mp.fog[0]; scene.fog.far = mp.fog[1];
      hemi.color.set(w.hemi[0]); hemi.groundColor.set(w.hemi[1]); baseHemi = w.hemi[2];
      sun.color.set(w.sun[0]); baseSun = w.sun[1]; baseEnv = key === 'rain' ? 0.7 : (key === 'night' ? 0.4 : (key === 'sunset' ? 0.8 : 1));
      applyLightK();
      tmpColor.set(w.city); for (const m of tintMats) { m.color.copy(tmpColor); if (key === 'night' && m.isMeshBasicMaterial) m.color.multiplyScalar(0.4); } // unlit backdrop pieces go dark at night
      lakeWaterMat.color.set(0x1f78a0).multiply(tmpColor);
      cityMat.color.set(w.city); bldMat.color.set(w.city); roadMat.color.set(w.road); leafMat.color.set(w.leaf);
      tmpColor.set(w.city); for (const c of cityMats) c.m.color.copy(c.base).multiply(tmpColor);
      roadMat.roughness = key === 'rain' ? 0.1 : (key === 'snow' ? 0.75 : 0.34); roadMat.envMapIntensity = key === 'rain' ? 1.5 : 1.0; // wet / snowy / dry
      treeLineMat.color.set(key === 'snow' ? '#b9d4c4' : (key === 'sunset' ? '#5a6a22' : (key === 'rain' ? '#1f5a3a' : '#2f8a3c')));
      sunGlow.material.opacity = w.glow; sunGlow.visible = w.glow > 0 && (key === 'sunset' || !photoSky);
      sunGlow.position.y = key === 'sunset' ? 60 : 190;
      sunGlow.material.color.set(key === 'sunset' ? '#ffd27a' : '#ffffff');
      rain.visible = key === 'rain'; snow.visible = key === 'snow';
      climateApply(key); // night lights, wet road, snow caps (see the climate block above)
    };

    // ---------- sizing ----------
    const PR_MAX = Math.min(window.devicePixelRatio || 1, 2.5); // sharp on high-DPR phones
    let pixelCap = PR_MAX, viewW = 0, viewH = 0, tppFov = 50, fppFov = 70;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(160, Math.round(rect.width)), h = Math.max(140, Math.round(rect.height));
      if (w === viewW && h === viewH && renderer.getPixelRatio() === pixelCap) return;
      viewW = w; viewH = h;
      renderer.setPixelRatio(pixelCap);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // hold the horizontal view steady so the road fills the width on any phone shape
      tppFov = Math.max(36, Math.min(74, 2 * Math.atan(Math.tan(T.MathUtils.degToRad(26)) / camera.aspect) * 180 / Math.PI));
      fppFov = Math.max(50, Math.min(66, 2 * Math.atan(Math.tan(T.MathUtils.degToRad(34)) / camera.aspect) * 180 / Math.PI));
      camera.fov = tppFov;
      camPitch = 0.30 * Math.tan(T.MathUtils.degToRad(tppFov / 2));
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);

    // ---------- post-processing: bloom + SMAA + ACES (dropped automatically if the frame rate sags) ----------
    let composer = null, quality = 3; // 3 = post + shadows, 2 = shadows only, 1 = plain
    if (ADD.PP) {
      try {
        const PP = ADD.PP;
        composer = new PP.EffectComposer(renderer, { frameBufferType: T.HalfFloatType });
        composer.addPass(new PP.RenderPass(scene, camera));
        const bloom = new PP.BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.9, luminanceSmoothing: 0.18, intensity: 0.42, radius: 0.6 });
        const smaa = new PP.SMAAEffect({ preset: PP.SMAAPreset.MEDIUM });
        const tone = new PP.ToneMappingEffect({ mode: PP.ToneMappingMode.ACES_FILMIC });
        composer.addPass(new PP.EffectPass(camera, bloom, smaa, tone));
        renderer.toneMapping = T.NoToneMapping;
      } catch (err) { composer = null; renderer.toneMapping = T.ACESFilmicToneMapping; }
    }
    if (!composer) quality = 2;
    // Quality steps are reversible: the post-processing chain is parked, not destroyed.
    const composerFull = composer, QUALITY_MAX = quality;
    const setQuality = (q) => {
      quality = q;
      const wantPost = q >= 3 && !!composerFull, wantShadow = q >= 2;
      if (wantPost !== !!composer || wantShadow !== renderer.shadowMap.enabled) {
        composer = wantPost ? composerFull : null; composerW = 0; sceneryWarm = false; // every shader is rebuilt: let the street and bridge ones follow in the same frame
        renderer.toneMapping = wantPost ? T.NoToneMapping : T.ACESFilmicToneMapping;
        renderer.shadowMap.enabled = wantShadow; sun.castShadow = wantShadow;
        scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
      }
    };
    R3D.getQuality = () => quality;

    // ---------- per-frame ----------
    const CAM_H = 5.7, CAM_BACK = 11.8; // higher chase cam: far obstacles and the road ahead are visible
    let camPitch = 0.22; // tan(angle below level); set from the FOV so the horizon sits ~35% down the view
    let curveFor = null, curve = null, bendSm = 0, hillSm = 0, sqFor = null, composerW = 0, composerH = 0, composerPR = 0;
    let lastT = performance.now(), wheelSpin = 0, camX = 0, fovKick = 0, frameCount = 0, emaDt = 1 / 60, slowT = 0, fastT = 0, restores = 0;
    const tmpColor = new T.Color();
    R3D.render = () => {
      const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      const tSec = now * 0.001;
      resize();
      const RT = raceRoute(); // the map and the route of this race (re-rolled whenever the map, the obstacle layout or the race length changes)
      if (mapApplied !== RT.map) applyMap(RT.map);
      if (RT !== sceneryFor) { sceneryFor = RT; setRouteScenery(RT); }
      if (weatherApplied !== wxNow()) applyWeather(wxNow()); // an unknown climate key falls back to the sunny table

      // adaptive resolution: step down once if the phone cannot hold the frame rate
      frameCount++;
      // Works on a smoothed frame time, so a short hitch never costs quality. Sustained slowness first
      // lowers the resolution (cheap, invisible to undo), then post-processing, then shadows; once the
      // frame rate has been steady again for a few seconds each step is given back.
      if (frameCount > 90) {
        emaDt += (dt - emaDt) * 0.05;
        if (emaDt > 0.024) { slowT += dt; fastT = 0; } else if (emaDt < 0.0185) { fastT += dt; slowT = Math.max(0, slowT - dt); } else { fastT = 0; slowT = Math.max(0, slowT - dt * 0.5); }
        if (slowT > 2.5) {
          slowT = 0; fastT = 0;
          if (pixelCap > PR_MAX * 0.62) pixelCap = Math.max(PR_MAX * 0.6, pixelCap - PR_MAX * 0.2); else if (quality > 1) setQuality(quality - 1);
        } else if (fastT > 5) {
          fastT = 0;
          if (quality < QUALITY_MAX && restores < 3) { restores++; setQuality(quality + 1); } else if (pixelCap < PR_MAX) pixelCap = Math.min(PR_MAX, pixelCap + PR_MAX * 0.2);
        }
      }

      const player = cars.find((c) => c.isPlayer) || cars[0];
      if (!player) return;
      const racing = gameState === 'RACING';
      const pz = -player.z * R3D_ZS;

      // camera: chase view behind the player's car
      camX += (player.x * R3D_XS * 0.12 - camX) * Math.min(1, dt * 6);
      const boosting = racing && player.boostTimer > 0;
      fovKick += ((boosting ? 1 : 0) - fovKick) * Math.min(1, dt * 4);
      const shake = (racing && cameraShake > 0) ? cameraShake * 0.0096 : 0; // hit shake, 20% softer than before
      const fppOn = !!R3D.fpp && !!carKit, pRig = rigs[cars.indexOf(player)];
      if (fppOn && pRig) {
        // driver's seat of the player's own car (rough pose here; locked to the cabin once the cars have moved, below)
        const e = carKit.eye;
        camera.position.set(player.x * R3D_XS + e.x, e.y, pz + e.z);
        camera.lookAt(player.x * R3D_XS + e.x, e.y - 1.15, pz + e.z - 10);
        camera.fov = fppFov; camera.near = 0.07;
      } else {
        camera.up.set(0, 1, 0);
        camera.position.set(camX + (Math.random() - 0.5) * shake, CAM_H + (Math.random() - 0.5) * shake, pz + CAM_BACK + fovKick * 0.5);
        camera.lookAt(camX * 0.92 + bendSm * 520, CAM_H - 20 * camPitch, pz + CAM_BACK - 20); // a slow, slight look into the bend
        camera.fov = tppFov; camera.near = 0.3;
      }
      camera.zoom = 1 - fovKick * 0.03; camera.updateProjectionMatrix();
      // Bends and hills: one smoothed value each, taken a little ahead of the player so a turn is seen coming.
      // They ride in two otherwise-zero projection cells; the camera itself never yaws with the road, so the
      // sky and the skyline stay put while the road, rails and roadside swing.
      bendSm += (trackBendAt(player.z + 30) - bendSm) * Math.min(1, dt * 2.2);
      hillSm += (trackHillAt(player.z + 30) - hillSm) * Math.min(1, dt * 1.8);
      camera.projectionMatrix.elements[4] = bendSm;
      camera.projectionMatrix.elements[1] = hillSm;

      const cz = camera.position.z;
      backdrop.position.set(camX * 0.4, 0, cz);
      grass.position.z = cz - GRASS_LEN * 0.35; grass.position.x = 0;
      grassTex.offset.y = -(grass.position.z / GRASS_PERIOD) % 1;
      road.position.z = cz - ROAD_LEN * 0.4; rails.position.z = road.position.z;
      roadTex.offset.y = -(road.position.z / ROAD_PERIOD) % 1;

      // lane dashes + rail posts (world-anchored, wrapped ahead of the camera)
      const camTrack = -cz / R3D_ZS;
      // street, bridge, tunnel and the map extras: laid out when the route changes, windows re-laid every few tens of metres, drawn only while in reach
      const camM = -cz;
      cityGroup.visible = !!RT.city && camTrack > RT.city.z0 - 1500 && camTrack < RT.city.z1 + 80;
      if (cityGroup.visible) { const cb = Math.floor(camM / 40); if (cb !== cityBase) { cityBase = cb; layoutCity(RT.city, cb * 40); } }
      bridgeGroup.visible = !!RT.bridge && camTrack > RT.bridge.z0 - 1700 && camTrack < RT.bridge.z1 + 120;
      if (bridgeGroup.visible) { rippleTex.offset.set((tSec * 0.011) % 1, (tSec * 0.017) % 1); }
      tunnelGroup.visible = !!RT.tunnel && camTrack > RT.tunnel.z0 - 1500 && camTrack < RT.tunnel.z1 + 100;
      if (curMap === 'mountain') {
        const cb = Math.floor(camM / CLIFF_MOD); if (cb !== cliffBase) { cliffBase = cb; layoutCliff(cb * CLIFF_MOD); }
        const sb = Math.floor(camM / STONE_GAP); if (sb !== stoneBase) { stoneBase = sb; layoutStones(sb); }
        valley.position.z = Math.floor(cz / 6) * 6;
      } else if (curMap === 'lake' && RT.lake) {
        lakeGroup.visible = camM > lakeM0 - 1700 && camM < lakeM1 + 200;
        if (lakeGroup.visible) {
          const lb = Math.floor((camM - LAKE_BEHIND - lakeM0) / LAKE_MOD); if (lb !== lakeBase) { lakeBase = lb; layoutLake(camM); }
          const ib = Math.floor(camM / 60); if (ib !== islBase) { islBase = ib; layoutIslands(camM); }
          lakeWater.position.z = grass.position.z;
          lakeU.t.value = tSec; lakeU.sky.value.copy(scene.fog.color);
          lakeTex.offset.set((tSec * 0.011) % 1, (lakeWater.position.z / 9 + tSec * 0.017) % 1);
        }
      }
      // the finish gantry follows the race length (30 s / 1 min / 2 min races differ); the light level eases down inside a tunnel
      finishGroup.position.z = -r3dEndZ() * R3D_ZS;
      {
        const want = (!!RT.tunnel && player.z > RT.tunnel.z0 + 12 && player.z < RT.tunnel.z1 + 26) ? 0.5 : 1;
        tunK += (want - tunK) * Math.min(1, dt * 3.2); if (Math.abs(want - tunK) < 0.004) tunK = want;
        if (tunK !== tunKApplied) applyLightK();
      }
      const dBase = Math.floor(camTrack / DASH_PERIOD);
      for (let r = 0; r < DASH_ROWS; r++) {
        const tz = (dBase + r - 2) * DASH_PERIOD + DASH_PERIOD * 0.23, z = -tz * R3D_ZS;
        put(dashes, r * 3, -R3D_XS / 3, 0, z, 1, 1, 1); put(dashes, r * 3 + 1, 0, -5, z, 0, 0, 0); put(dashes, r * 3 + 2, R3D_XS / 3, 0, z, 1, 1, 1);
      }
      dashes.instanceMatrix.needsUpdate = true;
      if (dashes.instanceColor && !R3D.dashColorSent) { dashes.instanceColor.needsUpdate = true; R3D.dashColorSent = true; }
      const pBase = Math.floor(-cz / POST_GAP);
      for (let r = 0; r < POST_ROWS; r++) {
        const z = -(pBase + r - 3) * POST_GAP;
        put(posts, r * 2, -RAIL_X - 0.07, 0.39, z, 1, 1, 1); put(posts, r * 2 + 1, RAIL_X + 0.07, 0.39, z, 1, 1, 1);
      }
      posts.instanceMatrix.needsUpdate = true;
      const lBase = Math.floor(-cz / LIGHT_GAP);
      for (let r = 0; r < LIGHT_ROWS; r++) {
        const z = -(lBase + r - 1) * LIGHT_GAP, o = r * 6;
        railLightPos[o] = -RAIL_X + 0.1; railLightPos[o + 1] = 0.5; railLightPos[o + 2] = z;
        railLightPos[o + 3] = RAIL_X - 0.1; railLightPos[o + 4] = 0.5; railLightPos[o + 5] = z;
      }
      railLightGeo.attributes.position.needsUpdate = true;
      lampLightFrame(-player.z * R3D_ZS);
      climateFrame(cz); // night: lamp glows + light pools follow the lamps
      const lBaseL = Math.floor(-cz / LAMP_GAP);
      if (lBaseL !== lampBase) {
        lampBase = lBaseL; let nl = 0;
        for (let r = 0; r < LAMP_ROWS; r++) {
          const z = -(lBaseL + r - 1) * LAMP_GAP - 9, zL = z + LAMP_GAP / 2;
          const hideR = -z > tnM0 - 2 && -z < tnM1 + 2, hideL = -zL > tnM0 - 2 && -zL < tnM1 + 2; // no lamp posts inside the tunnel
          lamps.setMatrixAt(r * 2, m4.compose(v3a.set(RAIL_X + 1.0, 0, z), q0, hideR ? v3b.set(0, 0, 0) : v3b.set(1, 1, 1)));
          lamps.setMatrixAt(r * 2 + 1, m4.compose(v3a.set(-RAIL_X - 1.0, 0, zL), qFlip, hideL ? v3b.set(0, 0, 0) : v3b.set(1, 1, 1)));
          // warm glow at the lamp heads inside the street (heads are 2.3 m in from the poles)
          if (!hideR && -z > cityM0 - 4 && -z < cityM1 + 4 && nl < CITY_LIGHT_MAX) { cityLightPos[nl * 3] = RAIL_X + 1.0 - 2.3; cityLightPos[nl * 3 + 1] = 7.2; cityLightPos[nl * 3 + 2] = z; nl++; }
          if (!hideL && -zL > cityM0 - 4 && -zL < cityM1 + 4 && nl < CITY_LIGHT_MAX) { cityLightPos[nl * 3] = -(RAIL_X + 1.0 - 2.3); cityLightPos[nl * 3 + 1] = 7.2; cityLightPos[nl * 3 + 2] = zL; nl++; }
        }
        lamps.instanceMatrix.needsUpdate = true;
        cityLightGeo.setDrawRange(0, nl); cityLightGeo.attributes.position.needsUpdate = true;
      }
      // the passing city blocks scroll at 80% of the road speed (they follow the camera by 20%)
      const mBase = Math.floor(-cz * WORLD_DRIFT / MID_GAP); if (mBase !== midBase) { midBase = mBase; layoutMidBlocks(mBase); }
      for (const g of midBlocks) { g.position.z = g.userData.z0 + cz * (1 - WORLD_DRIFT); g.visible = curMap === 'highway' && !(brM0 < Infinity && -g.position.z > brM0 - 50 && -g.position.z < brM1 + 50); } // highway only, none over the gorge
      // flora is re-laid in 4-segment steps (about once a second at speed), never every segment
      const fBase = Math.floor(camTrack / (FLORA_SEG * 4)) * 4;
      if (fBase !== floraBase) { floraBase = fBase; if (curMap === 'desert') layoutFloraDesert(fBase); else layoutFlora(fBase); }

      // cars
      // Track distance is compressed for the scenery, so cars nose-to-tail in the simulation would
      // overlap on screen. Spread neighbours out by up to one car length, walking outward from the player.
      const order = cars.slice().sort((a, b) => a.z - b.z), pIdx = order.indexOf(player);
      const SPREAD = Math.max(0, 5.2 - 5.35 * R3D_ZS);
      const gapM = (u) => u * R3D_ZS + Math.min(u, 5.35) / 5.35 * SPREAD;
      player._vz = 0;
      for (let i = pIdx + 1; i < order.length; i++) order[i]._vz = order[i - 1]._vz + gapM(order[i].z - order[i - 1].z);
      for (let i = pIdx - 1; i >= 0; i--) order[i]._vz = order[i + 1]._vz - gapM(order[i + 1].z - order[i].z);
      for (let i = 0; i < rigs.length; i++) {
        const rig = rigs[i], car = cars[i];
        if (!car) { rig.group.visible = false; rig.tag.visible = false; continue; }
        const seat = fppOn && car === player;
        rig.group.visible = true; rig.tag.visible = !seat;
        if (rig.setView) {
          rig.setView(seat);
          if (seat && rig.steer) { // the wheel follows Left/Right (or the AI's steering in Car Bet)
            const want = Math.max(-1, Math.min(1, (racing ? (car.steerV || 0) : 0) / 2.2));
            rig.steerSm += (want - rig.steerSm) * Math.min(1, dt * 9);
            rig.steer.rotation.z = -rig.steerSm * 1.75;
          }
        }
        if (rig.themeKey !== car.themeKey) {
          rig.themeKey = car.themeKey;
          rig.paint.color.set(car.primaryColor); rig.stripe.color.set(car.stripeColor);
        }
        const label = car.floatLabel || car.name || '', tagKey = label + '|' + !!car.isPlayer + '|' + car.badgeColor;
        if (rig.tagKey !== tagKey) { rig.tagKey = tagKey; rig.tag.material.map = tagTex(label, !!car.isPlayer, car.badgeColor); rig.tag.material.needsUpdate = true; }
        const x = car.x * R3D_XS, z = pz - (car._vz || 0), steer = (car.targetX - car.x);
        const moving = racing ? Math.min(1, car.speed / 206) : 0;
        if (car.scrapeTimer > 0) car.scrapeTimer = Math.max(0, car.scrapeTimer - dt);
        const scrape = car.scrapeTimer > 0 ? Math.sin((1 - car.scrapeTimer / 0.45) * Math.PI) : 0;
        const air = car.jumpTimer > 0 ? 1 - car.jumpTimer / (car.jumpDur || 0.7) : 0;
        // on a ramp the car rides up the deck (never through it), then the arc starts from the lip height
        let rampT = 0;
        if (!(car.jumpTimer > 0)) for (const o of trackObjects) {
          if (o.type !== 'jump' || Math.abs(o.x - car.x) > 0.22) continue;
          const dm = -z - o.z * R3D_ZS + 1.2; // metres from the ramp centre as drawn, measured at the front axle
          if (dm > -2.1 && dm < 3.6) { rampT = Math.min(1, (dm + 2.1) / 4.2); break; }
        }
        const hopRaw = car.jumpTimer > 0 ? (car.jumpY || 0) + 1.05 * (1 - air) * (1 - air) : rampT * 1.05;
        // landing: the body comes down on a damper (no snap to the ground), then the suspension dips and settles
        rig.hopSm = hopRaw >= (rig.hopSm || 0) ? hopRaw : rig.hopSm + (hopRaw - rig.hopSm) * Math.min(1, dt * 13);
        if (rig.hopSm < 0.004) rig.hopSm = 0;
        const hpP = car.hopT > 0 && car.hopDur > 0 ? 1 - car.hopT / car.hopDur : 1; // v17 boost-pad hop (cosmetic, sim sets hopT/hopDur)
        const hp = car.hopT > 0 && car.hopDur > 0 ? Math.sin(Math.PI * hpP) * 0.3 : 0;
        const hop = rig.hopSm + hp, inAir = car.jumpTimer > 0;
        if (rig.wasAir && !inAir) rig.suspV = -1.5;
        rig.wasAir = inAir;
        rig.suspV = (rig.suspV || 0) + (-150 * (rig.suspY || 0) - 13 * (rig.suspV || 0)) * Math.min(dt, 0.033);
        rig.suspY = Math.max(-0.14, Math.min(0.08, (rig.suspY || 0) + rig.suspV * Math.min(dt, 0.033)));
        const pitchWant = inAir ? (air - 0.5) * 0.24 : (hop > 0.02 && !rampT ? 0.05 : -rampT * 0.2) - (hp > 0 && hpP < 0.5 ? 0.07 * Math.sin(Math.PI * hpP * 2) : 0);
        rig.pitchSm = (rig.pitchSm || 0) + (pitchWant - (rig.pitchSm || 0)) * Math.min(1, dt * 7);
        rig.group.position.set(x + (car.scrapeDir || 0) * scrape * 0.12, hop, z);
        rig.tilt.rotation.x = rig.pitchSm - rig.suspY * 0.35;
        rig.shadow.position.y = 0.022 - hop; rig.shadow.scale.setScalar(1 - hop * 0.08);
        rig.pen.position.y = 0.018 - hop; rig.pen.scale.setScalar(1 - hop * 0.05);
        const ease = Math.min(1, dt * 9);
        rig.yaw += ((racing ? Math.max(-0.14, Math.min(0.14, -steer * 0.5)) : 0) - rig.yaw) * ease;
        rig.group.rotation.y = rig.yaw;
        rig.tilt.rotation.z += ((Math.max(-0.05, Math.min(0.05, -steer * 0.1)) - (car.hitRoll || 0) * 0.7) - rig.tilt.rotation.z) * ease;
        rig.tilt.position.y = Math.sin(tSec * 31 + i * 2.1) * 0.006 * moving + rig.suspY;
        const spin = -(car.speed || 0) * 0.11 * dt * (racing ? 1 : 0);
        for (const w of rig.wheels) w.rotation.x += spin;
        const manualOn = () => !!(window._trRaceDbg && window._trRaceDbg.mode === 'manual');
        const sp = car.speed || 0;
        rig.spHist = rig.spHist || []; rig.spHist.push({ t: tSec, v: sp }); while (rig.spHist.length > 1 && tSec - rig.spHist[0].t > 0.25) rig.spHist.shift();
        const spOld = rig.spHist[0].v;
        const accel = car.isPlayer && manualOn() ? !!keys.accel : (sp - spOld > 3 && tSec - rig.spHist[0].t > 0.08);
        const hot = racing && (car.boostTimer > 0 || accel);
        for (const f of rig.flames) { f.visible = hot; if (hot) f.scale.set(0.8, 0.8, (car.boostTimer > 0 ? 0.75 : 0.32) * (0.8 + Math.random() * 0.4)); }
        if (hot) rig.flameMat.color.set(car.boostTimer > 0 ? 0x22e5ff : 0xfb923c);
        if (rig.exhMat) rig.exhMat.opacity = hot ? 0.8 : (racing ? 0.22 : 0.06);
        const braking = !racing || car.hitSlowTimer > 0 || (car.isPlayer && keys.brake);
        rig.setBrake(braking);
        const dist = Math.max(1, camera.position.distanceTo(rig.group.position));
        const ts = Math.max(1, dist / 13.5) * 1.3;
        rig.tag.scale.set(ts, ts / 3, 1); rig.ts = ts;
        rig.tag.position.set(x, 1.4 + rig.group.position.y, z);
      }
      updateBubbles(dt, racing, fppOn, player, cz);

      if (fppOn && pRig && pRig.eyeNode) {
        pRig.group.updateWorldMatrix(false, true);
        const sh = shake * 0.35;
        camera.position.setFromMatrixPosition(pRig.eyeNode.matrixWorld);
        camera.position.x += (Math.random() - 0.5) * sh; camera.position.y += (Math.random() - 0.5) * sh;
        camera.up.setFromMatrixColumn(pRig.eyeNode.matrixWorld, 1).normalize();
        camera.lookAt(v3a.setFromMatrixPosition(pRig.aimNode.matrixWorld));
      }
      // name tags are sprites, which the bend shader does not move: shift them the same way by hand
      camera.updateMatrixWorld();
      for (const rig of rigs) {
        if (!rig.tag.visible) continue;
        const v = rig.tag.position.applyMatrix4(camera.matrixWorldInverse), d2 = Math.min(v.z * v.z, 160000);
        v.x += bendSm * d2; v.y += hillSm * d2; v.applyMatrix4(camera.matrixWorld);
      }
      if (bubSprite.visible) { const v = bubSprite.position.applyMatrix4(camera.matrixWorldInverse), d2 = Math.min(v.z * v.z, 160000); v.x += bendSm * d2; v.y += hillSm * d2; v.applyMatrix4(camera.matrixWorld); }

      // wrong-way car
      const onc = (typeof oncoming !== 'undefined') ? oncoming : null;
      oncRig.group.visible = !!onc;
      if (onc) {
        oncRig.group.position.set(onc.x * R3D_XS, 0, -onc.z * R3D_ZS);
        oncRig.group.rotation.y = Math.PI + (onc.vx || 0) * -0.22;
        oncRig.tilt.rotation.z = (onc.roll || 0);
        for (const w of oncRig.wheels) w.rotation.x -= onc.speed * 0.11 * dt;
        oncRig.beamMat.opacity = onc.state === 'coming' ? (Math.sin(tSec * 22) > -0.2 ? 0.95 : 0.25) : 0.5; // flashing headlights
        oncRig.setBrake(onc.state !== 'coming');
      }
      // lane squeeze
      const sq = raceRoute().squeeze;
      if (sq && Math.abs(sq.z0 - player.z) < 1500) {
        if (sqFor !== sq) { sqFor = sq; squeezeGroup.userData.setSide(sq.side); }
        squeezeGroup.visible = true; squeezeGroup.position.z = -sq.z0 * R3D_ZS;
      } else squeezeGroup.visible = false;

      // track objects
      const used = {};
      for (const obj of trackObjects) {
        const dzTrack = obj.z - player.z;
        if (dzTrack < -40 || dzTrack > 2400) continue;
        const n = used[obj.type] = (used[obj.type] || 0) + 1;
        const m = acquire(obj.type, n - 1);
        m.visible = true;
        if (obj.type === 'boost') {
          m.position.set(obj.x * R3D_XS, 0, -obj.z * R3D_ZS);
        } else if (obj.type === 'jump' || obj.type === 'oil' || obj.type === 'bump') {
          m.position.set(obj.x * R3D_XS, 0, -obj.z * R3D_ZS);
        } else {
          // hit obstacles are shoved to the road edge and stay there (they never vanish)
          const k = obj.broken ? 1 : (obj.hitAnimTimer > 0 ? 1 - obj.hitAnimTimer / 0.32 : 0), e = 1 - (1 - k) * (1 - k), dir = obj.hitDir || 1;
          const heavy = obj.type === 'brokentruck', D = R3D_OBJ[obj.type] || R3D_OBJ.barrier, restX = dir * (RAIL_X + 1.2 + (heavy ? D.hd : D.hw));
          const x0 = obj.x * R3D_XS, push = (obj.pushM || 6) + (heavy ? 3 : 1.5);
          m.position.set(x0 + (restX - x0) * e, Math.sin(k * Math.PI) * (heavy ? 0.9 : 1.1), -(obj.z + 0.9) * R3D_ZS - e * push);
          m.rotation.set(0, dir * e * (heavy ? -1.35 : 1.9), (heavy ? 0.05 : (obj.type === 'cone' || obj.type === 'barricade' ? 1.45 : 0.25)) * e * -dir);
          m.scale.setScalar(1);
        }
      }
      for (const type in pools) { const pool = pools[type], n = used[type] || 0; for (let i = n; i < pool.length; i++) pool[i].visible = false; }
      while (R3D_FX.railHits.length) {
        const h = R3D_FX.railHits.shift(), m = railSpikes.reduce((a, b) => (b.userData.t > a.userData.t ? b : a));
        m.userData.t = 0; m.userData.side = h.side; m.position.set(h.side * (RAIL_X - 0.08), 0.62, -h.z * R3D_ZS - 1.2);
      }
      for (const m of railSpikes) {
        const t = (m.userData.t += dt); m.visible = t < 0.8;
        if (m.visible) { const k = t < 0.09 ? t / 0.09 : Math.max(0, 1 - (t - 0.09) / 0.71); m.rotation.y = m.userData.side > 0 ? Math.PI : 0; m.scale.set(0.15 + 0.95 * k * (2 - k), 1, 1); }
      }
      chevTex.offset.y = -(tSec * 1.6) % 1;
      padGlowMat.opacity = 0.7 + Math.sin(tSec * 5) * 0.18;

      // particles
      let dn = 0;
      for (const p of debrisParticles) {
        if (dn >= 48) break;
        const s = p.size * 0.034;
        q0.setFromAxisAngle(v3a.set(0.5, 0.7, 0.3).normalize(), p.rot);
        debris.setMatrixAt(dn, m4.compose(v3a.set(p.x * R3D_XS, Math.max(0.05, p.yOffset * 0.045), -p.z * R3D_ZS), q0, v3b.set(s, s, s)));
        debris.setColorAt(dn, tmpColor.set(p.color)); dn++;
      }
      q0.identity();
      debris.count = dn;
      if (dn) { debris.instanceMatrix.needsUpdate = true; if (debris.instanceColor) debris.instanceColor.needsUpdate = true; }
      for (let i = 0; i < smokes.length; i++) {
        const s = smokes[i], p = tireSmokeParticles[i];
        if (!p) { s.visible = false; continue; }
        s.visible = true; s.material.opacity = Math.max(0, p.alpha);
        const r = p.r * 0.11; s.scale.set(r, r, 1);
        s.position.set(p.x * R3D_XS, 0.35 + r * 0.3, -p.z * R3D_ZS + 2.6);
      }
      const fast = racing && player.speed > 195;
      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i]; s.visible = fast;
        if (fast) s.position.set((-0.88 + i * 0.35) * R3D_XS, 0.03, pz - ((tSec * 95 + i * 23) % 85) * R3D_ZS);
      }
      if (fast) { streakMat.color.set(player.boostTimer > 0 ? 0x38bdf8 : 0xffffff); streakMat.opacity = player.boostTimer > 0 ? 0.3 : 0.12; }

      rain.visible = weatherApplied === 'rain' && tunK > 0.9; snow.visible = weatherApplied === 'snow' && tunK > 0.9; // dry inside a tunnel
      if (rain.visible) {
        for (let i = 0; i < PRECIP_N; i++) {
          const s = seed[i]; s.y -= 34 * s.v * dt; if (s.y < 0) s.y += 22;
          const o = i * 6, x = camX + s.x, z = cz + s.z;
          rainPos[o] = x; rainPos[o + 1] = s.y; rainPos[o + 2] = z; rainPos[o + 3] = x - 0.42; rainPos[o + 4] = s.y + 1.15; rainPos[o + 5] = z; // slanted streaks
        }
        rainGeo.attributes.position.needsUpdate = true;
      } else if (snow.visible) {
        for (let i = 0; i < PRECIP_N; i++) {
          const s = seed[i]; s.y -= 3.2 * s.v * dt; if (s.y < 0) s.y += 22;
          const o = i * 3; snowPos[o] = camX + s.x + Math.sin(tSec * s.v + i) * 0.6; snowPos[o + 1] = s.y; snowPos[o + 2] = cz + s.z;
        }
        snowGeo.attributes.position.needsUpdate = true;
      }

      sun.target.position.set(camX, 0, pz - 6); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 60);
      // one warm-up frame draws the street and bridge far behind the camera, so their shaders are built in the lobby, not mid-race
      const warm = !sceneryWarm && (sceneryWarm = true);
      if (warm) {
        if (!RT.tunnel) buildTunnel({ z0: 600, z1: 830 }, RT.map); // a stand-in, only so the tunnel shaders get built now
        cityGroup.visible = bridgeGroup.visible = tunnelGroup.visible = true; cityGroup.position.z += 6000; bridgeGroup.position.z += 6000; tunnelGroup.position.z += 6000;
        for (const m of cityMeshes) m.count = 1;
      }
      if (composer) { if (composerW !== viewW || composerH !== viewH || composerPR !== pixelCap) { composerW = viewW; composerH = viewH; composerPR = pixelCap; composer.setSize(viewW, viewH); } composer.render(dt); }
      else renderer.render(scene, camera);
      if (warm) { cityGroup.position.z -= 6000; bridgeGroup.position.z -= 6000; tunnelGroup.position.z -= 6000; for (let k = 0; k < cityMeshes.length; k++) cityMeshes[k].count = 0; cityGroup.visible = bridgeGroup.visible = tunnelGroup.visible = false; sceneryFor = null; }

      // #raceCanvas stays on top as a transparent layer for the route / position mini-map only.
      if (racing) { ctx.clearRect(0, 0, cw, ch); drawRightMiniMap(); R3D.overlayDirty = true; }
      else if (R3D.overlayDirty) { ctx.clearRect(0, 0, cw, ch); R3D.overlayDirty = false; }
    };

    R3D.renderer = renderer; R3D.scene = scene; R3D.camera = camera;
    if (R3D.status === 'pending') R3D.status = 'ready';
  }

  function r3dBoot() {
    if (R3D.status !== 'pending') return;
    if (!window.THREE || !window.THREE.WebGLRenderer) { r3dFail(window.__trThreeError || 'three.js not loaded'); return; }
    if (R3D.booting) return;
    R3D.booting = true;
    r3dInit().catch((err) => {
      if (R3D.glCanvas && R3D.glCanvas.parentNode) R3D.glCanvas.parentNode.removeChild(R3D.glCanvas);
      r3dFail(err && err.message);
    });
  }
  if (window.THREE || window.__trThreeError) r3dBoot();
  else {
    window.addEventListener('tr-three', r3dBoot, { once: true });
    setTimeout(() => { if (R3D.status === 'pending' && !R3D.booting) r3dFail('three.js load timed out'); }, 7000);
  }

  function renderScene() {
    if (R3D.status === 'ready') {
      try { R3D.render(); } catch (err) { r3dFail(err && err.message); }
      return;
    }
    // while the library is still loading nothing is drawn (dark viewport for a moment);
    // if it failed, r3dFail() has put a message over the race view
  }

