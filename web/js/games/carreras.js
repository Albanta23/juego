class CarrerasGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.running = false; this.frame = 0;
    this.state = 'menu';
    this.particles = new VFX.particles();
    this.shake = new VFX.screenShake();
    this.stars = VFX.generateStars(80);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.keys = {}; this.rafId = null;
    this.roadOffset = 0; this.curveOffset = 0;
    this.nitroParticles = []; this.speedLines = [];
    this.scenery = this.initScenery();
    this.reset();
  }

  initScenery() {
    return Array.from({ length: 40 }, (_, i) => ({
      y: i * 80 + Math.random() * 40,
      side: Math.random() > 0.5 ? 1 : -1,
      type: ['tree','bush','rock','sign'][Math.floor(Math.random() * 4)],
      xOff: 80 + Math.random() * 60,
      size: 0.6 + Math.random() * 0.6
    }));
  }

  reset() {
    this.score = 0; this.speed = 0; this.maxSpeed = 14;
    this.accel = 0.18; this.friction = 0.025;
    this.x = this.W / 2; this.nitro = 100; this.nitroActive = false;
    this.shield = false; this.shieldTimer = 0;
    this.enemies = this.genEnemies(); this.powerups = this.genPowerups();
    this.particles = new VFX.particles();
    this.nitroParticles = []; this.speedLines = [];
    window.updateScore(0);
  }

  genEnemies() {
    const colors = ['#ff3366','#ffaa00','#00ffff','#ff00ff','#00ff88','#ffff00','#ff6600','#aa44ff'];
    return Array.from({ length: 10 }, (_, i) => ({ x: this.W / 2 - 100 + Math.random() * 200, y: this.H - 200 - i * 220, speed: 3 + Math.random() * 4, color: colors[i % colors.length], w: 36, h: 60 }));
  }

  genPowerups() {
    const types = ['nitro', 'shield', 'star'];
    return Array.from({ length: 15 }, (_, i) => ({ x: this.W / 2 - 120 + Math.random() * 240, y: this.H - 180 - i * 180 - Math.random() * 60, type: types[Math.floor(Math.random() * 3)], active: true }));
  }

  start() { this.running = true; this.state = 'menu'; document.addEventListener('keydown', this.boundKeyDown); document.addEventListener('keyup', this.boundKeyUp); this.loop(); }
  destroy() { this.running = false; document.removeEventListener('keydown', this.boundKeyDown); document.removeEventListener('keyup', this.boundKeyUp); if (this.rafId) cancelAnimationFrame(this.rafId); }

  onKeyDown(e) {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    this.keys[e.key] = true;
    if (this.state === 'menu' && e.key === 'Enter') { this.reset(); this.state = 'playing'; }
    if (e.key === 'Escape') exitGame();
    if (e.key === 'r') { this.reset(); this.state = 'playing'; }
    if (e.key === 'n') this.nitroActive = true;
  }
  onKeyUp(e) { this.keys[e.key] = false; if (e.key === 'n') this.nitroActive = false; }

  update(dt) {
    if (this.state !== 'playing') return;
    this.shake.update(dt * 1000);

    if (this.keys['ArrowUp'] || this.keys['w']) this.speed = Math.min(this.maxSpeed, this.speed + this.accel);
    else this.speed = Math.max(0, this.speed - this.friction);
    if (this.keys['ArrowDown'] || this.keys['s']) this.speed = Math.max(0, this.speed - this.accel * 2);

    if (this.nitroActive && this.nitro > 0) {
      this.speed = Math.min(this.maxSpeed + 6, this.speed + 0.35);
      this.nitro = Math.max(0, this.nitro - 0.6);
      if (this.frame % 2 === 0) this.nitroParticles.push({ x: this.x + (Math.random() - 0.5) * 20, y: this.H - 120, vx: (Math.random() - 0.5) * 3, vy: 4 + Math.random() * 3, life: 1, size: 3 + Math.random() * 3, color: Math.random() > 0.5 ? '#ff8800' : '#ffcc00' });
    } else this.nitro = Math.min(100, this.nitro + 0.15);

    const steer = 5 * (this.speed / this.maxSpeed);
    if (this.keys['ArrowLeft'] || this.keys['a']) this.x -= steer;
    if (this.keys['ArrowRight'] || this.keys['d']) this.x += steer;
    this.x = Math.max(60, Math.min(this.W - 60, this.x));

    this.roadOffset += this.speed;
    this.curveOffset = Math.sin(this.roadOffset * 0.003) * 30;

    if (this.speed > 6 && this.frame % 2 === 0) this.speedLines.push({ x: Math.random() * this.W, y: this.H, vy: this.speed * 8, life: 1, len: 10 + this.speed * 3 });

    this.enemies.forEach(e => {
      e.y += this.speed - e.speed;
      e.x += Math.sin(this.frame * 0.02 + e.y * 0.01) * 0.5;
      if (e.y > this.H + 50) { e.y -= this.H + 400; e.x = this.W / 2 - 100 + Math.random() * 200; }
      if (Math.abs(this.x - e.x) < 35 && Math.abs((this.H - 130) - e.y) < 50) {
        if (this.shield) { this.shield = false; window.audioManager.playHit(); this.particles.emit(this.x, this.H - 130, 20, ['#00ffff','#fff']); this.shake.trigger(6, 200); }
        else { this.speed = 0; window.audioManager.playCarHit(); this.particles.emit(this.x, this.H - 130, 30, ['#ff3366','#ff00ff','#fff'], [100, 300], [0.4, 1.0]); this.shake.trigger(10, 300); }
      }
    });

    this.powerups.forEach(p => {
      if (!p.active) return;
      p.y += this.speed;
      if (p.y > this.H + 30) { p.y -= this.H + 400; p.x = this.W / 2 - 120 + Math.random() * 240; }
      if (Math.abs(this.x - p.x) < 35 && Math.abs((this.H - 130) - p.y) < 35) {
        p.active = false;
        if (p.type === 'nitro') { this.nitro = 100; window.audioManager.playNitro(); }
        else if (p.type === 'shield') { this.shield = true; this.shieldTimer = performance.now(); window.audioManager.playPowerup(); }
        else if (p.type === 'star') { this.score += 50; window.audioManager.playBonus(); }
        this.particles.emit(p.x, p.y, 15, ['#ffff00','#fff','#ff00ff'], [60, 150], [0.3, 0.6]);
      }
    });

    if (this.speed > 1) { this.score += Math.floor(this.speed / 3); window.updateScore(this.score); }

    this.particles.update(dt);
    this.nitroParticles = this.nitroParticles.filter(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.025; return p.life > 0; });
    this.speedLines = this.speedLines.filter(l => { l.y -= l.vy * dt * 60; l.life -= 0.03; return l.life > 0; });
    if (this.shield && performance.now() - this.shieldTimer > 5000) this.shield = false;
  }

  draw() {
    const c = this.ctx, W = this.W, H = this.H;
    c.save(); this.shake.apply(c);

    // Synthwave sky
    const skyG = c.createLinearGradient(0, 0, 0, H * 0.35);
    skyG.addColorStop(0, '#0a0020'); skyG.addColorStop(0.5, '#200040'); skyG.addColorStop(1, '#400030');
    c.fillStyle = skyG; c.fillRect(0, 0, W, H * 0.35);
    VFX.starfield(c, W, H * 0.35, this.stars, this.frame * 0.02);
    VFX.radialGlow(c, W / 2, H * 0.33, 200, '#ff4400', 0.12);

    if (this.state === 'menu') {
      VFX.drawLEDText('RACING', W / 2, H / 2 - 80, '#ff3366', 64);
      VFX.glowText(c, 'PRESS ENTER TO START', W / 2, H / 2, { font: '22px monospace', color: '#00ffff' });
      VFX.glowText(c, '↑↓ SPEED  |  ←→ STEER  |  N NITRO', W / 2, H / 2 + 45, { font: '14px monospace', color: '#888' });
      VFX.drawCRTEffect(c, W, H, 0.2);
      c.restore(); return;
    }

    const horizon = H * 0.33, roadBaseW = W * 0.55;

    // Road segments
    for (let i = 55; i >= 0; i--) {
      const t = i / 55, y = horizon + t * (H - horizon), segH = (H - horizon) / 55 + 2;
      const w = roadBaseW * (0.3 + t * 0.7);
      const curve = Math.sin((this.roadOffset * 0.003) + i * 0.08) * 40 * t + this.curveOffset * t;
      const cx = W / 2 + curve;

      c.fillStyle = i % 2 === 0 ? '#0a1a0a' : '#081508'; c.fillRect(0, y, W, segH + 1);

      // Rumble strips
      const stripW = w + 16;
      c.fillStyle = i % 3 === 0 ? '#ff3366' : '#ffffff';
      c.fillRect(cx - stripW / 2, y, stripW, segH + 1);

      c.fillStyle = i % 2 === 0 ? '#222' : '#1a1a1a';
      c.fillRect(cx - w / 2, y, w, segH + 1);

      if (i % 4 < 2) { c.fillStyle = '#ffff00'; c.fillRect(cx - 2, y, 4, segH + 1); }

      // Neon edge lines
      c.save(); c.shadowColor = '#00ffff'; c.shadowBlur = 6;
      c.fillStyle = '#00ffff';
      c.fillRect(cx - w / 2, y, 2, segH + 1);
      c.fillRect(cx + w / 2 - 2, y, 2, segH + 1);
      c.restore();
    }

    // Scenery
    this.scenery.forEach(s => {
      const screenY = s.y - (this.roadOffset * 0.3) % (this.scenery.length * 80);
      if (screenY < horizon - 20 || screenY > H + 30) return;
      const dist = (screenY - horizon) / (H - horizon), scale = 0.3 + dist * 0.7;
      const cx = W / 2 + this.curveOffset * dist;
      const sx = cx + s.side * (roadBaseW * 0.4 * scale + s.xOff * scale);
      c.save(); c.translate(sx, screenY); c.scale(scale, scale);
      if (s.type === 'tree') {
        c.fillStyle = '#3a2a1a'; c.fillRect(-3, -s.size * 30, 6, s.size * 30);
        c.save(); c.shadowColor = '#00ff88'; c.shadowBlur = 8;
        c.fillStyle = '#0a3a0a'; c.beginPath(); c.arc(0, -s.size * 35, s.size * 18, 0, Math.PI * 2); c.fill();
        c.restore();
      } else if (s.type === 'bush') {
        c.save(); c.shadowColor = '#00ff88'; c.shadowBlur = 5;
        c.fillStyle = '#0a3a0a'; c.beginPath(); c.arc(0, -s.size * 8, s.size * 12, 0, Math.PI * 2); c.fill();
        c.restore();
      } else if (s.type === 'rock') {
        c.fillStyle = '#555'; c.beginPath(); c.moveTo(-s.size * 10, 0); c.lineTo(-s.size * 5, -s.size * 12); c.lineTo(s.size * 8, -s.size * 10); c.lineTo(s.size * 12, 0); c.fill();
      } else {
        c.fillStyle = '#666'; c.fillRect(-2, -s.size * 25, 4, s.size * 25);
        c.save(); c.shadowColor = '#ffff00'; c.shadowBlur = 8;
        c.fillStyle = '#ffff00'; c.fillRect(-8, -s.size * 25, 16, 10);
        c.restore();
      }
      c.restore();
    });

    // Speed lines
    this.speedLines.forEach(l => {
      c.strokeStyle = `rgba(0,255,255,${l.life * 0.3})`; c.lineWidth = 1;
      c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(l.x, l.y + l.len); c.stroke();
    });

    // Powerups
    this.powerups.forEach(p => {
      if (!p.active) return;
      const colors = { nitro: '#ff8800', shield: '#00ffff', star: '#ffff00' };
      const pulse = 1 + 0.15 * Math.sin(this.frame * 0.1);
      VFX.drawNeonCircle(c, p.x, p.y, 12 * pulse, colors[p.type], 2);
      c.fillStyle = '#fff'; c.font = 'bold 11px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const icons = { nitro: '⚡', shield: '🛡', star: '★' };
      c.fillText(icons[p.type], p.x, p.y);
    });

    // Enemy cars
    this.enemies.forEach(e => {
      if (e.y < horizon || e.y > H + 50) return;
      const dist = (e.y - horizon) / (H - horizon), scale = 0.4 + dist * 0.6;
      const cx = W / 2 + this.curveOffset * dist + Math.sin(this.frame * 0.02 + e.y * 0.01) * 10 * dist;
      const ex = cx + (e.x - W / 2) * scale;
      c.save(); c.translate(ex, e.y); c.scale(scale, scale);
      VFX.drawCar(c, 0, 0, e.w, e.h, e.color);
      c.restore();
    });

    // Player car
    c.save(); c.translate(this.x, this.H - 130);
    const tilt = (this.keys['ArrowLeft'] || this.keys['a'] ? -0.1 : 0) + (this.keys['ArrowRight'] || this.keys['d'] ? 0.1 : 0);
    c.rotate(tilt);
    VFX.drawCar(c, 0, 0, 40, 70, '#00ffff');
    if (this.shield) {
      c.save(); c.strokeStyle = '#00ffff'; c.lineWidth = 3;
      c.globalAlpha = 0.4 + 0.3 * Math.sin(this.frame * 0.15);
      c.shadowColor = '#00ffff'; c.shadowBlur = 15;
      c.beginPath(); c.arc(0, 0, 45, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    c.restore();

    // Nitro particles
    this.nitroParticles.forEach(p => {
      c.globalAlpha = p.life; c.fillStyle = p.color;
      c.shadowColor = p.color; c.shadowBlur = 8;
      c.beginPath(); c.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); c.fill();
    });
    c.globalAlpha = 1; c.shadowBlur = 0;

    this.particles.draw(c);

    // HUD
    VFX.panel(c, 10, 10, 220, 100, { bg: 'rgba(0,0,20,0.7)', border: 'rgba(0,255,255,0.15)', radius: 10 });
    VFX.drawLEDText(`${this.score}`, 120, 30, '#00ffff', 22);
    VFX.glowText(c, 'SCORE', 20, 30, { font: '10px monospace', color: '#888', align: 'left' });
    VFX.glowText(c, `SPEED: ${Math.round(this.speed * 10)} KM/H`, 20, 55, { font: '13px monospace', color: this.speed > 10 ? '#ff3366' : '#aaa', align: 'left' });

    // Nitro bar
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.beginPath(); c.roundRect(20, 72, 140, 18, 9); c.fill();
    VFX.drawNeonRect(c, 20, 72, Math.max(0, this.nitro * 1.4), 18, '#ff8800', 9, 1);
    VFX.glowText(c, 'NITRO', 90, 81, { font: 'bold 10px monospace', color: '#fff' });

    VFX.glowText(c, '← → STEER  |  ↑ ↓ SPEED  |  N NITRO  |  ESC MENU', W - 10, H - 15, { font: '11px monospace', color: '#444', align: 'right', baseline: 'bottom' });

    if (this.state === 'gameover') {
      c.fillStyle = 'rgba(10,0,21,0.8)'; c.fillRect(0, 0, W, H);
      VFX.drawNeonRect(c, W / 2 - 200, H / 2 - 80, 400, 160, '#ff3366', 12, 2);
      VFX.drawLEDText('CRASHED!', W / 2, H / 2 - 25, '#ff3366', 48);
      VFX.drawLEDText(`SCORE: ${this.score}`, W / 2, H / 2 + 20, '#00ffff', 22);
      VFX.glowText(c, 'R = RESTART  |  ESC = MENU', W / 2, H / 2 + 55, { font: '12px monospace', color: '#666' });
    }

    VFX.drawCRTEffect(c, W, H, 0.15);
    c.restore();
  }

  loop() {
    if (!this.running) return;
    this.frame++; this.update(1 / 60); this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
