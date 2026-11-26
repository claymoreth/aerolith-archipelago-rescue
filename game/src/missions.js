// Mission definitions + state machine. Missions are data (from
// config.js) plus a small runtime: timer, score, stage flags, win/fail
// checks. The game loop owns rendering; this module owns the rules.

import { MISSIONS, RING_POSITIONS, DROP_ZONE, HELIPAD, RUNWAY } from './config.js';
import { landingScore } from './physics.js';

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[3];
}

export function createMissionState() {
  return {
    mission: MISSIONS[3], // free flight by default
    status: 'menu',        // menu | playing | complete | failed
    timeLeft: 0,
    elapsed: 0,
    score: 0,
    ringsPassed: 0,
    dropped: false,
    dropResult: null,      // 'hit' | 'miss' | null
    hikerPickedUp: false,
    landing: null,         // landingScore() result once landed in M3
    failReason: '',
    toast: '',
    toastUntil: 0,
  };
}

export function startMission(state, missionId, now = 0) {
  const mission = getMission(missionId);
  state.mission = mission;
  state.status = 'playing';
  state.timeLeft = mission.timeLimit;
  state.elapsed = 0;
  state.score = 0;
  state.ringsPassed = 0;
  state.dropped = false;
  state.dropResult = null;
  state.hikerPickedUp = false;
  state.landing = null;
  state.failReason = '';
  state.toast = mission.name + ' — ' + mission.description;
  state.toastUntil = now + 5;
  return state;
}

export function setToast(state, text, now, seconds = 3.5) {
  state.toast = text;
  state.toastUntil = now + seconds;
}

// Per-frame mission logic. `world` carries the live objects the rules
// need: { flight, rings, planePos, now, onEvent }.
export function updateMission(state, world, dt) {
  if (state.status !== 'playing') return state;
  const { flight, rings, planePos } = world;
  state.elapsed += dt;
  if (state.mission.timeLimit > 0) {
    state.timeLeft = Math.max(0, state.mission.timeLimit - state.elapsed);
    if (state.timeLeft <= 0) {
      return failMission(state, 'Time ran out');
    }
  }
  if (flight.crashed) {
    return failMission(state, flight.crashReason || 'You crashed');
  }
  if (flight.fuel <= 0 && !flight.onGround) {
    setToast(state, 'OUT OF FUEL — glide and land!', world.now, 2);
  }

  const id = state.mission.id;

  if (id === 'ring-run' && rings) {
    const passed = rings.checkRingPass(planePos);
    if (passed >= 0) {
      state.ringsPassed++;
      state.score += state.mission.ringReward;
      setToast(state, 'Ring ' + (passed + 1) + ' cleared! +' + state.mission.ringReward, world.now);
      if (world.onEvent) world.onEvent('ring', passed);
      if (rings.done) return completeMission(state, world);
    }
  }

  if (id === 'supply-drop' && !state.dropped) {
    const dx = planePos.x - DROP_ZONE.x;
    const dz = planePos.z - DROP_ZONE.z;
    const over = Math.hypot(dx, dz) < DROP_ZONE.radius + 30;
    if (over && world.dropRequested) {
      state.dropped = true;
      const dist = Math.hypot(dx, dz);
      if (dist <= DROP_ZONE.radius) {
        state.dropResult = 'hit';
        state.score += state.mission.dropReward;
        setToast(state, 'Supply drop ON TARGET! +' + state.mission.dropReward, world.now);
        if (world.onEvent) world.onEvent('drop-hit', dist);
        return completeMission(state, world);
      }
      state.dropResult = 'miss';
      setToast(state, 'Drop missed the zone — supplies lost in the sea', world.now, 4);
      if (world.onEvent) world.onEvent('drop-miss', dist);
      return failMission(state, 'Supply drop missed the marked zone');
    }
    if (world.dropRequested) {
      setToast(state, 'Not over the drop zone yet — fly to Far Atoll', world.now, 2.5);
    }
  }

  if (id === 'volcano-rescue') {
    if (!state.hikerPickedUp) {
      const dx = planePos.x - (HELIPAD.x + 26);
      const dz = planePos.z - HELIPAD.z;
      const dist = Math.hypot(dx, dz);
      const low = planePos.y < 118 && planePos.y > 88;
      if (dist < HELIPAD.radius + 8 && low && flight.speed > 20) {
        state.hikerPickedUp = true;
        state.score += state.mission.pickupReward;
        setToast(state, 'Hiker aboard! Now fly home and land on the runway', world.now, 5);
        if (world.onEvent) world.onEvent('pickup', 0);
      }
    } else if (flight.onGround && flight.speed < 6) {
      // Landed after pickup: score the precision landing.
      const inStrip =
        Math.abs(planePos.x - RUNWAY.centerX) <= RUNWAY.width / 2 + 4 &&
        Math.abs(planePos.z - RUNWAY.centerZ) <= RUNWAY.length / 2 + 4;
      if (inStrip) {
        state.landing = landingScore(flight);
        state.score += Math.round((state.landing.total / 100) * state.mission.landingReward);
        return completeMission(state, world);
      }
      return failMission(state, 'Landed off the runway — the rescue needs a runway landing');
    }
  }

  return state;
}

export function timeBonus(state) {
  if (!state.mission.timeLimit) return 0;
  return Math.round(state.timeLeft * (state.mission.timeBonusPerSecond || 0));
}

export function completeMission(state, world) {
  const bonus = timeBonus(state);
  state.score += bonus;
  state.status = 'complete';
  state.toast = 'Mission complete! Time bonus +' + bonus;
  state.toastUntil = (world ? world.now : 0) + 6;
  if (world && world.onEvent) world.onEvent('complete', state.score);
  return state;
}

export function failMission(state, reason) {
  state.status = 'failed';
  state.failReason = reason;
  state.toast = 'Mission failed — ' + reason;
  state.toastUntil = 0;
  return state;
}

export function checkWin(state) {
  return state.status === 'complete';
}

export function checkFail(state) {
  return state.status === 'failed' || state.status === 'crashed';
}

export function missionObjectiveText(state) {
  const m = state.mission;
  if (m.id === 'ring-run') return 'Fly through ring ' + (state.ringsPassed + 1) + ' of ' + RING_POSITIONS.length;
  if (m.id === 'supply-drop') return state.dropped ? 'Supplies delivered' : 'Drop supplies on Far Atoll (Space)';
  if (m.id === 'volcano-rescue') {
    return state.hikerPickedUp
      ? 'Hiker aboard — land on the home runway'
      : 'Fly low over the volcano helipad to pick up the hiker';
  }
  return 'Explore the archipelago';
}

export function progressText(state) {
  if (state.mission.id === 'ring-run') return 'Ring ' + state.ringsPassed + '/' + RING_POSITIONS.length;
  if (state.mission.id === 'supply-drop') return state.dropped ? 'Dropped' : 'En route';
  if (state.mission.id === 'volcano-rescue') return state.hikerPickedUp ? 'Return home' : 'Pickup';
  return '—';
}
