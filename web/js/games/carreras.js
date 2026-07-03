class CarrerasGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = 600;
    this.canvas.height = 600;
    this.running = false;
    this.frame = 0;
    this.state = 'menu';
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.keys = {};
    this.rafId = null;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.lap = 0;
    this.totalLaps = 3;
    this.speed = 0;
    this.maxSpeed = 12;
    this.accel = 0.15;
    this.decel = 0.05;
    this.friction = 0.02;
    this.turnSpeed = 0.04;
    this.drift = 0;
    this.x = 300;
    this.y = 450;
    this.angle = -Math.PI / 2;
    this.nitro = 100;
    this.nitroActive = false;
    this.shield = false;
    this.shieldTimer = 0;
    this.track = this.generateTrack();
    this.enemies = this.generateEnemies();
    this.powerups = this.generatePowerups();
    this.particles = [];
    this.cameraY = 0;
    this.roadOffset = 0;
    this.bgScroll = 0;
    window.updateScore(0);
  }

  generateTrack() {
    const segments = [];
    let x = 0;
    for (let i = 0; i < 200; i++) {
      const curve = Math.sin(i * 0.05) * 3 + Math.sin(i * 0.02) * 2;
      segments.push({ y: i * 100, curve, width: 200 + Math.sin(i * 0.1) * 40 });
      x += curve;
    }
    return segments;
  }

  generateEnemies() {
    const enemies = [];
    const colors = ['#f44', '#ff0', '#0af', '#f0f', '#0f0'];
    for (let i = 0; i < 8; i++) {
      enemies.push({
        x: 250 + Math.random() * 100,
        y: 200 + i * 250,
        speed: 2 + Math.random() * 3,
        color: colors[i % colors.length],
        w: 30, h: 50,
      });
    }
    return enemies;
  }

  generatePowerups() {
    const types = ['nitro', 'shield', 'star'];
    const p = [];
    for (let i = 0; i < 12; i++) {
      p.push({
        x: 220 + Math.random() * 160,
        y: 150 + i * 200 + Math.random() * 100,
        type: types[Math.floor(Math.random() * types.length)],
        active: true,
      });
    }
    return p;
  }

  start() {
    this.running = true;
    this.state = 'menu';
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
    this.keys[e.key] = true;
    if (this.state === 'menu') {
      if (e.key === 'Enter') { this.reset(); this.state = 'playing'; }
    }
    if (e.key === 'Escape') exitGame();
    if (e.key === 'r' || e.key === 'R') { this.reset(); this.state = 'playing'; }
    if (e.key === 'n' || e.key === 'N') this.nitroActive = true;
  }

  onKeyUp(e) {
    this.keys[e.key] = false;
    if (e.key === 'n' || e.key === 'N') this.nitroActive = false;
  }

  update() {
    if (this.state !== 'playing') return;

    // Acceleration
    if (this.keys['ArrowUp'] || this.keys['w']) {
      this.speed = Math.min(this.maxSpeed, this.speed + this.accel);
    } else {
      this.speed = Math.max(0, this.speed - this.friction);
    }
    if (this.keys['ArrowDown'] || this.keys['s']) {
      this.speed = Math.max(0, this.speed - this.decel * 3);
    }

    // Nitro
    if (this.nitroActive && this.nitro > 0) {
      this.speed = Math.min(this.maxSpeed + 5, this.speed + 0.3);
      this.nitro = Math.max(0, this.nitro - 0.5);
      if (this.frame % 3 === 0) {
        this.particles.push({
          x: this.x + Math.random() * 10 - 5,
          y: this.y + 25,
          vx: Math.random() * 4 - 2, vy: 3 + Math.random() * 2,
          life: 1, color: '#f80', size: 3 + Math.random() * 2
        });
      }
    } else {
      this.nitro = Math.min(100, this.nitro + 0.1);
    }

    // Turning
    if (this.keys['ArrowLeft'] || this.keys['a']) {
      this.angle -= this.turnSpeed * (this.speed / this.maxSpeed);
      this.drift = Math.max(-1, this.drift - 0.1);
    } else if (this.keys['ArrowRight'] || this.keys['d']) {
      this.angle += this.turnSpeed * (this.speed / this.maxSpeed);
      this.drift = Math.min(1, this.drift + 0.1);
    } else {
      this.drift *= 0.9;
    }

    // Move
    this.x += Math.cos(this.angle) * this.speed;
    this.y -= Math.sin(this.angle) * this.speed * 0.5;
    this.bgScroll += this.speed;

    // Road bounds
    if (this.x < 100) { this.x = 100; this.speed *= 0.5; }
    if (this.x > 500) { this.x = 500; this.speed *= 0.5; }

    // Enemies
    this.enemies.forEach(e => {
      e.y += this.speed - e.speed;
      if (e.y > 700) e.y -= 900;
      const dx = Math.abs(this.x - e.x);
      const dy = Math.abs(this.y - e.y);
      if (dx < 30 && dy < 45) {
        if (this.shield) {
          this.shield = false;
          window.audioManager.playHit();
          this.addParticles(this.x, this.y, '#ff0', 15);
        } else {
          this.speed = 0;
          window.audioManager.playCarHit();
          this.addParticles(this.x, this.y, '#f00', 20);
        }
      }
    });

    // Powerups
    this.powerups.forEach(p => {
      if (!p.active) return;
      const dx = Math.abs(this.x - p.x);
      const dy = Math.abs(this.y - p.y);
      if (dx < 30 && dy < 30) {
        p.active = false;
        if (p.type === 'nitro') { this.nitro = 100; window.audioManager.playNitro(); }
        else if (p.type === 'shield') { this.shield = true; this.shieldTimer = performance.now(); window.audioManager.playPowerup(); }
        else if (p.type === 'star') { this.score += 50; window.audioManager.playBonus(); }
        this.addParticles(p.x, p.y, '#ff0', 12);
      }
    });

    // Score
    if (this.speed > 1) {
      this.score += Math.floor(this.speed / 3);
      window.updateScore(this.score);
    }

    // Particles
    this.particles = this.particles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.02;
      return p.life > 0;
    });

    // Shield timeout
    if (this.shield && performance.now() - this.shieldTimer > 5000) this.shield = false;
  }

  addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x, y, vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4,
        life: 1, color, size: 2 + Math.random() * 3
      });
    }
  }

  draw() {
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    c.fillStyle = '#1a3a1a';
    c.fillRect(0, 0, W, H);

    if (this.state === 'menu') {
      c.textAlign = 'center';
      c.fillStyle = '#f44';
      c.font = 'bold 48px sans-serif';
      c.fillText('CARRERAS', W / 2, H / 2 - 60);
      c.fillStyle = '#fff';
      c.font = '20px sans-serif';
      c.fillText('Press ENTER to start', W / 2, H / 2);
      c.fillStyle = '#888';
      c.font = '14px sans-serif';
      c.fillText('↑↓ Accelerate/Brake  |  ←→ Steer  |  N Nitro', W / 2, H / 2 + 40);
      c.fillText('3 laps to win!', W / 2, H / 2 + 65);
      return;
    }

    // Road perspective
    const roadW = 300;
    const horizon = 150;
    const segH = 8;

    for (let i = 0; i < 50; i++) {
      const t = i / 50;
      const y = horizon + t * (H - horizon);
      const w = roadW * (0.3 + t * 0.7);
      const curve = Math.sin((this.bgScroll + i * 10) * 0.003) * 40 * t;
      const cx = W / 2 + curve;

      // Grass
      const grassColor = i % 2 === 0 ? '#2a5a2a' : '#245024';
      c.fillStyle = grassColor;
      c.fillRect(0, y, W, segH + 1);

      // Road
      c.fillStyle = i % 2 === 0 ? '#444' : '#3a3a3a';
      c.fillRect(cx - w / 2, y, w, segH + 1);

      // Center line
      if (i % 4 < 2) {
        c.fillStyle = '#ff0';
        c.fillRect(cx - 2, y, 4, segH + 1);
      }

      // Road edges
      c.fillStyle = '#f00';
      c.fillRect(cx - w / 2, y, 4, segH + 1);
      c.fillRect(cx + w / 2 - 4, y, 4, segH + 1);
    }

    // Enemies
    this.enemies.forEach(e => {
      const screenY = e.y - this.bgScroll * 0.3;
      if (screenY < 100 || screenY > H) return;
      const scale = 0.3 + (screenY - 100) / (H - 100) * 0.7;
      const ex = e.x + Math.sin((this.bgScroll + e.y) * 0.01) * 20;
      c.fillStyle = e.color;
      c.fillRect(ex - e.w * scale / 2, screenY - e.h * scale / 2, e.w * scale, e.h * scale);
      c.fillStyle = '#0003';
      c.fillRect(ex - e.w * scale / 2 + 3, screenY - e.h * scale / 2 + 3, e.w * scale - 6, e.h * scale - 6);
    });

    // Powerups
    this.powerups.forEach(p => {
      if (!p.active) return;
      const screenY = p.y - this.bgScroll * 0.3;
      if (screenY < 100 || screenY > H) return;
      const colors = { nitro: '#f80', shield: '#0af', star: '#ff0' };
      c.fillStyle = colors[p.type];
      c.beginPath();
      c.arc(p.x, screenY, 8, 0, Math.PI * 2);
      c.fill();
    });

    // Player car
    c.save();
    c.translate(this.x, this.y);
    c.rotate(this.drift * 0.15);

    // Car body
    c.fillStyle = '#0af';
    c.fillRect(-15, -25, 30, 50);
    c.fillStyle = '#08c';
    c.fillRect(-12, -20, 24, 40);
    // Windshield
    c.fillStyle = '#fff4';
    c.fillRect(-10, -15, 20, 12);
    // Wheels
    c.fillStyle = '#333';
    c.fillRect(-18, -20, 6, 12);
    c.fillRect(12, -20, 6, 12);
    c.fillRect(-18, 10, 6, 12);
    c.fillRect(12, 10, 6, 12);

    // Shield glow
    if (this.shield) {
      c.strokeStyle = '#0af';
      c.lineWidth = 3;
      c.globalAlpha = 0.5 + Math.sin(this.frame * 0.1) * 0.3;
      c.beginPath();
      c.arc(0, 0, 30, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    }

    c.restore();

    // Particles
    this.particles.forEach(p => {
      c.globalAlpha = p.life;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
    });
    c.globalAlpha = 1;

    // HUD
    c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.font = 'bold 16px sans-serif';
    c.fillText(`Score: ${this.score}`, 10, 25);
    c.fillText(`Speed: ${Math.round(this.speed * 10)}`, 10, 48);

    // Nitro bar
    c.fillStyle = '#333';
    c.fillRect(10, 58, 100, 12);
    c.fillStyle = this.nitro > 20 ? '#f80' : '#f44';
    c.fillRect(10, 58, this.nitro, 12);
    c.fillStyle = '#fff';
    c.font = '10px sans-serif';
    c.fillText('NITRO', 15, 68);

    // Controls hint
    c.textAlign = 'right';
    c.fillStyle = '#888';
    c.font = '11px sans-serif';
    c.fillText('← → Steer  |  ↑ ↓ Speed  |  N Nitro  |  ESC Menu', W - 10, H - 10);

    // Game over / win
    if (this.state === 'gameover' || this.state === 'win') {
      c.fillStyle = 'rgba(0,0,0,0.7)';
      c.fillRect(0, 0, W, H);
      c.textAlign = 'center';
      c.fillStyle = this.state === 'win' ? '#ff0' : '#f44';
      c.font = 'bold 44px sans-serif';
      c.fillText(this.state === 'win' ? 'FINISHED!' : 'CRASHED!', W / 2, H / 2 - 20);
      c.fillStyle = '#fff';
      c.font = '22px sans-serif';
      c.fillText(`Score: ${this.score}`, W / 2, H / 2 + 25);
      c.fillStyle = '#888';
      c.font = '14px sans-serif';
      c.fillText('R = Restart  |  ESC = Menu', W / 2, H / 2 + 60);
    }
  }

  loop() {
    if (!this.running) return;
    this.frame++;
    this.update();
    this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
