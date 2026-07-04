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
    this.viewDistance = 1300;
    this.zoneLength = 420;
    this.zoneIndex = 0;
    this.zoneBannerTimer = 0;
    this.zones = [
      { name: 'NEON CITY', sky: ['#050018','#191055','#55123f'], ground: ['#07170f','#0c2515'], road: ['#101018','#30303b'], edge: '#00ffff', lane: '#ffff00', scenery: ['tower','drone','gate','sign'], atmosphere: 'glow' },
      { name: 'DUST VALLEY', sky: ['#180712','#502313','#b24a1f'], ground: ['#2a1608','#4a260d'], road: ['#1b1512','#3b2c22'], edge: '#ff8800', lane: '#ffe66d', scenery: ['crystal','sign','gate','palm'], atmosphere: 'dust' },
      { name: 'CYBER TUNNEL', sky: ['#02030f','#07113a','#091020'], ground: ['#02040a','#050b16'], road: ['#05070d','#161b2b'], edge: '#ff00ff', lane: '#00ffff', scenery: ['gate','drone','tower','crystal'], atmosphere: 'tunnel' },
      { name: 'FROST RUN', sky: ['#061827','#123d5a','#7cc7ff'], ground: ['#163343','#d7f8ff'], road: ['#17242c','#314652'], edge: '#9ffcff', lane: '#ffffff', scenery: ['crystal','tower','sign','drone'], atmosphere: 'snow' },
      { name: 'ALIEN WOODS', sky: ['#06110b','#12351e','#346a2c'], ground: ['#061b0d','#124d24'], road: ['#111812','#263426'], edge: '#00ff88', lane: '#ff00ff', scenery: ['palm','crystal','drone','gate'], atmosphere: 'spores' }
    ];
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
    this.zoneIndex = 0; this.zoneBannerTimer = 140;
    this.crashCooldown = 0; this.nearMisses = 0;
    this.shield = false; this.shieldTimer = 0;
    this.enemies = this.genEnemies(); this.powerups = this.genPowerups();
    this.particles = new VFX.particles();
    this.nitroParticles = []; this.speedLines = [];
    window.updateScore(0);
  }

  genEnemies() {
    const colors = ['#ff3366','#ffaa00','#00ffff','#ff00ff','#00ff88','#ffff00','#ff6600','#aa44ff'];
    return Array.from({ length: 14 }, (_, i) => ({
      lane: [-1, 0, 1][Math.floor(Math.random() * 3)],
      z: 320 + i * 115 + Math.random() * 100,
      speed: 2.5 + Math.random() * 3.5,
      color: colors[i % colors.length],
      w: 36,
      h: 60,
      scoredNear: false,
      type: Math.random() > 0.72 ? 'truck' : 'car'
    }));
  }

  genPowerups() {
    const types = ['nitro', 'shield', 'star'];
    return Array.from({ length: 10 }, (_, i) => ({
      lane: [-1, 0, 1][Math.floor(Math.random() * 3)],
      z: 500 + i * 210 + Math.random() * 160,
      type: types[Math.floor(Math.random() * 3)],
      active: true
    }));
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
    const nextZone = Math.floor(this.distance / this.zoneLength) % this.zones.length;
    if (nextZone !== this.zoneIndex) { this.zoneIndex = nextZone; this.zoneBannerTimer = 180; window.audioManager.playLevelUp(); }
    if (this.zoneBannerTimer > 0) this.zoneBannerTimer--;
    this.level = 1 + Math.floor(this.distance / 500);
    this.maxSpeed = Math.min(22, 14 + this.level * 0.7);
    this.curveOffset = Math.sin(this.roadOffset * 0.003) * 30;

    if (this.speed > 6 && this.frame % 2 === 0) this.speedLines.push({ x: Math.random() * this.W, y: this.H, vy: this.speed * 8, life: 1, len: 10 + this.speed * 3 });

    this.enemies.forEach(e => {
      e.z -= Math.max(1.6, this.speed * 0.42 - e.speed * 0.16);
      if (e.z < -80) this.respawnEnemy(e, this.viewDistance + 120 + Math.random() * 360);
      const pos = this.projectRoad(e.lane, e.z);
      e.screenX = pos.x; e.screenY = pos.y; e.screenScale = pos.scale;
      if (Math.abs(this.x - pos.x) < 32 + pos.scale * 18 && Math.abs((this.H - 130) - pos.y) < 38 + pos.scale * 30) {
        if (this.crashCooldown <= 0) {
          this.crashCooldown = 1.2;
          if (this.shield) { this.shield = false; window.audioManager.playHit(); this.particles.emit(this.x, this.H - 130, 20, ['#00ffff','#fff']); this.shake.trigger(6, 200); }
          else {
            this.health--; this.combo = 1; this.speed = Math.max(2, this.speed * 0.25);
            window.audioManager.playCarHit(); this.particles.emit(this.x, this.H - 130, 30, ['#ff3366','#ff00ff','#fff'], [100, 300], [0.4, 1.0]); this.shake.trigger(10, 300);
            if (this.health <= 0) { this.state = 'gameover'; window.gameStorage.setHighScore('carreras', this.score); }
          }
        }
      } else if (!e.scoredNear && e.z < 120 && e.z > -30 && Math.abs(this.x - pos.x) < 82) {
        e.scoredNear = true; this.nearMisses++; this.combo = Math.min(5, this.combo + 0.5);
        this.score += Math.floor(20 * this.combo); window.audioManager.playBonus();
        this.particles.emit(this.x, this.H - 130, 8, ['#ffff00','#00ffff','#fff'], [60, 130], [0.2, 0.5]);
      }
    });

    this.powerups.forEach(p => {
      if (!p.active) return;
      p.z -= Math.max(1.4, this.speed * 0.42);
      if (p.z < -60) this.respawnPowerup(p, this.viewDistance + 220 + Math.random() * 460);
      const pos = this.projectRoad(p.lane, p.z);
      p.screenX = pos.x; p.screenY = pos.y; p.screenScale = pos.scale;
      if (Math.abs(this.x - pos.x) < 34 + pos.scale * 10 && Math.abs((this.H - 130) - pos.y) < 34 + pos.scale * 12) {
        p.active = false;
        if (p.type === 'nitro') { this.nitro = 100; window.audioManager.playNitro(); }
        else if (p.type === 'shield') { this.shield = true; this.shieldTimer = performance.now(); window.audioManager.playPowerup(); }
        else if (p.type === 'star') { this.score += Math.floor(50 * this.combo); this.combo = Math.min(5, this.combo + 0.25); window.audioManager.playBonus(); }
        this.particles.emit(pos.x, pos.y, 15, ['#ffff00','#fff','#ff00ff'], [60, 150], [0.3, 0.6]);
      }
    });

    if (this.speed > 1) { this.score += Math.floor((this.speed / 3) * this.combo); window.updateScore(this.score); }

    this.particles.update(dt);
    this.nitroParticles = this.nitroParticles.filter(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.025; return p.life > 0; });
    this.speedLines = this.speedLines.filter(l => { l.y -= l.vy * dt * 60; l.life -= 0.03; return l.life > 0; });
    if (this.shield && performance.now() - this.shieldTimer > 5000) this.shield = false;
  }

  respawnEnemy(e, z) {
    e.lane = [-1, 0, 1][Math.floor(Math.random() * 3)];
    e.z = z;
    e.speed = 2.5 + Math.random() * 3.8 + Math.min(2.2, this.level * 0.15);
    e.scoredNear = false;
    e.type = Math.random() > 0.72 ? 'truck' : 'car';
  }

  respawnPowerup(p, z) {
    p.lane = [-1, 0, 1][Math.floor(Math.random() * 3)];
    p.z = z;
    p.active = true;
  }

  projectRoad(lane, z) {
    const horizon = this.H * 0.33;
    const depth = Math.max(0, Math.min(1, 1 - z / this.viewDistance));
    const t = Math.pow(depth, 1.58);
    const y = horizon + t * (this.H - horizon - 24);
    const roadW = this.W * 0.55 * (0.28 + t * 0.78);
    const curve = Math.sin(this.roadOffset * 0.003 + z * 0.006) * 42 * t + this.curveOffset * t;
    const cx = this.W / 2 + curve;
    return {
      x: cx + lane * roadW * 0.27,
      y,
      t,
      roadW,
      centerX: cx,
      scale: 0.28 + t * 1.0
    };
  }

  drawHazardHints(c, W, H) {
    const playerLane = this.getPlayerLane();
    this.enemies.forEach(e => {
      if (e.z < 180 || e.z > 760) return;
      const pos = this.projectRoad(e.lane, e.z);
      const danger = e.lane === playerLane || Math.abs(pos.x - this.x) < 80;
      c.save();
      c.globalAlpha = danger ? 0.65 : 0.25;
      c.shadowColor = danger ? '#ff3366' : '#ffff00';
      c.shadowBlur = danger ? 18 : 10;
      c.strokeStyle = danger ? '#ff3366' : '#ffff00';
      c.fillStyle = danger ? 'rgba(255,51,102,0.14)' : 'rgba(255,255,0,0.08)';
      c.lineWidth = danger ? 3 : 2;
      c.beginPath();
      c.moveTo(pos.x, pos.y + 24 * pos.scale);
      c.lineTo(pos.x - 22 * pos.scale, pos.y + 62 * pos.scale);
      c.lineTo(pos.x + 22 * pos.scale, pos.y + 62 * pos.scale);
      c.closePath();
      c.fill();
      c.stroke();
      if (danger) VFX.glowText(c, 'ALERTA', pos.x, pos.y + 80 * pos.scale, { font: `${Math.max(9, 12 * pos.scale)}px monospace`, color: '#ff3366' });
      c.restore();
    });
  }

  drawRadar(c, W, H) {
    const compact = W < 520;
    const w = compact ? 62 : 84, h = compact ? 96 : 120;
    const x = W - w - 10, y = compact ? 10 : 18;
    const laneGap = compact ? 17 : 24;
    VFX.panel(c, x, y, w, h, { bg: 'rgba(0,0,20,0.62)', border: 'rgba(255,255,0,0.18)', radius: 8 });
    VFX.glowText(c, 'RADAR', x + w / 2, y + 12, { font: '10px monospace', color: '#ffff00' });
    c.save();
    c.strokeStyle = 'rgba(0,255,255,0.18)';
    c.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const lx = x + w / 2 - laneGap + i * laneGap;
      c.beginPath(); c.moveTo(lx, y + 25); c.lineTo(lx, y + h - 12); c.stroke();
    }
    this.enemies.forEach(e => {
      if (e.z < 0 || e.z > this.viewDistance) return;
      const rx = x + w / 2 + e.lane * laneGap;
      const ry = y + h - 16 - (1 - e.z / this.viewDistance) * (h - 34);
      const close = e.z < 360;
      c.fillStyle = close ? '#ff3366' : '#ffff00';
      c.shadowColor = c.fillStyle;
      c.shadowBlur = close ? 12 : 6;
      c.beginPath(); c.roundRect(rx - 5, ry - 4, 10, 8, 3); c.fill();
    });
    c.fillStyle = '#00ffff';
    c.shadowColor = '#00ffff'; c.shadowBlur = 10;
    c.beginPath(); c.moveTo(x + w / 2, y + h - 8); c.lineTo(x + w / 2 - 8, y + h - 20); c.lineTo(x + w / 2 + 8, y + h - 20); c.closePath(); c.fill();
    c.restore();
  }

  getPlayerLane() {
    const left = this.W / 2 - this.W * 0.16;
    const right = this.W / 2 + this.W * 0.16;
    if (this.x < left) return -1;
    if (this.x > right) return 1;
    return 0;
  }

  zone() { return this.zones[this.zoneIndex % this.zones.length]; }

  sceneryType(s) {
    const options = this.zone().scenery;
    const seed = Math.abs(Math.floor((s.y + s.xOff * 13 + s.size * 97) % 997));
    return options[seed % options.length];
  }

  darken(hex, factor) {
    const [r, g, b] = VFX.hexToRgb(hex);
    return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
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
    const zone = this.zone();

    // Road segments
    for (let i = 55; i >= 0; i--) {
      const t = i / 55, y = horizon + t * (H - horizon), segH = (H - horizon) / 55 + 2;
      const w = roadBaseW * (0.3 + t * 0.7);
      const curve = Math.sin((this.roadOffset * 0.003) + i * 0.08) * 40 * t + this.curveOffset * t;
      const cx = W / 2 + curve;

      const grassG = c.createLinearGradient(0, y, 0, y + segH + 1);
      grassG.addColorStop(0, i % 2 === 0 ? zone.ground[0] : this.darken(zone.ground[0], 0.7));
      grassG.addColorStop(1, i % 2 === 0 ? zone.ground[1] : this.darken(zone.ground[1], 0.78));
      c.fillStyle = grassG; c.fillRect(0, y, W, segH + 1);

      // Rumble strips
      const stripW = w + 16;
      c.fillStyle = i % 3 === 0 ? zone.edge : '#ffffff';
      c.fillRect(cx - stripW / 2, y, stripW, segH + 1);

      const roadG = c.createLinearGradient(cx - w / 2, y, cx + w / 2, y);
      roadG.addColorStop(0, zone.road[0]);
      roadG.addColorStop(0.5, i % 2 === 0 ? zone.road[1] : this.darken(zone.road[1], 0.78));
      roadG.addColorStop(1, zone.road[0]);
      c.fillStyle = roadG;
      c.fillRect(cx - w / 2, y, w, segH + 1);

      if (i % 4 < 2) {
        c.save(); c.shadowColor = zone.lane; c.shadowBlur = 6;
        c.fillStyle = zone.lane; c.fillRect(cx - 2, y, 4, segH + 1);
        c.restore();
      }

      // Neon edge lines
      c.save(); c.shadowColor = zone.edge; c.shadowBlur = 6;
      c.fillStyle = zone.edge;
      c.fillRect(cx - w / 2, y, 2, segH + 1);
      c.fillRect(cx + w / 2 - 2, y, 2, segH + 1);
      c.globalAlpha = 0.5;
      c.fillStyle = zone.atmosphere === 'tunnel' ? '#00ffff' : '#ff00ff';
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
      const type = this.sceneryType(s);
      if (type === 'palm') {
        c.save(); c.shadowColor = '#00ff88'; c.shadowBlur = 8;
        c.fillStyle = '#1d5b44'; c.fillRect(-3, -s.size * 38, 6, s.size * 38);
        for (let a = -2; a <= 2; a++) {
          c.save(); c.rotate(a * 0.42); c.fillStyle = '#00b878'; c.beginPath(); c.ellipse(0, -s.size * 40, s.size * 6, s.size * 22, 0, 0, Math.PI * 2); c.fill(); c.restore();
        }
        c.restore();
      } else if (type === 'tower') {
        c.save(); c.shadowColor = '#00ff88'; c.shadowBlur = 8;
        c.fillStyle = 'rgba(0,255,255,0.12)'; c.fillRect(-s.size * 10, -s.size * 70, s.size * 20, s.size * 70);
        VFX.drawNeonRect(c, -s.size * 10, -s.size * 70, s.size * 20, s.size * 70, '#00ffff', 2, 1);
        for (let wy = -62; wy < -12; wy += 12) { c.fillStyle = '#ffff00'; c.fillRect(-s.size * 5, s.size * wy, s.size * 3, s.size * 4); c.fillRect(s.size * 2, s.size * wy, s.size * 3, s.size * 4); }
        c.restore();
      } else if (type === 'gate') {
        c.save(); c.shadowColor = '#ff00ff'; c.shadowBlur = 10;
        c.strokeStyle = '#ff00ff'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(-s.size * 18, 0); c.lineTo(-s.size * 18, -s.size * 46); c.lineTo(s.size * 18, -s.size * 46); c.lineTo(s.size * 18, 0); c.stroke();
        c.fillStyle = '#ffff00'; c.fillRect(-s.size * 10, -s.size * 38, s.size * 20, s.size * 8);
        c.restore();
      } else if (type === 'sign') {
        c.fillStyle = '#666'; c.fillRect(-2, -s.size * 25, 4, s.size * 25);
        c.save(); c.shadowColor = '#ffff00'; c.shadowBlur = 8;
        c.fillStyle = '#1b1038'; c.fillRect(-s.size * 22, -s.size * 34, s.size * 44, s.size * 16);
        c.strokeStyle = '#ffff00'; c.strokeRect(-s.size * 22, -s.size * 34, s.size * 44, s.size * 16);
        c.fillStyle = '#ffff00'; c.font = `${Math.max(8, s.size * 10)}px monospace`; c.textAlign = 'center'; c.fillText(zone.name.split(' ')[0], 0, -s.size * 22);
        c.restore();
      } else if (type === 'drone') {
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
    this.powerups.slice().sort((a, b) => b.z - a.z).forEach(p => {
      if (!p.active) return;
      const pos = this.projectRoad(p.lane, p.z);
      if (pos.y < horizon || pos.y > H + 30) return;
      const colors = { nitro: '#ff8800', shield: '#00ffff', star: '#ffff00' };
      const pulse = 1 + 0.15 * Math.sin(this.frame * 0.1);
      VFX.radialGlow(c, pos.x, pos.y, 28 * pos.scale, colors[p.type], 0.22);
      VFX.drawNeonCircle(c, pos.x, pos.y, Math.max(8, 12 * pulse * pos.scale), colors[p.type], 2);
      c.fillStyle = '#fff'; c.font = 'bold 11px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const icons = { nitro: '⚡', shield: '🛡', star: '★' };
      c.fillText(icons[p.type], pos.x, pos.y);
    });

    this.drawHazardHints(c, W, H);

    // Enemy cars
    this.enemies.slice().sort((a, b) => b.z - a.z).forEach(e => {
      const pos = this.projectRoad(e.lane, e.z);
      if (pos.y < horizon || pos.y > H + 60) return;
      const w = e.type === 'truck' ? e.w * 1.25 : e.w;
      const h = e.type === 'truck' ? e.h * 1.22 : e.h;
      c.save();
      c.globalAlpha = Math.min(1, 0.35 + pos.t * 1.2);
      c.translate(pos.x, pos.y);
      c.scale(pos.scale, pos.scale);
      if (e.z > 500) {
        c.shadowColor = e.color; c.shadowBlur = 18;
        c.fillStyle = e.color;
        c.beginPath(); c.arc(-10, -14, 4, 0, Math.PI * 2); c.arc(10, -14, 4, 0, Math.PI * 2); c.fill();
      }
      VFX.drawCar(c, 0, 0, w, h, e.color);
      c.globalAlpha = 0.72;
      VFX.drawNeonRect(c, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, e.z < 360 ? '#ffff00' : e.color, 8, 1);
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
    this.drawRadar(c, W, H);
    VFX.glowText(c, this.zone().name, W - 10, 154, { font: '12px monospace', color: this.zone().edge, align: 'right' });
    if (this.combo >= 2) {
      VFX.glowText(c, `NEAR MISS CHAIN x${this.combo.toFixed(1)}`, W / 2, 34, { font: '15px monospace', color: '#ffff00', glow: '#ffff00' });
    }
    if (this.zoneBannerTimer > 0) {
      const a = Math.min(1, this.zoneBannerTimer / 45);
      c.save(); c.globalAlpha = a;
      VFX.panel(c, W / 2 - 170, H * 0.36 - 34, 340, 68, { bg: 'rgba(0,0,20,0.62)', border: this.zone().edge, radius: 10 });
      VFX.drawLEDText(c, this.zone().name, W / 2, H * 0.36 - 5, this.zone().edge, 28);
      VFX.glowText(c, 'NUEVO SECTOR', W / 2, H * 0.36 + 24, { font: '11px monospace', color: '#ffff00' });
      c.restore();
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
    const zone = this.zone();
    const skyG = c.createLinearGradient(0, 0, 0, horizon);
    skyG.addColorStop(0, zone.sky[0]);
    skyG.addColorStop(0.45, zone.sky[1]);
    skyG.addColorStop(1, zone.sky[2]);
    c.fillStyle = skyG; c.fillRect(0, 0, W, horizon);
    VFX.starfield(c, W, horizon, this.stars, this.frame * 0.02);

    const sunY = horizon - 18;
    if (zone.atmosphere !== 'tunnel') {
      VFX.radialGlow(c, W / 2, sunY, Math.min(220, W * 0.36), zone.edge, 0.26);
      c.save();
      c.shadowColor = zone.lane; c.shadowBlur = 24;
      c.fillStyle = zone.atmosphere === 'snow' ? '#dff9ff' : '#ffb000';
      c.beginPath(); c.arc(W / 2, sunY, Math.min(72, W * 0.13), 0, Math.PI * 2); c.fill();
      c.globalCompositeOperation = 'destination-out';
      for (let y = sunY - 48; y < sunY + 70; y += 12) c.fillRect(W / 2 - 90, y, 180, 5);
      c.restore();
    } else {
      for (let i = 0; i < 8; i++) {
        const x = (i / 7) * W;
        VFX.drawNeonLine(c, x, horizon, W / 2, horizon - 70, zone.edge, 1);
      }
    }

    c.save();
    c.fillStyle = zone.atmosphere === 'snow' ? '#123748' : '#09071f';
    c.beginPath(); c.moveTo(0, horizon);
    for (let x = 0; x <= W; x += W / 8) c.lineTo(x + W / 16, horizon - 30 - Math.sin(x * 0.02) * 20);
    c.lineTo(W, horizon); c.closePath(); c.fill();
    c.restore();

    c.save();
    c.fillStyle = zone.atmosphere === 'dust' ? 'rgba(255,136,0,0.12)' : 'rgba(0,255,255,0.08)';
    c.strokeStyle = zone.atmosphere === 'dust' ? 'rgba(255,136,0,0.24)' : 'rgba(0,255,255,0.18)';
    for (let x = -20; x < W + 40; x += zone.atmosphere === 'tunnel' ? 58 : 38) {
      const h = 24 + ((x * 13) % 55 + 55) % 55;
      if (zone.atmosphere === 'spores') {
        c.beginPath(); c.arc(x, horizon - h * 0.55, 12 + (h % 18), 0, Math.PI * 2); c.fill(); c.stroke();
      } else {
        c.fillRect(x, horizon - h, 24, h);
        c.strokeRect(x, horizon - h, 24, h);
        c.fillStyle = zone.lane === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,0,0.35)';
        for (let wy = horizon - h + 8; wy < horizon - 8; wy += 12) c.fillRect(x + 7, wy, 3, 4);
        c.fillStyle = zone.atmosphere === 'dust' ? 'rgba(255,136,0,0.12)' : 'rgba(0,255,255,0.08)';
      }
    }
    c.restore();
    this.drawAtmosphere(c, W, H, horizon, zone);
  }

  drawAtmosphere(c, W, H, horizon, zone) {
    c.save();
    if (zone.atmosphere === 'dust') {
      c.fillStyle = 'rgba(255,136,0,0.07)';
      for (let i = 0; i < 24; i++) {
        const x = (i * 97 + this.frame * 2.4) % (W + 80) - 40;
        const y = horizon + ((i * 53 + this.frame * 1.1) % (H - horizon));
        c.beginPath(); c.ellipse(x, y, 34, 5, -0.2, 0, Math.PI * 2); c.fill();
      }
    } else if (zone.atmosphere === 'snow') {
      c.fillStyle = 'rgba(220,250,255,0.7)';
      for (let i = 0; i < 55; i++) {
        const x = (i * 41 + this.frame * 0.7) % W;
        const y = (i * 73 + this.frame * 2.2) % H;
        c.fillRect(x, y, 2, 2);
      }
    } else if (zone.atmosphere === 'spores') {
      c.fillStyle = 'rgba(0,255,136,0.35)';
      for (let i = 0; i < 28; i++) {
        const x = (i * 83 + Math.sin(this.frame * 0.02 + i) * 50) % W;
        const y = horizon + ((i * 37 + this.frame * 0.5) % (H - horizon));
        c.beginPath(); c.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); c.fill();
      }
    } else if (zone.atmosphere === 'tunnel') {
      c.strokeStyle = 'rgba(255,0,255,0.18)';
      for (let i = 0; i < 9; i++) {
        const y = horizon + ((i * 70 + this.roadOffset * 0.8) % (H - horizon));
        VFX.drawNeonRect(c, W * 0.12, y, W * 0.76, 18, zone.edge, 4, 1);
      }
    }
    c.restore();
  }

  loop() {
    if (!this.running) return;
    this.frame++; this.update(1 / 60); this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
