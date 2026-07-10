// Web Audio API sound system - with music and engine
class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.3;
    this.music = null;
    this.engine = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineNoise = null;
    this.engineNoiseGain = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.music = new MusicPlayer(this.ctx, this);
    }
    if (!this.engineOsc) this.setupEngine();
  }

  setupEngine() {
    if (!this.ctx || this.engineOsc) return;
    // Main engine oscillator
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 80;

    // Engine gain
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    // Noise for rumble
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    this.engineNoise = this.ctx.createBufferSource();
    this.engineNoise.buffer = buffer;
    this.engineNoise.loop = true;

    this.engineNoiseGain = this.ctx.createGain();
    this.engineNoiseGain.gain.value = 0;

    // Filter noise
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 400;

    // Route: osc → gain → master, noise → noiseGain → filter → master
    this.engineOsc.connect(this.engineGain);
    this.engineNoise.connect(this.engineNoiseGain);
    this.engineNoiseGain.connect(noiseFilter);
    noiseFilter.connect(this.engineGain);

    this.engineGain.connect(this.ctx.destination);

    // Don't start yet - wait for startEngine()
    this.engine = { running: false };
  }

  startEngine() {
    if (!this.ctx || !this.engineOsc || !this.enabled) return;
    try {
      this.engineOsc.start();
      this.engineNoise.start();
    } catch (e) {
      // May already be started
    }
    this.engine.running = true;
  }

  stopEngine() {
    if (!this.engineOsc || !this.engineNoise) return;
    try {
      this.engineOsc.stop();
      this.engineNoise.stop();
    } catch (e) {}
    this.engineOsc = null;
    this.engineNoise = null;
    this.engineGain = null;
    this.engineNoiseGain = null;
    this.engine = null;
  }

  updateEngine(speedRatio, rumbleIntensity = 0) {
    if (!this.enabled || !this.engineGain || !this.engineOsc) return;
    const freq = 60 + speedRatio * 120 + rumbleIntensity * 40;
    this.engineOsc.frequency.value = freq;
    const vol = 0.04 + speedRatio * 0.12 + rumbleIntensity * 0.06;
    this.engineGain.gain.setTargetAtTime(Math.min(0.2, vol), this.ctx.currentTime, 0.05);
    if (this.engineNoiseGain) {
      this.engineNoiseGain.gain.setTargetAtTime(rumbleIntensity * 0.08, this.ctx.currentTime, 0.05);
    }
  }

  playTone(freq, duration, type = 'sine', vol = null) {
    if (!this.enabled || !this.ctx) return;
    const v = vol ?? this.volume;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(v, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playChord(freqs, duration, vol = null) {
    freqs.forEach(f => this.playTone(f, duration, 'sine', (vol ?? this.volume) / freqs.length));
  }

  playEat() { this.playTone(880, 0.08); }
  playBonus() { this.playChord([523, 659, 784], 0.2); }
  playGameOver() { this.playTone(220, 0.4); }
  playPowerup() { [440, 554, 659].forEach((f, i) => setTimeout(() => this.playTone(f, 0.1), i * 50)); }
  playLevelUp() { this.playChord([523, 659, 784, 1047], 0.3); }
  playCombo(n) { this.playTone(400 + n * 100, 0.06); }
  playPoison() { this.playTone(300, 0.15, 'sawtooth'); }
  playMove() { this.playTone(200, 0.02, 'square', 0.05); }
  playLineClear() { this.playChord([523, 659, 784], 0.15); }
  playRotate() { this.playTone(600, 0.04, 'square', 0.1); }
  playDrop() { this.playTone(150, 0.1, 'square', 0.15); }
  playHit() { this.playTone(100, 0.15, 'square', 0.2); }
  playBounce() { this.playTone(440, 0.05, 'square', 0.15); }
  playScore() { this.playChord([523, 659], 0.1); }
  playMerge() { this.playTone(660, 0.08); }
  playBoost() { this.playTone(220, 0.2, 'sawtooth', 0.15); }
  playCarHit() { this.playTone(70, 0.35, 'square', 0.25); this.playTone(50, 0.4, 'sawtooth', 0.15); }
  playNitro() { [220, 330, 440, 660].forEach((f, i) => setTimeout(() => this.playTone(f, 0.1, 'sine', 0.15), i * 40)); }

  toggle() {
    this.enabled = !this.enabled;
    if (this.music && !this.enabled) this.music.stop();
    if (this.engine && this.engineGain && !this.enabled) this.engineGain.gain.value = 0;
    return this.enabled;
  }
}

// Synthwave procedural music generator
class MusicPlayer {
  constructor(ctx, manager) {
    this.ctx = ctx;
    this.manager = manager;
    this.playing = false;
    this.timer = null;
    this.bpm = 135;
    this.beatInterval = 60 / this.bpm;
    this.beat = 0;
    this.bar = 0;
    this.intensity = 0.5;
    this.chords = [
      [220.00, 261.63, 329.63],  // Am
      [174.61, 220.00, 261.63],  // F
      [130.81, 163.50, 196.00],  // C
      [196.00, 246.94, 293.66],  // G
    ];
    this.chordIdx = 0;
    this.nodes = {};
  }

  start() {
    if (this.playing || !this.manager.enabled) return;
    this.playing = true;
    this.beat = 0;
    this.bar = 0;
    this.chordIdx = 0;
    this.scheduleNext();
    this.timer = setInterval(() => this.scheduleNext(), 100);
  }

  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    Object.values(this.nodes).forEach(n => {
      try { if (n.osc) n.osc.stop(); } catch(e) {}
      try { if (n.gain) n.gain.disconnect(); } catch(e) {}
    });
    this.nodes = {};
  }

  setIntensity(val) {
    this.intensity = Math.max(0, Math.min(1, val));
  }

  scheduleNext() {
    if (!this.playing || !this.manager.enabled) return;

    const now = this.ctx.currentTime;
    const lookAhead = 0.2;

    while (this.beat * this.beatInterval < now + lookAhead) {
      const beatTime = this.beat * this.beatInterval;
      const beatInBar = this.beat % 8;
      const chordBar = Math.floor(this.beat / 8);

      // Change chord every 2 bars (16 beats)
      this.chordIdx = Math.floor(chordBar / 2) % this.chords.length;

      if (beatInBar % 4 === 0) this.playKick(beatTime, 1);
      else if (beatInBar % 4 === 2) this.playKick(beatTime, 0.6);

      if (beatInBar % 2 === 1) this.playSnare(beatTime);

      if (beatInBar % 1 === 0) this.playHat(beatTime);

      if (beatInBar % 8 === 0) this.playBass(beatTime);

      this.beat++;
    }
  }

  playKick(time, vol = 1) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
    gain.gain.setValueAtTime(0.25 * vol * this.intensity, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  playSnare(time) {
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12 * this.intensity, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(time);
    source.stop(time + 0.1);
  }

  playHat(time) {
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06 * this.intensity, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4000;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(time);
    source.stop(time + 0.05);
  }

  playBass(time) {
    const chord = this.chords[this.chordIdx];
    if (!chord) return;
    const freq = chord[0] / 2;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1 * this.intensity, time + 0.02);
    gain.gain.setValueAtTime(0.1 * this.intensity, time + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.6);
  }
}

window.audioManager = new AudioManager();
