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

    // Config
    this.FOCAL = 180;
    this.VISIBLE_SEGS = 100;
    this.ROAD_WIDTH = 0.7;
    this.LANE_COUNT = 5;
    this.CURVE_SCALE = 1.6;
    this.TOTAL_SEGMENTS = 5000;

    // Road data
    this.roadCurves = [];
    this.roadX = [];
    this.roadSegLength = 8;
    this.roadIndex = 0;

    // Zones
    this.zoneLength = 500;
    this.zoneIndex = 0;
    this.zoneBannerTimer = 0;
    this.zones = [
      { name: 'NEON CITY', sky: ['#050018','#191055','#55123f'], ground: ['#07170f','#0c2515'], road: ['#101018','#30303b'], edge: '#00ffff', lane: '#ffff00', curb: '#00ffff', guardrail: '#ff00ff', atmosphere: 'glow' },
      { name: 'DUST VALLEY', sky: ['#180712','#502313','#b24a1f'], ground: ['#2a1608','#4a260d'], road: ['#1b1512','#3b2c22'], edge: '#ff8800', lane: '#ffe66d', curb: '#ff8800', guardrail: '#ff6600', atmosphere: 'dust' },
      { name: 'CYBER TUNNEL', sky: ['#02030f','#07113a','#091020'], ground: ['#02040a','#050b16'], road: ['#05070d','#161b2b'], edge: '#ff00ff', lane: '#00ffff', curb: '#ff00ff', guardrail: '#00ffff', atmosphere: 'tunnel' },
      { name: 'FROST RUN', sky: ['#061827','#123d5a','#7cc7ff'], ground: ['#163343','#d7f8ff'], road: ['#17242c','#314652'], edge: '#9ffcff', lane: '#ffffff', curb: '#9ffcff', guardrail: '#00aaff', atmosphere: 'snow' },
      { name: 'ALIEN WOODS', sky: ['#06110b','#12351e','#346a2c'], ground: ['#061b0d','#124d24'], road: ['#111812','#263426'], edge: '#00ff88', lane: '#ff00ff', curb: '#00ff88', guardrail: '#ff00ff', atmosphere: 'spores' }
    ];

    this.reset();
  }

  generateRoad() {
    this.roadCurves = [];
    this.roadX = [];
    let x = 0;
    let curve = 0;
    let targetCurve = 0;
    let sectionLen = 0;
    let sectionMax = 40 + Math.floor(Math.random() * 50);
    for (let i = 0; i < this.TOTAL_SEGMENTS; i++) {
      sectionLen++;
      if (sectionLen >= sectionMax) {
        const opts = [-5, -4, -3, -2, -1, 0, 0, 0, 1, 2, 3, 4, 5];
        targetCurve = opts[Math.floor(Math.random() * opts.length)];
        sectionMax = 35 + Math.floor(Math.random() * 55);
        sectionLen = 0;
      }
      curve += (targetCurve - curve) * 0.1;
      this.roadCurves.push(curve);
      x += curve;
      this.roadX.push(x);
    }
  }

  reset() {
    this.generateRoad();
    this.roadIndex = 0;
    this.speed = 0;
    this.maxSpeed = 14;
    this.accel = 0.12;
    this.brakeForce = 0.2;
    this.friction = 0.015;
    this.lane = 0;
    this.targetLane = 0;
    this.steerSpeed = 0.08;
    this.health = 5;
    this.maxHealth = 5;
    this.score = 0;
    this.distance = 0;
    this.level = 1;
    this.combo = 1;
    this.nitro = 100;
    this.nitroActive = false;
    this.shield = false;
    this.shieldTimer = 0;
    this.crashCooldown = 0;
    this.nearMisses = 0;
    this.zoneIndex = 0;
    this.zoneBannerTimer = 140;
    this.rumbleIntensity = 0;
    this.offRoad = false;
    this.enemies = [];
    this.powerups = [];
    this.particles = new VFX.particles();
    this.nitroParticles = [];
    this.speedLines = [];
    this.wheelAngle = 0;
    this.spawnEnemies();
    this.spawnPowerups();
    window.updateScore(0);
  }

  spawnEnemies() {
    this.enemies = [];
    const count = Math.min(10, 4 + Math.floor(this.level / 2));
    const span = Math.max(180, 350 - this.level * 12);
    for (let i = 0; i < count; i++) {
      this.enemies.push(this.createEnemy(120 + (span / count) * i + Math.random() * (span / count) * 0.3));
    }
  }

  createEnemy(depth) {
    const colors = ['#ff3366','#ffaa00','#00ffff','#ff00ff','#00ff88','#ffff00','#ff6600','#aa44ff','#ff4488','#44ff88'];
    return {
      lane: Math.floor(Math.random() * 5) - 2,
      depth: depth,
      speed: 0.8 + Math.random() * 1.5 + this.level * 0.05,
      color: colors[Math.floor(Math.random() * colors.length)],
      w: 32,
      h: 52,
      scoredNear: false,
      type: Math.random() > 0.8 ? 'truck' : 'car',
      passed: false,
      active: true
    };
  }

  spawnPowerups() {
    this.powerups = [];
    for (let i = 0; i < 6; i++) {
      this.powerups.push({
        lane: Math.floor(Math.random() * 5) - 2,
        depth: 140 + i * 130 + Math.random() * 60,
        type: ['nitro','shield','star'][Math.floor(Math.random() * 3)],
        active: true
      });
    }
  }

  start() {
    this.running = true;
    this.state = 'menu';
    document.addEventListener('keydown', this.boundKeyDown);
    document.addEventListener('keyup', this.boundKeyUp);
    if (window.audioManager) window.audioManager.init();
    this.loop();
  }

  destroy() {
    this.running = false;
    document.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('keyup', this.boundKeyUp);
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (window.audioManager && window.audioManager.music) window.audioManager.music.stop();
    if (window.audioManager && window.audioManager.engine) window.audioManager.stopEngine();
  }

  onKeyDown(e) {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    this.keys[e.key] = true;
    if (this.state === 'menu' && (e.key === 'Enter' || e.key === ' ')) {
      this.reset();
      this.state = 'playing';
      if (window.audioManager) {
        if (window.audioManager.music) window.audioManager.music.start();
        window.audioManager.startEngine();
      }
    }
    if (e.key === 'Escape') exitGame();
    if (e.key === 'r' && this.state === 'gameover') {
      this.reset();
      this.state = 'playing';
      if (window.audioManager) {
        if (window.audioManager.music) window.audioManager.music.start();
        window.audioManager.startEngine();
      }
    }
    if (e.key === 'n' || e.key === 'N') this.nitroActive = true;
  }

  onKeyUp(e) {
    this.keys[e.key] = false;
    if (e.key === 'n' || e.key === 'N') this.nitroActive = false;
  }

  zone() { return this.zones[this.zoneIndex % this.zones.length]; }

  update(dt) {
    if (this.state !== 'playing') return;
    this.shake.update(dt * 1000);
    if (this.crashCooldown > 0) this.crashCooldown -= dt;

    // Acceleration
    if (this.keys['ArrowUp'] || this.keys['w']) {
      this.speed = Math.min(this.maxSpeed, this.speed + this.accel);
    } else if (this.keys['ArrowDown'] || this.keys['s']) {
      this.speed = Math.max(0, this.speed - this.brakeForce);
    } else {
      this.speed = Math.max(0, this.speed - this.friction);
    }

    // Nitro
    if (this.nitroActive && this.nitro > 0 && this.speed > 2) {
      this.speed = Math.min(this.maxSpeed + 7, this.speed + 0.4);
      this.nitro = Math.max(0, this.nitro - 0.7);
      if (this.frame % 2 === 0) {
        this.nitroParticles.push({
          x: this.W / 2 + this.lane * 20 + (Math.random() - 0.5) * 16,
          y: this.H - 120,
          vx: (Math.random() - 0.5) * 2,
          vy: 3 + Math.random() * 4,
          life: 1,
          size: 2 + Math.random() * 3,
          color: Math.random() > 0.5 ? '#ff8800' : '#ffcc00'
        });
      }
    } else {
      this.nitro = Math.min(100, this.nitro + 0.12);
    }

    // Steering
    const steerFactor = 0.06 + (this.speed / this.maxSpeed) * 0.06;
    if (this.keys['ArrowLeft'] || this.keys['a']) {
      this.lane = Math.max(-2.6, this.lane - steerFactor);
      this.wheelAngle = Math.max(-0.6, this.wheelAngle - 0.04);
    } else if (this.keys['ArrowRight'] || this.keys['d']) {
      this.lane = Math.min(2.6, this.lane + steerFactor);
      this.wheelAngle = Math.min(0.6, this.wheelAngle + 0.04);
    } else {
      this.wheelAngle *= 0.92;
    }

    // Road edge rumble
    this.rumbleIntensity = 0;
    this.offRoad = false;
    if (this.lane < -2.3) {
      this.rumbleIntensity = Math.min(1, (-2.3 - this.lane) / 0.5);
      this.speed = Math.max(1, this.speed - this.rumbleIntensity * 0.08);
      if (this.lane < -2.8) {
        this.offRoad = true;
        this.speed = Math.max(0.5, this.speed - 0.15);
        this.shake.trigger(4, 100);
      }
    } else if (this.lane > 2.3) {
      this.rumbleIntensity = Math.min(1, (this.lane - 2.3) / 0.5);
      this.speed = Math.max(1, this.speed - this.rumbleIntensity * 0.08);
      if (this.lane > 2.8) {
        this.offRoad = true;
        this.speed = Math.max(0.5, this.speed - 0.15);
        this.shake.trigger(4, 100);
      }
    }

    // Update road position
    const speedScale = this.speed > 0.1 ? this.speed * 0.08 : 0;
    this.roadIndex = (this.roadIndex + Math.max(0, Math.round(speedScale))) % this.TOTAL_SEGMENTS;
    this.distance += this.speed * 0.015;

    // Zone changes
    const nextZone = Math.floor(this.distance / this.zoneLength) % this.zones.length;
    if (nextZone !== this.zoneIndex) {
      this.zoneIndex = nextZone;
      this.zoneBannerTimer = 180;
      if (window.audioManager) window.audioManager.playLevelUp();
    }
    if (this.zoneBannerTimer > 0) this.zoneBannerTimer--;

    // Level progression
    this.level = 1 + Math.floor(this.distance / 600);
    this.maxSpeed = Math.min(22, 14 + this.level * 0.6);

    // Speed lines
    if (this.speed > 5 && this.frame % 2 === 0) {
      this.speedLines.push({
        x: Math.random() * this.W,
        y: this.H,
        vy: this.speed * 6,
        life: 1,
        len: 8 + this.speed * 2
      });
    }

    // Update enemies
    this.updateEnemies(dt);

    // Update powerups
    this.updatePowerups(dt);

    // Score
    if (this.speed > 1) {
      this.score += Math.floor((this.speed / 4) * this.combo);
      window.updateScore(this.score);
    }

    // Shield timer
    if (this.shield && performance.now() - this.shieldTimer > 5000) {
      this.shield = false;
    }

    // Particles
    this.particles.update(dt);
    this.nitroParticles = this.nitroParticles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.025;
      return p.life > 0;
    });
    this.speedLines = this.speedLines.filter(l => {
      l.y -= l.vy * dt * 60; l.life -= 0.03;
      return l.life > 0;
    });

    // Engine sound
    if (window.audioManager && window.audioManager.engine) {
      window.audioManager.updateEngine(this.speed / this.maxSpeed, this.rumbleIntensity);
    }
  }

  updateEnemies(dt) {
    this.enemies.forEach(e => {
      if (!e.active) return;
      e.depth -= Math.max(0.6, this.speed * 0.18 + 0.4 - e.speed * 0.08);

      if (e.depth < -60) {
        this.respawnEnemy(e);
        return;
      }

      const pos = this.projectPoint(e.lane, e.depth);
      e.screenX = pos.x;
      e.screenY = pos.y;
      e.screenScale = pos.scale;

      const pp = this.projectPoint(this.lane, 0);
      const px = pp.x;
      const py = this.H - 130;

      const hitW = 28 + pos.scale * 16;
      const hitH = 34 + pos.scale * 28;

      if (Math.abs(px - pos.x) < hitW && Math.abs(py - pos.y) < hitH) {
        if (this.crashCooldown <= 0) {
          this.crashCooldown = 1.0;
          if (this.shield) {
            this.shield = false;
            if (window.audioManager) window.audioManager.playHit();
            this.particles.emit(px, py, 20, ['#00ffff','#fff']);
            this.shake.trigger(5, 200);
          } else {
            this.health--;
            this.combo = 1;
            this.speed = Math.max(2, this.speed * 0.35);
            if (window.audioManager) window.audioManager.playCarHit();
            this.particles.emit(px, py, 30, ['#ff3366','#ff00ff','#fff'], [80, 250], [0.4, 0.9]);
            this.shake.trigger(10, 300);
            if (this.health <= 0) {
              this.state = 'gameover';
              window.gameStorage.setHighScore('carreras', this.score);
              if (window.audioManager) {
                window.audioManager.playGameOver();
                if (window.audioManager.music) window.audioManager.music.stop();
                if (window.audioManager.engine) window.audioManager.stopEngine();
              }
            }
          }
        }
      } else if (!e.scoredNear && e.depth < 80 && e.depth > -20 && Math.abs(px - pos.x) < hitW * 2.5) {
        e.scoredNear = true;
        this.nearMisses++;
        this.combo = Math.min(5, this.combo + 0.5);
        this.score += Math.floor(15 * this.combo);
        if (window.audioManager) window.audioManager.playBonus();
        this.particles.emit(px, py - 40, 6, ['#ffff00','#00ffff','#fff'], [50, 100], [0.2, 0.4]);
      }
    });
  }

  respawnEnemy(e) {
    e.lane = Math.floor(Math.random() * 5) - 2;
    e.depth = 80 + Math.random() * 50;
    e.speed = 0.8 + Math.random() * 1.5 + this.level * 0.05;
    e.scoredNear = false;
    e.passed = false;
    e.type = Math.random() > 0.85 ? 'truck' : 'car';
    const colors = ['#ff3366','#ffaa00','#00ffff','#ff00ff','#00ff88','#ffff00','#ff6600','#aa44ff'];
    e.color = colors[Math.floor(Math.random() * colors.length)];
  }

  updatePowerups(dt) {
    this.powerups.forEach(p => {
      if (!p.active) return;
      p.depth -= Math.max(0.4, this.speed * 0.15 + 0.25);

      if (p.depth < -60) {
        this.respawnPowerup(p);
        return;
      }

      const pos = this.projectPoint(p.lane, p.depth);
      p.screenX = pos.x;
      p.screenY = pos.y;
      p.screenScale = pos.scale;

      const pp2 = this.projectPoint(this.lane, 0);
      const px = pp2.x;

      if (Math.abs(px - pos.x) < 30 + pos.scale * 8 && Math.abs((this.H - 130) - pos.y) < 30 + pos.scale * 10) {
        p.active = false;
        if (p.type === 'nitro') { this.nitro = 100; if (window.audioManager) window.audioManager.playNitro(); }
        else if (p.type === 'shield') { this.shield = true; this.shieldTimer = performance.now(); if (window.audioManager) window.audioManager.playPowerup(); }
        else if (p.type === 'star') { this.score += Math.floor(40 * this.combo); this.combo = Math.min(5, this.combo + 0.25); if (window.audioManager) window.audioManager.playBonus(); }
        this.particles.emit(pos.x, pos.y, 15, ['#ffff00','#fff','#ff00ff'], [60, 150], [0.3, 0.6]);
      }
    });
  }

  respawnPowerup(p) {
    p.lane = Math.floor(Math.random() * 5) - 2;
    p.depth = 70 + Math.random() * 60;
    p.active = true;
  }

  projectPoint(lane, depth) {
    const playerX = this.roadX[this.roadIndex];
    const idx = (this.roadIndex + Math.max(0, Math.round(depth))) % this.TOTAL_SEGMENTS;
    const segX = this.roadX[idx];
    const relX = (segX - playerX) * this.CURVE_SCALE;
    const relZ = depth * this.roadSegLength;

    const persp = this.FOCAL / (relZ + this.FOCAL);
    const horizon = this.H * 0.36;
    const y = horizon + (this.H - horizon) * persp;
    const roadW = this.W * this.ROAD_WIDTH;
    const laneOffset = lane * (roadW / this.LANE_COUNT) * persp;

    const x = this.W / 2 + relX * persp + laneOffset;

    return { x, y, scale: persp, roadW: roadW * persp };
  }

  darken(hex, factor) {
    const [r, g, b] = VFX.hexToRgb(hex);
    return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
  }

  draw() {
    const c = this.ctx, W = this.W, H = this.H;
    c.save();
    this.shake.apply(c);

    if (this.state === 'menu') {
      this.drawBackdrop(c, W, H);
      this.drawRoad(c, W, H);
      this.drawPlayer(c, W, H);
      const panelW = Math.min(480, W - 28);
      VFX.panel(c, W / 2 - panelW / 2, H / 2 - 140, panelW, 250, { bg: 'rgba(4,0,18,0.75)', border: 'rgba(255,51,102,0.3)', radius: 14 });
      VFX.drawLEDText(c, 'RACING', W / 2, H / 2 - 85, '#ff3366', Math.min(64, W * 0.12));
      VFX.glowText(c, 'ENTER O ESPACIO PARA CORRER', W / 2, H / 2 - 15, { font: '18px monospace', color: '#00ffff' });
      VFX.glowText(c, 'ESQUIVA EL TRAFICO, CONSIGUE PUNTOS', W / 2, H / 2 + 20, { font: '12px monospace', color: '#ffff00' });
      VFX.glowText(c, '↑↓ GAS/FRENO  ←→ GIRO  N NITRO', W / 2, H / 2 + 52, { font: '13px monospace', color: '#888' });
      VFX.drawCRTEffect(c, W, H, 0.2);
      c.restore();
      return;
    }

    this.drawBackdrop(c, W, H);
    this.drawRoad(c, W, H);
    this.drawScenery(c, W, H);
    this.drawSpeedLines(c, W, H);

    // Draw enemies and powerups sorted by depth (far first)
    const items = [];
    this.enemies.forEach(e => { if (e.active) items.push({ type: 'enemy', data: e, depth: e.depth }); });
    this.powerups.forEach(p => { if (p.active) items.push({ type: 'powerup', data: p, depth: p.depth }); });
    items.sort((a, b) => b.depth - a.depth);

    items.forEach(item => {
      if (item.type === 'powerup') this.drawPowerup(c, item.data);
      else this.drawEnemy(c, item.data);
    });

    this.drawPlayer(c, W, H);
    this.drawNitroParticles(c);
    this.particles.draw(c);
    this.drawHUD(c, W, H);
    this.drawZoneBanner(c, W, H);

    if (this.state === 'gameover') {
      this.drawGameOver(c, W, H);
    }

    VFX.drawCRTEffect(c, W, H, 0.15);
    c.restore();
  }

  drawBackdrop(c, W, H) {
    const horizon = H * 0.36;
    const zone = this.zone();
    const skyG = c.createLinearGradient(0, 0, 0, horizon);
    skyG.addColorStop(0, zone.sky[0]);
    skyG.addColorStop(0.45, zone.sky[1]);
    skyG.addColorStop(1, zone.sky[2]);
    c.fillStyle = skyG;
    c.fillRect(0, 0, W, horizon);
    VFX.starfield(c, W, horizon, this.stars, this.frame * 0.02);

    if (zone.atmosphere === 'tunnel') {
      for (let i = 0; i < 10; i++) {
        const x = (i / 9) * W;
        c.save();
        c.globalAlpha = 0.3 + 0.2 * Math.sin(this.frame * 0.03 + i);
        c.shadowColor = zone.edge;
        c.shadowBlur = 12;
        c.strokeStyle = zone.edge;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x, horizon);
        c.lineTo(W / 2 + (x - W / 2) * 0.3, horizon - 60);
        c.stroke();
        c.restore();
      }
    } else {
      const sunY = horizon - 20;
      VFX.radialGlow(c, W / 2, sunY, Math.min(200, W * 0.32), zone.edge, 0.2);
      c.save();
      c.shadowColor = zone.lane;
      c.shadowBlur = 20;
      c.fillStyle = zone.atmosphere === 'snow' ? '#dff9ff' : '#ffb000';
      c.beginPath();
      c.arc(W / 2, sunY, Math.min(60, W * 0.1), 0, Math.PI * 2);
      c.fill();
      if (zone.atmosphere !== 'snow') {
        c.globalCompositeOperation = 'destination-out';
        for (let y = sunY - 40; y < sunY + 60; y += 10) {
          c.fillRect(W / 2 - 70, y, 140, 4);
        }
      }
      c.restore();
    }

    // Mountains/horizon
    c.save();
    c.fillStyle = zone.atmosphere === 'snow' ? '#0d2a3a' : '#08061a';
    c.beginPath();
    c.moveTo(0, horizon);
    for (let x = 0; x <= W; x += W / 10) {
      c.lineTo(x, horizon - 25 - Math.sin(x * 0.015 + 1) * 18 - Math.sin(x * 0.03) * 10);
    }
    c.lineTo(W, horizon);
    c.closePath();
    c.fill();

    // Horizon buildings silhouette
    c.fillStyle = 'rgba(0,0,0,0.2)';
    for (let x = 0; x < W; x += 30 + ((x * 17) % 40)) {
      const bh = 15 + ((x * 31) % 35);
      c.fillRect(x, horizon - bh, 22, bh);
    }
    c.restore();

    this.drawAtmosphere(c, W, H, horizon);
  }

  drawAtmosphere(c, W, H, horizon) {
    const zone = this.zone();
    c.save();
    if (zone.atmosphere === 'dust') {
      c.fillStyle = 'rgba(255,136,0,0.06)';
      for (let i = 0; i < 20; i++) {
        const x = (i * 97 + this.frame * 2) % (W + 80) - 40;
        const y = horizon + ((i * 53 + this.frame * 0.8) % (H - horizon));
        c.beginPath();
        c.ellipse(x, y, 30, 4, -0.2, 0, Math.PI * 2);
        c.fill();
      }
    } else if (zone.atmosphere === 'snow') {
      c.fillStyle = 'rgba(220,250,255,0.6)';
      for (let i = 0; i < 50; i++) {
        const x = (i * 41 + this.frame * 0.5) % W;
        const y = (i * 73 + this.frame * 1.8) % H;
        c.fillRect(x, y, 2, 2);
      }
    } else if (zone.atmosphere === 'spores') {
      c.fillStyle = 'rgba(0,255,136,0.3)';
      for (let i = 0; i < 25; i++) {
        const x = (i * 83 + Math.sin(this.frame * 0.02 + i) * 40) % W;
        const y = horizon + ((i * 37 + this.frame * 0.4) % (H - horizon));
        c.beginPath();
        c.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
        c.fill();
      }
    } else if (zone.atmosphere === 'tunnel') {
      c.strokeStyle = 'rgba(255,0,255,0.15)';
      for (let i = 0; i < 8; i++) {
        const y = horizon + ((i * 70 + this.roadIndex * 0.6) % (H - horizon));
        VFX.drawNeonRect(c, W * 0.1, y, W * 0.8, 16, zone.edge, 4, 1);
      }
    }
    c.restore();
  }

  drawRoad(c, W, H) {
    const horizon = H * 0.36;
    const segCount = this.VISIBLE_SEGS;
    const roadTotalW = W * this.ROAD_WIDTH;
    const zone = this.zone();
    const playerX = this.roadX[this.roadIndex];

    // Pre-compute cumulative curve offsets for each depth
    const cumOffsets = [0];
    for (let i = 1; i <= segCount; i++) {
      const idx = (this.roadIndex + i) % this.TOTAL_SEGMENTS;
      cumOffsets[i] = cumOffsets[i - 1] + (this.roadX[idx] - this.roadX[(this.roadIndex + i - 1) % this.TOTAL_SEGMENTS]) * this.CURVE_SCALE;
    }

    // Draw from far to near
    for (let i = segCount; i >= 0; i--) {
      const t = i / segCount;
      const persp = this.FOCAL / ((i * this.roadSegLength) + this.FOCAL);
      const y = horizon + (H - horizon) * persp;
      const segH = Math.max(2, (H - horizon) / segCount * (persp * 2 + 0.5));

      const curveOffset = cumOffsets[i] * persp;
      const roadW = roadTotalW * persp;
      const cx = W / 2 + curveOffset;

      // Ground/grass on both sides
      const grassG = c.createLinearGradient(0, y, 0, y + segH + 2);
      grassG.addColorStop(0, i % 2 === 0 ? zone.ground[0] : this.darken(zone.ground[0], 0.65));
      grassG.addColorStop(1, i % 2 === 0 ? zone.ground[1] : this.darken(zone.ground[1], 0.75));
      c.fillStyle = grassG;
      c.fillRect(0, y, W, segH + 2);

      // Rumble strips (road edges)
      const rumbleW = roadW + 14 * persp;
      c.fillStyle = i % 3 === 0 ? zone.edge : '#ffffff';
      c.fillRect(cx - rumbleW / 2, y, rumbleW, segH + 2);

      // Road surface
      const roadG = c.createLinearGradient(cx - roadW / 2, y, cx + roadW / 2, y);
      roadG.addColorStop(0, zone.road[0]);
      roadG.addColorStop(0.5, i % 2 === 0 ? zone.road[1] : this.darken(zone.road[1], 0.75));
      roadG.addColorStop(1, zone.road[0]);
      c.fillStyle = roadG;
      c.fillRect(cx - roadW / 2, y, roadW, segH + 2);

      // Lane markings (dashed center lines for 5 lanes)
      const laneW = roadW / this.LANE_COUNT;
      for (let lane = 0; lane < this.LANE_COUNT - 1; lane++) {
        const lx = cx - roadW / 2 + laneW * (lane + 1);
        if (i % 6 < 3) {
          c.save();
          c.globalAlpha = 0.6;
          c.shadowColor = zone.lane;
          c.shadowBlur = 4;
          c.fillStyle = zone.lane;
          c.fillRect(lx - 1.5 * persp, y, 3 * persp, segH + 2);
          c.restore();
        }
      }

      // Edge neon lines
      c.save();
      c.shadowColor = zone.edge;
      c.shadowBlur = 6 * persp;
      c.globalAlpha = 0.7;
      c.fillStyle = zone.edge;
      c.fillRect(cx - roadW / 2, y, Math.max(1, 2 * persp), segH + 2);
      c.fillRect(cx + roadW / 2 - Math.max(1, 2 * persp), y, Math.max(1, 2 * persp), segH + 2);
      c.restore();

      // Guardrails
      const guardX = cx - roadW / 2 - 6 * persp;
      const guardX2 = cx + roadW / 2 + 6 * persp;
      c.save();
      c.shadowColor = zone.guardrail;
      c.shadowBlur = 8 * persp;
      c.globalAlpha = 0.4 + 0.3 * Math.sin(this.frame * 0.05 + i * 0.5);
      c.fillStyle = zone.guardrail;
      c.fillRect(guardX, y, Math.max(1, 2 * persp), segH + 2);
      c.fillRect(guardX2, y, Math.max(1, 2 * persp), segH + 2);
      c.restore();

      // Guardrail posts
      if (i % 8 === 0) {
        c.save();
        c.globalAlpha = 0.3;
        c.fillStyle = '#aaa';
        c.fillRect(guardX - 2 * persp, y, 4 * persp, segH + 2);
        c.fillRect(guardX2 - 2 * persp, y, 4 * persp, segH + 2);
        c.restore();
      }
    }

    // Center road marker at player position
    const laneW = roadTotalW / this.LANE_COUNT;
    for (let lane = 0; lane < this.LANE_COUNT; lane++) {
      const lx = W / 2 - roadTotalW / 2 + laneW * lane + laneW / 2;
      c.save();
      c.globalAlpha = 0.15 + 0.1 * Math.sin(this.frame * 0.1 + lane);
      c.fillStyle = zone.lane;
      c.shadowColor = zone.lane;
      c.shadowBlur = 6;
      c.fillRect(lx - 1, H - 150, 2, 20);
      c.restore();
    }

    // Road edge rumble effect
    if (this.rumbleIntensity > 0) {
      c.save();
      c.globalAlpha = this.rumbleIntensity * 0.3;
      const side = this.lane < 0 ? 'left' : 'right';
      const rx = side === 'left' ? W / 2 - roadTotalW / 2 - 8 : W / 2 + roadTotalW / 2 + 8;
      for (let r = 0; r < 6; r++) {
        const ry = (H - 140) + r * 10 + Math.sin(this.frame * 0.3 + r) * 3;
        c.fillStyle = '#ff8800';
        c.shadowColor = '#ff8800';
        c.shadowBlur = 10;
        c.fillRect(rx - 4, ry, 8, 6);
      }
      c.restore();
    }
  }

  drawScenery(c, W, H) {
    const horizon = H * 0.36;
    const zone = this.zone();
    const roadTotalW = W * this.ROAD_WIDTH;
    const playerX = this.roadX[this.roadIndex];

    for (let i = 10; i < this.VISIBLE_SEGS; i += 12 + ((i * 7) % 5)) {
      const idx = (this.roadIndex + i) % this.TOTAL_SEGMENTS;
      const relX = (this.roadX[idx] - playerX) * this.CURVE_SCALE;
      const relZ = i * this.roadSegLength;
      const persp = this.FOCAL / (relZ + this.FOCAL);
      const y = horizon + (H - horizon) * persp;
      if (y < horizon || y > H + 20) continue;

      const side = ((i * 13) % 7) > 3 ? 1 : -1;
      const distFromRoad = roadTotalW * 0.5 * persp + 30 * persp + ((i * 17) % 40) * persp;
      const sx = W / 2 + relX * persp + side * distFromRoad;
      const sc = 0.15 + persp * 0.85;

      c.save();
      c.translate(sx, y);
      c.scale(sc, sc);

      const seed = (i * 17 + 13) % 6;
      if (seed === 0 || seed === 1) {
        // Tree
        c.shadowColor = '#00ff88';
        c.shadowBlur = 6;
        c.fillStyle = '#1d5b44';
        c.fillRect(-2, -30, 4, 30);
        c.fillStyle = '#00b878';
        c.beginPath();
        c.arc(0, -32, 12, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#00d890';
        c.beginPath();
        c.arc(-5, -36, 8, 0, Math.PI * 2);
        c.fill();
      } else if (seed === 2 || seed === 3) {
        // Building
        const bw = 18 + ((i * 11) % 12);
        const bh = 30 + ((i * 7) % 25);
        c.shadowColor = zone.edge;
        c.shadowBlur = 4;
        c.fillStyle = 'rgba(0,20,40,0.7)';
        c.fillRect(-bw / 2, -bh, bw, bh);
        c.strokeStyle = 'rgba(0,255,255,0.15)';
        c.lineWidth = 1;
        c.strokeRect(-bw / 2, -bh, bw, bh);
        for (let wy = -bh + 6; wy < -4; wy += 8) {
          c.fillStyle = ((i * 3 + wy) % 4 === 0) ? '#ffff00' : 'rgba(100,200,255,0.3)';
          c.fillRect(-bw / 3, wy, 5, 4);
          c.fillRect(bw / 6, wy, 5, 4);
        }
      } else if (seed === 4) {
        // Sign
        c.fillStyle = '#666';
        c.fillRect(-1, -20, 2, 20);
        c.shadowColor = '#ffff00';
        c.shadowBlur = 6;
        c.fillStyle = '#1b1038';
        c.fillRect(-16, -28, 32, 12);
        c.strokeStyle = '#ffff00';
        c.strokeRect(-16, -28, 32, 12);
        c.fillStyle = '#ffff00';
        c.font = '8px monospace';
        c.textAlign = 'center';
        c.fillText(zone.name.substring(0, 4), 0, -19);
      } else {
        // Light pole
        c.fillStyle = '#888';
        c.fillRect(-1, -24, 2, 24);
        c.shadowColor = '#ff00ff';
        c.shadowBlur = 10;
        c.fillStyle = '#ff00ff';
        c.beginPath();
        c.arc(0, -26, 3, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
  }

  drawEnemy(c, e) {
    const pos = { x: e.screenX, y: e.screenY, scale: e.screenScale };
    if (!pos || pos.y < this.H * 0.36 || pos.y > this.H + 60) return;

    const w = e.type === 'truck' ? e.w * 1.3 : e.w;
    const h = e.type === 'truck' ? e.h * 1.25 : e.h;

    c.save();
    c.globalAlpha = Math.min(1, 0.3 + pos.scale * 1.3);
    c.translate(pos.x, pos.y);
    c.scale(pos.scale * 0.9, pos.scale * 0.9);

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(3, 5, w * 0.45, h * 0.3, 0, 0, Math.PI * 2);
    c.fill();

    // Car body
    const [r, g, b] = VFX.hexToRgb(e.color);
    const darkColor = `rgb(${Math.round(r * 0.6)},${Math.round(g * 0.6)},${Math.round(b * 0.6)})`;
    const lightColor = `rgb(${Math.min(255, r + 50)},${Math.min(255, g + 50)},${Math.min(255, b + 50)})`;

    c.shadowColor = e.color;
    c.shadowBlur = 14;
    c.fillStyle = e.color;
    c.beginPath();
    c.roundRect(-w / 2, -h / 2, w, h, 5);
    c.fill();

    // Body gradient
    const bodyG = c.createLinearGradient(-w / 2, -h / 2, -w / 2, h / 2);
    bodyG.addColorStop(0, lightColor);
    bodyG.addColorStop(0.5, e.color);
    bodyG.addColorStop(1, darkColor);
    c.fillStyle = bodyG;
    c.shadowBlur = 0;
    c.beginPath();
    c.roundRect(-w / 2, -h / 2, w, h, 5);
    c.fill();

    // Windshield
    c.fillStyle = 'rgba(150,200,255,0.5)';
    c.beginPath();
    c.roundRect(-w * 0.35, -h * 0.2, w * 0.7, h * 0.2, 2);
    c.fill();

    // Rear window
    c.fillStyle = 'rgba(150,200,255,0.35)';
    c.beginPath();
    c.roundRect(-w * 0.3, h * 0.05, w * 0.6, h * 0.14, 2);
    c.fill();

    // Headlights
    c.shadowColor = '#ffe';
    c.shadowBlur = 8;
    c.fillStyle = '#ffe';
    c.fillRect(-w * 0.35, -h / 2, w * 0.15, 2);
    c.fillRect(w * 0.2, -h / 2, w * 0.15, 2);

    // Tail lights
    c.shadowColor = '#f00';
    c.fillStyle = '#f33';
    c.fillRect(-w * 0.35, h / 2 - 2, w * 0.15, 2);
    c.fillRect(w * 0.2, h / 2 - 2, w * 0.15, 2);
    c.shadowBlur = 0;

    // Wheels
    c.fillStyle = '#222';
    c.fillRect(-w / 2 - 2, -h * 0.32, 4, h * 0.2);
    c.fillRect(w / 2 - 2, -h * 0.32, 4, h * 0.2);
    c.fillRect(-w / 2 - 2, h * 0.12, 4, h * 0.2);
    c.fillRect(w / 2 - 2, h * 0.12, 4, h * 0.2);

    // Neon outline
    c.globalAlpha = 0.5;
    c.shadowColor = e.depth < 50 ? '#ffff00' : e.color;
    c.shadowBlur = 8;
    c.strokeStyle = e.depth < 50 ? '#ffff00' : e.color;
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 6);
    c.stroke();
    c.restore();
  }

  drawPowerup(c, p) {
    const pos = { x: p.screenX, y: p.screenY, scale: p.screenScale };
    if (!pos || pos.y < this.H * 0.36 || pos.y > this.H + 30) return;

    const colors = { nitro: '#ff8800', shield: '#00ffff', star: '#ffff00' };
    const col = colors[p.type];
    const pulse = 1 + 0.15 * Math.sin(this.frame * 0.1);

    c.save();
    c.translate(pos.x, pos.y);
    c.scale(pos.scale, pos.scale);

    VFX.radialGlow(c, 0, 0, 22 * pulse, col, 0.25);
    VFX.drawNeonCircle(c, 0, 0, Math.max(6, 10 * pulse), col, 2);

    c.fillStyle = '#fff';
    c.font = 'bold 11px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const icons = { nitro: '⚡', shield: '🛡', star: '★' };
    c.fillText(icons[p.type], 0, 0);
    c.restore();
  }

  drawPlayer(c, W, H) {
    c.save();
    const pp = this.projectPoint(this.lane, 0);
    const px = pp.x;
    const py = H - 130;

    // Shadow
    c.globalAlpha = 0.4;
    c.fillStyle = '#000';
    c.beginPath();
    c.ellipse(px + 5, py + 30, 38, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;

    c.translate(px, py);
    c.rotate(this.wheelAngle * 0.3);

    const w = 40, h = 68;

    // Tire smoke when steering at speed
    if (Math.abs(this.wheelAngle) > 0.2 && this.speed > 4 && this.frame % 3 === 0) {
      const sx = this.wheelAngle > 0 ? 22 : -22;
      this.particles.emit(sx, 32, 2, ['#aaa','#ccc','#888'], [10, 30], [0.3, 0.6], [2, 4]);
    }

    // Shadow under car
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(2, 5, w * 0.48, h * 0.32, 0, 0, Math.PI * 2);
    c.fill();

    // Car body glow
    c.shadowColor = '#00ffff';
    c.shadowBlur = 16;
    c.fillStyle = '#00ffff';
    c.beginPath();
    c.roundRect(-w / 2, -h / 2, w, h, 6);
    c.fill();

    // Body gradient (cyan car)
    const bodyG = c.createLinearGradient(-w / 2, -h / 2, -w / 2, h / 2);
    bodyG.addColorStop(0, '#66ffff');
    bodyG.addColorStop(0.4, '#00ffff');
    bodyG.addColorStop(1, '#0099aa');
    c.fillStyle = bodyG;
    c.shadowBlur = 0;
    c.beginPath();
    c.roundRect(-w / 2, -h / 2, w, h, 6);
    c.fill();

    // Carbon roof
    c.fillStyle = 'rgba(10,10,30,0.5)';
    c.beginPath();
    c.roundRect(-w * 0.35, -h * 0.3, w * 0.7, h * 0.28, 3);
    c.fill();

    // Windshield
    c.fillStyle = 'rgba(150,200,255,0.55)';
    c.beginPath();
    c.roundRect(-w * 0.32, -h * 0.25, w * 0.64, h * 0.18, 2);
    c.fill();

    // Rear window
    c.fillStyle = 'rgba(150,200,255,0.35)';
    c.beginPath();
    c.roundRect(-w * 0.28, h * 0.08, w * 0.56, h * 0.12, 2);
    c.fill();

    // Headlights
    c.shadowColor = '#ffffff';
    c.shadowBlur = 12;
    c.fillStyle = '#ffffff';
    c.fillRect(-w * 0.35, -h / 2, w * 0.12, 2);
    c.fillRect(w * 0.23, -h / 2, w * 0.12, 2);

    // Headlight beams
    if (this.speed > 2) {
      c.save();
      c.globalAlpha = 0.08 + this.speed * 0.005;
      c.fillStyle = '#ffffcc';
      c.shadowColor = '#ffffcc';
      c.shadowBlur = 20;
      c.beginPath();
      c.moveTo(-w * 0.3, -h / 2);
      c.lineTo(-w * 0.15, -h / 2 - 30 - this.speed * 2);
      c.lineTo(w * 0.15, -h / 2 - 30 - this.speed * 2);
      c.lineTo(w * 0.3, -h / 2);
      c.closePath();
      c.fill();
      c.restore();
    }

    // Tail lights
    c.shadowColor = '#ff0000';
    c.shadowBlur = 8;
    c.fillStyle = '#ff3333';
    c.fillRect(-w * 0.35, h / 2 - 3, w * 0.12, 3);
    c.fillRect(w * 0.23, h / 2 - 3, w * 0.12, 3);

    c.shadowBlur = 0;

    // Wheels
    c.fillStyle = '#222';
    c.shadowColor = 'rgba(0,0,0,0.3)';
    c.shadowBlur = 4;
    c.fillRect(-w / 2 - 2, -h * 0.35, 5, h * 0.22);
    c.fillRect(w / 2 - 3, -h * 0.35, 5, h * 0.22);
    c.fillRect(-w / 2 - 2, h * 0.13, 5, h * 0.22);
    c.fillRect(w / 2 - 3, h * 0.13, 5, h * 0.22);

    // Wheel rims
    c.fillStyle = '#666';
    c.fillRect(-w / 2 - 1, -h * 0.3, 3, h * 0.08);
    c.fillRect(w / 2 - 2, -h * 0.3, 3, h * 0.08);
    c.fillRect(-w / 2 - 1, h * 0.18, 3, h * 0.08);
    c.fillRect(w / 2 - 2, h * 0.18, 3, h * 0.08);

    // Shield effect
    if (this.shield) {
      c.save();
      c.strokeStyle = '#00ffff';
      c.lineWidth = 3;
      c.globalAlpha = 0.35 + 0.25 * Math.sin(this.frame * 0.15);
      c.shadowColor = '#00ffff';
      c.shadowBlur = 20;
      c.beginPath();
      c.arc(0, 0, 48, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    // Nitro flame effect
    if (this.nitroActive && this.nitro > 0) {
      c.save();
      const flameLen = 15 + Math.random() * 20;
      c.shadowColor = '#ff8800';
      c.shadowBlur = 25;
      c.fillStyle = '#ff6600';
      c.beginPath();
      c.moveTo(-8, h / 2);
      c.quadraticCurveTo(-12, h / 2 + flameLen, 0, h / 2 + flameLen + 5);
      c.quadraticCurveTo(12, h / 2 + flameLen, 8, h / 2);
      c.fill();
      c.shadowColor = '#ffcc00';
      c.shadowBlur = 15;
      c.fillStyle = '#ffcc00';
      c.beginPath();
      c.moveTo(-4, h / 2);
      c.quadraticCurveTo(-6, h / 2 + flameLen * 0.6, 0, h / 2 + flameLen * 0.7);
      c.quadraticCurveTo(6, h / 2 + flameLen * 0.6, 4, h / 2);
      c.fill();
      c.restore();
    }

    c.restore();
  }

  drawNitroParticles(c) {
    this.nitroParticles.forEach(p => {
      c.save();
      c.globalAlpha = p.life;
      c.fillStyle = p.color;
      c.shadowColor = p.color;
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      c.fill();
      c.restore();
    });
    c.globalAlpha = 1;
    c.shadowBlur = 0;
  }

  drawSpeedLines(c, W, H) {
    this.speedLines.forEach(l => {
      c.save();
      c.globalAlpha = l.life * 0.25;
      c.strokeStyle = '#00ffff';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(l.x, l.y);
      c.lineTo(l.x, l.y + l.len);
      c.stroke();
      c.restore();
    });
  }

  drawHUD(c, W, H) {
    // Score panel
    VFX.panel(c, 10, 10, 230, 130, { bg: 'rgba(0,0,20,0.7)', border: 'rgba(0,255,255,0.12)', radius: 10 });
    VFX.drawLEDText(c, `${this.score}`, 125, 32, '#00ffff', 22);
    VFX.glowText(c, 'SCORE', 20, 32, { font: '10px monospace', color: '#888', align: 'left' });

    // Speed
    const speedKmh = Math.round(this.speed * 12);
    const speedColor = this.speed > this.maxSpeed * 0.8 ? '#ff3366' : '#aaa';
    VFX.glowText(c, `${speedKmh}`, 20, 58, { font: 'bold 24px monospace', color: speedColor, align: 'left' });
    VFX.glowText(c, 'KM/H', 70, 62, { font: '10px monospace', color: '#666', align: 'left' });

    // Speed bar
    const barW = 130;
    const barH = 6;
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.beginPath();
    c.roundRect(20, 76, barW, barH, 3);
    c.fill();
    const fillW = (this.speed / this.maxSpeed) * barW;
    const barColor = this.speed > this.maxSpeed * 0.85 ? '#ff3366' : this.speed > this.maxSpeed * 0.6 ? '#ffaa00' : '#00ffff';
    if (fillW > 0) {
      c.fillStyle = barColor;
      c.shadowColor = barColor;
      c.shadowBlur = 6;
      c.beginPath();
      c.roundRect(20, 76, fillW, barH, 3);
      c.fill();
      c.shadowBlur = 0;
    }

    // Health
    const hpStr = '';
    for (let i = 0; i < this.maxHealth; i++) {
      const hx = 20 + i * 22;
      c.fillStyle = i < this.health ? '#ff3366' : 'rgba(255,51,102,0.15)';
      c.shadowColor = i < this.health ? '#ff3366' : 'transparent';
      c.shadowBlur = i < this.health ? 6 : 0;
      c.beginPath();
      c.roundRect(hx, 90, 18, 14, 4);
      c.fill();
      c.fillStyle = i < this.health ? '#fff' : 'rgba(255,255,255,0.2)';
      c.font = 'bold 9px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.shadowBlur = 0;
      c.fillText('♥', hx + 9, 97);
    }

    // Level and combo
    VFX.glowText(c, `LVL ${this.level}`, 20, 118, { font: '11px monospace', color: '#ffff00', align: 'left' });
    VFX.glowText(c, `x${this.combo.toFixed(1)}`, 80, 118, { font: '11px monospace', color: this.combo >= 2 ? '#ffaa00' : '#666', align: 'left' });

    // Nitro bar
    VFX.panel(c, 10, H - 52, 160, 38, { bg: 'rgba(0,0,20,0.7)', border: 'rgba(255,136,0,0.15)', radius: 8 });
    const nw = 130;
    c.fillStyle = 'rgba(255,255,255,0.05)';
    c.beginPath();
    c.roundRect(22, H - 38, nw, 14, 7);
    c.fill();
    VFX.drawNeonRect(c, 22, H - 38, Math.max(0, (this.nitro / 100) * nw), 14, '#ff8800', 7, 1);
    VFX.glowText(c, 'NITRO', 87, H - 31, { font: 'bold 9px monospace', color: '#fff' });

    // Zone name
    VFX.glowText(c, this.zone().name, W - 10, 18, { font: '12px monospace', color: this.zone().edge, align: 'right' });

    // Combo display
    if (this.combo >= 2) {
      VFX.glowText(c, `NEAR MISS x${this.combo.toFixed(1)}`, W / 2, 34, { font: '15px monospace', color: '#ffff00', glow: '#ffff00' });
    }

    // Radar
    this.drawRadar(c, W, H);
  }

  drawRadar(c, W, H) {
    const compact = W < 520;
    const rw = compact ? 60 : 80, rh = compact ? 90 : 110;
    const rx = W - rw - 10, ry = compact ? 10 : 30;

    VFX.panel(c, rx, ry, rw, rh, { bg: 'rgba(0,0,20,0.6)', border: 'rgba(255,255,0,0.15)', radius: 6 });
    VFX.glowText(c, 'RADAR', rx + rw / 2, ry + 10, { font: '9px monospace', color: '#ffff00' });

    c.save();
    c.strokeStyle = 'rgba(0,255,255,0.15)';
    c.lineWidth = 1;
    const laneGap = compact ? 12 : 18;
    for (let i = 0; i < 5; i++) {
      const lx = rx + rw / 2 - laneGap * 2 + i * laneGap;
      c.beginPath();
      c.moveTo(lx, ry + 20);
      c.lineTo(lx, ry + rh - 8);
      c.stroke();
    }

    this.enemies.forEach(e => {
      if (!e.active || e.depth < 0 || e.depth > 120) return;
      const radarLane = rx + rw / 2 + e.lane * laneGap;
      const radarY = ry + rh - 10 - (1 - e.depth / 120) * (rh - 30);
      const close = e.depth < 40;
      c.fillStyle = close ? '#ff3366' : '#ffff00';
      c.shadowColor = c.fillStyle;
      c.shadowBlur = close ? 8 : 4;
      c.beginPath();
      c.roundRect(radarLane - 3, radarY - 3, 6, 6, 2);
      c.fill();
    });

    // Player dot
    c.fillStyle = '#00ffff';
    c.shadowColor = '#00ffff';
    c.shadowBlur = 10;
    c.beginPath();
    c.arc(rx + rw / 2, ry + rh - 6, 4, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  drawZoneBanner(c, W, H) {
    if (this.zoneBannerTimer <= 0) return;
    const a = Math.min(1, this.zoneBannerTimer / 45);
    c.save();
    c.globalAlpha = a;
    VFX.panel(c, W / 2 - 170, H * 0.34 - 34, 340, 68, { bg: 'rgba(0,0,20,0.6)', border: this.zone().edge, radius: 10 });
    VFX.drawLEDText(c, this.zone().name, W / 2, H * 0.34 - 5, this.zone().edge, 26);
    VFX.glowText(c, 'NUEVA ZONA', W / 2, H * 0.34 + 24, { font: '10px monospace', color: '#ffff00' });
    c.restore();
  }

  drawGameOver(c, W, H) {
    c.fillStyle = 'rgba(8,0,18,0.82)';
    c.fillRect(0, 0, W, H);
    VFX.drawNeonRect(c, W / 2 - 200, H / 2 - 80, 400, 160, '#ff3366', 12, 2);
    VFX.drawLEDText(c, 'CRASHED!', W / 2, H / 2 - 25, '#ff3366', 46);
    VFX.drawLEDText(c, `SCORE: ${this.score}`, W / 2, H / 2 + 20, '#00ffff', 20);
    VFX.glowText(c, `DIST: ${Math.floor(this.distance)}m  |  NEAR MISS: ${this.nearMisses}`, W / 2, H / 2 + 54, { font: '12px monospace', color: '#ffff00' });
    VFX.glowText(c, 'R = REINTENTAR  |  ESC = MENU', W / 2, H / 2 + 78, { font: '11px monospace', color: '#666' });
  }

  loop() {
    if (!this.running) return;
    this.frame++;
    this.update(1 / 60);
    this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
