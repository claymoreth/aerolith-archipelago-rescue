// Deterministic screenshot scenes for ?shot=. Each scene puts the
// real game in a fixed pose, freezes the simulation, and leaves the HUD
// up — the render is the actual game, never a mockup.

import { RUNWAY } from './config.js';
import { degToRad } from './random.js';

// Place the plane group + flight state together so visuals match physics.
function posePlane(api, x, y, z, headingDeg, pitchDeg, rollDeg, speed, throttle) {
  const f = api.flight;
  f.x = x; f.y = y; f.z = z;
  f.headingDeg = headingDeg; f.pitchDeg = pitchDeg; f.rollDeg = rollDeg;
  f.speed = speed; f.throttle = throttle;
  f.onGround = y <= 1.2;
  f.airborne = !f.onGround;
  f.fuel = 78;
  f.stalled = false;
  api.syncPlaneMesh();
}

export function applyShot(api, name, seed) {
  // seed is accepted for determinism (world gen already uses seed 1);
  // the scenes themselves are fixed poses, so the same seed always
  // renders the same frame.
  void seed;
  const f = api.flight;
  const missions = api.missions;
  const t = api.now;

  if (name === 'hero') {
    // Plane at (-50, 95, -180), heading 73: Volcano Isle bears ~40 deg
    // and Twin Peaks ~106 deg, so both sit inside the frame with the
    // sea below and the sun high left.
    posePlane(api, -50, 95, -180, 73, 2, -14, 76, 0.72);
    api.setCameraMode('chase');
    missions.mission = missions.mission || null;
    api.startMissionForShot('ring-run');
    api.hudShow();
    api.setToast('Ring Run — fly through ring 1 of 5', t + 30);
  } else if (name === 'rings') {
    // Approach ring 1 head-on along its facing (from the runway spawn),
    // 22 units out, so the active gold ring is big and face-on ahead.
    const r = api.rings.activeRing;
    const rp = r ? r.pos : { x: 60, y: 46, z: -120 };
    const spawnZ = RUNWAY.centerZ - RUNWAY.length / 2 + 18;
    const heading = Math.atan2(rp.x - RUNWAY.centerX, rp.z - spawnZ) * 180 / Math.PI;
    const dist = 22;
    const hr = degToRad(heading);
    posePlane(api, rp.x - Math.sin(hr) * dist, rp.y + 2, rp.z - Math.cos(hr) * dist, heading, 0, 0, 68, 0.65);
    api.setCameraMode('chase');
    api.startMissionForShot('ring-run');
    api.hudShow();
    api.setToast('Ring 1 ahead — fly through the gold ring', t + 30);
  } else if (name === 'cockpit') {
    // Over Home Island looking at the volcano (bearing ~41 deg from
    // here): terrain ahead below, volcano dead ahead, dash in frame.
    // Pitched -6 deg (gentle descent toward the volcano): the panel is
    // fixed to the plane so it stays put, while the volcano rises 6 deg
    // in frame and clears the top of the panel instead of hiding
    // behind it.
    posePlane(api, 0, 100, -100, 41, -6, 0, 74, 0.7);
    api.setCameraMode('cockpit');
    api.startMissionForShot('volcano-rescue');
    api.hudShow();
    api.setToast('Volcano Rescue — hiker pickup ahead', t + 30);
  } else if (name === 'landing') {
    // Final approach from the south: 90 units out from the threshold
    // (z=-70), heading 0 (+Z) straight down the centreline, gear down.
    // Close enough that the runway reads large in frame.
    posePlane(api, RUNWAY.centerX, 12, -160, 0, -3, 0, 42, 0.32);
    api.setCameraMode('chase');
    api.startMissionForShot('volcano-rescue');
    api.missions.hikerPickedUp = true;
    api.hudShow();
    api.setToast('Final approach — land on the runway', t + 30);
  } else {
    return false;
  }

  // Freeze the simulation so the frame is stable for the screenshot.
  api.freeze(true);
  // One deterministic render pass state: propeller mid-spin, clouds set.
  api.plane.update(0.016, f);
  if (name === 'cockpit') {
    // A frozen propeller reads as giant black bars across the cockpit
    // view; in motion it is a blur, so hide it for this still only.
    // (The prop disc has a stale local z in the original build and
    // would float ahead of the nose, so the whole group goes.)
    api.plane.propeller.visible = false;
  }
  return true;
}

export function shotNames() {
  return ['hero', 'rings', 'cockpit', 'landing'];
}

export function headingToRadForShot(deg) {
  return degToRad(deg);
}
