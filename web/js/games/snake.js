class SnakeGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 600; this.H = 500;
    this.cellSize = 20;
    this.cols = 30; this.rows = 25;
    this.running = false;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.frame = 0;
    this.flashAlpha = 0;
    this.trail = [];
    this.particles = [];
    this.state = 'start'; // start, playing, gameover
    this.snake = null;
    this.food = null;
    this.bonusFood = null;
    this.specialFood = null;
    this.powerups = [];
    this.activePowerups = [];
    this.obstacles = [];
    this.level = 1;
    this.fps = 10;
    this.lastMove = 0;
    this.animSnake = this.createAnimSnake();
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.rafId = null;
  }

  createAnimSnake() {
    const s = [];
    for (let i = 8; i >= 1; i--) s.push({ x: i, y: 5 });
    return { body: s, dir: { x: 1, y: 0 }, timer: 0 };
  }

  start() {
    this.running = true;
    this.state = 'start';
    document.addEventListener('keydown', this.boundKeyDown);
    this.loop();
  }

  destroy() {
    this.running = false;
    document.removeEventListener('keydown', this.boundKeyDown);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  reset() {
    this.snake = { body: [{ x: 9, y: 12 }, { x: 8, y: 12 }], dir: { x: 1, y: 0 }, grow: false, invincible: 0 };
    this.score = 0; this.combo = 0; this.level = 1; this.fps = 10;
    this.food = this.spawnFood();
    this.bonusFood = null; this.specialFood = null;
    this.powerups = []; this.activePowerups = []; this.obstacles = [];
    this.trail = []; this.particles = []; this.flashAlpha = 0;
    this.state = 'playing'; this.lastMove = performance.now();
    window.updateScore(0);
  }

  spawnFood() {
    const occupied = new Set(this.snake.body.map(p => `${p.x},${p.y}`));
    this.obstacles.forEach(o => occupied.add(`${o.x},${o.y}`));
    let x, y;
    do { x = Math.floor(Math.random() * this.cols); y = Math.floor(Math.random() * this.rows); }
    while (occupied.has(`${x},${y}`));
    const types = ['normal', 'normal', 'normal', 'speed', 'poison'];
    return { x, y, type: types[Math.floor(Math.random() * types.length)] };
  }

  spawnBonus() {
    const occupied = new Set(this.snake.body.map(p => `${p.x},${p.y}`));
    if (this.food) occupied.add(`${this.food.x},${this.food.y}`);
    let x, y;
    do { x = Math.floor(Math.random() * this.cols); y = Math.floor(Math.random() * this.rows); }
    while (occupied.has(`${x},${y}`));
    this.bonusFood = { x, y, spawn: performance.now(), life: 5000 };
  }

  spawnPowerup() {
    const types = ['speed', 'slow', 'shield', 'double'];
    const occupied = new Set(this.snake.body.map(p => `${p.x},${p.y}`));
    let x, y;
    do { x = 2 + Math.floor(Math.random() * (this.cols - 4)); y = 2 + Math.floor(Math.random() * (this.rows - 4)); }
    while (occupied.has(`${x},${y}`));
    this.powerups.push({ x, y, type: types[Math.floor(Math.random() * types.length)], spawn: performance.now() });
  }

  spawnObstacles() {
    this.obstacles = [];
    const count = Math.min(2 + this.level, 12);
    const head = this.snake.body[0];
    for (let i = 0; i < count; i++) {
      let attempts = 0, x, y;
      do {
        x = 2 + Math.floor(Math.random() * (this.cols - 4));
        y = 2 + Math.floor(Math.random() * (this.rows - 4));
        attempts++;
      } while (attempts < 50 && (Math.abs(head.x - x) + Math.abs(head.y - y)) < 5);
      if (attempts < 50) this.obstacles.push({ x, y });
    }
  }

  addParticles(x, y, colors, count, speed) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random());
      this.particles.push({
        x: x * this.cellSize + this.cellSize / 2,
        y: y * this.cellSize + this.cellSize / 2,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        life: 0.3 + Math.random() * 0.5, maxLife: 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3
      });
    }
  }

  onKeyDown(e) {
    if (this.state === 'start') {
      if (e.key === 'Enter') { this.reset(); return; }
    }
    if (this.state === 'gameover') {
      if (e.key === 'r' || e.key === 'R') { this.reset(); return; }
      if (e.key === 'Escape') { exitGame(); return; }
    }
    if (this.state !== 'playing') return;
    const d = this.snake.dir;
    if (e.key === 'ArrowUp' && d.y !== 1) { d.x = 0; d.y = -1; }
    else if (e.key === 'ArrowDown' && d.y !== -1) { d.x = 0; d.y = 1; }
    else if (e.key === 'ArrowLeft' && d.x !== 1) { d.x = -1; d.y = 0; }
    else if (e.key === 'ArrowRight' && d.x !== -1) { d.x = 1; d.y = 0; }
    else if (e.key === 'w' || e.key === 'W') { if (d.y !== 1) { d.x = 0; d.y = -1; } }
    else if (e.key === 's' || e.key === 'S') { if (d.y !== -1) { d.x = 0; d.y = 1; } }
    else if (e.key === 'a' || e.key === 'A') { if (d.x !== 1) { d.x = -1; d.y = 0; } }
    else if (e.key === 'd' || e.key === 'D') { if (d.x !== -1) { d.x = 1; d.y = 0; } }
    if (e.key === 'Escape') exitGame();
  }

  moveSnake() {
    const h = this.snake.body[0];
    const nx = (h.x + this.snake.dir.x + this.cols) % this.cols;
    const ny = (h.y + this.snake.dir.y + this.rows) % this.rows;
    const newHead = { x: nx, y: ny };

    this.trail.push({ x: h.x, y: h.y, t: this.frame });
    if (this.trail.length > 15) this.trail.shift();

    let ate = false, ateBonus = false, ateSpeed = false, atePoison = false;

    if (this.food && nx === this.food.x && ny === this.food.y) {
      if (this.food.type === 'speed') ateSpeed = true;
      else if (this.food.type === 'poison') atePoison = true;
      else ate = true;
      this.snake.grow = true;
      this.food = this.spawnFood();
      window.audioManager.playEat();
    }

    if (this.bonusFood && nx === this.bonusFood.x && ny === this.bonusFood.y) {
      ateBonus = true;
      this.snake.grow = true;
      this.bonusFood = null;
      window.audioManager.playBonus();
    }

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      if (nx === p.x && ny === p.y) {
        this.activePowerups.push({ type: p.type, start: performance.now(), dur: p.type === 'double' ? 8000 : 5000 });
        if (p.type === 'shield') this.snake.invincible = performance.now() + 6000;
        this.powerups.splice(i, 1);
        window.audioManager.playPowerup();
        this.addParticles(p.x, p.y, ['#ff0', '#f80', '#ff0'], 15, 80);
      }
    }

    this.snake.body.unshift(newHead);
    if (!this.snake.grow) this.snake.body.pop();
    else this.snake.grow = false;

    if (ate) { this.score += this.getScoreMult(); this.combo++; this.comboTimer = performance.now(); this.flashAlpha = 80; this.addParticles(nx, ny, ['#0f8', '#0f0', '#8f8'], 10, 70); }
    else if (ateBonus) { this.score += 3 * this.getScoreMult(); this.combo++; this.comboTimer = performance.now(); this.flashAlpha = 120; this.addParticles(nx, ny, ['#ff0', '#ff8', '#f80'], 18, 100); }
    else if (ateSpeed) { this.score += this.getScoreMult(); this.snake.invincible = performance.now() + 2000; this.flashAlpha = 60; this.addParticles(nx, ny, ['#f80', '#ff0'], 12, 80); window.audioManager.playBoost(); }
    else if (atePoison) { this.score = Math.max(0, this.score - 2); this.snake.body.splice(-2, 2); this.flashAlpha = 40; this.addParticles(nx, ny, ['#a0f', '#f0f'], 10, 60); window.audioManager.playPoison(); this.combo = 0; }

    if (performance.now() - this.comboTimer > 2000) this.combo = 0;
    if (this.combo > 1) { window.audioManager.playCombo(this.combo); window.gameStorage.updateStats('snake', { combos: 1 }); }

    window.updateScore(this.score);

    const newLevel = Math.min(1 + Math.floor(this.score / 5), 10);
    if (newLevel > this.level) { this.level = newLevel; this.fps = 8 + this.level * 2; window.audioManager.playLevelUp(); if (this.level % 2 === 0) this.spawnObstacles(); }

    this.activePowerups = this.activePowerups.filter(p => performance.now() - p.start < p.dur);
    if (!this.bonusFood && Math.random() < 0.01) this.spawnBonus();
    if (!this.powerups.length && Math.random() < 0.005) this.spawnPowerup();
    if (this.bonusFood && performance.now() - this.bonusFood.spawn > this.bonusFood.life) this.bonusFood = null;
    this.powerups = this.powerups.filter(p => performance.now() - p.spawn < 6000);

    if (this.checkDeath()) {
      if (this.hasShield()) {
        this.activePowerups = this.activePowerups.filter(p => p.type !== 'shield');
        this.snake.invincible = 0;
        this.addParticles(nx, ny, ['#ff0', '#f80'], 15, 80);
      } else {
        this.state = 'gameover';
        window.audioManager.playGameOver();
        this.addParticles(nx, ny, ['#f55', '#f80', '#f00'], 35, 120);
        const isNew = window.gameStorage.setHighScore('snake', this.score);
        window.gameStorage.updateStats('snake', { games: 1, food: this.score });
      }
    }
  }

  checkDeath() {
    const h = this.snake.body[0];
    for (let i = 1; i < this.snake.body.length; i++) {
      if (this.snake.body[i].x === h.x && this.snake.body[i].y === h.y) return true;
    }
    if (this.obstacles.some(o => o.x === h.x && o.y === h.y)) return true;
    return false;
  }

  hasShield() { return this.activePowerups.some(p => p.type === 'shield' && performance.now() - p.start < p.dur); }
  getScoreMult() { return this.activePowerups.some(p => p.type === 'double' && performance.now() - p.start < p.dur) ? 2 : 1; }
  getSpeedMult() {
    if (this.activePowerups.some(p => p.type === 'speed' && performance.now() - p.start < p.dur)) return 2;
    if (this.activePowerups.some(p => p.type === 'slow' && performance.now() - p.start < p.dur)) return 0.5;
    return 1;
  }

  update() {
    if (this.state === 'start') {
      this.animSnake.timer++;
      if (this.animSnake.timer >= 8) {
        this.animSnake.timer = 0;
        const s = this.animSnake;
        const h = s.body[0];
        const nx = (h.x + s.dir.x + this.cols) % this.cols;
        const ny = (h.y + s.dir.y + this.rows) % this.rows;
        s.body.unshift({ x: nx, y: ny });
        s.body.pop();
        if (nx >= this.cols - 2 || nx <= 1) s.dir = s.dir.y === 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
        else if (ny >= this.rows - 2 || ny <= 1) s.dir = s.dir.x === 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
      }
      return;
    }
    if (this.state !== 'playing') return;
    const now = performance.now();
    const interval = 1000 / (this.fps * this.getSpeedMult());
    if (now - this.lastMove >= interval) {
      this.lastMove = now;
      this.moveSnake();
    }
  }

  draw() {
    const c = this.ctx;
    c.fillStyle = '#0a0a1a';
    c.fillRect(0, 0, this.W, this.H);

    if (this.state === 'start') {
      this.drawAnimSnake();
      this.drawStartUI();
      return;
    }

    // Grid
    c.strokeStyle = '#1a1a2a';
    c.lineWidth = 0.5;
    for (let x = 0; x <= this.cols; x++) { c.beginPath(); c.moveTo(x * this.cellSize, 0); c.lineTo(x * this.cellSize, this.rows * this.cellSize); c.stroke(); }
    for (let y = 0; y <= this.rows; y++) { c.beginPath(); c.moveTo(0, y * this.cellSize); c.lineTo(this.cols * this.cellSize, y * this.cellSize); c.stroke(); }

    // Obstacles
    this.obstacles.forEach(o => {
      c.fillStyle = '#555';
      c.fillRect(o.x * this.cellSize + 1, o.y * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2);
      c.fillStyle = '#777';
      c.fillRect(o.x * this.cellSize + 3, o.y * this.cellSize + 3, 4, 4);
    });

    // Trail
    this.trail.forEach((t, i) => {
      const age = this.frame - t.t;
      if (age > 15) return;
      c.fillStyle = `rgba(0,181,39,${Math.max(0, 0.3 - age * 0.02)})`;
      c.fillRect(t.x * this.cellSize + 2, t.y * this.cellSize + 2, this.cellSize - 4, this.cellSize - 4);
    });

    // Food
    if (this.food) {
      const colors = { normal: '#b22', speed: '#f80', poison: '#a0f' };
      c.fillStyle = colors[this.food.type] || '#b22';
      const r = this.food.x * this.cellSize + 2, s2 = this.cellSize - 4;
      c.beginPath();
      c.roundRect(r, this.food.y * this.cellSize + 2, s2, s2, 4);
      c.fill();
      c.fillStyle = '#fff3';
      c.fillRect(r + 3, this.food.y * this.cellSize + 4, 4, 4);
    }

    // Bonus
    if (this.bonusFood) {
      const pulse = Math.abs(((this.frame % 20) / 10) - 1);
      c.fillStyle = '#ff0';
      c.beginPath();
      c.roundRect(this.bonusFood.x * this.cellSize + 1, this.bonusFood.y * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2, 5);
      c.fill();
      c.strokeStyle = `rgba(255,255,0,${pulse * 0.5})`;
      c.lineWidth = 2;
      c.stroke();
    }

    // Powerups
    this.powerups.forEach(p => {
      const colors = { speed: '#0af', slow: '#a0f', shield: '#ff0', double: '#f6a' };
      c.fillStyle = colors[p.type];
      c.beginPath();
      c.roundRect(p.x * this.cellSize + 2, p.y * this.cellSize + 2, this.cellSize - 4, this.cellSize - 4, 6);
      c.fill();
      c.fillStyle = '#fff';
      c.font = '10px sans-serif';
      c.textAlign = 'center';
      const labels = { speed: 'S', slow: 'W', shield: 'D', double: 'x2' };
      c.fillText(labels[p.type], p.x * this.cellSize + this.cellSize / 2, p.y * this.cellSize + this.cellSize / 2 + 3);
    });

    // Snake
    const shielded = performance.now() < this.snake.invincible;
    this.snake.body.forEach((seg, i) => {
      const t = i / Math.max(this.snake.body.length - 1, 1);
      let r = Math.round(0 + t * 0), g = Math.round(181 - t * 61), b = Math.round(39 - t * 12);
      if (shielded) { const p = Math.abs(((this.frame % 15) / 7.5) - 1); r = Math.round(r + (255 - r) * p * 0.4); g = Math.round(g + (215 - g) * p * 0.4); b = Math.round(b * (1 - p * 0.4)); }
      c.fillStyle = `rgb(${r},${g},${b})`;
      c.beginPath();
      c.roundRect(seg.x * this.cellSize + 1, seg.y * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2, 4);
      c.fill();
    });

    // Eyes
    const head = this.snake.body[0];
    const hx = head.x * this.cellSize + this.cellSize / 2;
    const hy = head.y * this.cellSize + this.cellSize / 2;
    const dx = this.snake.dir.x, dy = this.snake.dir.y;
    const px = -dy, py = dx;
    [-1, 1].forEach(sign => {
      const ex = hx + dx * 3 + px * 4 * sign;
      const ey = hy + dy * 3 + py * 4 * sign;
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(ex, ey, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#000';
      c.beginPath(); c.arc(ex + dx * 1.5, ey + dy * 1.5, 1, 0, Math.PI * 2); c.fill();
    });

    // Particles
    this.particles.forEach(p => {
      const alpha = Math.max(0, p.life / p.maxLife);
      c.fillStyle = p.color;
      c.globalAlpha = alpha;
      c.beginPath();
      c.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      c.fill();
    });
    c.globalAlpha = 1;

    // Flash
    if (this.flashAlpha > 0) {
      c.fillStyle = `rgba(255,255,255,${this.flashAlpha / 255})`;
      c.fillRect(0, 0, this.W, this.H);
    }

    // Border glow
    const glowColors = ['#1e3c1e', '#1e5032', '#286450', '#327878', '#5050b4', '#783cc8', '#b432b4', '#c85078', '#dc783c', '#ffa028'];
    c.strokeStyle = glowColors[Math.min(this.level - 1, 9)];
    c.lineWidth = 3;
    c.strokeRect(1, 1, this.W - 2, this.H - 2);

    // HUD
    c.fillStyle = '#fff';
    c.font = 'bold 14px sans-serif';
    c.textAlign = 'left';
    c.fillText(`Score: ${this.score}`, 10, 18);
    c.fillStyle = '#aaa';
    c.font = '12px sans-serif';
    c.fillText(`High: ${window.gameStorage.getHighScore('snake')}`, 10, 34);
    c.fillStyle = '#aaf';
    c.fillText(`Level: ${this.level}`, this.W - 80, 18);

    // Combo
    if (this.combo > 1 && performance.now() - this.comboTimer < 2000) {
      const fade = Math.max(0, 1 - (performance.now() - this.comboTimer) / 2000);
      c.globalAlpha = fade;
      c.fillStyle = '#ff0';
      c.font = `bold ${20 + this.combo * 2}px sans-serif`;
      c.textAlign = 'center';
      c.fillText(`COMBO x${this.combo}`, this.W / 2, 80);
      c.globalAlpha = 1;
    }

    // Active powerups
    let pY = 50;
    this.activePowerups.forEach(p => {
      const rem = Math.max(0, p.dur - (performance.now() - p.start));
      const prog = rem / p.dur;
      const colors = { speed: '#0af', slow: '#a0f', shield: '#ff0', double: '#f6a' };
      const labels = { speed: 'SPEED', slow: 'SLOW', shield: 'SHIELD', double: 'x2 SCORE' };
      c.fillStyle = '#222';
      c.fillRect(this.W - 130, pY, 120, 14);
      c.fillStyle = colors[p.type];
      c.fillRect(this.W - 130, pY, 120 * prog, 14);
      c.fillStyle = '#fff';
      c.font = '10px sans-serif';
      c.textAlign = 'center';
      c.fillText(`${labels[p.type]} ${rem / 1000 | 0}s`, this.W - 70, pY + 11);
      pY += 18;
    });

    // Game over
    if (this.state === 'gameover') {
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(0, 0, this.W, this.H);
      c.textAlign = 'center';
      c.fillStyle = '#f55';
      c.font = 'bold 48px sans-serif';
      c.fillText('GAME OVER', this.W / 2, this.H / 2 - 40);
      c.fillStyle = '#fff';
      c.font = '24px sans-serif';
      c.fillText(`Score: ${this.score}`, this.W / 2, this.H / 2 + 10);
      const hi = window.gameStorage.getHighScore('snake');
      if (this.score >= hi && this.score > 0) {
        c.fillStyle = '#ff0';
        c.fillText('NEW HIGH SCORE!', this.W / 2, this.H / 2 + 45);
      } else {
        c.fillStyle = '#aaa';
        c.fillText(`High: ${hi}`, this.W / 2, this.H / 2 + 45);
      }
      c.fillStyle = '#888';
      c.font = '16px sans-serif';
      c.fillText('R = Restart  |  ESC = Menu', this.W / 2, this.H / 2 + 80);
    }
  }

  drawAnimSnake() {
    const c = this.ctx;
    this.animSnake.body.forEach((seg, i) => {
      const t = i / Math.max(this.animSnake.body.length - 1, 1);
      c.fillStyle = `rgb(0,${Math.round(181 - t * 61)},${Math.round(39 - t * 12)})`;
      c.beginPath();
      c.roundRect(seg.x * this.cellSize + 1, seg.y * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2, 4);
      c.fill();
    });
  }

  drawStartUI() {
    const c = this.ctx;
    const pulse = Math.abs(((this.frame % 40) / 20) - 1);
    c.textAlign = 'center';
    c.fillStyle = '#0e6';
    c.font = `bold ${60 + 10 * pulse}px sans-serif`;
    c.fillText('SNAKE', this.W / 2, this.H / 2 - 80);
    c.fillStyle = '#fff';
    c.font = '22px sans-serif';
    c.fillText('Press ENTER to play', this.W / 2, this.H / 2 - 20);
    c.fillStyle = '#ff0';
    c.font = '16px sans-serif';
    c.fillText(`High Score: ${window.gameStorage.getHighScore('snake')}`, this.W / 2, this.H / 2 + 20);
    c.fillStyle = '#888';
    c.font = '14px sans-serif';
    c.fillText('Arrows / WASD: Move  |  ESC: Menu', this.W / 2, this.H - 30);
  }

  loop() {
    if (!this.running) return;
    this.frame++;
    this.update();
    this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
