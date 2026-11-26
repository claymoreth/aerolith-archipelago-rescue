// Glowing flight rings for the Ring Run mission. Rings are torus
// meshes with an emissive core; only the active ring is bright gold,
// later rings are dim teal, passed rings turn green. An arrow above the
// plane always points at the next active ring.

import * as THREE from 'three';
import { COLORS, RUNWAY } from './config.js';

export function createRings(scene, positions) {
  const group = new THREE.Group();
  group.name = 'rings';
  scene.add(group);
  const rings = [];
  const geo = new THREE.TorusGeometry(7, 0.55, 12, 28);
  // Each ring faces the incoming flight direction (from the previous
  // ring, or from the runway spawn for ring 1) so it reads as a circle
  // on approach instead of an edge-on sliver.
  const spawn = [RUNWAY.centerX, 0, RUNWAY.centerZ - RUNWAY.length / 2 + 18];
  positions.forEach(([x, y, z], i) => {
    const prev = i === 0 ? spawn : positions[i - 1];
    const yaw = Math.atan2(x - prev[0], z - prev[2]);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.ringOrange,
      emissive: COLORS.ringOrange,
      emissiveIntensity: 0.7,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw; // torus axis (+Z) points along the approach
    mesh.userData.index = i;
    mesh.userData.baseScale = 1;
    group.add(mesh);
    // Inner glow disc so the ring reads from far away.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(6.4, 24),
      new THREE.MeshBasicMaterial({ color: COLORS.ringOrange, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
    );
    disc.position.copy(mesh.position);
    disc.rotation.y = yaw;
    group.add(disc);
    rings.push({ mesh, disc, passed: false, pos: new THREE.Vector3(x, y, z) });
  });

  // Guide arrow: a small cone floating above the plane, pointing at
  // the active ring. Built here so missions.js does not need scene access.
  const arrowMat = new THREE.MeshBasicMaterial({ color: COLORS.gold });
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 8), arrowMat);
  arrow.name = 'guide-arrow';
  arrow.visible = false;
  scene.add(arrow);

  let activeIndex = 0;

  function paint() {
    rings.forEach((r, i) => {
      if (r.passed) {
        r.mesh.material.color.set(0x2ecc71);
        r.mesh.material.emissive.set(0x2ecc71);
        r.mesh.material.emissiveIntensity = 0.45;
        r.disc.material.color.set(0x2ecc71);
      } else if (i === activeIndex) {
        r.mesh.material.color.set(COLORS.ringOrange);
        r.mesh.material.emissive.set(COLORS.ringOrange);
        r.mesh.material.emissiveIntensity = 1.4;
        r.disc.material.color.set(COLORS.ringOrange);
      } else {
        r.mesh.material.color.set(COLORS.teal);
        r.mesh.material.emissive.set(COLORS.teal);
        r.mesh.material.emissiveIntensity = 0.35;
        r.disc.material.color.set(COLORS.teal);
      }
    });
  }
  paint();

  return {
    group,
    rings,
    arrow,
    get activeIndex() { return activeIndex; },
    get activeRing() { return rings[activeIndex] || null; },
    get passedCount() { return rings.filter((r) => r.passed).length; },
    get total() { return rings.length; },
    get done() { return rings.every((r) => r.passed); },
    placeRings(newPositions) {
      newPositions.forEach(([x, y, z], i) => {
        if (!rings[i]) return;
        rings[i].pos.set(x, y, z);
        rings[i].mesh.position.set(x, y, z);
        rings[i].disc.position.set(x, y, z);
        rings[i].passed = false;
      });
      activeIndex = 0;
      paint();
    },
    reset() {
      rings.forEach((r) => { r.passed = false; });
      activeIndex = 0;
      arrow.visible = false;
      paint();
    },
    // Returns the ring index passed, or -1.
    checkRingPass(planePos) {
      const active = rings[activeIndex];
      if (!active || active.passed) return -1;
      const d = planePos.distanceTo(active.pos);
      if (d < 7.5) {
        active.passed = true;
        activeIndex = Math.min(activeIndex + 1, rings.length);
        paint();
        return active.mesh.userData.index;
      }
      return -1;
    },
    update(dt, time, planePos) {
      const pulse = 1 + Math.sin(time * 3.2) * 0.05;
      rings.forEach((r, i) => {
        const s = i === activeIndex ? pulse : 1;
        r.mesh.scale.setScalar(s);
        r.disc.scale.setScalar(s);
        r.disc.material.opacity = i === activeIndex ? 0.14 + Math.sin(time * 3.2) * 0.06 : 0.08;
      });
      // Guide arrow: hover above the plane, aim at the active ring.
      const active = rings[activeIndex];
      if (active && planePos) {
        arrow.visible = true;
        arrow.position.set(planePos.x, planePos.y + 4.2, planePos.z);
        const target = active.pos.clone();
        arrow.lookAt(target);
        arrow.rotateX(Math.PI / 2);
      } else {
        arrow.visible = false;
      }
      void dt;
    },
    hideArrow() { arrow.visible = false; },
  };
}
