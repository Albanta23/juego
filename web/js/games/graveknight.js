class GraveKnightGame {
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
    this.stars = VFX.generateStars(70);
    this.reset();
  }

  reset() {
    this.groundY = Math.max(245, this.H - 86);
    this.camera = 0; this.score = 0; this.distance = 0; this.wave = 1;
    this.spawnTimer = 0; this.bossSpawned = false; this.boss = null;
    this.player = {
      x: 95, y: this.groundY - 54, vx: 0, vy: 0, w: 28, h: 52,
      dir: 1, lives: 3, armor: 2, onGround: false, inv: 0, attackCd: 0
    };
    this.projectiles = []; this.enemies = []; this.pickups = [];
    this.platforms = this.makePlatforms();
    this.decor = this.makeDecor();
    window.updateScore(0);
  }

  makePlatforms() {
    const plats = [{ x: -200, y: this.groundY, w: 9000, h: 80 }];
    for (let i = 0; i < 34; i++) {
      plats.push({ x: 360 + i * 250 + Math.random() * 90, y: this.groundY - 70 - (i % 3) * 36, w: 90 + Math.random() * 60, h: 14 });
    }
    return plats;
  }

  makeDecor() {
    const items = [];
    const types = ['grave','cross','tree','crypt','fence','moonrock'];
    for (let i = 0; i < 90; i++) {
      items.push({ x: i * 105 + Math.random() * 45, type: types[i % types.length], s: 0.75 + Math.random() * 0.7 });
    }
    return items;
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
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','x','z'].includes(e.key)) e.preventDefault();
    this.keys[e.key] = true;
    if (e.key === 'Escape') { exitGame(); return; }
    if (this.state === 'title' && (e.key === 'Enter' || e.key === ' ')) { this.reset(); this.state = 'playing'; return; }
    if (this.state === 'gameover' && (e.key === 'r' || e.key === 'Enter')) { this.reset(); this.state = 'playing'; return; }
    if (this.state !== 'playing') return;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'z' || e.key === ' ') this.jump();
    if (e.key === 'x' || e.key === 'Control') this.attack();
  }

  onKeyUp(e) { this.keys[e.key] = false; }

  jump() {
    if (!this.player.onGround) return;
    this.player.vy = -13.2;
    this.player.onGround = false;
    window.audioManager.playBounce();
  }

  attack() {
    const p = this.player;
    if (p.attackCd > 0) return;
    p.attackCd = 18;
    this.projectiles.push({ x: p.x + p.dir * 22, y: p.y + 22, vx: p.dir * 9.5, life: 75, r: 4 });
    window.audioManager.playRotate();
  }

  spawnEnemy() {
    const ahead = this.camera + this.W + 40 + Math.random() * 260;
    const typeRoll = Math.random();
    if (this.distance > 820 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.boss = { x: ahead + 220, y: this.groundY - 92, w: 76, h: 92, hp: 18, vx: -1.2, phase: 0, hurt: 0 };
      return;
    }
    if (typeRoll < 0.56) {
      this.enemies.push({ type: 'zombie', x: ahead, y: this.groundY - 42, w: 28, h: 42, vx: -1.1 - Math.random() * 0.7, hp: 2, rise: 22, hurt: 0 });
    } else if (typeRoll < 0.82) {
      this.enemies.push({ type: 'bat', x: ahead, y: this.groundY - 130 - Math.random() * 80, w: 30, h: 20, vx: -2.1 - Math.random() * 0.9, hp: 1, phase: Math.random() * 9, hurt: 0 });
    } else {
      this.enemies.push({ type: 'hound', x: ahead, y: this.groundY - 28, w: 38, h: 28, vx: -3.1, hp: 1, hurt: 0 });
    }
  }

  update(dt) {
    this.shake.update(dt * 1000);
    this.particles.update(dt);
    if (this.state !== 'playing') return;

    const p = this.player;
    if (p.inv > 0) p.inv--;
    if (p.attackCd > 0) p.attackCd--;

    const accel = 0.8, max = 4.4;
    if (this.keys['ArrowLeft'] || this.keys['a']) { p.vx = Math.max(-max, p.vx - accel); p.dir = -1; }
    else if (this.keys['ArrowRight'] || this.keys['d']) { p.vx = Math.min(max, p.vx + accel); p.dir = 1; }
    else p.vx *= 0.78;

    p.vy += 0.72;
    p.x += p.vx; p.y += p.vy;
    p.onGround = false;
    this.platforms.forEach(pl => {
      if (p.x + p.w / 2 > pl.x && p.x - p.w / 2 < pl.x + pl.w && p.y + p.h >= pl.y && p.y + p.h <= pl.y + 22 && p.vy >= 0) {
        p.y = pl.y - p.h; p.vy = 0; p.onGround = true;
      }
    });
    if (p.y > this.H + 80) this.damagePlayer(2);

    this.camera = Math.max(0, p.x - this.W * 0.34);
    this.distance = Math.floor(this.camera / 10);
    this.wave = 1 + Math.floor(this.distance / 260);
    this.spawnTimer--;
    if (this.spawnTimer <= 0) { this.spawnEnemy(); this.spawnTimer = Math.max(24, 92 - this.wave * 6); }

    this.projectiles.forEach(pr => { pr.x += pr.vx; pr.life--; });
    this.projectiles = this.projectiles.filter(pr => pr.life > 0 && pr.x > this.camera - 80 && pr.x < this.camera + this.W + 120);

    this.enemies.forEach(e => {
      if (e.hurt > 0) e.hurt--;
      if (e.type === 'zombie' && e.rise > 0) { e.rise--; e.y += Math.sin(e.rise * 0.4) * 0.5; }
      e.x += e.vx;
      if (e.type === 'bat') { e.phase += 0.12; e.y += Math.sin(e.phase) * 2.0; }
      if (e.type === 'hound') e.vx = -3.0 - this.wave * 0.12;
    });

    if (this.boss) {
      const b = this.boss;
      if (b.hurt > 0) b.hurt--;
      b.phase += 0.03;
      b.x += Math.sin(b.phase) * 1.5 + b.vx;
      b.y = this.groundY - b.h + Math.sin(b.phase * 2) * 8;
      if (b.x < this.camera + this.W * 0.54) b.vx = 0.8;
      if (b.x > this.camera + this.W - 90) b.vx = -1.0;
      if (this.rectHit(p, b)) this.damagePlayer(1);
    }

    this.handleHits();
    this.enemies = this.enemies.filter(e => e.hp > 0 && e.x > this.camera - 180);
    this.pickups.forEach(it => {
      it.y += Math.sin((this.frame + it.x) * 0.08) * 0.12;
      if (this.rectHit(p, { x: it.x, y: it.y, w: 18, h: 18 })) {
        it.dead = true; this.score += it.type === 'armor' ? 150 : 50;
        if (it.type === 'armor') p.armor = Math.min(2, p.armor + 1);
        window.audioManager.playBonus();
      }
    });
    this.pickups = this.pickups.filter(it => !it.dead && it.x > this.camera - 80);
    window.updateScore(this.score);
  }

  handleHits() {
    const p = this.player;
    this.projectiles.forEach(pr => {
      this.enemies.forEach(e => {
        if (e.hp > 0 && pr.life > 0 && this.pointHit(pr.x, pr.y, e)) {
          pr.life = 0; e.hp--; e.hurt = 8; this.score += 25;
          this.particles.emit(pr.x, pr.y, 8, ['#ffff00','#ff3366','#fff'], [40, 120], [0.2, 0.45]);
          window.audioManager.playHit();
          if (e.hp <= 0) this.killEnemy(e);
        }
      });
      if (this.boss && pr.life > 0 && this.pointHit(pr.x, pr.y, this.boss)) {
        pr.life = 0; this.boss.hp--; this.boss.hurt = 8; this.score += 35;
        this.particles.emit(pr.x, pr.y, 12, ['#ff00ff','#ffff00','#fff'], [50, 150], [0.25, 0.55]);
        if (this.boss.hp <= 0) {
          this.score += 1000; window.gameStorage.setHighScore('graveknight', this.score);
          this.particles.emit(this.boss.x, this.boss.y + 35, 70, ['#ff00ff','#00ffff','#ffff00','#fff'], [90, 250], [0.4, 1.0]);
          this.boss = null; this.bossSpawned = false; this.distance += 250; window.audioManager.playLevelUp();
        }
      }
    });

    this.enemies.forEach(e => { if (this.rectHit(p, e)) this.damagePlayer(1); });
  }

  killEnemy(e) {
    this.score += e.type === 'bat' ? 80 : e.type === 'hound' ? 120 : 100;
    this.particles.emit(e.x, e.y + e.h / 2, 18, ['#9cffd0','#ff3366','#fff'], [60, 180], [0.25, 0.65]);
    if (Math.random() < 0.18) this.pickups.push({ x: e.x, y: e.y, type: Math.random() < 0.25 ? 'armor' : 'coin' });
    window.audioManager.playPoison();
  }

  damagePlayer(amount) {
    const p = this.player;
    if (p.inv > 0) return;
    p.inv = 90; this.shake.trigger(10, 260);
    p.armor -= amount;
    if (p.armor <= 0) {
      p.lives--; p.armor = 1;
      if (p.lives <= 0) {
        this.state = 'gameover'; window.audioManager.playGameOver(); window.gameStorage.setHighScore('graveknight', this.score); return;
      }
    }
    p.x = Math.max(this.camera + 40, p.x - 70); p.y = this.groundY - p.h; p.vx = -p.dir * 4; p.vy = -7;
    window.audioManager.playCarHit();
  }

  rectHit(a, b) {
    const ax = a.x - a.w / 2, ay = a.y, bx = b.x - b.w / 2, by = b.y;
    return ax < bx + b.w && ax + a.w > bx && ay < by + b.h && ay + a.h > by;
  }

  pointHit(x, y, r) {
    return x > r.x - r.w / 2 && x < r.x + r.w / 2 && y > r.y && y < r.y + r.h;
  }

  draw() {
    const c = this.ctx, W = this.W, H = this.H;
    this.drawSky(c, W, H);
    if (this.state === 'title') { this.drawTitle(c, W, H); return; }
    c.save(); this.shake.apply(c); c.translate(-this.camera, 0);
    this.drawWorld(c);
    this.pickups.forEach(it => this.drawPickup(c, it));
    this.projectiles.forEach(pr => this.drawProjectile(c, pr));
    this.enemies.forEach(e => this.drawEnemy(c, e));
    if (this.boss) this.drawBoss(c, this.boss);
    this.drawPlayer(c, this.player);
    c.restore();
    this.particles.draw(c);
    this.drawHud(c, W, H);
    if (this.state === 'gameover') this.drawGameOver(c, W, H);
    VFX.drawCRTEffect(c, W, H, 0.12);
  }

  drawSky(c, W, H) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070012'); g.addColorStop(0.42, '#1d1638'); g.addColorStop(1, '#050008');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    VFX.starfield(c, W, H * 0.58, this.stars, this.frame * 0.012);
    VFX.radialGlow(c, W * 0.78, H * 0.22, 90, '#d8e8ff', 0.23);
    c.save(); c.fillStyle = '#d8e8ff'; c.shadowColor = '#d8e8ff'; c.shadowBlur = 20;
    c.beginPath(); c.arc(W * 0.78, H * 0.22, 34, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#070012'; c.beginPath(); c.arc(W * 0.79, H * 0.2, 32, 0, Math.PI * 2); c.fill(); c.restore();
  }

  drawWorld(c) {
    const left = this.camera - 80, right = this.camera + this.W + 120;
    c.fillStyle = '#070508'; c.fillRect(left, this.groundY, right - left, this.H - this.groundY);
    c.fillStyle = '#182018'; c.fillRect(left, this.groundY, right - left, 12);
    for (let x = Math.floor(left / 48) * 48; x < right; x += 48) {
      c.fillStyle = x % 96 === 0 ? '#1e2a20' : '#111a14';
      c.fillRect(x, this.groundY + 8, 48, this.H - this.groundY);
    }
    this.decor.forEach(d => {
      if (d.x < left || d.x > right) return;
      this.drawDecor(c, d);
    });
    this.platforms.forEach(pl => {
      if (pl.x + pl.w < left || pl.x > right || pl.y === this.groundY) return;
      c.save(); c.shadowColor = '#00ffff'; c.shadowBlur = 8;
      c.fillStyle = '#252331'; c.beginPath(); c.roundRect(pl.x, pl.y, pl.w, pl.h, 4); c.fill();
      VFX.drawNeonRect(c, pl.x, pl.y, pl.w, pl.h, '#7d8cff', 4, 1);
      c.restore();
    });
  }

  drawDecor(c, d) {
    const y = this.groundY, x = d.x, s = d.s;
    c.save(); c.translate(x, y); c.scale(s, s);
    if (d.type === 'tree') {
      c.fillStyle = '#100b14'; c.fillRect(-8, -92, 16, 92);
      c.strokeStyle = '#17101e'; c.lineWidth = 6;
      [-1, 1].forEach(side => { c.beginPath(); c.moveTo(0, -68); c.lineTo(side * 38, -104); c.stroke(); });
    } else if (d.type === 'crypt') {
      c.fillStyle = '#191827'; c.fillRect(-28, -55, 56, 55);
      c.fillStyle = '#0b0911'; c.fillRect(-10, -32, 20, 32);
      VFX.drawNeonRect(c, -28, -55, 56, 55, '#3b405d', 3, 1);
    } else if (d.type === 'fence') {
      c.strokeStyle = '#33364a'; c.lineWidth = 3;
      for (let i = -30; i <= 30; i += 12) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, -38); c.stroke(); }
      c.beginPath(); c.moveTo(-36, -22); c.lineTo(36, -22); c.stroke();
    } else if (d.type === 'moonrock') {
      c.fillStyle = '#343042'; c.beginPath(); c.moveTo(-18, 0); c.lineTo(-8, -24); c.lineTo(16, -18); c.lineTo(22, 0); c.fill();
    } else {
      c.fillStyle = '#2e3040'; c.fillRect(-8, -36, 16, 36);
      if (d.type === 'cross') { c.fillRect(-20, -28, 40, 8); }
      VFX.drawNeonRect(c, -10, -38, 20, 38, '#6f7898', 3, 1);
    }
    c.restore();
  }

  drawPlayer(c, p) {
    c.save(); c.translate(p.x, p.y);
    if (p.inv > 0 && Math.floor(this.frame / 5) % 2 === 0) c.globalAlpha = 0.45;
    c.scale(p.dir, 1);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(0, p.h + 4, 20, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.armor > 1 ? '#b8f7ff' : '#c98a54';
    c.shadowColor = p.armor > 1 ? '#00ffff' : '#ff8800'; c.shadowBlur = 10;
    c.beginPath(); c.roundRect(-13, 16, 26, 28, 5); c.fill();
    c.fillStyle = '#f3d1a0'; c.beginPath(); c.arc(0, 10, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#23202a'; c.fillRect(-9, 7, 18, 5);
    c.strokeStyle = '#d8e8ff'; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, 28); c.lineTo(-22, 42); c.moveTo(10, 28); c.lineTo(22, 42); c.stroke();
    c.fillStyle = '#402c2c'; c.fillRect(-10, 44, 7, 9); c.fillRect(4, 44, 7, 9);
    c.restore();
  }

  drawProjectile(c, pr) {
    c.save(); c.shadowColor = '#ffff00'; c.shadowBlur = 12; c.strokeStyle = '#ffff00'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(pr.x - Math.sign(pr.vx) * 12, pr.y); c.lineTo(pr.x + Math.sign(pr.vx) * 10, pr.y); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); c.fill(); c.restore();
  }

  drawEnemy(c, e) {
    c.save(); c.translate(e.x, e.y); if (e.hurt > 0) c.globalAlpha = 0.5;
    if (e.type === 'bat') {
      c.fillStyle = '#2a143c'; c.shadowColor = '#ff00ff'; c.shadowBlur = 8;
      c.beginPath(); c.ellipse(0, 10, 11, 8, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(-8, 10); c.lineTo(-30, Math.sin(this.frame * 0.3) * 10 + 8); c.lineTo(-10, 18); c.fill();
      c.beginPath(); c.moveTo(8, 10); c.lineTo(30, Math.sin(this.frame * 0.3) * 10 + 8); c.lineTo(10, 18); c.fill();
    } else if (e.type === 'hound') {
      c.fillStyle = '#5a1c24'; c.shadowColor = '#ff3366'; c.shadowBlur = 8;
      c.beginPath(); c.roundRect(-19, 8, 38, 20, 8); c.fill();
      c.fillStyle = '#ffdd88'; c.fillRect(-14, 14, 5, 4); c.fillRect(8, 14, 5, 4);
    } else {
      const sink = Math.max(0, e.rise || 0);
      c.translate(0, sink);
      c.fillStyle = '#7fb38a'; c.shadowColor = '#00ff88'; c.shadowBlur = 8;
      c.beginPath(); c.roundRect(-13, 8, 26, 34, 5); c.fill();
      c.fillStyle = '#b8f0c0'; c.beginPath(); c.arc(0, 4, 11, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1b1020'; c.fillRect(-6, 2, 4, 4); c.fillRect(4, 2, 4, 4);
    }
    c.restore();
  }

  drawBoss(c, b) {
    c.save(); c.translate(b.x, b.y); if (b.hurt > 0) c.globalAlpha = 0.55;
    VFX.radialGlow(c, 0, 45, 90, '#ff00ff', 0.3);
    c.fillStyle = '#35104a'; c.shadowColor = '#ff00ff'; c.shadowBlur = 18;
    c.beginPath(); c.roundRect(-b.w / 2, 18, b.w, 70, 16); c.fill();
    c.fillStyle = '#b8f0c0'; c.beginPath(); c.arc(0, 12, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff3366'; c.fillRect(-12, 8, 8, 7); c.fillRect(6, 8, 8, 7);
    c.strokeStyle = '#d8e8ff'; c.lineWidth = 4; c.beginPath(); c.moveTo(-28, 45); c.lineTo(-58, 78); c.moveTo(28, 45); c.lineTo(58, 78); c.stroke();
    c.restore();
  }

  drawPickup(c, it) {
    const color = it.type === 'armor' ? '#00ffff' : '#ffff00';
    VFX.drawNeonCircle(c, it.x, it.y + 8, 10, color, 2);
    c.fillStyle = color; c.font = 'bold 12px monospace'; c.textAlign = 'center'; c.fillText(it.type === 'armor' ? 'A' : '$', it.x, it.y + 12);
  }

  drawHud(c, W, H) {
    VFX.panel(c, 10, 10, 245, 82, { bg: 'rgba(0,0,20,0.72)', border: 'rgba(0,255,255,0.16)', radius: 8 });
    VFX.drawLEDText(c, `${this.score}`, 122, 30, '#00ffff', 22);
    VFX.glowText(c, 'GRAVE KNIGHT', 20, 58, { font: '11px monospace', color: '#ff00ff', align: 'left' });
    VFX.glowText(c, `LIVES ${this.player.lives}  ARMOR ${this.player.armor}  WAVE ${this.wave}`, 20, 76, { font: '11px monospace', color: '#ffff00', align: 'left' });
    if (this.boss) {
      VFX.panel(c, W / 2 - 130, 18, 260, 20, { bg: 'rgba(0,0,0,0.5)', border: 'rgba(255,0,255,0.35)', radius: 8 });
      c.fillStyle = '#ff00ff'; c.beginPath(); c.roundRect(W / 2 - 126, 22, 252 * Math.max(0, this.boss.hp / 18), 12, 6); c.fill();
      VFX.glowText(c, 'LICH LORD', W / 2, 29, { font: '10px monospace', color: '#fff' });
    }
    VFX.glowText(c, '← → MOVE | ↑ JUMP | X ATTACK', W - 10, H - 14, { font: '11px monospace', color: '#666', align: 'right' });
  }

  drawTitle(c, W, H) {
    VFX.drawLEDText(c, 'GRAVE KNIGHT', W / 2, H / 2 - 88, '#c8f7ff', Math.min(54, W * 0.09));
    VFX.glowText(c, 'ARCADE DE CEMENTERIO: SALTA, LANZA Y SOBREVIVE', W / 2, H / 2 - 26, { font: '14px monospace', color: '#ffff00' });
    VFX.glowText(c, 'ENTER / START PARA JUGAR', W / 2, H / 2 + 16, { font: '18px monospace', color: '#ff00ff' });
    VFX.glowText(c, 'CONTROLES: ← → MOVER  |  ↑/Z SALTAR  |  X ATACAR', W / 2, H / 2 + 54, { font: '12px monospace', color: '#888' });
    VFX.drawCRTEffect(c, W, H, 0.16);
  }

  drawGameOver(c, W, H) {
    c.fillStyle = 'rgba(5,0,10,0.82)'; c.fillRect(0, 0, W, H);
    VFX.drawNeonRect(c, W / 2 - 205, H / 2 - 78, 410, 156, '#ff3366', 12, 2);
    VFX.drawLEDText(c, 'GAME OVER', W / 2, H / 2 - 24, '#ff3366', 42);
    VFX.glowText(c, `SCORE: ${this.score}`, W / 2, H / 2 + 22, { font: '18px monospace', color: '#00ffff' });
    VFX.glowText(c, 'R / ENTER = RESTART  |  ESC = MENU', W / 2, H / 2 + 56, { font: '12px monospace', color: '#777' });
  }

  loop() {
    if (!this.running) return;
    this.frame++; this.update(1 / 60); this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
