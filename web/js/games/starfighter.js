class StarfighterGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.running = false; this.frame = 0; this.state = 'title';
    this.keys = {}; this.rafId = null;
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.particles = new VFX.particles();
    this.shake = new VFX.screenShake();
    this.stars = VFX.generateStars(130);
    this.reset();
  }

  reset() {
    this.score = 0; this.wave = 1; this.spawnTimer = 40; this.boss = null;
    this.player = { x: this.W / 2, y: this.H - 78, vx: 0, vy: 0, shield: 100, lives: 3, fireCd: 0, inv: 0 };
    this.bullets = []; this.enemyShots = []; this.enemies = []; this.asteroids = []; this.pickups = [];
    this.nebulaHue = Math.random() * 360;
    window.updateScore(0);
  }

  start() {
    this.running = true;
    document.addEventListener('keydown', this.boundKeyDown);
    document.addEventListener('keyup', this.boundKeyUp);
    this.loop();
  }

  destroy() {
    this.running = false;
    document.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('keyup', this.boundKeyUp);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  onKeyDown(e) {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','x'].includes(e.key)) e.preventDefault();
    this.keys[e.key] = true;
    if (e.key === 'Escape') { exitGame(); return; }
    if (this.state === 'title' && (e.key === 'Enter' || e.key === ' ')) { this.reset(); this.state = 'playing'; return; }
    if (this.state === 'gameover' && (e.key === 'r' || e.key === 'Enter')) { this.reset(); this.state = 'playing'; return; }
    if (this.state !== 'playing') return;
    if (e.key === ' ' || e.key === 'x' || e.key === 'Control') this.fire();
  }

  onKeyUp(e) { this.keys[e.key] = false; }

  fire() {
    const p = this.player;
    if (p.fireCd > 0) return;
    p.fireCd = 9;
    this.bullets.push({ x: p.x - 10, y: p.y - 28, vx: -0.7, vy: -10.5, life: 70, power: 1 });
    this.bullets.push({ x: p.x + 10, y: p.y - 28, vx: 0.7, vy: -10.5, life: 70, power: 1 });
    window.audioManager.playMove();
  }

  update(dt) {
    this.shake.update(dt * 1000);
    this.particles.update(dt);
    if (this.state !== 'playing') return;
    const p = this.player;
    if (p.fireCd > 0) p.fireCd--;
    if (p.inv > 0) p.inv--;

    const accel = 0.72, drag = 0.86, max = 7.4;
    if (this.keys['ArrowLeft'] || this.keys['a']) p.vx -= accel;
    if (this.keys['ArrowRight'] || this.keys['d']) p.vx += accel;
    if (this.keys['ArrowUp'] || this.keys['w']) p.vy -= accel;
    if (this.keys['ArrowDown'] || this.keys['s']) p.vy += accel;
    if (this.keys[' '] || this.keys['x'] || this.keys['Control']) this.fire();
    p.vx = Math.max(-max, Math.min(max, p.vx)) * drag;
    p.vy = Math.max(-max, Math.min(max, p.vy)) * drag;
    p.x = Math.max(30, Math.min(this.W - 30, p.x + p.vx));
    p.y = Math.max(46, Math.min(this.H - 42, p.y + p.vy));

    this.spawnTimer--;
    if (this.spawnTimer <= 0) {
      this.spawnWaveObject();
      this.spawnTimer = Math.max(13, 48 - this.wave * 3);
    }
    if (!this.boss && this.score > 0 && this.score % 1800 < 22 && this.wave > 1) this.spawnBoss();

    this.bullets.forEach(b => { b.x += b.vx; b.y += b.vy; b.life--; });
    this.enemyShots.forEach(b => { b.x += b.vx; b.y += b.vy; b.life--; });
    this.asteroids.forEach(a => { a.x += a.vx; a.y += a.vy; a.rot += a.spin; });
    this.enemies.forEach(e => {
      e.x += Math.sin((this.frame + e.phase) * 0.035) * e.sway;
      e.y += e.vy;
      e.fire--;
      if (e.fire <= 0) {
        e.fire = 70 + Math.random() * 60;
        this.enemyShots.push({ x: e.x, y: e.y + 20, vx: (this.player.x - e.x) * 0.012, vy: 4.4, life: 120, r: 4 });
      }
    });
    if (this.boss) this.updateBoss();

    this.handleCollisions();
    this.cleanup();
    this.wave = 1 + Math.floor(this.score / 900);
    window.updateScore(this.score);
  }

  spawnWaveObject() {
    if (Math.random() < 0.58) {
      const r = 16 + Math.random() * 26;
      this.asteroids.push({ x: 30 + Math.random() * (this.W - 60), y: -50, r, vx: (Math.random() - 0.5) * 1.8, vy: 2.0 + Math.random() * 2.2 + this.wave * 0.12, hp: Math.ceil(r / 14), rot: Math.random() * 9, spin: (Math.random() - 0.5) * 0.05 });
    } else {
      this.enemies.push({ x: 40 + Math.random() * (this.W - 80), y: -45, w: 38, h: 38, vy: 1.8 + this.wave * 0.12, hp: 3 + Math.floor(this.wave / 3), phase: Math.random() * 100, sway: 1.6 + Math.random() * 1.8, fire: 55 + Math.random() * 80 });
    }
  }

  spawnBoss() {
    this.boss = { x: this.W / 2, y: 80, w: 150, h: 88, hp: 45 + this.wave * 8, maxHp: 45 + this.wave * 8, phase: 0, fire: 30, hurt: 0 };
    window.audioManager.playLevelUp();
  }

  updateBoss() {
    const b = this.boss;
    b.phase += 0.025;
    b.x = this.W / 2 + Math.sin(b.phase) * this.W * 0.26;
    if (b.hurt > 0) b.hurt--;
    b.fire--;
    if (b.fire <= 0) {
      b.fire = 18;
      for (let i = -2; i <= 2; i++) this.enemyShots.push({ x: b.x + i * 22, y: b.y + 45, vx: i * 0.9, vy: 4.2, life: 130, r: 5 });
    }
  }

  handleCollisions() {
    const p = this.player;
    this.bullets.forEach(b => {
      this.asteroids.forEach(a => {
        if (b.life > 0 && Math.hypot(b.x - a.x, b.y - a.y) < a.r) {
          b.life = 0; a.hp -= b.power; a.hit = 8; this.particles.emit(b.x, b.y, 8, ['#ffaa00','#ffffff','#00ffff'], [50, 130], [0.18, 0.42]);
          if (a.hp <= 0) this.destroyAsteroid(a);
        }
      });
      this.enemies.forEach(e => {
        if (b.life > 0 && this.pointRect(b.x, b.y, e)) {
          b.life = 0; e.hp--; e.hurt = 7; this.score += 20; this.particles.emit(b.x, b.y, 10, ['#00ffff','#ff00ff','#fff'], [50, 150], [0.2, 0.48]);
          if (e.hp <= 0) this.destroyEnemy(e);
        }
      });
      if (this.boss && b.life > 0 && this.pointRect(b.x, b.y, this.boss)) {
        b.life = 0; this.boss.hp--; this.boss.hurt = 7; this.score += 18;
        this.particles.emit(b.x, b.y, 12, ['#ff00ff','#ffff00','#fff'], [60, 160], [0.2, 0.5]);
        if (this.boss.hp <= 0) this.destroyBoss();
      }
    });

    this.asteroids.forEach(a => { if (Math.hypot(p.x - a.x, p.y - a.y) < a.r + 18) this.damagePlayer(22); });
    this.enemies.forEach(e => { if (this.rectCircle(e, p.x, p.y, 18)) this.damagePlayer(28); });
    this.enemyShots.forEach(s => { if (s.life > 0 && Math.hypot(p.x - s.x, p.y - s.y) < s.r + 16) { s.life = 0; this.damagePlayer(16); } });
    if (this.boss && this.rectCircle(this.boss, p.x, p.y, 18)) this.damagePlayer(35);
    this.pickups.forEach(it => {
      it.y += 2.2; it.phase += 0.08;
      if (Math.hypot(p.x - it.x, p.y - it.y) < 24) {
        it.dead = true; p.shield = Math.min(100, p.shield + 28); this.score += 80; window.audioManager.playBonus();
      }
    });
  }

  destroyAsteroid(a) {
    a.dead = true; this.score += Math.round(80 + a.r * 3);
    this.particles.emit(a.x, a.y, 24, ['#bfa58a','#ffaa00','#fff'], [70, 190], [0.3, 0.75]);
    if (Math.random() < 0.16) this.pickups.push({ x: a.x, y: a.y, phase: 0 });
    window.audioManager.playHit();
  }

  destroyEnemy(e) {
    e.dead = true; this.score += 180;
    this.particles.emit(e.x, e.y, 32, ['#00ffff','#ff00ff','#fff'], [80, 220], [0.3, 0.8]);
    if (Math.random() < 0.22) this.pickups.push({ x: e.x, y: e.y, phase: 0 });
    window.audioManager.playPowerup();
  }

  destroyBoss() {
    this.score += 2200; this.particles.emit(this.boss.x, this.boss.y, 90, ['#ff00ff','#00ffff','#ffff00','#fff'], [100, 300], [0.5, 1.1]);
    this.boss = null; this.spawnTimer = 80; window.audioManager.playLevelUp();
    window.gameStorage.setHighScore('starfighter', this.score);
  }

  damagePlayer(amount) {
    const p = this.player;
    if (p.inv > 0) return;
    p.inv = 50; p.shield -= amount; this.shake.trigger(9, 220); window.audioManager.playCarHit();
    this.particles.emit(p.x, p.y, 22, ['#00ffff','#ff3366','#fff'], [70, 180], [0.25, 0.62]);
    if (p.shield <= 0) {
      p.lives--; p.shield = 100;
      if (p.lives <= 0) { this.state = 'gameover'; window.gameStorage.setHighScore('starfighter', this.score); window.audioManager.playGameOver(); }
    }
  }

  cleanup() {
    this.bullets = this.bullets.filter(b => b.life > 0 && b.y > -60);
    this.enemyShots = this.enemyShots.filter(b => b.life > 0 && b.y < this.H + 60);
    this.asteroids = this.asteroids.filter(a => !a.dead && a.y < this.H + a.r + 40);
    this.enemies = this.enemies.filter(e => !e.dead && e.y < this.H + 80);
    this.pickups = this.pickups.filter(p => !p.dead && p.y < this.H + 50);
  }

  pointRect(x, y, r) { return x > r.x - r.w / 2 && x < r.x + r.w / 2 && y > r.y - r.h / 2 && y < r.y + r.h / 2; }
  rectCircle(r, x, y, rad) {
    const cx = Math.max(r.x - r.w / 2, Math.min(x, r.x + r.w / 2));
    const cy = Math.max(r.y - r.h / 2, Math.min(y, r.y + r.h / 2));
    return Math.hypot(x - cx, y - cy) < rad;
  }

  draw() {
    const c = this.ctx, W = this.W, H = this.H;
    this.drawSpace(c, W, H);
    if (this.state === 'title') { this.drawTitle(c, W, H); return; }
    c.save(); this.shake.apply(c);
    this.pickups.forEach(p => VFX.drawGem3D(c, p.x, p.y, 10 + Math.sin(p.phase) * 2, '#00ffff', { spin: this.frame * 0.04 }));
    this.asteroids.forEach(a => VFX.drawAsteroid3D(c, a.x, a.y, a.r, a.rot));
    this.enemies.forEach(e => this.drawEnemy(c, e));
    if (this.boss) this.drawBoss(c, this.boss);
    this.bullets.forEach(b => this.drawBullet(c, b, '#00ffff'));
    this.enemyShots.forEach(b => this.drawBullet(c, b, '#ff3366'));
    this.drawPlayer(c);
    c.restore();
    this.particles.draw(c);
    this.drawHud(c, W, H);
    if (this.state === 'gameover') this.drawGameOver(c, W, H);
    VFX.drawCRTEffect(c, W, H, 0.1);
  }

  drawSpace(c, W, H) {
    VFX.backgroundGradient(c, W, H, '#02020e', '#090018');
    VFX.starfield(c, W, H, this.stars, this.frame * 0.018);
    const hue = (this.nebulaHue + this.frame * 0.05) % 360;
    VFX.radialGlow(c, W * 0.2, H * 0.22, W * 0.36, `hsl(${hue}, 85%, 45%)`, 0.12);
    VFX.radialGlow(c, W * 0.82, H * 0.35, W * 0.32, `hsl(${(hue + 105) % 360}, 85%, 48%)`, 0.1);
    c.save(); c.strokeStyle = 'rgba(0,255,255,0.08)';
    for (let y = (this.frame * 2) % 36; y < H; y += 36) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.restore();
  }

  drawPlayer(c) {
    const p = this.player;
    c.save();
    if (p.inv > 0 && Math.floor(this.frame / 4) % 2 === 0) c.globalAlpha = 0.5;
    VFX.drawShip3D(c, p.x, p.y, 28, '#00ffff', p.vx * 0.018);
    if (p.shield > 0) {
      c.globalAlpha = 0.18 + p.shield / 180;
      VFX.drawNeonCircle(c, p.x, p.y, 35, '#00ffff', 2);
    }
    c.restore();
  }

  drawEnemy(c, e) {
    c.save();
    if (e.hurt > 0) c.globalAlpha = 0.55;
    c.translate(e.x, e.y);
    c.rotate(Math.PI);
    VFX.drawShip3D(c, 0, 0, 22, '#ff3366', Math.sin(this.frame * 0.05) * 0.1);
    c.restore();
  }

  drawBoss(c, b) {
    c.save();
    if (b.hurt > 0) c.globalAlpha = 0.6;
    c.translate(b.x, b.y);
    VFX.radialGlow(c, 0, 0, 110, '#ff00ff', 0.28);
    VFX.drawMetalPanel3D(c, -b.w / 2, -b.h / 2, b.w, b.h, '#40104f', 18);
    VFX.drawOrb3D(c, 0, 0, 25, '#ff00ff');
    VFX.drawNeonRect(c, -b.w / 2, -b.h / 2, b.w, b.h, '#ff00ff', 18, 2);
    c.restore();
  }

  drawBullet(c, b, color) {
    c.save(); c.shadowColor = color; c.shadowBlur = 12; c.fillStyle = color;
    c.beginPath(); c.ellipse(b.x, b.y, b.r || 4, 12, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  drawHud(c, W, H) {
    VFX.panel(c, 10, 10, 250, 82, { bg: 'rgba(0,0,20,0.72)', border: 'rgba(0,255,255,0.16)', radius: 8 });
    VFX.drawLEDText(c, `${this.score}`, 128, 30, '#00ffff', 22);
    VFX.glowText(c, `LIVES ${this.player.lives}  WAVE ${this.wave}`, 20, 58, { font: '11px monospace', color: '#ffff00', align: 'left' });
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.beginPath(); c.roundRect(20, 68, 145, 10, 5); c.fill();
    VFX.drawNeonRect(c, 20, 68, Math.max(2, this.player.shield * 1.45), 10, this.player.shield < 35 ? '#ff3366' : '#00ffff', 5, 1);
    VFX.glowText(c, 'SHIELD', 194, 73, { font: '10px monospace', color: '#888', align: 'left' });
    if (this.boss) {
      VFX.panel(c, W / 2 - 150, 16, 300, 22, { bg: 'rgba(0,0,0,0.55)', border: 'rgba(255,0,255,0.36)', radius: 8 });
      c.fillStyle = '#ff00ff'; c.beginPath(); c.roundRect(W / 2 - 145, 21, 290 * Math.max(0, this.boss.hp / this.boss.maxHp), 12, 6); c.fill();
      VFX.glowText(c, 'MOTHERSHIP', W / 2, 28, { font: '10px monospace', color: '#fff' });
    }
    VFX.glowText(c, 'MOVE: ARROWS/WASD | FIRE: SPACE/X', W - 10, H - 14, { font: '11px monospace', color: '#666', align: 'right' });
  }

  drawTitle(c, W, H) {
    VFX.drawShip3D(c, W / 2, H / 2 - 125, 46, '#00ffff', Math.sin(this.frame * 0.03) * 0.15);
    VFX.drawLEDText(c, 'STARFIGHTER 3D', W / 2, H / 2 - 58, '#00ffff', Math.min(52, W * 0.085));
    VFX.glowText(c, 'ASTEROIDES, CAZAS ENEMIGOS Y JEFE NODRIZA', W / 2, H / 2 - 8, { font: '14px monospace', color: '#ffff00' });
    VFX.glowText(c, 'ENTER / START PARA DESPEGAR', W / 2, H / 2 + 34, { font: '18px monospace', color: '#ff00ff' });
    VFX.glowText(c, 'ARROWS/WASD MOVER  |  SPACE/X DISPARAR', W / 2, H / 2 + 70, { font: '12px monospace', color: '#888' });
  }

  drawGameOver(c, W, H) {
    c.fillStyle = 'rgba(2,0,10,0.82)'; c.fillRect(0, 0, W, H);
    VFX.drawNeonRect(c, W / 2 - 205, H / 2 - 78, 410, 156, '#ff3366', 12, 2);
    VFX.drawLEDText(c, 'MISSION FAILED', W / 2, H / 2 - 24, '#ff3366', 36);
    VFX.glowText(c, `SCORE: ${this.score}`, W / 2, H / 2 + 22, { font: '18px monospace', color: '#00ffff' });
    VFX.glowText(c, 'R / ENTER = RESTART  |  ESC = MENU', W / 2, H / 2 + 56, { font: '12px monospace', color: '#777' });
  }

  loop() {
    if (!this.running) return;
    this.frame++; this.update(1 / 60); this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
