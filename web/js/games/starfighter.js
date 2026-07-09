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
    this.stars = VFX.generateStars(170);
    this.sectors = [
      { name: 'ORBITA AZUL', top: '#02020e', bottom: '#071d3a', glowA: '#00b7ff', glowB: '#7b2cff', planet: '#256dff', accent: '#00ffff' },
      { name: 'CAMPO DE ASTEROIDES', top: '#090508', bottom: '#21150e', glowA: '#ff9d00', glowB: '#ff3366', planet: '#9a6a42', accent: '#ffaa00' },
      { name: 'NEBULOSA VERDE', top: '#00110c', bottom: '#031f1c', glowA: '#00ff88', glowB: '#00ffff', planet: '#14a36f', accent: '#00ff88' },
      { name: 'FRENTE CARMESI', top: '#10020b', bottom: '#250015', glowA: '#ff3366', glowB: '#ff00ff', planet: '#b62050', accent: '#ff3366' },
      { name: 'ZONA PROFUNDA', top: '#030314', bottom: '#08001f', glowA: '#7f5cff', glowB: '#00ffff', planet: '#5b57d6', accent: '#c8f7ff' }
    ];
    this.reset();
  }

  reset() {
    this.score = 0; this.wave = 1; this.spawnTimer = 40; this.boss = null; this.bossScoreTarget = 1800;
    this.weapon = 'DUAL'; this.weaponTimer = 0; this.bombs = 2; this.patternIndex = 0;
    this.distance = 0; this.sector = 0; this.sectorLength = 2600; this.warpTimer = 0; this.sectorBanner = 120;
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
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','x','b','p'].includes(e.key)) e.preventDefault();
    this.keys[e.key] = true;
    if (e.key === 'Escape') { exitGame(); return; }
    if (e.key === 'p' && (this.state === 'playing' || this.state === 'paused')) {
      this.state = this.state === 'playing' ? 'paused' : 'playing';
      return;
    }
    if (this.state === 'title' && (e.key === 'Enter' || e.key === ' ')) { this.reset(); this.state = 'playing'; return; }
    if (this.state === 'gameover' && (e.key === 'r' || e.key === 'Enter')) { this.reset(); this.state = 'playing'; return; }
    if (this.state !== 'playing') return;
    if (e.key === ' ' || e.key === 'x' || e.key === 'Control') this.fire();
    if (e.key === 'b') this.useBomb();
  }

  onKeyUp(e) { this.keys[e.key] = false; }

  fire() {
    const p = this.player;
    if (p.fireCd > 0) return;
    p.fireCd = this.weapon === 'RAPID' ? 5 : this.weapon === 'LASER' ? 13 : 9;
    if (this.weapon === 'SPREAD') {
      [-2, -1, 0, 1, 2].forEach(i => this.bullets.push({ x: p.x + i * 6, y: p.y - 28, vx: i * 1.15, vy: -10.2, life: 64, power: 1, kind: 'bolt' }));
    } else if (this.weapon === 'LASER') {
      this.bullets.push({ x: p.x, y: p.y - 34, vx: 0, vy: -13.2, life: 54, power: 3, r: 7, kind: 'laser' });
      this.bullets.push({ x: p.x - 18, y: p.y - 22, vx: -0.35, vy: -9.4, life: 58, power: 1, kind: 'bolt' });
      this.bullets.push({ x: p.x + 18, y: p.y - 22, vx: 0.35, vy: -9.4, life: 58, power: 1, kind: 'bolt' });
    } else {
      this.bullets.push({ x: p.x - 10, y: p.y - 28, vx: -0.7, vy: -10.5, life: 70, power: this.weapon === 'RAPID' ? 1.2 : 1, kind: 'bolt' });
      this.bullets.push({ x: p.x + 10, y: p.y - 28, vx: 0.7, vy: -10.5, life: 70, power: this.weapon === 'RAPID' ? 1.2 : 1, kind: 'bolt' });
    }
    window.audioManager.playMove();
  }

  useBomb() {
    if (this.bombs <= 0 || this.state !== 'playing') return;
    this.bombs--;
    this.enemyShots = [];
    this.shake.trigger(14, 300);
    this.particles.emit(this.player.x, this.player.y, 80, ['#00ffff','#ff00ff','#ffffff'], [140, 360], [0.45, 1.0]);
    this.asteroids.forEach(a => { a.hp -= 4; if (a.hp <= 0) this.destroyAsteroid(a); });
    this.enemies.forEach(e => { e.hp -= 5; if (e.hp <= 0) this.destroyEnemy(e); });
    if (this.boss) {
      this.boss.hp -= 12;
      this.boss.hurt = 14;
      if (this.boss.hp <= 0) this.destroyBoss();
    }
    window.audioManager.playNitro();
  }

  update(dt) {
    this.shake.update(dt * 1000);
    this.particles.update(dt);
    if (this.state !== 'playing') return;
    const p = this.player;
    if (p.fireCd > 0) p.fireCd--;
    if (p.inv > 0) p.inv--;
    if (this.weaponTimer > 0) {
      this.weaponTimer--;
      if (this.weaponTimer <= 0) this.weapon = 'DUAL';
    }
    this.advanceSectorProgress();

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
    if (!this.boss && this.score >= this.bossScoreTarget && this.wave > 1) this.spawnBoss();

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

  advanceSectorProgress() {
    const speed = this.boss ? 3.2 : 7.5 + Math.min(5, this.wave * 0.35);
    this.distance += speed;
    if (this.warpTimer > 0) this.warpTimer--;
    if (this.sectorBanner > 0) this.sectorBanner--;
    const nextSector = Math.floor(this.distance / this.sectorLength) % this.sectors.length;
    if (nextSector !== this.sector) {
      this.sector = nextSector;
      this.warpTimer = 95;
      this.sectorBanner = 150;
      this.spawnTimer = Math.max(this.spawnTimer, 45);
      this.enemyShots = [];
      this.nebulaHue = (this.nebulaHue + 73) % 360;
      this.shake.trigger(6, 180);
      window.audioManager.playLevelUp();
    }
  }

  spawnWaveObject() {
    const pattern = this.patternIndex++ % 6;
    if (pattern === 0) {
      const count = Math.min(6, 3 + Math.floor(this.wave / 2));
      for (let i = 0; i < count; i++) this.spawnAsteroid(45 + i * ((this.W - 90) / Math.max(1, count - 1)), -40 - Math.random() * 110, 0.6 - Math.random() * 1.2);
    } else if (pattern === 1) {
      const count = Math.min(5, 2 + Math.floor(this.wave / 2));
      for (let i = 0; i < count; i++) this.spawnEnemy(70 + i * ((this.W - 140) / Math.max(1, count - 1)), -45 - i * 16, 'scout');
    } else if (pattern === 2) {
      this.spawnEnemy(55 + Math.random() * (this.W - 110), -48, 'hunter');
      for (let i = 0; i < 2; i++) this.spawnAsteroid(35 + Math.random() * (this.W - 70), -70 - i * 80, (Math.random() - 0.5) * 1.8);
    } else if (pattern === 3 && this.wave > 2) {
      this.spawnEnemy(this.W * 0.25, -52, 'elite');
      this.spawnEnemy(this.W * 0.75, -90, 'elite');
    } else {
      if (Math.random() < 0.55) this.spawnAsteroid(30 + Math.random() * (this.W - 60), -50, (Math.random() - 0.5) * 1.8);
      else this.spawnEnemy(40 + Math.random() * (this.W - 80), -45, Math.random() < 0.35 ? 'hunter' : 'scout');
    }
  }

  spawnAsteroid(x, y, vx) {
    const r = 16 + Math.random() * 28;
    this.asteroids.push({ x, y, r, vx, vy: 2.0 + Math.random() * 2.2 + this.wave * 0.12, hp: Math.ceil(r / 14), rot: Math.random() * 9, spin: (Math.random() - 0.5) * 0.05 });
  }

  spawnEnemy(x, y, type = 'scout') {
    const stats = {
      scout: { hp: 3, vy: 1.8, sway: 1.8, fire: 72, color: '#ff3366' },
      hunter: { hp: 4, vy: 2.35, sway: 2.7, fire: 48, color: '#ffaa00' },
      elite: { hp: 7, vy: 1.55, sway: 3.2, fire: 34, color: '#ff00ff' }
    }[type];
    this.enemies.push({
      x, y, type, w: type === 'elite' ? 48 : 38, h: type === 'elite' ? 44 : 38,
      vy: stats.vy + this.wave * 0.12, hp: stats.hp + Math.floor(this.wave / 3),
      phase: Math.random() * 100, sway: stats.sway, fire: stats.fire + Math.random() * 55,
      color: stats.color
    });
  }

  spawnBoss() {
    const hp = 58 + this.wave * 10;
    this.boss = { x: this.W / 2, y: 80, w: Math.min(190, this.W * 0.36), h: 92, hp, maxHp: hp, phase: 0, fire: 30, hurt: 0, attack: 0 };
    window.audioManager.playLevelUp();
  }

  updateBoss() {
    const b = this.boss;
    const hpRatio = b.hp / b.maxHp;
    b.attack = hpRatio < 0.34 ? 3 : hpRatio < 0.68 ? 2 : 1;
    b.phase += 0.025;
    b.x = this.W / 2 + Math.sin(b.phase * (b.attack === 3 ? 1.6 : 1)) * this.W * 0.26;
    if (b.hurt > 0) b.hurt--;
    b.fire--;
    if (b.fire <= 0) {
      b.fire = b.attack === 3 ? 11 : b.attack === 2 ? 15 : 20;
      if (b.attack === 1) {
        for (let i = -2; i <= 2; i++) this.enemyShots.push({ x: b.x + i * 22, y: b.y + 45, vx: i * 0.9, vy: 4.2, life: 130, r: 5 });
      } else if (b.attack === 2) {
        const angle = this.frame * 0.1;
        for (let i = 0; i < 8; i++) {
          const a = angle + i * Math.PI / 4;
          this.enemyShots.push({ x: b.x, y: b.y + 30, vx: Math.cos(a) * 2.3, vy: Math.abs(Math.sin(a)) * 2.1 + 2.6, life: 140, r: 4 });
        }
      } else {
        for (let i = -3; i <= 3; i++) this.enemyShots.push({ x: b.x + i * 18, y: b.y + 42, vx: i * 0.55 + Math.sin(this.frame * 0.08) * 0.8, vy: 5.0, life: 120, r: 5 });
        if (this.frame % 120 === 0) this.spawnEnemy(b.x + (Math.random() < 0.5 ? -70 : 70), b.y + 42, 'hunter');
      }
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
          b.life = 0; e.hp -= b.power; e.hurt = 7; this.score += 20; this.particles.emit(b.x, b.y, 10, ['#00ffff','#ff00ff','#fff'], [50, 150], [0.2, 0.48]);
          if (e.hp <= 0) this.destroyEnemy(e);
        }
      });
      if (this.boss && b.life > 0 && this.pointRect(b.x, b.y, this.boss)) {
        b.life = 0; this.boss.hp -= b.power; this.boss.hurt = 7; this.score += 18;
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
        it.dead = true; this.applyPickup(it.type); this.score += 80; window.audioManager.playBonus();
      }
    });
  }

  applyPickup(type = 'shield') {
    if (type === 'shield') this.player.shield = Math.min(100, this.player.shield + 30);
    if (type === 'bomb') this.bombs = Math.min(5, this.bombs + 1);
    if (type === 'spread' || type === 'laser' || type === 'rapid') {
      this.weapon = type.toUpperCase();
      this.weaponTimer = type === 'laser' ? 520 : 650;
    }
  }

  spawnPickup(x, y) {
    const roll = Math.random();
    const type = roll < 0.34 ? 'shield' : roll < 0.56 ? 'spread' : roll < 0.76 ? 'rapid' : roll < 0.92 ? 'laser' : 'bomb';
    this.pickups.push({ x, y, type, phase: 0 });
  }

  destroyAsteroid(a) {
    a.dead = true; this.score += Math.round(80 + a.r * 3);
    this.particles.emit(a.x, a.y, 24, ['#bfa58a','#ffaa00','#fff'], [70, 190], [0.3, 0.75]);
    if (Math.random() < 0.16) this.spawnPickup(a.x, a.y);
    window.audioManager.playHit();
  }

  destroyEnemy(e) {
    e.dead = true; this.score += 180;
    this.particles.emit(e.x, e.y, 32, ['#00ffff','#ff00ff','#fff'], [80, 220], [0.3, 0.8]);
    if (Math.random() < 0.24) this.spawnPickup(e.x, e.y);
    window.audioManager.playPowerup();
  }

  destroyBoss() {
    this.score += 2200; this.particles.emit(this.boss.x, this.boss.y, 90, ['#ff00ff','#00ffff','#ffff00','#fff'], [100, 300], [0.5, 1.1]);
    this.boss = null; this.bossScoreTarget += 2400; this.spawnTimer = 80; this.bombs = Math.min(5, this.bombs + 1); window.audioManager.playLevelUp();
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
    this.pickups.forEach(p => this.drawPickup(c, p));
    this.asteroids.forEach(a => VFX.drawAsteroid3D(c, a.x, a.y, a.r, a.rot));
    this.enemies.forEach(e => this.drawEnemy(c, e));
    if (this.boss) this.drawBoss(c, this.boss);
    this.bullets.forEach(b => this.drawBullet(c, b, '#00ffff'));
    this.enemyShots.forEach(b => this.drawBullet(c, b, '#ff3366'));
    this.drawPlayer(c);
    c.restore();
    this.particles.draw(c);
    this.drawHud(c, W, H);
    if (this.state === 'paused') this.drawPaused(c, W, H);
    if (this.state === 'gameover') this.drawGameOver(c, W, H);
    VFX.drawCRTEffect(c, W, H, 0.1);
  }

  drawSpace(c, W, H) {
    const sector = this.sectors[this.sector];
    const warp = this.warpTimer / 95;
    VFX.backgroundGradient(c, W, H, sector.top, sector.bottom);
    this.drawSectorLandmarks(c, W, H, sector);
    this.drawMovingStars(c, W, H, sector, warp);
    const hue = (this.nebulaHue + this.sector * 45 + this.frame * 0.05) % 360;
    VFX.radialGlow(c, W * 0.2, H * 0.22, W * 0.36, warp > 0 ? '#ffffff' : sector.glowA, 0.10 + warp * 0.18);
    VFX.radialGlow(c, W * 0.82, H * 0.35, W * 0.32, warp > 0 ? `hsl(${hue}, 95%, 58%)` : sector.glowB, 0.08 + warp * 0.12);
    c.save(); c.strokeStyle = warp > 0 ? `rgba(255,255,255,${0.1 + warp * 0.28})` : 'rgba(0,255,255,0.08)';
    const gridSpeed = this.frame * (2.2 + warp * 18);
    for (let y = gridSpeed % 36; y < H; y += 36) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.restore();
  }

  drawMovingStars(c, W, H, sector, warp) {
    c.save();
    this.stars.forEach((s, i) => {
      const layer = 0.45 + s.speed * 0.42;
      const travel = this.distance * layer * (0.018 + warp * 0.04);
      const xDrift = Math.sin((this.frame + i * 17) * 0.006) * W * 0.025 * layer;
      const x = ((s.x * W + xDrift) % W + W) % W;
      const y = ((s.y * H + travel) % (H + 30)) - 15;
      const len = 1 + layer * 7 + warp * 34;
      const alpha = Math.min(1, (0.25 + s.brightness * 0.75) * (1 + warp * 0.8));
      c.globalAlpha = alpha;
      c.strokeStyle = i % 11 === 0 ? sector.accent : '#ffffff';
      c.lineWidth = Math.max(1, s.size * (1 + warp));
      c.beginPath();
      c.moveTo(x, y - len);
      c.lineTo(x, y + len * 0.7);
      c.stroke();
    });
    c.restore();
  }

  drawSectorLandmarks(c, W, H, sector) {
    const progress = (this.distance % this.sectorLength) / this.sectorLength;
    const planetY = H * (0.18 + progress * 0.42);
    const planetX = this.sector % 2 === 0 ? W * 0.18 : W * 0.82;
    VFX.drawOrb3D(c, planetX, planetY, W * (0.075 + progress * 0.035), sector.planet, { glow: true });

    c.save();
    c.globalAlpha = 0.18;
    c.strokeStyle = sector.accent;
    c.lineWidth = 2;
    const beltY = (this.distance * 0.08) % (H + 160) - 80;
    for (let i = 0; i < 9; i++) {
      const x = (i / 8) * W + Math.sin(this.frame * 0.01 + i) * 16;
      c.beginPath();
      c.arc(x, beltY + Math.sin(i) * 28, 5 + (i % 3) * 3, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();

    if (this.sector === 1 || this.sector === 4) {
      c.save();
      c.globalAlpha = 0.22;
      for (let i = 0; i < 5; i++) {
        const x = ((i * 137 + this.distance * 0.12) % (W + 90)) - 45;
        const y = ((i * 91 + this.distance * 0.18) % (H + 120)) - 60;
        VFX.drawAsteroid3D(c, x, y, 11 + i * 2, this.frame * 0.01 + i);
      }
      c.restore();
    }
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
    VFX.drawShip3D(c, 0, 0, e.type === 'elite' ? 28 : 22, e.color || '#ff3366', Math.sin(this.frame * 0.05) * 0.1);
    c.restore();
  }

  drawPickup(c, p) {
    const colors = { shield: '#00ffff', spread: '#ffff00', rapid: '#00ff88', laser: '#ff00ff', bomb: '#ff3366' };
    const labels = { shield: 'SH', spread: 'SP', rapid: 'RP', laser: 'LS', bomb: 'BM' };
    const color = colors[p.type] || '#00ffff';
    VFX.drawGem3D(c, p.x, p.y, 10 + Math.sin(p.phase) * 2, color, { spin: this.frame * 0.04 });
    VFX.glowText(c, labels[p.type] || 'UP', p.x, p.y + 24, { font: '9px monospace', color });
  }

  drawBoss(c, b) {
    c.save();
    if (b.hurt > 0) c.globalAlpha = 0.6;
    c.translate(b.x, b.y);
    VFX.radialGlow(c, 0, 0, 110, '#ff00ff', 0.28);
    VFX.drawMetalPanel3D(c, -b.w / 2, -b.h / 2, b.w, b.h, b.attack === 3 ? '#5b0925' : '#40104f', 18);
    VFX.drawOrb3D(c, 0, 0, 25, b.attack === 3 ? '#ff3366' : '#ff00ff');
    VFX.drawOrb3D(c, -b.w * 0.32, 8, 14, '#00ffff');
    VFX.drawOrb3D(c, b.w * 0.32, 8, 14, '#00ffff');
    VFX.drawNeonRect(c, -b.w / 2, -b.h / 2, b.w, b.h, '#ff00ff', 18, 2);
    c.restore();
  }

  drawBullet(c, b, color) {
    c.save(); c.shadowColor = color; c.shadowBlur = 12; c.fillStyle = color;
    c.beginPath(); c.ellipse(b.x, b.y, b.r || 4, b.kind === 'laser' ? 18 : 12, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  drawHud(c, W, H) {
    VFX.panel(c, 10, 10, 270, 98, { bg: 'rgba(0,0,20,0.72)', border: 'rgba(0,255,255,0.16)', radius: 8 });
    VFX.drawLEDText(c, `${this.score}`, 128, 30, '#00ffff', 22);
    VFX.glowText(c, `LIVES ${this.player.lives}  WAVE ${this.wave}`, 20, 58, { font: '11px monospace', color: '#ffff00', align: 'left' });
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.beginPath(); c.roundRect(20, 68, 145, 10, 5); c.fill();
    VFX.drawNeonRect(c, 20, 68, Math.max(2, this.player.shield * 1.45), 10, this.player.shield < 35 ? '#ff3366' : '#00ffff', 5, 1);
    VFX.glowText(c, 'SHIELD', 194, 73, { font: '10px monospace', color: '#888', align: 'left' });
    VFX.glowText(c, `WEAPON ${this.weapon}  BOMB ${this.bombs}`, 20, 94, { font: '11px monospace', color: this.weapon === 'DUAL' ? '#888' : '#00ff88', align: 'left' });
    const sector = this.sectors[this.sector];
    const pct = Math.floor(((this.distance % this.sectorLength) / this.sectorLength) * 100);
    const sectorX = W < 620 ? 10 : W - 214;
    const sectorY = W < 620 ? 114 : 12;
    VFX.panel(c, sectorX, sectorY, 204, 48, { bg: 'rgba(0,0,20,0.58)', border: 'rgba(255,255,255,0.12)', radius: 8 });
    VFX.glowText(c, sector.name, sectorX + 102, sectorY + 16, { font: '10px monospace', color: sector.accent });
    VFX.drawNeonRect(c, sectorX + 16, sectorY + 30, Math.max(2, pct * 1.8), 8, sector.accent, 4, 1);
    if (this.boss) {
      VFX.panel(c, W / 2 - 150, 16, 300, 22, { bg: 'rgba(0,0,0,0.55)', border: 'rgba(255,0,255,0.36)', radius: 8 });
      c.fillStyle = '#ff00ff'; c.beginPath(); c.roundRect(W / 2 - 145, 21, 290 * Math.max(0, this.boss.hp / this.boss.maxHp), 12, 6); c.fill();
      VFX.glowText(c, `MOTHERSHIP PHASE ${this.boss.attack || 1}`, W / 2, 28, { font: '10px monospace', color: '#fff' });
    }
    if (this.sectorBanner > 0) {
      const a = Math.min(1, this.sectorBanner / 40);
      c.save();
      c.globalAlpha = a;
      VFX.glowText(c, `SECTOR ${this.sector + 1}: ${sector.name}`, W / 2, H * 0.18, { font: `${Math.min(22, W * 0.035)}px monospace`, color: sector.accent, glow: sector.accent });
      c.restore();
    }
    VFX.glowText(c, 'MOVE ARROWS/WASD | FIRE SPACE/X | B BOMB | P PAUSE', W - 10, H - 14, { font: '11px monospace', color: '#666', align: 'right' });
  }

  drawTitle(c, W, H) {
    VFX.drawShip3D(c, W / 2, H / 2 - 125, 46, '#00ffff', Math.sin(this.frame * 0.03) * 0.15);
    VFX.drawLEDText(c, 'STARFIGHTER 3D', W / 2, H / 2 - 58, '#00ffff', Math.min(52, W * 0.085));
    VFX.glowText(c, 'SECTORES DINAMICOS, WARP, POWER-UPS Y JEFE CON FASES', W / 2, H / 2 - 8, { font: '14px monospace', color: '#ffff00' });
    VFX.glowText(c, 'ENTER / START PARA DESPEGAR', W / 2, H / 2 + 34, { font: '18px monospace', color: '#ff00ff' });
    VFX.glowText(c, 'ARROWS/WASD MOVER  |  SPACE/X DISPARAR  |  B BOMBA', W / 2, H / 2 + 70, { font: '12px monospace', color: '#888' });
  }

  drawPaused(c, W, H) {
    c.fillStyle = 'rgba(2,0,10,0.66)'; c.fillRect(0, 0, W, H);
    VFX.drawNeonRect(c, W / 2 - 150, H / 2 - 45, 300, 90, '#00ffff', 12, 2);
    VFX.drawLEDText(c, 'PAUSED', W / 2, H / 2 - 4, '#00ffff', 36);
    VFX.glowText(c, 'P / Ⅱ PARA CONTINUAR', W / 2, H / 2 + 32, { font: '12px monospace', color: '#ffff00' });
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
