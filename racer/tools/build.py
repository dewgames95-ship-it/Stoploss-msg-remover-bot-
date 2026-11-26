#!/usr/bin/env python3
"""Inject tools/r3d.js (the Three.js race renderer) into index.html.

Run from the repo root:  python3 tools/build.py
Safe to re-run: the injected blocks are replaced in place. Also refreshes the
byte-identical twin turbo_usdt_racer_3d.html.
"""
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"
TWIN = ROOT / "turbo_usdt_racer_3d.html"
THREE_VERSION = "0.187.0"

R3D_BEGIN = "  // >>> R3D-BEGIN (generated from tools/r3d.js)\n"
R3D_END = "  // <<< R3D-END\n"
LOADER_BEGIN = "<!-- R3D-LOADER-BEGIN -->\n"
LOADER_END = "<!-- R3D-LOADER-END -->\n"

LOADER = f"""<style>
#centerStartCircle {{ scale: none; left: 50% !important; right: auto !important; margin: 0 !important; transform: translate(-50%, -50%) scale(0.66) !important; }}
#leaderboardBtn, #modeSelectHudBtn, #raceInfoBtn, #howToPlayBtn {{ zoom: 0.77; }}
/* top bar: one compact card, 20% smaller */
.status-strip {{ zoom: 0.8; gap: 0; padding: 4px 8px; background: #0984e3; }}
.status-strip .status-card {{ border-radius: 0; border-width: 1px 0; border-color: rgba(255,255,255,0.15); padding: 3px 8px; }}
.status-strip .status-card:first-child {{ border-radius: 12px 0 0 12px; border-left-width: 1px; }}
.status-strip .status-card:last-child {{ border-radius: 0 12px 12px 0; border-right-width: 1px; }}
.status-strip .status-card + .status-card {{ box-shadow: inset 1px 0 0 rgba(255,255,255,0.12); }}
@media (max-width: 400px) {{
  .left-hud-stack {{ zoom: 0.9; opacity: 0.88; }}
  .right-hud-stack {{ zoom: 0.9; opacity: 0.9; }}
}}
</style>
<script type="importmap">
{{ "imports": {{ "three": "./assets/vendor/three/build/three.module.js", "three/addons/": "./assets/vendor/three/addons/", "postprocessing": "./assets/vendor/postprocessing/postprocessing.js" }} }}
</script>
<script type="module">
// Three.js for the race view: local copy first, pinned CDN second, a 'no WebGL' message if both fail.
const CDN = 'https://cdn.jsdelivr.net/npm/three@{THREE_VERSION}';
const sources = [
  {{ core: 'three', gltf: 'three/addons/loaders/GLTFLoader.js', draco: 'three/addons/loaders/DRACOLoader.js', dracoPath: './assets/vendor/three/addons/libs/draco/', pp: 'postprocessing' }},
  {{ core: CDN + '/+esm', gltf: CDN + '/examples/jsm/loaders/GLTFLoader.js/+esm', draco: CDN + '/examples/jsm/loaders/DRACOLoader.js/+esm', dracoPath: CDN + '/examples/jsm/libs/draco/gltf/' }}
];
let lastError = 'three.js unavailable';
for (const src of sources) {{
  try {{
    const [core, gltf, draco] = await Promise.all([import(src.core), import(src.gltf), import(src.draco)]);
    window.__trThreeAddons = {{ GLTFLoader: gltf.GLTFLoader, DRACOLoader: draco.DRACOLoader, dracoPath: src.dracoPath }};
    // optional post-processing (bloom, SMAA, tone mapping); the game runs without it
    if (src.pp) {{ try {{ window.__trThreeAddons.PP = await import(src.pp); }} catch (err) {{}} }}
    window.THREE = core;
    break;
  }} catch (err) {{ lastError = String(err && err.message || err); }}
}}
if (!window.THREE) window.__trThreeError = lastError;
window.dispatchEvent(new Event('tr-three'));
</script>
"""

ANCHOR = "  resetToIdleState();\n  let lastSimWallMs = Date.now();\n"
MAIN_SCRIPT = "<script>\n(() => {\n  // ====="


def strip(src, begin, end):
    return re.sub(re.escape(begin) + r".*?" + re.escape(end), "", src, flags=re.S)


def once(src, old, new, what):
    if src.count(old) != 1:
        sys.exit(f"build: expected exactly one '{what}', found {src.count(old)}")
    return src.replace(old, new)


def main():
    src = (ROOT / "tools" / "index.base.html").open(encoding="utf-8", newline="").read()  # pristine original, never edited
    src = strip(strip(src, R3D_BEGIN, R3D_END), LOADER_BEGIN, LOADER_END)

    # The old Canvas 2D race renderer has been removed; #raceCanvas is only a
    # transparent overlay (route / position mini-map) above the WebGL canvas.

    # Brief v3: three lanes, fixed grid order (yellow / blue / red), more and more varied obstacles.
    SIM = [
        ("const LANE_CENTERS = [-0.75, -0.25, 0.25, 0.75];", "const LANE_CENTERS = [-0.6667, 0, 0.6667];", 1),
        ("    const availLanes = [0, 1, 2, 3];\n    for (let i = availLanes.length - 1; i > 0; i--) {", "    const availLanes = [1, 2, 0]; // grid: bot2 left, bot1 middle, player right\n    for (let i = 0; i > 0; i--) {", 1),
        ("{ id: 1, z: 76, lane: 1, x: LANE_CENTERS[1],", "{ id: 1, z: 76, lane: 0, x: LANE_CENTERS[0],", 1),
        ("{ id: 4, z: 215, lane: 3, x: LANE_CENTERS[3],", "{ id: 4, z: 215, lane: 1, x: LANE_CENTERS[1],", 1),
        ("const obstacleTypes = ['barrier', 'cone', 'barrel', 'brokentruck', 'brokencar'];", "const obstacleTypes = ['barrier', 'cone', 'tyres', 'roadblock', 'oil', 'barricade', 'barrel'];", 1),
        ("dist < FINISH_LINE_Z - 110; dist += 84)", "dist < FINISH_LINE_Z - 110; dist += 64)", 1),
        ("const l = Math.floor(rng() * 4);", "const l = Math.floor(rng() * 3);", 1),
        ("const freeLanes = [0, 1, 2, 3].filter(", "const freeLanes = [0, 1, 2].filter(", 1),
        ("Math.min(3, player.lane + dir)", "Math.min(2, player.lane + dir)", 1),
        ("Math.min(3, victim.lane + knockDir)", "Math.min(2, victim.lane + knockDir)", 1),
        ("Math.min(3, altLane)", "Math.min(2, altLane)", 1),
        ("const altLane = rearCar.lane < 2 ?", "const altLane = rearCar.lane < 1 ?", 1),
        ("tel.lane >= 0 && tel.lane <= 3)", "tel.lane >= 0 && tel.lane <= 2)", 1),
        ("    const scores = [0, 0, 0, 0];", "    const scores = [0, 0, 0];", 1),
        ("for (let l = 0; l < 4; l++) {", "for (let l = 0; l < 3; l++) {", 2),
        ("const MIN_DX = 0.34;", "const MIN_DX = 0.44;", 1),
        ("dist < FINISH_LINE_Z - 110; dist += 64)", "dist < FINISH_LINE_Z - 110; dist += 71)", 1),
        ("      if (rng() < 0.68) {", "      if (rng() < 0.48) {", 1),
        # guard-rail scrape when steering past the outer lane
        ("    if (nextLane !== player.lane) {\n      player.lane = nextLane;\n      player.targetX = LANE_CENTERS[nextLane];\n      spawnTireSmoke(player.x, player.z);",
         "    if (nextLane === player.lane && !(player.scrapeTimer > 0)) {\n      // steered into the guard rail: sparks and a small speed loss\n      player.scrapeTimer = 0.45; player.scrapeDir = dir;\n      player.speed = Math.max(120, player.speed * 0.9); player.boostTimer = 0;\n      spawnShatterDebris(player.x + dir * 0.16, player.z + 6, 'spark');\n      cameraShake = 7; sfxHitCone();\n    }\n    if (nextLane !== player.lane) {\n      player.lane = nextLane;\n      player.targetX = LANE_CENTERS[nextLane];\n      spawnTireSmoke(player.x, player.z); ", 1),
        # broken truck across two lanes, and jump ramps ahead of some obstacles
        ("      const cnt = rng() < 0.64 ? 2 : 1;\n",
         "      if (rng() < 0.14) {\n        const a = rng() < 0.5 ? 0 : 1;\n        trackObjects.push({ id: nextId++, z: dist, lane: a, lane2: a + 1, x: (LANE_CENTERS[a] + LANE_CENTERS[a + 1]) / 2, hw: 0.52, type: 'brokentruck', broken: false, hitAnimTimer: 0, hitDir: a === 0 ? 1 : -1, hitBy: new Set() });\n        used.add(a); used.add(a + 1);\n      }\n      const cnt = used.size ? 0 : (rng() < 0.64 ? 2 : 1);\n", 1),
        ("        const type = obstacleTypes[(nextId + i) % obstacleTypes.length];\n",
         "        const type = obstacleTypes[(nextId + i) % obstacleTypes.length];\n        if (type !== 'oil' && rng() < 0.3) trackObjects.push({ id: nextId++, z: dist - 20, lane: l, x: LANE_CENTERS[l], type: 'jump', broken: false, hitAnimTimer: 0, hitBy: new Set() });\n", 1),
        ("Math.abs(obj.x - car.x) < 0.20) {\n",
         "Math.abs(obj.x - car.x) < (obj.hw || 0.20)) {\n          if (car.jumpTimer > 0 && obj.type !== 'boost') continue; // airborne: sails over it\n          if (obj.type === 'jump') {\n            if (!obj.hitBy.has(car.id)) { obj.hitBy.add(car.id); car.jumpTimer = 0.8; car.speed = Math.min(BOOST_TOP_SPEED, car.speed + 14); if (car.isPlayer || Math.abs(car.z - player.z) < 25) sfxBoost(); }\n            continue;\n          }\n", 1),
        ("      if (Math.abs(car.hitRoll) > 0.001) car.hitRoll *= Math.pow(0.08, dt);",
         "      if (car.jumpTimer > 0) car.jumpTimer = Math.max(0, car.jumpTimer - dt);\n      if (Math.abs(car.hitRoll) > 0.001) car.hitRoll *= Math.pow(0.08, dt); ", 1),
        ("        if (obj.type === 'boost') {\n          if (isDesignatedWinner) scores[obj.lane] += 95 * u;",
         "        if (obj.type === 'jump') {\n          scores[obj.lane] += 30 * u;\n        } else if (obj.type === 'boost') {\n          if (isDesignatedWinner) scores[obj.lane] += 95 * u; ", 1),
        ("            scores[obj.lane] -= pen * u;\n", "            scores[obj.lane] -= pen * u;\n            if (obj.lane2 !== undefined) scores[obj.lane2] -= pen * u; \n", 1),
        # livelier car-to-car contact
        ("victim.speed * (victimProtected ? 0.94 : 0.84))", "victim.speed * (victimProtected ? 0.94 : (aggressor.isPlayer ? 0.74 : 0.82)))", 1),
        ("sideSlamEventsTriggered < 2 && timeRemaining < 48", "sideSlamEventsTriggered < 5 && timeRemaining < 52", 1),
        # ---- v5: spacing, ramps, softer hits, smooth boost, close racing ----
        ("const obstacleTypes = ['barrier', 'cone', 'tyres', 'roadblock', 'oil', 'barricade', 'barrel'];", "const obstacleTypes = ['barrier', 'cone', 'oil', 'bump', 'crates', 'barricade'];", 1),
        ("    for (let dist = 420; dist < FINISH_LINE_Z - 110; dist += 71) {\n      const used = new Set();",
         "    let lastUsed = new Set();\n    for (let dist = 420; dist < FINISH_LINE_Z - 110; dist += 100) {\n      const prevRow = lastUsed; const used = new Set(); lastUsed = used;", 1),
        ("        const l = Math.floor(rng() * 3);\n        if (used.has(l)) continue;",
         "        let l = Math.floor(rng() * 3);\n        if (prevRow.has(l)) l = (l + 1) % 3; // keep a lane clear for ~40 m after an obstacle\n        if (used.has(l)) continue;", 1),
        ("        if (type !== 'oil' && rng() < 0.3) trackObjects.push({ id: nextId++, z: dist - 20,",
         "        if (type !== 'oil' && type !== 'bump' && !prevRow.has(l) && rng() < 0.4) trackObjects.push({ id: nextId++, z: dist - 88 - rng() * 14,", 1),
        ("car.jumpTimer = 0.8; car.speed = Math.min(BOOST_TOP_SPEED, car.speed + 14);", "car.jumpTimer = 1.25; car.jumpDur = 1.25;", 1),
        ("(obj.hw || 0.20)", "(obj.hw || 0.36)", 1),
        ("car.speed = Math.max(152, car.speed * 0.74);", "car.speed = Math.max(150, car.speed * 0.85);", 1),
        ("car.speed = Math.max(142, car.speed * 0.68);", "car.speed = Math.max(150, car.speed * 0.85);", 1),
        ("car.speed = Math.max(126, car.speed * 0.58);", "car.speed = Math.max(150, car.speed * 0.85); ", 1),
        ("car.speed = Math.max(134, car.speed * 0.63);", "car.speed = Math.max(150, car.speed * 0.85);  ", 1),
        ("          car.hitSlowTimer = 0.85;", "          car.hitSlowTimer = 0.5;", 1),
        ("maxSpd = Math.min(maxSpd, 162 + (1 - car.hitSlowTimer / 0.9) * 65);", "maxSpd = Math.min(maxSpd, EQUAL_TOP_SPEED * (0.85 + 0.15 * (1 - car.hitSlowTimer / 0.5)));", 1),
        ("car.speed = Math.min(BOOST_TOP_SPEED, car.speed + 48);", "/* speed now builds smoothly through the boost acceleration below */", 1),
        ("const accel = car.boostTimer > 0 ? 185 : EQUAL_ACCEL_RATE;", "const accel = car.boostTimer > 0 ? 112 : EQUAL_ACCEL_RATE;", 2),
        ("const accel = car.boostTimer > 0 ? 180 : EQUAL_ACCEL_RATE;", "const accel = car.boostTimer > 0 ? 112 : EQUAL_ACCEL_RATE; ", 1),
        ("        let targetSpeed = maxSpd;\n        const designatedCar = cars.find(c => c.id === designatedWinnerId) || cars[0];",
         "        let targetSpeed = maxSpd;\n        // first 40%: the leader lifts slightly so the pack stays together and trades places\n        if (raceProgress < 0.4 && car.boostTimer <= 0 && car.z - Math.min(...cars.map(c => c.z)) > 12) targetSpeed = Math.min(targetSpeed, EQUAL_TOP_SPEED - 9);\n        const designatedCar = cars.find(c => c.id === designatedWinnerId) || cars[0];", 1),
        ("sideSlamEventsTriggered < 5 && timeRemaining < 52", "sideSlamEventsTriggered < 7 && timeRemaining < 57", 1),
        ("                  sfxCarSlam();", "                  sfxCarSlam(); spawnShatterDebris((a.x + b.x) / 2, (a.z + b.z) / 2 + 6, 'spark');", 2),
        # ---- v6: jump physics, ramps, bot AI and speeds now live in index.base.html; adapt only what is left ----
        ("Math.abs(obj.x - car.x) < 0.20) {", "Math.abs(obj.x - car.x) < 0.30) {", 1),
        ("['barrier', 'cone', 'oil', 'bump', 'crates', 'barricade']", "['barrier', 'cone', 'crates', 'barricade', 'barrel', 'brokentruck', 'brokencar']", 1),
        ("car.speed = Math.max(122, car.speed * 0.74);", "car.speed = Math.max(120, car.speed * 0.85);", 1),
        ("car.speed = Math.max(114, car.speed * 0.68);", "car.speed = Math.max(120, car.speed * 0.85);", 1),
        ("car.speed = Math.max(101, car.speed * 0.58);", "car.speed = Math.max(120, car.speed * 0.85); ", 1),
        ("car.speed = Math.max(107, car.speed * 0.63);", "car.speed = Math.max(120, car.speed * 0.85);  ", 1),
        ("maxSpd = Math.min(maxSpd, 130 + (1 - car.hitSlowTimer / 0.9) * 52);", "maxSpd = Math.min(maxSpd, EQUAL_TOP_SPEED * (0.85 + 0.15 * (1 - car.hitSlowTimer / 0.5)));", 1),
        ("car.speed = Math.min(BOOST_TOP_SPEED, car.speed + 38);", "/* speed builds smoothly through the boost acceleration */", 1),
        ("car.boostTimer > 0 ? 148 : EQUAL_ACCEL_RATE", "car.boostTimer > 0 ? 90 : EQUAL_ACCEL_RATE", 2),
        ("car.boostTimer > 0 ? 144 : EQUAL_ACCEL_RATE", "car.boostTimer > 0 ? 90 : EQUAL_ACCEL_RATE", 1),
    ]
    OBSOLETE = ("dist < FINISH_LINE_Z - 110; dist += 84)", "dist < FINISH_LINE_Z - 110; dist += 64)", "      const cnt = rng() < 0.64", "        const type = obstacleTypes[(nextId + i)",
                "Math.abs(obj.x - car.x) < 0.20) {\n", "      if (Math.abs(car.hitRoll)", "        if (obj.type === 'boost') {\n          if (isDesignatedWinner)",
                "            scores[obj.lane] -= pen * u;", "    for (let dist = 420", "        const l = Math.floor(rng() * 3);\n", "        if (type !== 'oil' && rng() < 0.3)",
                "car.jumpTimer = 0.8;", "(obj.hw || 0.20)", "car.speed = Math.max(152,", "car.speed = Math.max(142,", "car.speed = Math.max(126,", "car.speed = Math.max(134,",
                "maxSpd = Math.min(maxSpd, 162", "car.speed = Math.min(BOOST_TOP_SPEED, car.speed + 48)", "const accel = car.boostTimer > 0 ? 185", "const accel = car.boostTimer > 0 ? 180",
                "        let targetSpeed = maxSpd;\n")
    SIM = [e for e in SIM if not e[0].startswith(OBSOLETE)]
    for old, new, count in SIM:
        if src.count(old) != count:
            sys.exit(f"build: sim patch expected {count} of '{old[:40]}', found {src.count(old)}")
        src = src.replace(old, new)

    r3d = (ROOT / "tools" / "r3d.js").read_text(encoding="utf-8")
    src = once(src, ANCHOR, R3D_BEGIN + r3d + R3D_END + ANCHOR, "render-loop anchor")
    src = once(src, MAIN_SCRIPT, LOADER_BEGIN + LOADER + LOADER_END + MAIN_SCRIPT, "main script tag")

    with HTML.open("w", encoding="utf-8", newline="") as fh:
        fh.write(src)
    shutil.copyfile(HTML, TWIN)
    print(f"build: ok, index.html {len(src.encode('utf-8'))} bytes, twin refreshed")


if __name__ == "__main__":
    main()
