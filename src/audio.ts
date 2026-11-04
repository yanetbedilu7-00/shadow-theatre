let ctx: AudioContext | undefined;

// A short synthesized note. Fails silently if audio isn't available.
export function beep(
  freq: number,
  duration = 0.35,
  type: OscillatorType = 'sine',
  volume = 0.12,
): void {
  try {
    if (ctx === undefined) {
      ctx = new AudioContext();
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  } catch {
    // Audio is optional.
  }
}