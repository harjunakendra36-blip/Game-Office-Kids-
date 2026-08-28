/**
 * Administrasi Cilik - Audio Engine
 * Pure Web Audio API Sound Synthesizer & Procedural BGM
 * 100% standalone, no external audio files required.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isBgmPlaying = false;
    this.bgmTimer = null;
    this.initAudioContext();
  }

  initAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      this.ctx = new AudioCtx();
    }
  }

  ensureContext() {
    if (!this.ctx) this.initAudioContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBgm();
    } else {
      this.startBgm();
    }
    return !this.isMuted;
  }

  /** Play a short pop / button click sound */
  playClick() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /** Desk Bell "Ding!" sound for receptionist */
  playBell() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [1046.5, 2093.0]; // High C notes
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.4 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.3);
    });
  }

  /** Paper Swoosh sound */
  playSwoosh() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** Satisfying Folder Snap into Drawer sound */
  playSnap() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Tone 1
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.05); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.1); // G5

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  /** Heavy Stamp "THUMP!" Sound with ink squish */
  playStamp() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Bass thud
    const oscThud = this.ctx.createOscillator();
    const gainThud = this.ctx.createGain();
    oscThud.type = 'triangle';
    oscThud.frequency.setValueAtTime(160, now);
    oscThud.frequency.exponentialRampToValueAtTime(40, now + 0.2);

    gainThud.gain.setValueAtTime(0.8, now);
    gainThud.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    oscThud.connect(gainThud);
    gainThud.connect(this.ctx.destination);

    oscThud.start(now);
    oscThud.stop(now + 0.23);

    // High snap
    const oscSnap = this.ctx.createOscillator();
    const gainSnap = this.ctx.createGain();
    oscSnap.type = 'sine';
    oscSnap.frequency.setValueAtTime(800, now);
    oscSnap.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    gainSnap.gain.setValueAtTime(0.3, now);
    gainSnap.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    oscSnap.connect(gainSnap);
    gainSnap.connect(this.ctx.destination);

    oscSnap.start(now);
    oscSnap.stop(now + 0.09);
  }

  /** Cash Register "Ka-Ching!" sound */
  playCashRegister() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [659.25, 783.99, 1046.50, 1318.51]; // E, G, C, E

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = now + (i * 0.06);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.25, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.45);
    });
  }

  /** Success & Fanfare Chime */
  playFanfare() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const melody = [
      { f: 523.25, d: 0.15 }, // C5
      { f: 659.25, d: 0.15 }, // E5
      { f: 783.99, d: 0.15 }, // G5
      { f: 1046.50, d: 0.4 }  // C6
    ];

    let t = now;
    melody.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.f, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + note.d + 0.05);

      t += note.d * 0.8;
    });
  }

  /** Cheerful procedural marimba / ukulele acoustic BGM loop */
  startBgm() {
    if (this.isMuted || this.isBgmPlaying) return;
    this.ensureContext();
    if (!this.ctx) return;

    this.isBgmPlaying = true;
    let step = 0;
    // Cheerful C Major Pentatonic loop (C4, D4, E4, G4, A4, C5)
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
    const pattern = [0, 2, 4, 2, 3, 5, 4, 1, 0, 4, 3, 2, 5, 3, 2, 0];

    const playStep = () => {
      if (!this.isBgmPlaying || this.isMuted || !this.ctx) return;

      const now = this.ctx.currentTime;
      const noteIdx = pattern[step % pattern.length];
      const freq = scale[noteIdx];

      // Soft marimba-like acoustic pluck
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.05, now); // Soft background volume
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);

      step++;
      this.bgmTimer = setTimeout(playStep, 260); // ~115 BPM rhythm
    };

    playStep();
  }

  stopBgm() {
    this.isBgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

// Global Sound Instance
window.soundEngine = new SoundEngine();
