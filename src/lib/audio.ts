let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

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
    master.connect(ctx.destination);
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

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.3,
  when = 0,
  freqEnd?: number,
) {
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
  tone(880, 0.16, "triangle", 0.35);
  tone(1760, 0.09, "sine", 0.12);
}

/** Energetic chime on 1 / reveal */
export function revealChime() {
  tone(784, 0.18, "triangle", 0.3, 0);
  tone(1046, 0.18, "triangle", 0.3, 0.08);
  tone(1568, 0.4, "triangle", 0.28, 0.16);
}

/** Soft mechanical woodblock tick */
export function tick(intensity: 0 | 1 | 2 = 0) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = intensity === 2 ? 1500 : intensity === 1 ? 1200 : 1000;
  filter.Q.value = 6;
  osc.type = "square";
  osc.frequency.setValueAtTime(intensity === 2 ? 900 : 700, t);
  osc.frequency.exponentialRampToValueAtTime(220, t + 0.04);
  const vol = intensity === 2 ? 0.26 : intensity === 1 ? 0.2 : 0.14;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  osc.connect(filter);
  filter.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + 0.1);
}

export function gotItSound() {
  tone(660, 0.1, "triangle", 0.3, 0);
  tone(990, 0.22, "triangle", 0.3, 0.07);
}

export function skipSound() {
  tone(330, 0.16, "sawtooth", 0.16, 0, 180);
}

/** Rounded punchy game-show buzzer */
export function buzzer() {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.45, t + 0.03);
  g.gain.setValueAtTime(0.45, t + 0.55);
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
    tone(f, 0.35, "triangle", 0.28, i * 0.11),
  );
}

export function stopAll() {
  if (!ctx) return;
  void ctx.close();
  ctx = null;
  master = null;
}
