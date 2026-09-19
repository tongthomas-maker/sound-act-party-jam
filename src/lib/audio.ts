let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let sfxOn = true;
let musicOn = true;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    // soft limiter keeps the louder mix clean instead of clipping
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-10, ctx.currentTime);
    comp.knee.setValueAtTime(18, ctx.currentTime);
    comp.ratio.setValueAtTime(6, ctx.currentTime);
    comp.attack.setValueAtTime(0.003, ctx.currentTime);
    comp.release.setValueAtTime(0.18, ctx.currentTime);
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ensure();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.01);
}

export function isMuted() {
  return muted;
}

/* ---------- independent channel toggles ---------- */
export function setSfxEnabled(on: boolean) {
  sfxOn = on;
}
export function isSfxEnabled() {
  return sfxOn;
}
export function setMusicEnabled(on: boolean) {
  musicOn = on;
  if (!on) stopMusic();
}
export function isMusicEnabled() {
  return musicOn;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.3,
  when = 0,
  freqEnd?: number,
) {
  if (!sfxOn) return;
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Crisp countdown beep (5,4,3,2) */
export function countdownBeep() {
  tone(880, 0.18, "triangle", 0.62);
  tone(1760, 0.09, "sine", 0.16);
  tone(440, 0.14, "sine", 0.3);
}

/** Energetic chime on 1 / reveal */
export function revealChime() {
  tone(784, 0.18, "triangle", 0.55, 0);
  tone(1046, 0.18, "triangle", 0.55, 0.08);
  tone(1568, 0.4, "triangle", 0.5, 0.16);
  tone(392, 0.3, "sine", 0.3, 0);
}

/** Soft mechanical woodblock tick */
export function tick(intensity: 0 | 1 | 2 = 0) {
  if (!sfxOn) return;
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = intensity === 2 ? 1050 : intensity === 1 ? 950 : 850;
  filter.Q.value = 4;
  osc.type = "square";
  osc.frequency.setValueAtTime(intensity === 2 ? 760 : 660, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.045);
  const vol = intensity === 2 ? 0.5 : intensity === 1 ? 0.38 : 0.26;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  osc.connect(filter);
  filter.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** Low pressure pulse — felt rather than heard as a literal heartbeat. */
export function heartbeat(intensity = 1) {
  if (!sfxOn) return;
  const c = ensure();
  if (!c || !master) return;
  const thump = (when: number, gain: number) => {
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 120;
    osc.type = "sine";
    osc.frequency.setValueAtTime(78, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(lp);
    lp.connect(g);
    g.connect(master as GainNode);
    osc.start(t);
    osc.stop(t + 0.3);
  };
  thump(0, 0.3 * intensity);
  thump(0.18, 0.2 * intensity);
}

export function gotItSound() {
  tone(660, 0.1, "triangle", 0.5, 0);
  tone(990, 0.22, "triangle", 0.5, 0.07);
}

export function skipSound() {
  tone(330, 0.16, "sawtooth", 0.3, 0, 180);
}

/** Rounded punchy game-show buzzer */
export function buzzer() {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 780;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.95, t + 0.03);
  g.gain.setValueAtTime(0.95, t + 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
  filter.connect(g);
  g.connect(master);
  [110, 165, 82].forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = i === 2 ? "square" : "sawtooth";
    osc.frequency.setValueAtTime(f, t);
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + 0.8);
  });
}

export function fanfare() {
  [523, 659, 784, 1046].forEach((f, i) =>
    tone(f, 0.35, "triangle", 0.45, i * 0.11),
  );
}

/* ---------- Sound V2: light instrumental game bed ---------- */

let musicGain: GainNode | null = null;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicStep = 0;
let musicDuck = 1;

const BASS = [55, 55, 73.42, 65.41]; // A1 A1 D2 C2 — per bar
const ARP = [440, 659.25, 554.37, 659.25, 493.88, 739.99, 587.33, 493.88];

function musicNote(freq: number, dur: number, type: OscillatorType, gain: number) {
  const c = ctx;
  if (!c || !musicGain) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Start the light, vocal-free energy bed. Safe to call repeatedly. */
export function startMusic() {
  if (!musicOn || musicTimer) return;
  const c = ensure();
  if (!c || !master) return;
  musicGain = c.createGain();
  musicGain.gain.value = 0.16;
  musicDuck = 1;
  musicGain.connect(master);
  musicStep = 0;

  const STEP_MS = 200; // ~150 bpm eighth notes
  musicTimer = setInterval(() => {
    const s = musicStep % 8;
    if (s === 0 || s === 4) {
      const bar = Math.floor(musicStep / 8) % BASS.length;
      musicNote(BASS[bar] as number, 0.26, "triangle", 0.5);
    }
    if (s % 2 === 0) musicNote(ARP[s] as number, 0.12, "square", 0.075);
    else musicNote((ARP[s] as number) * 2, 0.06, "square", 0.03);
    if (s === 2 || s === 6) musicNote(1200, 0.035, "triangle", 0.05); // light hat
    musicStep += 1;
  }, STEP_MS);
}

/** Duck the bed toward silence as pressure builds (1 = full, 0 = out). */
export function setMusicIntensity(level: number) {
  musicDuck = Math.max(0, Math.min(1, level));
  if (musicGain && ctx)
    musicGain.gain.setTargetAtTime(0.16 * musicDuck, ctx.currentTime, 0.25);
}

export function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  if (musicGain && ctx) {
    musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
    const g = musicGain;
    musicGain = null;
    setTimeout(() => {
      try {
        g.disconnect();
      } catch {
        /* ignore */
      }
    }, 600);
  }
}

export function stopAll() {
  stopMusic();
  if (!ctx) return;
  void ctx.close();
  ctx = null;
  master = null;
}
