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

  // Cockpit dashboard: a low, narrow dark strip + three tiny glowing
  // gauges, just above the nose line so the horizon stays clear from
  // the cockpit camera (a tall/close panel blocks the whole view).
  // Kept thin and near the nose: from the cockpit a deep/tilted panel
  // reads as a huge black slab.
  const dash = new THREE.Group();
  const dashPanel = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.12), lam(0x1d2126));
  dashPanel.position.set(0, 0.88, 2.6);
  dashPanel.rotation.x = -0.1;
  dash.add(dashPanel);
  const gaugeCols = [0x2fd6c8, 0xffb020, 0x7ddc4f];
  gaugeCols.forEach((c, i) => {
    const g = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 10, 8),
      new THREE.MeshBasicMaterial({ color: c }),
    );
    g.position.set((i - 1) * 0.3, 0.95, 2.62);
    dash.add(g);
  });
  group.add(dash);

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
    update(dt, flight) {
      propeller.rotation.z -= flight.propellerSpeed * dt;
      const rpm = Math.min(1, flight.propellerSpeed / 40);
      disc.material.opacity = rpm * 0.18;
      // Gear is fixed on this bush plane; keep the refs for shots/HUD.
      gearLeft.visible = true;
      gearRight.visible = true;
    },
  };
}
