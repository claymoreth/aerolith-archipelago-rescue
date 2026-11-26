// Cameras: smooth chase cam, cockpit cam, and a slow menu orbit.
// All cameras look at the plane; the chase cam lerps so turns feel
// weighty instead of snapping.

import * as THREE from 'three';
import { CAMERA } from './config.js';
import { degToRad, lerp } from './random.js';

export function createCameraRig(camera) {
  const chasePos = new THREE.Vector3(0, 8, -30);
  const lookTarget = new THREE.Vector3();
  const desired = new THREE.Vector3();
  return {
    mode: 'chase', // chase | cockpit | orbit
    chasePos,
    updateChaseCamera(flight, input, dt, time) {
      const heading = degToRad(flight.headingDeg);
      const backX = -Math.sin(heading);
      const backZ = -Math.cos(heading);
      desired.set(
        flight.x + backX * CAMERA.chaseDistance,
        flight.y + CAMERA.chaseHeight,
        flight.z + backZ * CAMERA.chaseDistance,
      );
      // Keep the camera out of the terrain / sea.
      desired.y = Math.max(desired.y, 2.2);
      const k = 1 - Math.exp(-CAMERA.smooth * dt);
      chasePos.lerp(desired, k);
      // Mouse look-around offsets the view a little without moving the cam.
      lookTarget.set(
        flight.x + Math.sin(heading) * CAMERA.chaseLookAhead + (input ? input.lookX * 6 : 0),
        flight.y + 1.2 + (input ? -input.lookY * 4 : 0),
        flight.z + Math.cos(heading) * CAMERA.chaseLookAhead,
      );
      camera.position.copy(chasePos);
      camera.lookAt(lookTarget);
      camera.fov = lerp(camera.fov, CAMERA.fov + Math.min(10, flight.speed * 0.06), Math.min(1, dt * 3));
      camera.updateProjectionMatrix();
      void time;
    },
    updateCockpitCamera(flight, input, dt) {
      const heading = degToRad(flight.headingDeg);
      const pitch = degToRad(flight.pitchDeg);
      const roll = degToRad(flight.rollDeg);
      const [ox, oy, oz] = CAMERA.cockpitOffset;
      // The camera is the pilot's head: rigidly attached to the plane,
      // so its position rotates with heading, pitch AND roll exactly
      // like the airframe. (The old heading-only offset let the camera
      // drift outside the canopy glass on a pitched-down shot, and the
      // glass then washed out the whole view.)
      const off = new THREE.Vector3(ox, oy, oz).applyEuler(new THREE.Euler(-pitch, heading, roll, 'YXZ'));
      camera.position.set(flight.x + off.x, flight.y + off.y, flight.z + off.z);
      camera.rotation.order = 'YXZ';
      // Three.js cameras face -Z by default, the plane nose faces +Z at
      // heading 0, so the cockpit must look along PI + heading.
      camera.rotation.y = Math.PI + heading + (input ? input.lookX * 0.5 : 0);
      camera.rotation.x = pitch + (input ? -input.lookY * 0.4 : 0);
      camera.rotation.z = roll * 0.6;
      camera.fov = lerp(camera.fov, CAMERA.fov, Math.min(1, dt * 3));
      camera.updateProjectionMatrix();
    },
    updateOrbitCamera(time) {
      const a = time * 0.07;
      const r = 150;
      camera.position.set(Math.sin(a) * r, 55 + Math.sin(time * 0.11) * 8, Math.cos(a) * r);
      camera.lookAt(0, 12, 0);
      camera.fov = lerp(camera.fov, 55, 0.05);
      camera.updateProjectionMatrix();
    },
  };
}
