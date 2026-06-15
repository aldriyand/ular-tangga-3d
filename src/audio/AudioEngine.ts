/**
 * Procedural audio engine. All sounds are synthesized with the
 * Web Audio API — no audio files, no licensing issues, no asset
 * pipeline. This keeps the bundle small and the app offline-ready.
 *
 * Sound design:
 *   - dice-rolled:     short percussive click (filtered noise burst)
 *   - snake:           descending pitch sweep (low to lower)
 *   - ladder:          rising pentatonic chime (3 notes ascending)
 *   - win:             celebratory major arpeggio (5 notes)
 *   - lock:            soft "tick" (short sine pulse)
 *
 * The audio context is created lazily on the first user gesture
 * (browser autoplay policy requires this).
 */
export type SfxName = 'dice-rolled' | 'snake' | 'ladder' | 'win' | 'lock';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  /** Master volume 0..1 */
  volume = 0.6;

  /** Ensure the audio context exists. Must be called from a user gesture. */
  ensureContext(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return; // Browser doesn't support Web Audio
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  isMuted(): boolean { return this.muted; }

  /** Play a sound effect by name. Safe to call before ensureContext — just no-ops. */
  play(name: SfxName): void {
    if (!this.ctx || !this.master) return;
    const master = this.master; // Local non-null reference for closures below
    if (this.muted) return;
    switch (name) {
      case 'dice-rolled':   this.playDiceClick(master); break;
      case 'snake':         this.playSnakeSlide(master); break;
      case 'ladder':        this.playLadderClimb(master); break;
      case 'win':           this.playWinFlourish(master); break;
      case 'lock':          this.playLock(master); break;
    }
  }

  // --- SFX implementations ---

  /** Short percussive click: filtered noise burst with sharp envelope. */
  private playDiceClick(master: GainNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + 0.07);
  }

  /** Descending pitch sweep (gamelan-like): sine oscillator + a tonal hit at the end. */
  private playSnakeSlide(master: GainNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  /** Rising pentatonic chime (gamelan-inspired): 3 sine notes ascending. */
  private playLadderClimb(master: GainNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // Pentatonic ascending: C5, E5, G5
    const notes = [523.25, 659.26, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const startT = now + i * 0.12;
      gain.gain.setValueAtTime(0.001, startT);
      gain.gain.exponentialRampToValueAtTime(0.16, startT + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.35);
      osc.connect(gain);
      gain.connect(master);
      osc.start(startT);
      osc.stop(startT + 0.4);
    });
  }

  /** Celebratory major arpeggio: 5 notes spanning an octave. */
  private playWinFlourish(master: GainNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // Major chord arpeggio: C, E, G, C, E (one octave up)
    const notes = [523.25, 659.26, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const startT = now + i * 0.1;
      gain.gain.setValueAtTime(0.001, startT);
      gain.gain.exponentialRampToValueAtTime(0.18, startT + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.5);
      osc.connect(gain);
      gain.connect(master);
      osc.start(startT);
      osc.stop(startT + 0.55);
    });
  }

  /** Soft tick when a die is locked. */
  private playLock(master: GainNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}
