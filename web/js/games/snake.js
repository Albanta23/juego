class SnakeGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.cellSize = Math.min(Math.floor(this.W / 30), Math.floor(this.H / 24));
    this.cols = Math.floor(this.W / this.cellSize);
    this.rows = Math.floor(this.H / this.cellSize);
    this.running = false; this.frame = 0; this.score = 0;
    this.combo = 0; this.comboTimer = 0; this.flashAlpha = 0;
    this.trail = []; this.particles = new VFX.particles();
    this.shake = new VFX.screenShake();
    this.stars = VFX.generateStars(60);
    this.state = 'start'; this.snake = null; this.food = null;
    this.bonusFood = null; this.powerups = []; this.activePowerups = [];
    this.obstacles = []; this.level = 1; this.fps = 10; this.lastMove = 0;
    this.animSnake = this.createAnimSnake();
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.rafId = null;
    this.boardX = (this.W - this.cols * this.cellSize) / 2;
    this.boardY = (this.H - this.rows * this.cellSize) / 2;
    this.glitchTimer = 0;
  }

  createAnimSnake() {
    const s = [];
    for (let i = 8; i >= 1; i--) s.push({ x: i, y: 5 });
    return { body: s, dir: { x: 1, y: 0 }, timer: 0 };
  }

  start() { this.running = true; this.state = 'start'; document.addEventListener('keydown', this.boundKeyDown); this.loop(); }
  destroy() { this.running = false; document.removeEventListener('keydown', this.boundKeyDown); if (this.rafId) cancelAnimationFrame(this.rafId); }

  reset() {
    this.snake = { body: [{ x: Math.floor(this.cols / 2), y: Math.floor(this.rows / 2) }, { x: Math.floor(this.cols / 2) - 1, y: Math.floor(this.rows / 2) }], dir: { x: 1, y: 0 }, grow: false, invincible: 0 };
    this.score = 0; this.combo = 0; this.level = 1; this.fps = 10;
    this.food = this.spawnFood(); this.bonusFood = null;
    this.powerups = []; this.activePowerups = []; this.obstacles = [];
    this.trail = []; this.flashAlpha = 0;
    this.state = 'playing'; this.lastMove = performance.now();
    window.updateScore(0);
  }

  spawnFood() {
    const occ = new Set(this.snake.body.map(p => `${p.x},${p.y}`));
    this.obstacles.forEach(o => occ.add(`${o.x},${o.y}`));
    let x, y, att = 0;
    do { x = Math.floor(Math.random() * this.cols); y = Math.floor(Math.random() * this.rows); att++; } while (occ.has(`${x},${y}`) && att < 200);
    return { x, y, type: ['normal','normal','normal','speed','poison'][Math.floor(Math.random() * 5)] };
  }

  spawnBonus() {
    const occ = new Set(this.snake.body.map(p => `${p.x},${p.y}`));
    if (this.food) occ.add(`${this.food.x},${this.food.y}`);
    let x, y, att = 0;
    do { x = Math.floor(Math.random() * this.cols); y = Math.floor(Math.random() * this.rows); att++; } while (occ.has(`${x},${y}`) && att < 200);
    if (att < 200) this.bonusFood = { x, y, spawn: performance.now(), life: 5000 };
  }

  spawnPowerup() {
    const occ = new Set(this.snake.body.map(p => `${p.x},${p.y}`));
    let x, y, att = 0;
    do { x = 2 + Math.floor(Math.random() * (this.cols - 4)); y = 2 + Math.floor(Math.random() * (this.rows - 4)); att++; } while (occ.has(`${x},${y}`) && att < 200);
    if (att < 200) this.powerups.push({ x, y, type: ['speed','slow','shield','double'][Math.floor(Math.random() * 4)], spawn: performance.now() });
  }

  spawnObstacles() {
    this.obstacles = [];
    const count = Math.min(2 + this.level, 12);
    const head = this.snake.body[0];
    for (let i = 0; i < count; i++) {
      let att = 0, x, y;
      do { x = 2 + Math.floor(Math.random() * (this.cols - 4)); y = 2 + Math.floor(Math.random() * (this.rows - 4)); att++; }
      while (att < 50 && (Math.abs(head.x - x) + Math.abs(head.y - y)) < 5);
      if (att < 50) this.obstacles.push({ x, y });
    }
  }

  onKeyDown(e) {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if (this.state === 'start') { if (e.key === 'Enter') { this.reset(); return; } }
    if (this.state === 'gameover') { if (e.key === 'r') { this.reset(); return; } if (e.key === 'Escape') { exitGame(); return; } }
    if (this.state !== 'playing') return;
    const d = this.snake.dir;
    if ((e.key === 'ArrowUp' || e.key === 'w') && d.y !== 1) { d.x = 0; d.y = -1; }
    else if ((e.key === 'ArrowDown' || e.key === 's') && d.y !== -1) { d.x = 0; d.y = 1; }
    else if ((e.key === 'ArrowLeft' || e.key === 'a') && d.x !== 1) { d.x = -1; d.y = 0; }
    else if ((e.key === 'ArrowRight' || e.key === 'd') && d.x !== -1) { d.x = 1; d.y = 0; }
    if (e.key === 'Escape') exitGame();
  }

  tx(c) { return this.boardX + c.x * this.cellSize; }
  ty(c) { return this.boardY + c.y * this.cellSize; }

  moveSnake() {
    const h = this.snake.body[0];
    const nx = (h.x + this.snake.dir.x + this.cols) % this.cols;
    const ny = (h.y + this.snake.dir.y + this.rows) % this.rows;
    this.trail.push({ x: h.x, y: h.y, t: this.frame });
    if (this.trail.length > 20) this.trail.shift();

    let ate = false, ateBonus = false, ateSpeed = false, atePoison = false;
    if (this.food && nx === this.food.x && ny === this.food.y) {
      if (this.food.type === 'speed') ateSpeed = true;
      else if (this.food.type === 'poison') atePoison = true;
      else ate = true;
      this.snake.grow = true; this.food = this.spawnFood();
      window.audioManager.playEat();
    }
    if (this.bonusFood && nx === this.bonusFood.x && ny === this.bonusFood.y) {
      ateBonus = true; this.snake.grow = true; this.bonusFood = null;
      window.audioManager.playBonus();
    }
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      if (nx === p.x && ny === p.y) {
        this.activePowerups.push({ type: p.type, start: performance.now(), dur: p.type === 'double' ? 8000 : 5000 });
        if (p.type === 'shield') this.snake.invincible = performance.now() + 6000;
        this.powerups.splice(i, 1);
        window.audioManager.playPowerup();
        this.particles.emit(this.tx(p) + this.cellSize / 2, this.ty(p) + this.cellSize / 2, 15, ['#00ffff','#ff00ff','#ffff00']);
      }
    }

    this.snake.body.unshift({ x: nx, y: ny });
    if (!this.snake.grow) this.snake.body.pop(); else this.snake.grow = false;

    const cx = this.tx({ x: nx }) + this.cellSize / 2, cy = this.ty({ y: ny }) + this.cellSize / 2;
    if (ate) { this.score += this.getScoreMult(); this.combo++; this.comboTimer = performance.now(); this.flashAlpha = 50; this.particles.emit(cx, cy, 12, ['#00ffff','#00ff88','#fff']); }
    else if (ateBonus) { this.score += 3 * this.getScoreMult(); this.combo++; this.comboTimer = performance.now(); this.flashAlpha = 80; this.particles.emit(cx, cy, 20, ['#ffff00','#ff8800','#fff']); }
    else if (ateSpeed) { this.score += this.getScoreMult(); this.snake.invincible = performance.now() + 2000; this.flashAlpha = 40; this.particles.emit(cx, cy, 15, ['#ff8800','#ffff00','#fff']); window.audioManager.playBoost(); }
    else if (atePoison) { this.score = Math.max(0, this.score - 2); this.snake.body.splice(-2, 2); this.flashAlpha = 30; this.particles.emit(cx, cy, 12, ['#ff00ff','#aa00ff','#fff']); window.audioManager.playPoison(); this.combo = 0; }

    if (performance.now() - this.comboTimer > 2000) this.combo = 0;
    if (this.combo > 1) window.audioManager.playCombo(this.combo);
    window.updateScore(this.score);

    const nl = Math.min(1 + Math.floor(this.score / 5), 10);
    if (nl > this.level) { this.level = nl; this.fps = 8 + this.level * 2; window.audioManager.playLevelUp(); if (this.level % 2 === 0) this.spawnObstacles(); }

    this.activePowerups = this.activePowerups.filter(p => performance.now() - p.start < p.dur);
    if (!this.bonusFood && Math.random() < 0.01) this.spawnBonus();
    if (!this.powerups.length && Math.random() < 0.005) this.spawnPowerup();
    if (this.bonusFood && performance.now() - this.bonusFood.spawn > this.bonusFood.life) this.bonusFood = null;
    this.powerups = this.powerups.filter(p => performance.now() - p.spawn < 6000);

    if (this.checkDeath()) {
      if (this.hasShield()) {
        this.activePowerups = this.activePowerups.filter(p => p.type !== 'shield');
        this.snake.invincible = 0;
        this.particles.emit(cx, cy, 20, ['#00ffff','#fff']);
      } else {
        this.state = 'gameover'; window.audioManager.playGameOver();
        this.particles.emit(cx, cy, 40, ['#ff3366','#ff00ff','#00ffff','#fff'], [100, 250], [0.4, 1.0]);
        this.shake.trigger(12, 400); this.glitchTimer = 20;
        window.gameStorage.setHighScore('snake', this.score);
      }
    }
  }

  checkDeath() {
    const h = this.snake.body[0];
    for (let i = 1; i < this.snake.body.length; i++) if (this.snake.body[i].x === h.x && this.snake.body[i].y === h.y) return true;
    return this.obstacles.some(o => o.x === h.x && o.y === h.y);
  }

  hasShield() { return this.activePowerups.some(p => p.type === 'shield' && performance.now() - p.start < p.dur); }
  getScoreMult() { return this.activePowerups.some(p => p.type === 'double' && performance.now() - p.start < p.dur) ? 2 : 1; }
  getSpeedMult() {
    if (this.activePowerups.some(p => p.type === 'speed' && performance.now() - p.start < p.dur)) return 2;
    if (this.activePowerups.some(p => p.type === 'slow' && performance.now() - p.start < p.dur)) return 0.5;
    return 1;
  }

  update(dt) {
    this.shake.update(dt * 1000);
    if (this.glitchTimer > 0) this.glitchTimer--;
    if (this.state === 'start') {
      this.animSnake.timer++;
      if (this.animSnake.timer >= 8) {
        this.animSnake.timer = 0;
        const s = this.animSnake, h = s.body[0];
        s.body.unshift({ x: (h.x + s.dir.x + 30) % 30, y: (h.y + s.dir.y + 20) % 20 }); s.body.pop();
        const nx = s.body[0].x;
        if (nx >= 28 || nx <= 1) s.dir = s.dir.y === 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
      }
      return;
    }
    if (this.state !== 'playing') return;
    const now = performance.now();
    if (now - this.lastMove >= 1000 / (this.fps * this.getSpeedMult())) { this.lastMove = now; this.moveSnake(); }
  }

  draw() {
    const c = this.ctx, W = this.W, H = this.H;
    VFX.backgroundGradient(c, W, H, '#0a0015', '#150030');
    VFX.starfield(c, W, H, this.stars, this.frame * 0.02);
    VFX.drawGridFloor(c, W, H, this.frame * 2, '#ff00ff', 0.08);

    if (this.state === 'start') { this.drawStart(); return; }

    c.save();
    this.shake.apply(c);

    // Board
    VFX.drawNeonRect(c, this.boardX - 6, this.boardY - 6, this.cols * this.cellSize + 12, this.rows * this.cellSize + 12, '#00ffff', 8, 1);

    // Grid dots
    c.fillStyle = 'rgba(0,255,255,0.04)';
    for (let x = 0; x < this.cols; x++) for (let y = 0; y < this.rows; y++) {
      c.beginPath(); c.arc(this.boardX + x * this.cellSize + this.cellSize / 2, this.boardY + y * this.cellSize + this.cellSize / 2, 1, 0, Math.PI * 2); c.fill();
    }

    // Obstacles
    this.obstacles.forEach(o => {
      const bx = this.boardX + o.x * this.cellSize, by = this.boardY + o.y * this.cellSize;
      c.save(); c.shadowColor = '#ff3366'; c.shadowBlur = 8;
      c.fillStyle = 'rgba(255,51,102,0.15)'; c.fillRect(bx + 1, by + 1, this.cellSize - 2, this.cellSize - 2);
      VFX.drawNeonRect(c, bx + 1, by + 1, this.cellSize - 2, this.cellSize - 2, '#ff3366', 2, 1);
      c.restore();
    });

    // Trail
    this.trail.forEach(t => {
      const age = this.frame - t.t; if (age > 20) return;
      const alpha = Math.max(0, 0.4 - age * 0.02);
      VFX.radialGlow(c, this.boardX + t.x * this.cellSize + this.cellSize / 2, this.boardY + t.y * this.cellSize + this.cellSize / 2, this.cellSize, '#00ffff', alpha * 0.5);
    });

    // Food
    if (this.food) {
      const fx = this.boardX + this.food.x * this.cellSize + this.cellSize / 2;
      const fy = this.boardY + this.food.y * this.cellSize + this.cellSize / 2;
      const colors = { normal: '#ff3366', speed: '#ff8800', poison: '#ff00ff' };
      const pulse = 1 + 0.15 * Math.sin(this.frame * 0.12);
      VFX.radialGlow(c, fx, fy, this.cellSize * 1.5, colors[this.food.type], 0.35);
      c.save(); c.shadowColor = colors[this.food.type]; c.shadowBlur = 20;
      c.fillStyle = colors[this.food.type];
      c.beginPath(); c.arc(fx, fy, (this.cellSize / 2 - 2) * pulse, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(fx - 2, fy - 2, 2, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    // Bonus
    if (this.bonusFood) {
      const bx = this.boardX + this.bonusFood.x * this.cellSize + this.cellSize / 2;
      const by = this.boardY + this.bonusFood.y * this.cellSize + this.cellSize / 2;
      const pulse = 1 + 0.2 * Math.sin(this.frame * 0.15);
      VFX.drawNeonCircle(c, bx, by, (this.cellSize / 2) * pulse, '#ffff00', 2);
    }

    // Powerups
    this.powerups.forEach(p => {
      const px = this.boardX + p.x * this.cellSize + this.cellSize / 2;
      const py = this.boardY + p.y * this.cellSize + this.cellSize / 2;
      const colors = { speed: '#00ffff', slow: '#ff00ff', shield: '#ffff00', double: '#ff3366' };
      VFX.drawNeonCircle(c, px, py, this.cellSize / 2 - 2, colors[p.type], 2);
      c.fillStyle = '#fff'; c.font = `bold ${this.cellSize * 0.45}px monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const labels = { speed: 'S', slow: 'W', shield: 'D', double: 'x2' };
      c.fillText(labels[p.type], px, py);
    });

    // Snake
    const shielded = performance.now() < this.snake.invincible;
    this.snake.body.forEach((seg, i) => {
      const t = i / Math.max(this.snake.body.length - 1, 1);
      const r = Math.round(0 + t * 0), g = Math.round(255 - t * 100), b = Math.round(200 - t * 80);
      let color = `rgb(${r},${g},${b})`;
      if (shielded) { const p = Math.abs(((this.frame % 15) / 7.5) - 1); color = `rgb(${Math.round(r + (255-r)*p*0.4)},${Math.round(g + (255-g)*p*0.4)},${Math.round(b + (255-b)*p*0.4)})`; }
      const sx = this.boardX + seg.x * this.cellSize + 1, sy = this.boardY + seg.y * this.cellSize + 1;
      const sw = this.cellSize - 2, sh = this.cellSize - 2;
      c.save(); c.shadowColor = '#00ffff'; c.shadowBlur = i === 0 ? 18 : 6;
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.roundRect(sx, sy, sw, sh, 4); c.fill();
      VFX.drawNeonRect(c, sx, sy, sw, sh, color, 4, 1.5);
      c.restore();
    });

    // Eyes
    const head = this.snake.body[0];
    const hx = this.boardX + head.x * this.cellSize + this.cellSize / 2;
    const hy = this.boardY + head.y * this.cellSize + this.cellSize / 2;
    const dx = this.snake.dir.x, dy = this.snake.dir.y, px = -dy, py = dx;
    [-1, 1].forEach(sign => {
      const ex = hx + dx * 4 + px * 5 * sign, ey = hy + dy * 4 + py * 5 * sign;
      c.save(); c.shadowColor = '#00ffff'; c.shadowBlur = 8;
      c.fillStyle = '#00ffff'; c.beginPath(); c.arc(ex, ey, 3, 0, Math.PI * 2); c.fill();
      c.restore();
    });

    this.particles.draw(c);

    if (this.flashAlpha > 0) { c.fillStyle = `rgba(0,255,255,${this.flashAlpha / 255})`; c.fillRect(0, 0, W, H); this.flashAlpha = Math.max(0, this.flashAlpha - 4); }
    if (this.glitchTimer > 0) VFX.drawGlitch(c, W, H, 0.6);

    // HUD
    VFX.panel(c, 10, 10, 200, 80, { bg: 'rgba(0,0,20,0.7)', border: 'rgba(0,255,255,0.2)', radius: 8 });
    VFX.drawLEDText(`SCORE: ${this.score}`, 110, 30, '#00ffff', 22);
    VFX.glowText(c, `HIGH: ${window.gameStorage.getHighScore('snake')}`, 20, 55, { font: '12px monospace', color: '#ffff00', align: 'left' });
    VFX.glowText(c, `LVL: ${this.level}`, 20, 75, { font: '12px monospace', color: '#ff00ff', align: 'left' });

    // Combo
    if (this.combo > 1 && performance.now() - this.comboTimer < 2000) {
      const fade = Math.max(0, 1 - (performance.now() - this.comboTimer) / 2000);
      c.globalAlpha = fade;
      VFX.drawLEDText(`COMBO x${this.combo}`, W / 2, this.boardY - 25, '#ffff00', 28 + this.combo * 2);
      c.globalAlpha = 1;
    }

    // Powerups
    let pY = 100;
    this.activePowerups.forEach(p => {
      const rem = Math.max(0, p.dur - (performance.now() - p.start));
      const prog = rem / p.dur;
      const colors = { speed: '#00ffff', slow: '#ff00ff', shield: '#ffff00', double: '#ff3366' };
      const labels = { speed: 'SPEED', slow: 'SLOW', shield: 'SHIELD', double: 'x2 SCORE' };
      VFX.panel(c, 10, pY, 140, 18, { bg: 'rgba(0,0,20,0.7)', border: 'rgba(0,255,255,0.15)', radius: 4 });
      c.fillStyle = colors[p.type]; c.globalAlpha = 0.3; c.beginPath(); c.roundRect(10, pY, 140 * prog, 18, 4); c.fill(); c.globalAlpha = 1;
      VFX.glowText(c, `${labels[p.type]} ${(rem / 1000).toFixed(1)}`, 80, pY + 9, { font: '10px monospace', color: '#fff' });
      pY += 24;
    });

    // Game over
    if (this.state === 'gameover') {
      c.fillStyle = 'rgba(10,0,21,0.8)'; c.fillRect(0, 0, W, H);
      VFX.drawNeonRect(c, W / 2 - 220, H / 2 - 110, 440, 220, '#ff3366', 12, 2);
      VFX.drawLEDText('GAME OVER', W / 2, H / 2 - 55, '#ff3366', 42);
      VFX.drawLEDText(`SCORE: ${this.score}`, W / 2, H / 2 + 5, '#00ffff', 26);
      const hi = window.gameStorage.getHighScore('snake');
      if (this.score >= hi && this.score > 0) VFX.drawLEDText('NEW HIGH SCORE!', W / 2, H / 2 + 40, '#ffff00', 18);
      else VFX.glowText(c, `HIGH: ${hi}`, W / 2, H / 2 + 40, { font: '14px monospace', color: '#ffff00' });
      VFX.glowText(c, 'R = RESTART  |  ESC = MENU', W / 2, H / 2 + 75, { font: '12px monospace', color: '#666' });
    }

    VFX.drawCRTEffect(c, W, H, 0.15);
    c.restore();
  }

  drawStart() {
    const c = this.ctx, W = this.W, H = this.H;
    const s = this.animSnake;
    const sc = Math.min(this.cellSize, 20);
    const ox = W / 2 - (s.body.length * sc) / 2, oy = H / 2 - 20;
    s.body.forEach((seg, i) => {
      const t = i / Math.max(s.body.length - 1, 1);
      c.save(); c.shadowColor = '#00ffff'; c.shadowBlur = 12;
      VFX.drawNeonRect(c, ox + seg.x * sc + 1, oy + seg.y * sc + 1, sc - 2, sc - 2, `rgb(0,${Math.round(255 - t * 100)},${Math.round(200 - t * 80)})`, 4, 1.5);
      c.restore();
    });

    VFX.drawLEDText('SNAKE', W / 2, H / 2 - 110, '#00ffff', 64);
    VFX.glowText(c, 'PRESS ENTER TO PLAY', W / 2, H / 2 - 40, { font: '18px monospace', color: '#ff00ff' });
    VFX.glowText(c, `HIGH SCORE: ${window.gameStorage.getHighScore('snake')}`, W / 2, H / 2 - 5, { font: '14px monospace', color: '#ffff00' });
    VFX.glowText(c, 'ARROWS / WASD: MOVE  |  ESC: MENU', W / 2, H - 40, { font: '12px monospace', color: '#555' });
    VFX.drawCRTEffect(c, W, H, 0.2);
  }

  loop() {
    if (!this.running) return;
    this.frame++; this.update(1 / 60); this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
