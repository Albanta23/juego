class Game2048 {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.size = 4;
    this.cell = Math.min(Math.floor((Math.min(this.W, this.H) - 120) / this.size), 110);
    this.gap = 10;
    this.offsetX = (this.W - this.size * (this.cell + this.gap) + this.gap) / 2;
    this.offsetY = (this.H - this.size * (this.cell + this.gap) + this.gap) / 2 + 20;
    this.running = false; this.frame = 0;
    this.score = 0; this.grid = [];
    this.gameOver = false; this.won = false; this.keepPlaying = false;
    this.particles = new VFX.particles();
    this.shake = new VFX.screenShake();
    this.stars = VFX.generateStars(40);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.touchStartX = 0; this.touchStartY = 0;
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);
    this.rafId = null;
    this.TILES = {
      2: { bg: '#1a1a2e', fg: '#00ffff', glow: '#00ffff' },
      4: { bg: '#1a2040', fg: '#00ff88', glow: '#00ff88' },
      8: { bg: '#1a2848', fg: '#ffff00', glow: '#ffff00' },
      16: { bg: '#2a1848', fg: '#ff8800', glow: '#ff8800' },
      32: { bg: '#3a1040', fg: '#ff3366', glow: '#ff3366' },
      64: { bg: '#4a0838', fg: '#ff0066', glow: '#ff0066' },
      128: { bg: '#0a2a3a', fg: '#00ffff', glow: '#00ffff' },
      256: { bg: '#0a3a3a', fg: '#00ffaa', glow: '#00ffaa' },
      512: { bg: '#1a3a0a', fg: '#aaff00', glow: '#aaff00' },
      1024: { bg: '#3a3a0a', fg: '#ffff00', glow: '#ffff00' },
      2048: { bg: '#3a0a3a', fg: '#ff00ff', glow: '#ff00ff' },
    };
  }

  start() { this.running = true; this.reset(); document.addEventListener('keydown', this.boundKeyDown); this.canvas.addEventListener('touchstart', this.boundTouchStart); this.canvas.addEventListener('touchend', this.boundTouchEnd); this.loop(); }
  destroy() { this.running = false; document.removeEventListener('keydown', this.boundKeyDown); this.canvas.removeEventListener('touchstart', this.boundTouchStart); this.canvas.removeEventListener('touchend', this.boundTouchEnd); if (this.rafId) cancelAnimationFrame(this.rafId); }

  reset() {
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(0));
    this.score = 0; this.gameOver = false; this.won = false; this.keepPlaying = false;
    this.addRandom(); this.addRandom(); window.updateScore(0);
  }

  addRandom() {
    const empty = [];
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) if (this.grid[r][c] === 0) empty.push({ r, c });
    if (!empty.length) return;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }

  slide(row) {
    let arr = row.filter(v => v !== 0), score = 0, merged = false;
    for (let i = 0; i < arr.length - 1; i++) { if (arr[i] === arr[i + 1]) { arr[i] *= 2; score += arr[i]; arr.splice(i + 1, 1); merged = true; } }
    while (arr.length < this.size) arr.push(0);
    return { result: arr, score, moved: JSON.stringify(arr) !== JSON.stringify(row), merged };
  }

  move(dir) {
    if (this.gameOver) return;
    let moved = false, totalScore = 0, anyMerged = false;
    const g = this.grid.map(r => [...r]);
    const process = (arr, rev = false) => {
      let a = rev ? [...arr].reverse() : [...arr];
      const { result, score, moved: m, merged } = this.slide(a);
      if (rev) result.reverse(); totalScore += score; if (m) moved = true; if (merged) anyMerged = true;
      return result;
    };
    if (dir === 'left') { for (let r = 0; r < this.size; r++) this.grid[r] = process(g[r]); }
    else if (dir === 'right') { for (let r = 0; r < this.size; r++) this.grid[r] = process(g[r], true); }
    else if (dir === 'up') { for (let c = 0; c < this.size; c++) { const col = [g[0][c], g[1][c], g[2][c], g[3][c]]; const res = process(col); for (let r = 0; r < this.size; r++) this.grid[r][c] = res[r]; } }
    else if (dir === 'down') { for (let c = 0; c < this.size; c++) { const col = [g[3][c], g[2][c], g[1][c], g[0][c]]; const res = process(col, true).reverse(); for (let r = 0; r < this.size; r++) this.grid[r][c] = res[r]; } }

    if (moved) {
      this.score += totalScore; this.addRandom(); window.updateScore(this.score);
      if (anyMerged) { window.audioManager.playMerge(); this.shake.trigger(4, 100); this.addMergeParticles(); }
      if (!this.won && !this.keepPlaying) { for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) if (this.grid[r][c] === 2048) this.won = true; }
      if (!this.canMove()) { this.gameOver = true; window.audioManager.playGameOver(); window.gameStorage.setHighScore('game2048', this.score); }
    }
  }

  addMergeParticles() {
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) {
      const val = this.grid[r][c];
      if (val >= 8) this.particles.emit(this.offsetX + c * (this.cell + this.gap) + this.cell / 2, this.offsetY + r * (this.cell + this.gap) + this.cell / 2, 5, ['#00ffff','#ff00ff','#ffff00','#fff'], [30, 80], [0.2, 0.4]);
    }
  }

  canMove() {
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) {
      if (this.grid[r][c] === 0) return true;
      if (c < this.size - 1 && this.grid[r][c] === this.grid[r][c + 1]) return true;
      if (r < this.size - 1 && this.grid[r][c] === this.grid[r + 1][c]) return true;
    }
    return false;
  }

  onKeyDown(e) {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if (e.key === 'Escape') { exitGame(); return; }
    if (e.key === 'r') { this.reset(); return; }
    if (this.won && !this.keepPlaying) { if (e.key === 'Enter') this.keepPlaying = true; return; }
    if (this.gameOver) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') this.move('left');
    else if (e.key === 'ArrowRight' || e.key === 'd') this.move('right');
    else if (e.key === 'ArrowUp' || e.key === 'w') this.move('up');
    else if (e.key === 'ArrowDown' || e.key === 's') this.move('down');
  }

  onTouchStart(e) { this.touchStartX = e.touches[0].clientX; this.touchStartY = e.touches[0].clientY; }
  onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - this.touchStartX, dy = e.changedTouches[0].clientY - this.touchStartY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
    if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 'right' : 'left');
    else this.move(dy > 0 ? 'down' : 'up');
  }

  draw() {
    const c = this.ctx, W = this.W, H = this.H;
    VFX.backgroundGradient(c, W, H, '#0a0015', '#150030');
    VFX.starfield(c, W, H, this.stars, this.frame * 0.01);

    c.save(); this.shake.apply(c);

    const gridW = this.size * (this.cell + this.gap) + this.gap;
    VFX.drawNeonRect(c, this.offsetX - 14, this.offsetY - 14, gridW + 28, gridW + 28, '#ff00ff', 14, 1.5);

    for (let r = 0; r < this.size; r++) for (let col = 0; col < this.size; col++) {
      const x = this.offsetX + col * (this.cell + this.gap), y = this.offsetY + r * (this.cell + this.gap);
      c.fillStyle = 'rgba(255,255,255,0.02)'; c.beginPath(); c.roundRect(x, y, this.cell, this.cell, 6); c.fill();
    }

    for (let r = 0; r < this.size; r++) for (let col = 0; col < this.size; col++) {
      const val = this.grid[r][col]; if (val === 0) continue;
      const t = this.TILES[val] || { bg: '#1a1a2e', fg: '#fff', glow: '#fff' };
      const x = this.offsetX + col * (this.cell + this.gap), y = this.offsetY + r * (this.cell + this.gap);
      if (val >= 128) VFX.radialGlow(c, x + this.cell / 2, y + this.cell / 2, this.cell, t.glow, 0.2);
      c.save(); c.shadowColor = t.glow; c.shadowBlur = val >= 128 ? 15 : 8;
      c.fillStyle = t.bg; c.beginPath(); c.roundRect(x, y, this.cell, this.cell, 8); c.fill();
      VFX.drawNeonRect(c, x, y, this.cell, this.cell, t.glow, 8, 1);
      c.restore();
      c.fillStyle = t.fg;
      c.font = `bold ${val >= 1024 ? 26 : val >= 128 ? 32 : 40}px 'Courier New', monospace`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = t.glow; c.shadowBlur = 10;
      c.fillText(val, x + this.cell / 2, y + this.cell / 2);
      c.shadowBlur = 0;
    }

    this.particles.draw(c);

    const panelY = this.offsetY + gridW + 20;
    VFX.panel(c, this.offsetX, panelY, gridW, 55, { bg: 'rgba(0,0,20,0.6)', border: 'rgba(0,255,255,0.15)', radius: 8 });
    VFX.drawLEDText(`${this.score}`, this.offsetX + 60, panelY + 18, '#00ffff', 20);
    VFX.glowText(c, 'SCORE', this.offsetX + 15, panelY + 18, { font: '10px monospace', color: '#888', align: 'left' });
    VFX.glowText(c, `BEST: ${Math.max(parseInt(window.gameStorage.getHighScore('game2048') || '0'), this.score)}`, this.offsetX + 140, panelY + 18, { font: '12px monospace', color: '#ffff00', align: 'left' });
    VFX.glowText(c, 'R = NEW  |  ESC = MENU  |  ARROWS/SWIPE', this.offsetX + 15, panelY + 40, { font: '10px monospace', color: '#444', align: 'left' });

    if (this.won && !this.keepPlaying) {
      c.fillStyle = 'rgba(10,0,21,0.7)'; c.fillRect(0, 0, W, H);
      VFX.drawNeonRect(c, W / 2 - 180, H / 2 - 70, 360, 140, '#ffff00', 12, 2);
      VFX.drawLEDText('YOU WIN!', W / 2, H / 2 - 15, '#ffff00', 48);
      VFX.glowText(c, 'ENTER TO KEEP PLAYING  |  R = NEW', W / 2, H / 2 + 35, { font: '12px monospace', color: '#888' });
    }

    if (this.gameOver) {
      c.fillStyle = 'rgba(10,0,21,0.8)'; c.fillRect(0, 0, W, H);
      VFX.drawNeonRect(c, W / 2 - 180, H / 2 - 70, 360, 140, '#ff3366', 12, 2);
      VFX.drawLEDText('GAME OVER', W / 2, H / 2 - 15, '#ff3366', 42);
      VFX.glowText(c, `SCORE: ${this.score}  |  R = NEW  |  ESC = MENU`, W / 2, H / 2 + 35, { font: '12px monospace', color: '#888' });
    }

    VFX.drawCRTEffect(c, W, H, 0.15);
    c.restore();
  }

  loop() {
    if (!this.running) return;
    this.frame++; this.particles.update(1 / 60); this.shake.update(16); this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
