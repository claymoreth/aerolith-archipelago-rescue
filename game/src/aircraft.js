// "Aerolith K-1 Kestrel" — an original low-poly single-prop bush plane.
// Red-and-white livery with teal accents, glass canopy, visible fixed
// landing gear, spinning three-blade propeller.

import * as THREE from 'three';
import { COLORS } from './config.js';

function lam(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
}

export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'kestrel';

  const red = lam(COLORS.fuselageRed);
  const white = lam(COLORS.fuselageWhite);
  const teal = lam(COLORS.teal);
  const dark = lam(0x2b2f36);
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8e8, flatShading: true, transparent: true, opacity: 0.85 });

  // Fuselage: tapered cylinder, nose forward (+Z in local space).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.4, 10), red);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0, 0.2);
  fuselage.castShadow = true;
  group.add(fuselage);
  // White belly stripe.
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.57, 2.2, 10, 1, true, 0, Math.PI), white);
  stripe.rotation.x = Math.PI / 2;
  stripe.rotation.z = Math.PI;
  stripe.position.set(0, -0.08, 0.4);
  group.add(stripe);
  // Nose cone.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.3, 10), white);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0, 3.55);
  nose.castShadow = true;
  group.add(nose);

  // Canopy: glass bubble over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 8), glass);
  canopy.scale.set(0.95, 0.75, 1.5);
  canopy.position.set(0, 0.62, 0.9);
  group.add(canopy);
  const canopyFrame = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.06, 6, 12), dark);
  canopyFrame.position.set(0, 0.62, 0.9);
  canopyFrame.scale.set(1, 0.8, 1);
  group.add(canopyFrame);

  // Cockpit interior: a real instrument panel + canopy A-pillars, shown
  // only from the cockpit camera (main.js toggles visibility by camera
  // mode). In chase view the plane keeps its clean exterior; from the
  // cockpit the panel, gauges and struts must read instantly. The panel
  // top stays below the pilot's eye line so the horizon, terrain and
  // volcano stay visible above it, and the red nose shows below it.
  const cockpitInterior = new THREE.Group();
  cockpitInterior.name = 'cockpit-interior';
  cockpitInterior.visible = false;
  const panelMat = new THREE.MeshBasicMaterial({ color: 0x1d2126 });
  const strutMat = new THREE.MeshBasicMaterial({ color: 0x14181d });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.4, 0.1), panelMat);
  panel.position.set(0, 0.81, 2.28);
  cockpitInterior.add(panel);
  // Glareshield: padded lip across the top of the panel.
  const glare = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.06, 0.28), panelMat);
  glare.position.set(0, 1.01, 2.2);
  cockpitInterior.add(glare);

  // Round gauge faces are canvas textures: dark lit dial, white ticks
  // and numbers. The face is DoubleSide (the pilot sees its -Z side)
  // with repeat.x = -1 so the numbers read correctly from the cockpit.
  function gaugeFace(spec) {
    const S = 256;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const ctx = cv.getContext('2d');
    const cx = S / 2, cy = S / 2;
    ctx.fillStyle = '#0d141b';
    ctx.beginPath(); ctx.arc(cx, cy, 126, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a4a55'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.stroke();
    const rad = (d) => (d * Math.PI) / 180;
    // Canvas angle for a value: value gauges map fraction 0..1 onto
    // canvas 135..405 deg (min lower-left, max lower-right); the
    // heading gauge maps 0..360 deg onto canvas 270..630 deg (N up).
    const angleFor = (v) => (spec.compass ? 270 + v : 135 + 270 * v);
    const nMinor = spec.compass ? 36 : 27;
    ctx.strokeStyle = '#cfe8ef';
    for (let i = 0; i <= nMinor; i++) {
      const v = spec.compass ? (i / nMinor) * 360 : i / nMinor;
      const a = rad(angleFor(v));
      const major = i % (spec.compass ? 3 : 9) === 0;
      const r1 = major ? 96 : 106, r2 = 114;
      ctx.lineWidth = major ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.fillStyle = '#eef6f8';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [v, text] of spec.labels) {
      const a = rad(angleFor(v));
      ctx.fillText(text, cx + Math.cos(a) * 74, cy + Math.sin(a) * 74);
    }
    ctx.fillStyle = '#ffb020';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(spec.tag, cx, cy + 92);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  // One round gauge: rim + lit face + needle pivoting at the centre.
  // Returns the needle group; its rotation.z is driven from flight
  // state in update() below.
  function buildGauge(spec, x, y, r) {
    const g = new THREE.Group();
    g.position.set(x, y, 2.22);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(r, r * 0.14, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x3a4a55 }),
    );
    g.add(rim);
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.96, 28),
      new THREE.MeshBasicMaterial({ map: gaugeFace(spec), side: THREE.DoubleSide }),
    );
    g.add(face);
    const needle = new THREE.Group();
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(r * 0.13, r * 0.82, 0.012),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    blade.position.y = r * 0.3;
    needle.add(blade);
    const hub = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff5a4a }),
    );
    needle.add(hub);
    g.add(needle);
    cockpitInterior.add(g);
    return needle;
  }

  const needles = {
    airspeed: buildGauge(
      { labels: [[0, '0'], [1 / 6, '20'], [2 / 6, '40'], [3 / 6, '60'], [4 / 6, '80'], [5 / 6, '100'], [1, '120']], tag: 'KT' },
      -0.3, 0.81, 0.15,
    ),
    altitude: buildGauge(
      { labels: [[0, '0'], [0.2, '2'], [0.4, '4'], [0.6, '6'], [0.8, '8'], [1, '10']], tag: 'FT x100' },
      0, 0.81, 0.15,
    ),
    heading: buildGauge(
      { compass: true, labels: [[0, 'N'], [30, '3'], [60, '6'], [90, 'E'], [120, '12'], [150, '15'], [180, 'S'], [210, '21'], [240, '24'], [270, 'W'], [300, '30'], [330, '33']], tag: 'HDG' },
      0.3, 0.81, 0.15,
    ),
    fuel: buildGauge(
      { labels: [[0, 'E'], [1, 'F']], tag: 'FUEL' },
      -0.55, 0.81, 0.095,
    ),
    throttle: buildGauge(
      { labels: [[0, '0'], [0.5, '50'], [1, '100']], tag: 'THR' },
      0.55, 0.81, 0.095,
    ),
  };

  // Canopy A-pillars: dark struts from the panel top corners up and
  // back toward the pilot, framing the windscreen at the view edges.
  function strutBetween(a, b, r) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), strutMat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return m;
  }
  for (const s of [-1, 1]) {
    cockpitInterior.add(strutBetween(
      new THREE.Vector3(s * 0.6, 1.0, 2.2),
      new THREE.Vector3(s * 0.5, 1.16, 0.6),
      0.045,
    ));
  }
  group.add(cockpitInterior);

  // Main wings: low wing, slight dihedral, teal tips.
  const wingGeo = new THREE.BoxGeometry(9.6, 0.18, 1.7);
  const wings = new THREE.Mesh(wingGeo, white);
  wings.position.set(0, -0.25, 0.7);
  wings.rotation.z = 0;
  wings.castShadow = true;
  group.add(wings);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 1.72), teal);
    tip.position.set(side * 4.55, -0.25, 0.7);
    group.add(tip);
    // Wing strut.
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), dark);
    strut.position.set(side * 2.2, -0.75, 0.7);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  }

  // Tail: horizontal stabiliser + vertical fin with teal flash.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.1), white);
  stab.position.set(0, 0.15, -2.5);
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.2), red);
  fin.position.set(0, 0.75, -2.55);
  fin.rotation.x = -0.25;
  group.add(fin);
  const finFlash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.9), teal);
  finFlash.position.set(0, 1.05, -2.5);
  finFlash.rotation.x = -0.25;
  group.add(finFlash);

  // Propeller: hub + three blades, spins around local Z.
  const propeller = new THREE.Group();
  propeller.position.set(0, 0, 4.25);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), dark);
  propeller.add(hub);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 0.08), dark);
    blade.position.y = 1.05;
    const holder = new THREE.Group();
    holder.rotation.z = (i / 3) * Math.PI * 2;
    holder.add(blade);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.09), lam(COLORS.amber));
    tip.position.y = 1.9;
    holder.add(tip);
    propeller.add(holder);
  }
  group.add(propeller);
  // Translucent prop disc, fades in at high rpm so the spin reads.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.0, 24),
    new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  disc.position.set(0, 0, 4.28);
  disc.name = 'prop-disc';
  propeller.add(disc);

  // Fixed landing gear: two main legs + wheels, one tail wheel.
  const gearLeft = new THREE.Group();
  const gearRight = new THREE.Group();
  for (const [side, gear] of [[-1, gearLeft], [1, gearRight]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), dark);
    leg.position.set(side * 0.9, -0.9, 0.7);
    leg.rotation.z = side * 0.28;
    gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.15, -1.4, 0.7);
    wheel.castShadow = true;
    gear.add(wheel);
    const hubcap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8), white);
    hubcap.rotation.z = Math.PI / 2;
    hubcap.position.copy(wheel.position);
    gear.add(hubcap);
    group.add(gear);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.55, -2.6);
  group.add(tailWheel);

  // Navigation lights: red left, green right, white tail.
  const navLeft = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  navLeft.position.set(-4.85, -0.25, 0.7);
  group.add(navLeft);
  const navRight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  navRight.position.set(4.85, -0.25, 0.7);
  group.add(navRight);

  group.traverse((o) => { if (o.isMesh) o.castShadow = o.castShadow ?? false; });

  return {
    group,
    propeller,
    propDisc: disc,
    gearLeft,
    gearRight,
    nose,
    cockpitInterior,
    canopyFrame,
    update(dt, flight) {
      propeller.rotation.z -= flight.propellerSpeed * dt;
      const rpm = Math.min(1, flight.propellerSpeed / 40);
      disc.material.opacity = rpm * 0.18;
      // Gear is fixed on this bush plane; keep the refs for shots/HUD.
      gearLeft.visible = true;
      gearRight.visible = true;
      // Cockpit needles. rotation.z is CCW seen from the nose; from the
      // pilot's seat it reads CCW-from-up, so value 0 sits lower-left
      // and full scale lower-right; the heading needle points at the
      // heading, clockwise from up.
      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      const valueAngle = (f) => (1 - 2 * clamp01(f)) * 2.356;
      needles.airspeed.rotation.z = valueAngle(flight.speed / 120);
      needles.altitude.rotation.z = valueAngle((flight.y * 3.28) / 1000);
      needles.heading.rotation.z = -THREE.MathUtils.degToRad(flight.headingDeg);
      needles.fuel.rotation.z = valueAngle(flight.fuel / 100);
      needles.throttle.rotation.z = valueAngle(flight.throttle);
    },
  };
}
