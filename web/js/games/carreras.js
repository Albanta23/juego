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
    return Array.from({ length: 52 }, (_, i) => ({
      y: i * 80 + Math.random() * 40,
      side: Math.random() > 0.5 ? 1 : -1,
      type: ['palm','tower','gate','sign','drone','crystal'][Math.floor(Math.random() * 6)],
      xOff: 78 + Math.random() * 86,
      size: 0.6 + Math.random() * 0.6
    }));
  }

  reset() {
    this.score = 0; this.speed = 0; this.maxSpeed = 14;
    this.accel = 0.18; this.friction = 0.025;
    this.x = this.W / 2; this.nitro = 100; this.nitroActive = false;
    this.health = 3; this.distance = 0; this.level = 1; this.combo = 1;
    this.crashCooldown = 0; this.nearMisses = 0;
    this.shield = false; this.shieldTimer = 0;
    this.enemies = this.genEnemies(); this.powerups = this.genPowerups();
    this.particles = new VFX.particles();
    this.nitroParticles = []; this.speedLines = [];
    window.updateScore(0);
  }

  genEnemies() {
    const colors = ['#ff3366','#ffaa00','#00ffff','#ff00ff','#00ff88','#ffff00','#ff6600','#aa44ff'];
    return Array.from({ length: 10 }, (_, i) => ({ x: this.W / 2 - 100 + Math.random() * 200, y: this.H - 200 - i * 220, speed: 3 + Math.random() * 4, color: colors[i % colors.length], w: 36, h: 60, scoredNear: false }));
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
    if (this.crashCooldown > 0) this.crashCooldown -= dt;

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
    this.distance += this.speed * 0.02;
    this.level = 1 + Math.floor(this.distance / 500);
    this.maxSpeed = Math.min(22, 14 + this.level * 0.7);
    this.curveOffset = Math.sin(this.roadOffset * 0.003) * 30;

    if (this.speed > 6 && this.frame % 2 === 0) this.speedLines.push({ x: Math.random() * this.W, y: this.H, vy: this.speed * 8, life: 1, len: 10 + this.speed * 3 });

    this.enemies.forEach(e => {
      e.y += this.speed - e.speed;
      e.x += Math.sin(this.frame * 0.02 + e.y * 0.01) * 0.5;
      if (e.y > this.H + 50) { e.y -= this.H + 400; e.x = this.W / 2 - 100 + Math.random() * 200; e.scoredNear = false; }
      if (Math.abs(this.x - e.x) < 35 && Math.abs((this.H - 130) - e.y) < 50) {
        if (this.crashCooldown <= 0) {
          this.crashCooldown = 1.2;
          if (this.shield) { this.shield = false; window.audioManager.playHit(); this.particles.emit(this.x, this.H - 130, 20, ['#00ffff','#fff']); this.shake.trigger(6, 200); }
          else {
            this.health--; this.combo = 1; this.speed = Math.max(2, this.speed * 0.25);
            window.audioManager.playCarHit(); this.particles.emit(this.x, this.H - 130, 30, ['#ff3366','#ff00ff','#fff'], [100, 300], [0.4, 1.0]); this.shake.trigger(10, 300);
            if (this.health <= 0) { this.state = 'gameover'; window.gameStorage.setHighScore('carreras', this.score); }
          }
        }
      } else if (!e.scoredNear && e.y > this.H - 190 && e.y < this.H - 95 && Math.abs(this.x - e.x) < 70) {
        e.scoredNear = true; this.nearMisses++; this.combo = Math.min(5, this.combo + 0.5);
        this.score += Math.floor(20 * this.combo); window.audioManager.playBonus();
        this.particles.emit(this.x, this.H - 130, 8, ['#ffff00','#00ffff','#fff'], [60, 130], [0.2, 0.5]);
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
        else if (p.type === 'star') { this.score += Math.floor(50 * this.combo); this.combo = Math.min(5, this.combo + 0.25); window.audioManager.playBonus(); }
        this.particles.emit(p.x, p.y, 15, ['#ffff00','#fff','#ff00ff'], [60, 150], [0.3, 0.6]);
      }
    });

    if (this.speed > 1) { this.score += Math.floor((this.speed / 3) * this.combo); window.updateScore(this.score); }

    this.particles.update(dt);
    this.nitroParticles = this.nitroParticles.filter(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.025; return p.life > 0; });
    this.speedLines = this.speedLines.filter(l => { l.y -= l.vy * dt * 60; l.life -= 0.03; return l.life > 0; });
    if (this.shield && performance.now() - this.shieldTimer > 5000) this.shield = false;
  }

  draw() {
    const c = this.ctx, W = this.W, H = this.H;
    c.save(); this.shake.apply(c);

    this.drawBackdrop(c, W, H);

    if (this.state === 'menu') {
      const panelW = Math.min(460, W - 28);
      VFX.panel(c, W / 2 - panelW / 2, H / 2 - 130, panelW, 235, { bg: 'rgba(4,0,18,0.72)', border: 'rgba(255,51,102,0.28)', radius: 14 });
      VFX.drawLEDText(c, 'RACING', W / 2, H / 2 - 78, '#ff3366', Math.min(64, W * 0.12));
      VFX.glowText(c, 'ENTER / START PARA CORRER', W / 2, H / 2 - 8, { font: '18px monospace', color: '#00ffff' });
      VFX.glowText(c, 'ESQUIVA TRAFICO, ROZA COCHES Y ENCADENA MULTIPLICADOR', W / 2, H / 2 + 28, { font: '11px monospace', color: '#ffff00' });
      VFX.glowText(c, 'CRUCETA: GAS/FRENO/GIRO  |  NITRO: N / BOTON', W / 2, H / 2 + 62, { font: '12px monospace', color: '#888' });
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

      const grassG = c.createLinearGradient(0, y, 0, y + segH + 1);
      grassG.addColorStop(0, i % 2 === 0 ? '#07170f' : '#06120d');
      grassG.addColorStop(1, i % 2 === 0 ? '#0c2515' : '#091d13');
      c.fillStyle = grassG; c.fillRect(0, y, W, segH + 1);

      // Rumble strips
      const stripW = w + 16;
      c.fillStyle = i % 3 === 0 ? '#ff3366' : '#ffffff';
      c.fillRect(cx - stripW / 2, y, stripW, segH + 1);

      const roadG = c.createLinearGradient(cx - w / 2, y, cx + w / 2, y);
      roadG.addColorStop(0, '#101018');
      roadG.addColorStop(0.5, i % 2 === 0 ? '#30303b' : '#24242f');
      roadG.addColorStop(1, '#101018');
      c.fillStyle = roadG;
      c.fillRect(cx - w / 2, y, w, segH + 1);

      if (i % 4 < 2) {
        c.save(); c.shadowColor = '#ffff00'; c.shadowBlur = 6;
        c.fillStyle = '#ffff00'; c.fillRect(cx - 2, y, 4, segH + 1);
        c.restore();
      }

      // Neon edge lines
      c.save(); c.shadowColor = '#00ffff'; c.shadowBlur = 6;
      c.fillStyle = '#00ffff';
      c.fillRect(cx - w / 2, y, 2, segH + 1);
      c.fillRect(cx + w / 2 - 2, y, 2, segH + 1);
      c.globalAlpha = 0.5;
      c.fillStyle = '#ff00ff';
      c.fillRect(cx - w * 0.25, y, 1, segH + 1);
      c.fillRect(cx + w * 0.25, y, 1, segH + 1);
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
      if (s.type === 'palm') {
        c.save(); c.shadowColor = '#00ff88'; c.shadowBlur = 8;
        c.fillStyle = '#1d5b44'; c.fillRect(-3, -s.size * 38, 6, s.size * 38);
        for (let a = -2; a <= 2; a++) {
          c.save(); c.rotate(a * 0.42); c.fillStyle = '#00b878'; c.beginPath(); c.ellipse(0, -s.size * 40, s.size * 6, s.size * 22, 0, 0, Math.PI * 2); c.fill(); c.restore();
        }
        c.restore();
      } else if (s.type === 'tower') {
        c.save(); c.shadowColor = '#00ff88'; c.shadowBlur = 8;
        c.fillStyle = 'rgba(0,255,255,0.12)'; c.fillRect(-s.size * 10, -s.size * 70, s.size * 20, s.size * 70);
        VFX.drawNeonRect(c, -s.size * 10, -s.size * 70, s.size * 20, s.size * 70, '#00ffff', 2, 1);
        for (let wy = -62; wy < -12; wy += 12) { c.fillStyle = '#ffff00'; c.fillRect(-s.size * 5, s.size * wy, s.size * 3, s.size * 4); c.fillRect(s.size * 2, s.size * wy, s.size * 3, s.size * 4); }
        c.restore();
      } else if (s.type === 'gate') {
        c.save(); c.shadowColor = '#ff00ff'; c.shadowBlur = 10;
        c.strokeStyle = '#ff00ff'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(-s.size * 18, 0); c.lineTo(-s.size * 18, -s.size * 46); c.lineTo(s.size * 18, -s.size * 46); c.lineTo(s.size * 18, 0); c.stroke();
        c.fillStyle = '#ffff00'; c.fillRect(-s.size * 10, -s.size * 38, s.size * 20, s.size * 8);
        c.restore();
      } else if (s.type === 'sign') {
        c.fillStyle = '#666'; c.fillRect(-2, -s.size * 25, 4, s.size * 25);
        c.save(); c.shadowColor = '#ffff00'; c.shadowBlur = 8;
        c.fillStyle = '#1b1038'; c.fillRect(-s.size * 22, -s.size * 34, s.size * 44, s.size * 16);
        c.strokeStyle = '#ffff00'; c.strokeRect(-s.size * 22, -s.size * 34, s.size * 44, s.size * 16);
        c.fillStyle = '#ffff00'; c.font = `${Math.max(8, s.size * 10)}px monospace`; c.textAlign = 'center'; c.fillText('BOOST', 0, -s.size * 22);
        c.restore();
      } else if (s.type === 'drone') {
        c.save(); c.shadowColor = '#ff00ff'; c.shadowBlur = 12;
        c.strokeStyle = '#ff00ff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-s.size * 14, -s.size * 24); c.lineTo(s.size * 14, -s.size * 24); c.stroke();
        c.fillStyle = '#ff00ff'; c.beginPath(); c.arc(0, -s.size * 24, s.size * 7, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#00ffff'; c.fillRect(-s.size * 20, -s.size * 27, s.size * 8, s.size * 3); c.fillRect(s.size * 12, -s.size * 27, s.size * 8, s.size * 3);
        c.restore();
      } else {
        c.save(); c.shadowColor = '#00ffff'; c.shadowBlur = 10;
        c.fillStyle = 'rgba(0,255,255,0.3)';
        c.beginPath(); c.moveTo(0, -s.size * 34); c.lineTo(s.size * 14, 0); c.lineTo(-s.size * 14, 0); c.closePath(); c.fill();
        c.strokeStyle = '#00ffff'; c.stroke();
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
    c.save();
    c.globalAlpha = 0.45; c.fillStyle = '#000'; c.beginPath(); c.ellipse(this.x + 6, this.H - 93, 42, 18, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    c.translate(this.x, this.H - 130);
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
    VFX.panel(c, 10, 10, 220, 118, { bg: 'rgba(0,0,20,0.7)', border: 'rgba(0,255,255,0.15)', radius: 10 });
    VFX.drawLEDText(c, `${this.score}`, 120, 30, '#00ffff', 22);
    VFX.glowText(c, 'SCORE', 20, 30, { font: '10px monospace', color: '#888', align: 'left' });
    VFX.glowText(c, `SPEED: ${Math.round(this.speed * 10)} KM/H`, 20, 55, { font: '13px monospace', color: this.speed > 10 ? '#ff3366' : '#aaa', align: 'left' });
    VFX.glowText(c, `HP: ${'|'.repeat(this.health)}  LVL: ${this.level}  x${this.combo.toFixed(1)}`, 20, 103, { font: '12px monospace', color: this.health <= 1 ? '#ff3366' : '#ffff00', align: 'left' });

    // Nitro bar
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.beginPath(); c.roundRect(20, 72, 140, 18, 9); c.fill();
    VFX.drawNeonRect(c, 20, 72, Math.max(0, this.nitro * 1.4), 18, '#ff8800', 9, 1);
    VFX.glowText(c, 'NITRO', 90, 81, { font: 'bold 10px monospace', color: '#fff' });

    VFX.glowText(c, `DIST ${Math.floor(this.distance)}m  |  NEAR MISS ${this.nearMisses}`, W - 10, H - 34, { font: '11px monospace', color: '#777', align: 'right', baseline: 'bottom' });
    VFX.glowText(c, 'GIRA Y ACELERA CON CRUCETA  |  NITRO', W - 10, H - 15, { font: '11px monospace', color: '#444', align: 'right', baseline: 'bottom' });
    if (this.combo >= 2) {
      VFX.glowText(c, `NEAR MISS CHAIN x${this.combo.toFixed(1)}`, W / 2, 34, { font: '15px monospace', color: '#ffff00', glow: '#ffff00' });
    }

    if (this.state === 'gameover') {
      c.fillStyle = 'rgba(10,0,21,0.8)'; c.fillRect(0, 0, W, H);
      VFX.drawNeonRect(c, W / 2 - 200, H / 2 - 80, 400, 160, '#ff3366', 12, 2);
      VFX.drawLEDText(c, 'CRASHED!', W / 2, H / 2 - 25, '#ff3366', 48);
      VFX.drawLEDText(c, `SCORE: ${this.score}`, W / 2, H / 2 + 20, '#00ffff', 22);
      VFX.glowText(c, 'R = RESTART  |  ESC = MENU', W / 2, H / 2 + 55, { font: '12px monospace', color: '#666' });
    }

    VFX.drawCRTEffect(c, W, H, 0.15);
    c.restore();
  }

  drawBackdrop(c, W, H) {
    const horizon = H * 0.33;
    const skyG = c.createLinearGradient(0, 0, 0, horizon);
    skyG.addColorStop(0, '#060018');
    skyG.addColorStop(0.45, '#191055');
    skyG.addColorStop(1, '#55123f');
    c.fillStyle = skyG; c.fillRect(0, 0, W, horizon);
    VFX.starfield(c, W, horizon, this.stars, this.frame * 0.02);

    const sunY = horizon - 18;
    VFX.radialGlow(c, W / 2, sunY, Math.min(220, W * 0.36), '#ff3366', 0.28);
    c.save();
    c.shadowColor = '#ff8800'; c.shadowBlur = 24;
    c.fillStyle = '#ffb000';
    c.beginPath(); c.arc(W / 2, sunY, Math.min(72, W * 0.13), 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'destination-out';
    for (let y = sunY - 48; y < sunY + 70; y += 12) c.fillRect(W / 2 - 90, y, 180, 5);
    c.restore();

    c.save();
    c.fillStyle = '#09071f';
    c.beginPath(); c.moveTo(0, horizon);
    for (let x = 0; x <= W; x += W / 8) c.lineTo(x + W / 16, horizon - 30 - Math.sin(x * 0.02) * 20);
    c.lineTo(W, horizon); c.closePath(); c.fill();
    c.restore();

    c.save();
    c.fillStyle = 'rgba(0,255,255,0.08)';
    c.strokeStyle = 'rgba(0,255,255,0.18)';
    for (let x = -20; x < W + 40; x += 38) {
      const h = 24 + ((x * 13) % 55 + 55) % 55;
      c.fillRect(x, horizon - h, 24, h);
      c.strokeRect(x, horizon - h, 24, h);
      c.fillStyle = 'rgba(255,255,0,0.35)';
      for (let wy = horizon - h + 8; wy < horizon - 8; wy += 12) c.fillRect(x + 7, wy, 3, 4);
      c.fillStyle = 'rgba(0,255,255,0.08)';
    }
    c.restore();
  }

  loop() {
    if (!this.running) return;
    this.frame++; this.update(1 / 60); this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
