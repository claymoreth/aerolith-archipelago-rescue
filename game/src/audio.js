// Procedural WebAudio: no audio files. Engine hum follows throttle,
// wind follows airspeed, plus chimes and stingers. Everything is
// created lazily on first user gesture so autoplay rules are respected.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      // Engine: two detuned saws through a lowpass.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 62;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 31;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();

      // Wind: looped noise buffer through a bandpass.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buf;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();
      started = true;
      return true;
    } catch (err) {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type = 'sine', vol = 0.25, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  return {
    get muted() { return muted; },
    get ready() { return started; },
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    toggleMute() {
      this.setMuted(!muted);
      return muted;
    },
    // Call every frame while flying.
    update(throttle, speed, airborne) {
      if (!ctx || muted) return;
      if (ctx.state === 'suspended') return;
      const now = ctx.currentTime;
      const engVol = airborne || throttle > 0.02 ? 0.05 + throttle * 0.11 : 0;
      engineGain.gain.setTargetAtTime(engVol, now, 0.12);
      const freq = 52 + throttle * 78 + speed * 0.22;
      engineOsc.frequency.setTargetAtTime(freq, now, 0.1);
      engineOsc2.frequency.setTargetAtTime(freq / 2, now, 0.1);
      const windVol = airborne ? Math.min(0.16, speed * 0.0016) : 0;
      windGain.gain.setTargetAtTime(windVol, now, 0.2);
      windFilter.frequency.setTargetAtTime(500 + speed * 9, now, 0.2);
    },
    ringChime() {
      tone(880, 0.35, 'sine', 0.3);
      tone(1318, 0.5, 'sine', 0.22, 0.07);
    },
    dropThunk() {
      tone(180, 0.25, 'triangle', 0.3);
      tone(90, 0.4, 'sine', 0.28, 0.05);
    },
    click() { tone(660, 0.07, 'square', 0.12); },
    success() {
      tone(523, 0.25, 'sine', 0.28);
      tone(659, 0.25, 'sine', 0.28, 0.12);
      tone(784, 0.5, 'sine', 0.3, 0.24);
    },
    fail() {
      tone(220, 0.4, 'sawtooth', 0.2);
      tone(165, 0.6, 'sawtooth', 0.2, 0.18);
    },
    stallWarn() { tone(440, 0.12, 'square', 0.14); },
  };
}
