// AEROLITH: ARCHIPELAGO RESCUE — bootstrap & game loop.
// Wires every module: world, aircraft, physics, missions, rings,
// camera, HUD, audio, input and the deterministic ?shot= scenes.

import * as THREE from 'three';
import { WORLD, MISSIONS, RING_POSITIONS, VERSION } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { createFlightState, updateFlight, landingScore, isOnRunway } from './physics.js';
import { buildWorld, terrainHeightAt } from './world.js';
import { buildAircraft } from './aircraft.js';
import { createMissionState, startMission, updateMission, setToast } from './missions.js';
import { createRings } from './rings.js';
import { createCameraRig } from './camera.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot') || '';
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const rng = makeRng(seed);
void rng;

const world = buildWorld(scene, seed);
const plane = buildAircraft();
scene.add(plane.group);
const rings = createRings(scene, RING_POSITIONS);
const flight = createFlightState();
const missions = createMissionState();
const input = createInput(canvas);
const cameraRig = createCameraRig(camera);
const hud = createHud();
const audio = createAudio();

let gameState = 'menu'; // menu | playing | paused | complete | failed
let frozen = false;     // ?shot= scenes freeze the sim for a stable frame
let cameraMode = 'chase';
let dropRequested = false;
let fps = 0;
let frames = 0;
let fpsTime = 0;
let elapsed = 0;
let last = performance.now();
let stallBeepAt = 0;

const $ = (id) => document.getElementById(id);
const menuEl = $('menu');
const endEl = $('end-screen');
const endTitle = $('end-title');
const endDetail = $('end-detail');
const pauseEl = $('pause-screen');

function syncPlaneMesh() {
  const THREE_MATH = THREE.MathUtils;
  plane.group.position.set(flight.x, flight.y, flight.z);
  plane.group.rotation.order = 'YXZ';
  // Mesh forward must match physics forward (sin h, cos h) with nose
  // up on positive pitch: rotation.y = +heading, rotation.x = -pitch.
  // (The old -heading / +pitch mirrored the plane, so it visibly flew
  // sideways relative to its motion and to the cockpit camera.)
  plane.group.rotation.y = THREE_MATH.degToRad(flight.headingDeg);
  plane.group.rotation.x = -THREE_MATH.degToRad(flight.pitchDeg);
  plane.group.rotation.z = THREE_MATH.degToRad(flight.rollDeg);
  // Sink the gear into the ground plane by the wheel radius when landed.
  if (flight.onGround) plane.group.position.y = flight.y;
}

function setCameraMode(mode) {
  cameraMode = mode;
  cameraRig.mode = mode;
}

function startMissionForShot(id) {
  startMission(missions, id, elapsed);
  gameState = 'playing';
  if (menuEl) menuEl.classList.add('hidden');
  if (endEl) endEl.classList.add('hidden');
  hud.show();
}

function showMenu() {
  gameState = 'menu';
  missions.status = 'menu';
  if (menuEl) menuEl.classList.remove('hidden');
  if (endEl) endEl.classList.add('hidden');
  if (pauseEl) pauseEl.classList.add('hidden');
  hud.hide();
  rings.reset();
  rings.hideArrow();
  // Reset the plane to the runway for the menu orbit backdrop.
  Object.assign(flight, createFlightState());
  syncPlaneMesh();
}

function beginMission(id) {
  audio.unlock();
  audio.click();
  startMission(missions, id, elapsed);
  Object.assign(flight, createFlightState());
  flight.y = terrainHeightAt(flight.x, flight.z) + 0.35;
  rings.reset();
  rings.hideArrow();
  if (id !== 'ring-run') rings.arrow.visible = false;
  gameState = 'playing';
  if (menuEl) menuEl.classList.add('hidden');
  if (endEl) endEl.classList.add('hidden');
  if (pauseEl) pauseEl.classList.add('hidden');
  hud.show();
  syncPlaneMesh();
}

function showEnd(title, detail) {
  if (endTitle) endTitle.textContent = title;
  if (endDetail) endDetail.textContent = detail;
  if (endEl) endEl.classList.remove('hidden');
}

function endMission(win) {
  if (win) {
    gameState = 'complete';
    audio.success();
    const land = missions.landing
      ? ' Landing accuracy ' + missions.landing.total + '/100 (centreline off by ' + missions.landing.centreOffset + ' m, speed ' + missions.landing.speed + ' kt).'
      : '';
    showEnd('MISSION COMPLETE', missions.mission.name + ' — Score ' + missions.score + '.' + land + ' Press R to fly again or Esc for menu.');
  } else {
    gameState = 'failed';
    audio.fail();
    const reason = missions.failReason || flight.crashReason || 'Mission failed';
    showEnd('MISSION FAILED', reason + ' — Score ' + missions.score + '. Press R to retry or Esc for menu.');
  }
}

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    if (pauseEl) pauseEl.classList.remove('hidden');
  } else if (gameState === 'paused') {
    gameState = 'playing';
    if (pauseEl) pauseEl.classList.add('hidden');
  }
}

// Menu wiring: mission cards + start button.
let selectedMission = 'ring-run';
document.querySelectorAll('[data-mission]').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedMission = btn.getAttribute('data-mission') || 'ring-run';
    document.querySelectorAll('[data-mission]').forEach((b) => b.classList.toggle('selected', b === btn));
    audio.unlock();
    audio.click();
  });
});
const startBtn = $('btn-start');
if (startBtn) startBtn.addEventListener('click', () => beginMission(selectedMission));
const restartBtn = $('btn-restart');
if (restartBtn) restartBtn.addEventListener('click', () => beginMission(missions.mission.id));
const menuBtn = $('btn-menu');
if (menuBtn) menuBtn.addEventListener('click', () => showMenu());
const resumeBtn = $('btn-resume');
if (resumeBtn) resumeBtn.addEventListener('click', () => togglePause());

function handleKeys() {
  if (input.wasPressed('KeyC') && gameState === 'playing') {
    setCameraMode(cameraMode === 'chase' ? 'cockpit' : 'chase');
    audio.click();
  }
  if (input.wasPressed('KeyM')) {
    audio.unlock();
    const m = audio.toggleMute();
    setToast(missions, m ? 'Sound muted (M to unmute)' : 'Sound on', elapsed, 2);
  }
  if (input.wasPressed('KeyP') && (gameState === 'playing' || gameState === 'paused')) togglePause();
  // R restarts only from an ended/paused state: a stray R mid-flight
  // used to wipe a live mission with no confirmation.
  if (input.wasPressed('KeyR') && (gameState === 'complete' || gameState === 'failed' || gameState === 'paused')) {
    beginMission(missions.mission.id);
  }
  if (input.wasPressed('Enter') && gameState === 'menu') beginMission(selectedMission);
  if (input.wasPressed('Digit1') && gameState === 'menu') { selectedMission = 'ring-run'; beginMission('ring-run'); }
  if (input.wasPressed('Digit2') && gameState === 'menu') { selectedMission = 'supply-drop'; beginMission('supply-drop'); }
  if (input.wasPressed('Digit3') && gameState === 'menu') { selectedMission = 'volcano-rescue'; beginMission('volcano-rescue'); }
  if (input.wasPressed('Digit4') && gameState === 'menu') { selectedMission = 'free-flight'; beginMission('free-flight'); }
  if (input.wasPressed('Space') && gameState === 'playing') {
    dropRequested = true;
    if (missions.mission.id === 'supply-drop') audio.dropThunk();
  }
  // Menu from an end/paused screen is Esc only — M is mute (handled
  // above). The dead branch that used to sit here checked KeyM a second
  // time and did nothing, while the end screen text promised "M for menu".
  if (input.wasPressed('Escape') && (gameState === 'complete' || gameState === 'failed' || gameState === 'paused')) {
    showMenu();
  }
}

function animate(nowMs) {
  requestAnimationFrame(animate);
  const now = nowMs / 1000;
  let dt = Math.min(0.05, (nowMs - last) / 1000 || 0.016);
  last = nowMs;
  elapsed = now;

  // Internal frame counter (1 s window) for the automation handle only;
  // there is no FPS readout in the HUD.
  frames++;
  if (now - fpsTime >= 1) {
    fps = frames;
    frames = 0;
    fpsTime = now;
  }

  handleKeys();

  if (!frozen && gameState === 'playing') {
    const prevCrashed = flight.crashed;
    updateFlight(flight, input, dt, terrainHeightAt);
    plane.update(dt, flight);
    syncPlaneMesh();

    const planePos = plane.group.position;
    updateMission(missions, {
      flight,
      rings: missions.mission.id === 'ring-run' ? rings : null,
      planePos,
      now: elapsed,
      dropRequested,
      onEvent: (kind) => {
        if (kind === 'ring') audio.ringChime();
        if (kind === 'complete') audio.success();
        if (kind === 'pickup') audio.ringChime();
      },
    }, dt);
    dropRequested = false;

    if (flight.stalled && now - stallBeepAt > 1.4) {
      stallBeepAt = now;
      audio.stallWarn();
    }
    if (missions.status === 'complete' && gameState === 'playing') endMission(true);
    else if (missions.status === 'failed' && gameState === 'playing') endMission(false);
    else if (flight.crashed && !prevCrashed && gameState === 'playing') {
      missions.status = 'failed';
      missions.failReason = flight.crashReason || 'You crashed';
      endMission(false);
    }

    audio.update(flight.throttle, flight.speed, flight.airborne);
    hud.update(flight, missions, rings, elapsed);
  } else if (gameState === 'menu') {
    // Idle menu: plane parked, camera orbits slowly.
    plane.update(dt, flight);
    cameraRig.updateOrbitCamera(now);
  } else if (gameState === 'paused' || gameState === 'complete' || gameState === 'failed') {
    // Hold the last frame; keep the HUD readable.
    hud.update(flight, missions, rings, elapsed);
  }

  if (gameState === 'playing' && !frozen) {
    if (cameraMode === 'cockpit') cameraRig.updateCockpitCamera(flight, input, dt);
    else cameraRig.updateChaseCamera(flight, input, dt, now);
    rings.update(dt, now, plane.group.position);
  } else if (frozen) {
    // Shot scene: camera already posed by the shot; still update rings
    // pulse once so the active ring glows, then hold.
    rings.update(0, now, plane.group.position);
    // No guide arrow in stills: from behind it reads as a stray yellow
    // triangle floating in the sky. (Gameplay is unaffected: frozen is
    // only set by ?shot= scenes.)
    rings.arrow.visible = false;
    if (cameraMode === 'cockpit') cameraRig.updateCockpitCamera(flight, input, 0.016);
    // Snap the chase camera: at headless ~4-7 FPS the normal lerp from
    // (0,8,-30) has not converged after 2.5 s, so the framing would
    // depend on frame count instead of the shot pose.
    else cameraRig.updateChaseCamera(flight, input, 10, now);
    hud.update(flight, missions, rings, elapsed);
  }

  // Ambient life: clouds drift, volcano smoke rises, lighthouse blinks.
  if (!frozen) {
    for (const c of world.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 1000) c.position.x = -1000;
    }
    world.smoke.forEach((puff, i) => {
      puff.position.y += dt * (2 + i * 0.3);
      puff.position.x += Math.sin(now * 0.4 + i) * dt * 1.2;
      if (puff.position.y > 190) puff.position.y = 105;
    });
    if (world.lamp) world.lamp.material.color.setHex(Math.sin(now * 2.4) > 0 ? 0xffc94d : 0x8a7a3a);
    if (world.crater) world.crater.material.color.setHex(Math.sin(now * 1.8) > 0 ? 0xff5a1f : 0xd63d12);
  }

  // Cockpit interior (panel, gauges, struts) exists only in cockpit view.
  if (plane.cockpitInterior) plane.cockpitInterior.visible = cameraMode === 'cockpit';
  // The canopy frame torus sits 0.5 m ahead of the cockpit camera, so in
  // cockpit view it reads as a giant black roll cage across the sky;
  // hide it there (the A-pillars frame the windscreen instead) and keep
  // it for the exterior/chase view.
  if (plane.canopyFrame) plane.canopyFrame.visible = cameraMode !== 'cockpit';

  input.endFrame();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// Debug / automation handle.
const api = {
  get state() { return gameState; },
  get flight() { return flight; },
  get missions() { return missions; },
  get rings() { return rings; },
  get plane() { return plane; },
  get now() { return elapsed; },
  get fps() { return fps; },
  version: VERSION,
  syncPlaneMesh,
  setCameraMode,
  startMissionForShot,
  hudShow() { hud.show(); },
  setToast(text, until) { missions.toast = text; missions.toastUntil = until; },
  freeze(v) { frozen = v; },
  beginMission,
  showMenu,
  isOnRunway: (x, z) => isOnRunway(x, z),
  landingScore: () => landingScore(flight),
};
window.__aerolith = api;

// Boot: menu first, unless a ?shot= scene was requested.
syncPlaneMesh();
showMenu();
if (shotName) {
  const ok = applyShot(api, shotName, seed);
  if (ok) {
    gameState = 'playing';
    if (menuEl) menuEl.classList.add('hidden');
  }
}
requestAnimationFrame(animate);

export { api };
