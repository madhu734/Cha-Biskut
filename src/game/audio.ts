/**
 * 100% Procedural Web Audio API Synthesizer for Cha-Biscuit Dipping Simulator.
 * Zero external MP3 dependencies.
 */
export class TongAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private dipGain: GainNode | null = null;
  private dipFilter: BiquadFilterNode | null = null;
  private dipLfo: OscillatorNode | null = null;
  private dipNoiseSource: AudioBufferSourceNode | null = null;
  private bubbleTimer: number | null = null;

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stopDippingSound();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Starts gentle bubbling/dipping liquid sound while holding the biscuit in tea.
   */
  public startDippingSound(): void {
    if (this.isMuted || this.dipNoiseSource) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const noiseBuffer = this.createNoiseBuffer(ctx, 2.0);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(380, now);
    filter.Q.setValueAtTime(4.5, now);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(7.5, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(140, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.12);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    lfo.start(now);

    this.dipNoiseSource = source;
    this.dipFilter = filter;
    this.dipLfo = lfo;
    this.dipGain = gain;

    // Periodic tiny tea-bubble blips while soaking
    this.bubbleTimer = window.setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      this.playSingleBubble(0.045);
    }, 180);
  }

  /**
   * Modulates bubble intensity as soak % rises.
   */
  public updateDippingProgress(soakPercent: number): void {
    if (!this.ctx || !this.dipFilter || !this.dipLfo) return;
    const now = this.ctx.currentTime;
    const targetFreq = 340 + (soakPercent / 100) * 320;
    const targetLfo = 6 + (soakPercent / 100) * 10;
    this.dipFilter.frequency.setTargetAtTime(targetFreq, now, 0.05);
    this.dipLfo.frequency.setTargetAtTime(targetLfo, now, 0.05);
  }

  private playSingleBubble(volume = 0.05): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const baseFreq = 260 + Math.random() * 280;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.1, now + 0.075);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public stopDippingSound(): void {
    if (this.bubbleTimer !== null) {
      clearInterval(this.bubbleTimer);
      this.bubbleTimer = null;
    }
    if (this.ctx && this.dipGain) {
      try {
        const now = this.ctx.currentTime;
        this.dipGain.gain.setTargetAtTime(0.0001, now, 0.03);
      } catch {
        // ignore
      }
    }
    if (this.dipNoiseSource) {
      try {
        this.dipNoiseSource.stop();
        this.dipNoiseSource.disconnect();
      } catch {
        // ignore
      }
      this.dipNoiseSource = null;
    }
    if (this.dipLfo) {
      try {
        this.dipLfo.stop();
        this.dipLfo.disconnect();
      } catch {
        // ignore
      }
      this.dipLfo = null;
    }
    this.dipFilter = null;
    this.dipGain = null;
  }

  /**
   * Crisp "Crunch" sound if pulled out too dry (< 65% soaked).
   */
  public playDryCrunch(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Two-stage dry biscuit snap + toothy crunch burst
    [0, 0.09].forEach((offset, idx) => {
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(ctx, 0.12);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(idx === 0 ? 1450 : 1950, now + offset);
      filter.Q.setValueAtTime(2.2, now + offset);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.002, now + offset + 0.11);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now + offset);
      noise.stop(now + offset + 0.12);
    });

    // Low dry thud
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.12);
    oscGain.gain.setValueAtTime(0.15, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * Satisfying "Slurp + Bite" chime on a Perfect Dip (70% to 92% soaked).
   */
  public playPerfectSlurpAndChime(combo = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Warm Tea Slurp (sweeping resonant bandpass noise + sine whistle)
    const slurpNoise = ctx.createBufferSource();
    slurpNoise.buffer = this.createNoiseBuffer(ctx, 0.24);
    const slurpFilter = ctx.createBiquadFilter();
    slurpFilter.type = 'bandpass';
    slurpFilter.Q.setValueAtTime(6.0, now);
    slurpFilter.frequency.setValueAtTime(320, now);
    slurpFilter.frequency.exponentialRampToValueAtTime(1280, now + 0.2);

    const slurpGain = ctx.createGain();
    slurpGain.gain.setValueAtTime(0.01, now);
    slurpGain.gain.linearRampToValueAtTime(0.16, now + 0.08);
    slurpGain.gain.exponentialRampToValueAtTime(0.002, now + 0.23);

    slurpNoise.connect(slurpFilter);
    slurpFilter.connect(slurpGain);
    slurpGain.connect(ctx.destination);
    slurpNoise.start(now);
    slurpNoise.stop(now + 0.24);

    // 2. Soft Bite Mmm-Crunch at +0.16s
    const biteNoise = ctx.createBufferSource();
    biteNoise.buffer = this.createNoiseBuffer(ctx, 0.09);
    const biteFilter = ctx.createBiquadFilter();
    biteFilter.type = 'lowpass';
    biteFilter.frequency.setValueAtTime(920, now + 0.16);
    const biteGain = ctx.createGain();
    biteGain.gain.setValueAtTime(0.14, now + 0.16);
    biteGain.gain.exponentialRampToValueAtTime(0.002, now + 0.24);
    biteNoise.connect(biteFilter);
    biteFilter.connect(biteGain);
    biteGain.connect(ctx.destination);
    biteNoise.start(now + 0.16);
    biteNoise.stop(now + 0.25);

    // 3. Golden Arpeggio Chime (scales pitch slightly with combo)
    const pitchBoost = Math.min(1.25, 1 + (combo - 1) * 0.04);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t = now + 0.12 + i * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * pitchBoost, t);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  /**
   * Dramatic wet "PLOP / SPLASH" sound followed by a sad descending harmonium/trombone
   * note when the biscuit breaks into the cup!
   */
  public playTragedySplashAndSadHorn(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Wet PLOP (fast pitch-drop resonant sine + splash noise)
    const plopOsc = ctx.createOscillator();
    const plopGain = ctx.createGain();
    plopOsc.type = 'sine';
    plopOsc.frequency.setValueAtTime(420, now);
    plopOsc.frequency.exponentialRampToValueAtTime(95, now + 0.09);
    plopOsc.frequency.exponentialRampToValueAtTime(290, now + 0.19);

    plopGain.gain.setValueAtTime(0.28, now);
    plopGain.gain.exponentialRampToValueAtTime(0.002, now + 0.22);
    plopOsc.connect(plopGain);
    plopGain.connect(ctx.destination);
    plopOsc.start(now);
    plopOsc.stop(now + 0.23);

    // Splash droplets noise
    const splashNoise = ctx.createBufferSource();
    splashNoise.buffer = this.createNoiseBuffer(ctx, 0.28);
    const splashFilter = ctx.createBiquadFilter();
    splashFilter.type = 'bandpass';
    splashFilter.frequency.setValueAtTime(820, now + 0.04);
    splashFilter.Q.setValueAtTime(1.8, now + 0.04);
    const splashGain = ctx.createGain();
    splashGain.gain.setValueAtTime(0.2, now + 0.04);
    splashGain.gain.exponentialRampToValueAtTime(0.002, now + 0.3);
    splashNoise.connect(splashFilter);
    splashFilter.connect(splashGain);
    splashGain.connect(ctx.destination);
    splashNoise.start(now + 0.04);
    splashNoise.stop(now + 0.31);

    // 2. Sad Descending Harmonium / Trombone ("Womp-Womp-Woooooomp")
    const sadNotes = [
      { freqStart: 311.13, freqEnd: 293.66, start: 0.26, dur: 0.22 },
      { freqStart: 293.66, freqEnd: 277.18, start: 0.50, dur: 0.22 },
      { freqStart: 261.63, freqEnd: 196.00, start: 0.74, dur: 0.62 },
    ];

    sadNotes.forEach(({ freqStart, freqEnd, start, dur }) => {
      const t = now + start;
      const osc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      subOsc.type = 'square';

      osc.frequency.setValueAtTime(freqStart, t);
      osc.frequency.linearRampToValueAtTime(freqEnd, t + dur);

      subOsc.frequency.setValueAtTime(freqStart * 0.5, t);
      subOsc.frequency.linearRampToValueAtTime(freqEnd * 0.5, t + dur);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(720, t);
      filter.frequency.linearRampToValueAtTime(420, t + dur);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.13, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(filter);
      subOsc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      subOsc.start(t);
      osc.stop(t + dur + 0.02);
      subOsc.stop(t + dur + 0.02);
    });
  }

  public playUiClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.045);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }
}

export const tongAudio = new TongAudioEngine();
