// Web Audio API sound system
class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.3;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
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
  playCarHit() { this.playTone(80, 0.3, 'square', 0.2); }
  playNitro() { [220, 330, 440, 660].forEach((f, i) => setTimeout(() => this.playTone(f, 0.08), i * 30)); }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

window.audioManager = new AudioManager();
