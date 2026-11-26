// Flight-instrument HUD: DOM gauges + one top-down minimap canvas.
// Kept separate from the 3D scene so the instruments stay crisp and
// readable at any resolution. update() is cheap and called every frame.

import { ISLANDS, RUNWAY, DROP_ZONE, HELIPAD } from './config.js';
import { missionObjectiveText, progressText } from './missions.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'),
    alt: $('hud-alt'),
    speed: $('hud-speed'),
    heading: $('hud-heading'),
    fuelFill: $('hud-fuel-fill'),
    fuelText: $('hud-fuel-text'),
    throttleFill: $('hud-throttle-fill'),
    objective: $('hud-objective'),
    progress: $('hud-progress'),
    timer: $('hud-timer'),
    score: $('hud-score'),
    warn: $('hud-warn'),
    toast: $('hud-toast'),
    minimap: $('minimap'),
    compass: $('hud-compass'),
  };
  const mapCtx = el.minimap ? el.minimap.getContext('2d') : null;
  let lastStallBeep = 0;

  function fmtTime(sec) {
    if (!sec || sec <= 0) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function drawMinimap(flight, missionState, rings) {
    if (!mapCtx || !el.minimap) return;
    const W = el.minimap.width;
    const H = el.minimap.height;
    const scale = W / 1200; // world spans roughly -600..600
    const toMap = (x, z) => [W / 2 + x * scale, H / 2 + z * scale];
    mapCtx.clearRect(0, 0, W, H);
    mapCtx.fillStyle = 'rgba(10, 40, 60, 0.85)';
    mapCtx.fillRect(0, 0, W, H);
    // Islands.
    for (const isle of ISLANDS) {
      const [mx, my] = toMap(isle.x, isle.z);
      mapCtx.beginPath();
      mapCtx.arc(mx, my, Math.max(3, isle.radius * scale), 0, Math.PI * 2);
      mapCtx.fillStyle = isle.kind === 'volcano' ? '#7a4a3a' : '#3fae5a';
      mapCtx.fill();
    }
    // Runway.
    const [rx, ry] = toMap(RUNWAY.centerX, RUNWAY.centerZ);
    mapCtx.fillStyle = '#e8e8e8';
    mapCtx.fillRect(rx - 2, ry - RUNWAY.length / 2 * scale, 4, RUNWAY.length * scale);
    // Drop zone / helipad target.
    const target = missionState.mission.id === 'supply-drop'
      ? [DROP_ZONE.x, DROP_ZONE.z, '#ffc94d']
      : missionState.mission.id === 'volcano-rescue'
        ? [HELIPAD.x + 26, HELIPAD.z, '#ff7a1a']
        : null;
    if (target) {
      const [tx, ty] = toMap(target[0], target[1]);
      mapCtx.beginPath();
      mapCtx.arc(tx, ty, 6, 0, Math.PI * 2);
      mapCtx.strokeStyle = target[2];
      mapCtx.lineWidth = 2;
      mapCtx.stroke();
    }
    // Active ring.
    if (rings && rings.activeRing) {
      const [gx, gy] = toMap(rings.activeRing.pos.x, rings.activeRing.pos.z);
      mapCtx.beginPath();
      mapCtx.arc(gx, gy, 5, 0, Math.PI * 2);
      mapCtx.strokeStyle = '#ff7a1a';
      mapCtx.lineWidth = 2;
      mapCtx.stroke();
    }
    // Plane: amber triangle rotated by heading (map north = -Z up here,
    // so heading 0 points up).
    const [px, py] = toMap(flight.x, flight.z);
    const h = (flight.headingDeg * Math.PI) / 180;
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(Math.PI - h);
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fillStyle = '#ffb020';
    mapCtx.fill();
    mapCtx.restore();
  }

  return {
    show() { if (el.hud) el.hud.classList.remove('hidden'); },
    hide() { if (el.hud) el.hud.classList.add('hidden'); },
    update(flight, missionState, rings, now) {
      if (!el.hud || el.hud.classList.contains('hidden')) return;
      if (el.alt) el.alt.textContent = Math.max(0, Math.round(flight.y * 3.28)) + ' ft';
      if (el.speed) el.speed.textContent = Math.round(flight.speed) + ' kt';
      const heading = ((Math.round(flight.headingDeg) % 360) + 360) % 360;
      if (el.heading) el.heading.textContent = String(heading).padStart(3, '0') + '°';
      if (el.compass) {
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const idx = Math.round(heading / 45) % 8;
        el.compass.textContent = dirs[idx] + ' ' + String(heading).padStart(3, '0') + '°';
      }
      if (el.fuelFill) el.fuelFill.style.width = Math.max(0, flight.fuel) + '%';
      if (el.fuelFill) el.fuelFill.classList.toggle('low', flight.fuel < 20);
      if (el.fuelText) el.fuelText.textContent = 'FUEL ' + Math.round(flight.fuel) + '%';
      if (el.throttleFill) el.throttleFill.style.width = Math.round(flight.throttle * 100) + '%';
      if (el.objective) el.objective.textContent = missionObjectiveText(missionState);
      if (el.progress) el.progress.textContent = progressText(missionState);
      if (el.timer) {
        el.timer.textContent = missionState.mission.timeLimit ? fmtTime(missionState.timeLeft) : 'FREE';
        el.timer.classList.toggle('urgent', missionState.timeLeft > 0 && missionState.timeLeft < 30);
      }
      if (el.score) el.score.textContent = 'SCORE ' + missionState.score;
      // Warnings: stall first, then low fuel, then low speed on approach.
      let warn = '';
      if (flight.stalled) warn = '⚠ STALL — PUSH NOSE DOWN, ADD POWER';
      else if (flight.fuel > 0 && flight.fuel < 20) warn = '⚠ LOW FUEL — LAND SOON';
      else if (flight.fuel <= 0) warn = '⚠ OUT OF FUEL — GLIDING';
      else if (!flight.onGround && flight.speed < 35) warn = '⚠ LOW SPEED';
      if (el.warn) {
        el.warn.textContent = warn;
        el.warn.classList.toggle('hidden', !warn);
        if (warn.startsWith('⚠ STALL') && now - lastStallBeep > 1.2) lastStallBeep = now;
      }
      if (el.toast) {
        const show = missionState.toast && now < missionState.toastUntil;
        el.toast.textContent = show ? missionState.toast : '';
        el.toast.classList.toggle('hidden', !show);
      }
      drawMinimap(flight, missionState, rings);
    },
  };
}
