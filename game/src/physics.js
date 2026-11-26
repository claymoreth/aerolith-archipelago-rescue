// Arcade flight model. The plane is a point with heading / pitch /
// roll; speed comes from throttle minus drag, lift needs speed above
// stall, and the ground constrains it until takeoff speed.

import { PLANE, RUNWAY, WORLD } from './config.js';
import { clamp, degToRad, angleDiffDeg } from './random.js';

export function createFlightState() {
  return {
    // Position / orientation.
    x: RUNWAY.centerX,
    y: 0.6,
    z: RUNWAY.centerZ - RUNWAY.length / 2 + 18, // south end, facing north (+Z)
    headingDeg: 0,   // 0 = +Z (north along the runway)
    pitchDeg: 0,
    rollDeg: 0,
    speed: 0,
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    verticalSpeed: 0,
    onGround: true,
    airborne: false,
    stalled: false,
    crashed: false,
    crashReason: '',
    landed: false,
    gearDown: true,
    propellerSpeed: 0,
  };
}

export function resetFlightState(state, start) {
  const fresh = createFlightState();
  Object.assign(state, fresh);
  if (start) {
    state.x = start.x ?? fresh.x;
    state.y = start.y ?? fresh.y;
    state.z = start.z ?? fresh.z;
    state.headingDeg = start.headingDeg ?? 0;
  }
  // Sit exactly on the ground at the spawn point.
  state.groundY = 0;
  return state;
}

export function updateFlight(state, input, dt, terrainHeightAt) {
  if (state.crashed) return state;
  dt = Math.min(dt, 0.05);

  // --- Throttle ---
  if (input.throttleUp) state.throttle = clamp(state.throttle + dt * 0.9, 0, 1);
  if (input.throttleDown) state.throttle = clamp(state.throttle - dt * 0.9, 0, 1);

  // --- Fuel ---
  const burn = PLANE.fuelBurnIdle + (PLANE.fuelBurnFull - PLANE.fuelBurnIdle) * state.throttle;
  if (state.fuel > 0) {
    state.fuel = Math.max(0, state.fuel - burn * dt);
  }
  const hasFuel = state.fuel > 0;
  const effectiveThrottle = hasFuel ? state.throttle : 0;

  // --- Speed: thrust minus drag (gear adds drag on the ground roll) ---
  const drag = PLANE.drag + (state.onGround && state.gearDown ? PLANE.gearDrag * 0.01 : 0);
  const targetAccel = effectiveThrottle * PLANE.accelPerThrottle - drag * state.speed;
  state.speed = Math.max(0, state.speed + targetAccel * dt);

  // --- Control authority scales with speed ---
  const authority = clamp(state.speed / 60, 0.15, 1);
  const pitchInput = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
  const rollInput = (input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0);
  const yawInput = (input.yawRight ? 1 : 0) - (input.yawLeft ? 1 : 0);

  if (state.onGround) {
    // Ground roll: only yaw steering, no pitch/roll until takeoff speed.
    state.headingDeg += yawInput * PLANE.yawRate * 0.6 * dt;
    state.pitchDeg = 0;
    state.rollDeg *= 0.8;
    if (state.speed >= PLANE.takeoffSpeed && pitchInput > 0) {
      state.onGround = false;
      state.airborne = true;
      state.pitchDeg = 6;
    }
  } else {
    state.pitchDeg = clamp(state.pitchDeg + pitchInput * PLANE.pitchRate * authority * dt, -38, 38);
    state.rollDeg = clamp(state.rollDeg + rollInput * PLANE.rollRate * authority * dt, -65, 65);
    // Banked turn: roll feeds heading. Rudder adds a little direct yaw.
    state.headingDeg += (-state.rollDeg * 0.55 + yawInput * PLANE.yawRate * 0.5) * authority * dt;
    // Gentle auto-level when the player lets go of roll.
    if (rollInput === 0) {
      const level = -state.rollDeg;
      state.rollDeg += clamp(level, -PLANE.autoLevelRate * dt, PLANE.autoLevelRate * dt);
    }
    if (pitchInput === 0) {
      state.pitchDeg *= Math.max(0, 1 - 0.25 * dt);
    }
  }

  // --- Stall: below stall speed the wing stops flying ---
  state.stalled = !state.onGround && state.speed < PLANE.stallSpeed;
  const heading = degToRad(state.headingDeg);
  const pitch = degToRad(state.pitchDeg);
  const forwardX = Math.sin(heading) * Math.cos(pitch);
  const forwardZ = Math.cos(heading) * Math.cos(pitch);
  const forwardY = Math.sin(pitch);

  let vy = forwardY * state.speed;
  if (state.stalled) vy -= PLANE.stallSink;
  if (!state.onGround && !hasFuel && state.speed < PLANE.stallSpeed) vy -= 3; // dead-stick glide sinks
  state.verticalSpeed = vy;

  state.x += forwardX * state.speed * dt;
  state.z += forwardZ * state.speed * dt;
  state.y += vy * dt;

  // --- World bounds: soft turn-back, never a hard wall ---
  const bound = WORLD.size / 2;
  if (Math.abs(state.x) > bound || Math.abs(state.z) > bound) {
    state.headingDeg += 180;
    state.x = clamp(state.x, -bound, bound);
    state.z = clamp(state.z, -bound, bound);
  }
  if (state.y > 320) {
    state.y = 320;
    state.pitchDeg = Math.min(state.pitchDeg, 0);
  }

  // --- Ground / water contact ---
  const groundY = terrainHeightAt(state.x, state.z);
  state.groundY = groundY;
  const clearance = state.y - groundY;
  const overWater = groundY <= 0.01;

  if (state.onGround) {
    state.y = Math.max(groundY, 0.35) + 0.25;
    state.landed = true;
    if (state.speed < 2 && state.throttle < 0.05) state.landed = true;
  } else if (clearance <= 0.3) {
    // Touchdown or impact.
    const onRunway = isOnRunway(state.x, state.z);
    const sink = -state.verticalSpeed;
    const gentle = sink <= PLANE.crashVerticalSpeed && state.speed <= 95 && (!overWater || onRunway);
    if (gentle && (onRunway || !overWater)) {
      // Landing: settle onto the ground, keep rolling.
      state.onGround = true;
      state.airborne = false;
      state.y = groundY + 0.35;
      state.pitchDeg = 0;
      state.rollDeg *= 0.4;
      state.landed = true;
    } else {
      state.crashed = true;
      state.crashReason = overWater && !onRunway
        ? 'Ditched in the ocean at speed'
        : sink > PLANE.crashVerticalSpeed
          ? 'Hard impact — descended too fast'
          : 'Crashed into terrain';
      state.y = groundY + 0.3;
    }
  } else if (clearance < 0.3 && overWater && state.y <= 0.4) {
    state.crashed = true;
    state.crashReason = 'Ditched in the ocean';
  }

  // Propeller spins with throttle (and windmills a little when gliding).
  const targetProp = hasFuel ? 4 + effectiveThrottle * 42 : state.speed * 0.08;
  state.propellerSpeed += (targetProp - state.propellerSpeed) * Math.min(1, dt * 2.5);
  return state;
}

export function isOnRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.centerX) <= RUNWAY.width / 2 + 2 &&
    Math.abs(z - RUNWAY.centerZ) <= RUNWAY.length / 2 + 2
  );
}

export function landingScore(state) {
  // Precision landing score for M3: 0..100 from centreline offset,
  // touchdown zone, speed and sink rate at the moment of touchdown.
  const centerOffset = Math.abs(state.x - RUNWAY.centerX);
  const along = Math.abs(state.z - RUNWAY.centerZ);
  const centreScore = Math.max(0, 1 - centerOffset / RUNWAY.maxCenterlineOffset);
  const zoneScore = Math.max(0, 1 - Math.max(0, along - RUNWAY.touchdownZone) / 90);
  const speedScore = state.speed <= RUNWAY.maxLandingSpeed ? 1 : Math.max(0, 1 - (state.speed - RUNWAY.maxLandingSpeed) / 30);
  const sinkScore = -state.verticalSpeed <= RUNWAY.maxLandingSink ? 1 : Math.max(0, 1 - (-state.verticalSpeed - RUNWAY.maxLandingSink) / 8);
  const headingScore = Math.max(0, 1 - Math.abs(angleDiffDeg(state.headingDeg, RUNWAY.headingDeg)) / 25);
  const total = (centreScore * 0.35 + zoneScore * 0.2 + speedScore * 0.2 + sinkScore * 0.15 + headingScore * 0.1) * 100;
  return {
    total: Math.round(total),
    centreOffset: Math.round(centerOffset * 10) / 10,
    speed: Math.round(state.speed),
    sink: Math.round(-state.verticalSpeed * 10) / 10,
    headingError: Math.round(Math.abs(angleDiffDeg(state.headingDeg, RUNWAY.headingDeg))),
  };
}

export function isLowFuel(state) {
  return state.fuel > 0 && state.fuel < 20;
}

export function isOutOfFuel(state) {
  return state.fuel <= 0;
}
