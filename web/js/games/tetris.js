class TetrisGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.cols = 10; this.rows = 20;
    this.cell = Math.min(Math.floor((this.H - 80) / this.rows), Math.floor((this.W * 0.5) / this.cols));
    this.offsetX = (this.W - this.cols * this.cell) / 2 - 80;
    this.offsetY = (this.H - this.rows * this.cell) / 2;
    this.running = false; this.frame = 0;
    this.board = []; this.score = 0; this.level = 1; this.lines = 0;
    this.piece = null; this.nextPiece = null; this.holdPiece = null;
    this.bag = []; this.queue = []; this.combo = -1; this.backToBack = false;
    this.canHold = true; this.gameOver = false; this.paused = false;
    this.dropTimer = 0; this.dropInterval = 500; this.lastTime = 0;
    this.lockDelay = 500; this.lockTimer = 0;
    this.clearingRows = []; this.clearAnim = 0;
    this.glitchTimer = 0;
    this.particles = new VFX.particles();
    this.shake = new VFX.screenShake();
    this.stars = VFX.generateStars(40);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.rafId = null;
    this.PIECES = {
      I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#00ffff' },
      O: { shape: [[1,1],[1,1]], color: '#ffff00' },
      T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: '#aa00ff' },
      S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: '#00ff88' },
      Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: '#ff3366' },
      J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: '#0088ff' },
      L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: '#ff8800' },
    };
  }

  start() { this.running = true; this.reset(); document.addEventListener('keydown', this.boundKeyDown); this.lastTime = performance.now(); this.loop(); }
  destroy() { this.running = false; document.removeEventListener('keydown', this.boundKeyDown); if (this.rafId) cancelAnimationFrame(this.rafId); }

  reset() {
    this.board = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.score = 0; this.level = 1; this.lines = 0;
    this.piece = null; this.nextPiece = null; this.holdPiece = null;
    this.bag = []; this.queue = []; this.combo = -1; this.backToBack = false;
    this.canHold = true; this.gameOver = false; this.paused = false;
    this.dropInterval = 500; this.clearingRows = []; this.clearAnim = 0;
    this.particles = new VFX.particles();
    while (this.queue.length < 5) this.queue.push(this.randomPiece());
    this.spawnPiece();
    window.updateScore(0);
  }

  randomPiece() {
    if (this.bag.length === 0) {
      this.bag = Object.keys(this.PIECES);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    const key = this.bag.pop();
    const p = this.PIECES[key];
    return { shape: p.shape.map(r => [...r]), color: p.color, key };
  }

  spawnPiece() {
    while (this.queue.length < 5) this.queue.push(this.randomPiece());
    this.piece = this.queue.shift();
    this.nextPiece = this.queue[0];
    while (this.queue.length < 5) this.queue.push(this.randomPiece());
    this.piece.x = Math.floor((this.cols - this.piece.shape[0].length) / 2);
    this.piece.y = 0; this.canHold = true; this.lockTimer = 0;
    if (this.collides(this.piece.shape, this.piece.x, this.piece.y)) {
      this.gameOver = true; window.audioManager.playGameOver();
      window.gameStorage.setHighScore('tetris', this.score);
    }
  }

  collides(shape, px, py) {
    for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) { const x = px + c, y = py + r; if (x < 0 || x >= this.cols || y >= this.rows) return true; if (y >= 0 && this.board[y][x]) return true; }
    return false;
  }

  rotate(shape) {
    const n = shape.length; const rot = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) rot[c][n - 1 - r] = shape[r][c];
    return rot;
  }

  lock() {
    const shape = this.piece.shape;
    for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) { const y = this.piece.y + r, x = this.piece.x + c; if (y >= 0) this.board[y][x] = this.piece.color; }
    window.audioManager.playDrop(); this.clearLines();
  }

  clearLines() {
    const full = [];
    for (let r = 0; r < this.rows; r++) if (this.board[r].every(c => c !== null)) full.push(r);
    if (full.length === 0) { this.combo = -1; this.spawnPiece(); return; }
    this.clearingRows = full; this.clearAnim = 12;
    const pts = [0, 100, 300, 500, 800];
    const isTetris = full.length >= 4;
    this.combo++;
    let lineScore = (pts[full.length] || 800) * this.level;
    if (this.combo > 0) lineScore += this.combo * 50 * this.level;
    if (isTetris && this.backToBack) lineScore = Math.floor(lineScore * 1.5);
    this.score += lineScore;
    if (full.length > 0) this.backToBack = isTetris;
    this.lines += full.length; this.level = Math.min(1 + Math.floor(this.lines / 10), 15);
    this.dropInterval = Math.max(50, 500 - (this.level - 1) * 30);
    window.updateScore(this.score); window.audioManager.playLineClear();
    if (full.length >= 4) { this.shake.trigger(10, 300); this.glitchTimer = 15; }
    full.forEach(r => { for (let col = 0; col < this.cols; col++) this.particles.emit(this.offsetX + col * this.cell + this.cell / 2, this.offsetY + r * this.cell + this.cell / 2, 5, ['#00ffff','#ff00ff','#ffff00','#fff']); });
  }

  finishClear() {
    this.clearingRows.sort((a, b) => b - a).forEach(r => { this.board.splice(r, 1); this.board.unshift(Array(this.cols).fill(null)); });
    this.clearingRows = []; this.spawnPiece();
  }

  hold() {
    if (!this.canHold) return; this.canHold = false;
    if (this.holdPiece) { const tmp = this.holdPiece; this.holdPiece = { ...this.piece, shape: this.piece.shape.map(r => [...r]) }; this.piece = { ...tmp, shape: tmp.shape.map(r => [...r]) }; this.piece.x = Math.floor((this.cols - this.piece.shape[0].length) / 2); this.piece.y = 0; }
    else { this.holdPiece = { ...this.piece, shape: this.piece.shape.map(r => [...r]) }; this.spawnPiece(); this.canHold = false; }
    window.audioManager.playRotate();
  }

  hardDrop() {
    while (!this.collides(this.piece.shape, this.piece.x, this.piece.y + 1)) { this.piece.y++; this.score += 2; }
    for (let c = 0; c < this.piece.shape[0].length; c++) { if (this.piece.shape[0][c]) this.particles.emit(this.offsetX + (this.piece.x + c) * this.cell + this.cell / 2, this.offsetY + this.piece.y * this.cell, 4, [this.piece.color, '#fff']); }
    this.lock(); window.updateScore(this.score);
  }

  onKeyDown(e) {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if (this.gameOver) { if (e.key === 'r') { this.reset(); return; } if (e.key === 'Escape') { exitGame(); return; } }
    if (e.key === 'p') { this.paused = !this.paused; return; }
    if (e.key === 'Escape') { exitGame(); return; }
    if (this.paused || this.gameOver) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') { if (!this.collides(this.piece.shape, this.piece.x - 1, this.piece.y)) this.piece.x--; window.audioManager.playMove(); }
    else if (e.key === 'ArrowRight' || e.key === 'd') { if (!this.collides(this.piece.shape, this.piece.x + 1, this.piece.y)) this.piece.x++; window.audioManager.playMove(); }
    else if (e.key === 'ArrowDown' || e.key === 's') { if (!this.collides(this.piece.shape, this.piece.x, this.piece.y + 1)) { this.piece.y++; this.score++; } window.updateScore(this.score); }
    else if (e.key === 'ArrowUp' || e.key === 'w') {
      const rot = this.rotate(this.piece.shape);
      if (!this.collides(rot, this.piece.x, this.piece.y)) { this.piece.shape = rot; window.audioManager.playRotate(); }
      else if (!this.collides(rot, this.piece.x - 1, this.piece.y)) { this.piece.shape = rot; this.piece.x--; window.audioManager.playRotate(); }
      else if (!this.collides(rot, this.piece.x + 1, this.piece.y)) { this.piece.shape = rot; this.piece.x++; window.audioManager.playRotate(); }
    } else if (e.key === ' ') { e.preventDefault(); this.hardDrop(); }
    else if (e.key === 'c') this.hold();
  }

  update(dt) {
    this.shake.update(dt); this.particles.update(dt / 1000);
    if (this.glitchTimer > 0) this.glitchTimer--;
    if (this.gameOver || this.paused) return;
    if (this.clearingRows.length > 0) { this.clearAnim--; if (this.clearAnim <= 0) this.finishClear(); return; }
    this.dropTimer += dt;
    const onGround = this.collides(this.piece.shape, this.piece.x, this.piece.y + 1);
    if (onGround) { this.lockTimer += dt; if (this.lockTimer >= this.lockDelay) { this.lock(); this.lockTimer = 0; } }
    else { this.lockTimer = 0; if (this.dropTimer >= this.dropInterval) { this.dropTimer = 0; this.piece.y++; } }
  }

  draw() {
    const c = this.ctx, W = this.W, H = this.H;
    VFX.backgroundGradient(c, W, H, '#0a0015', '#150030');
    VFX.starfield(c, W, H, this.stars, this.frame * 0.01);

    c.save(); this.shake.apply(c);

    // Board neon border
    VFX.drawNeonRect(c, this.offsetX - 8, this.offsetY - 8, this.cols * this.cell + 16, this.rows * this.cell + 16, '#00ffff', 6, 1.5);

    // Grid
    c.strokeStyle = 'rgba(0,255,255,0.03)'; c.lineWidth = 0.5;
    for (let x = 0; x <= this.cols; x++) { c.beginPath(); c.moveTo(this.offsetX + x * this.cell, this.offsetY); c.lineTo(this.offsetX + x * this.cell, this.offsetY + this.rows * this.cell); c.stroke(); }
    for (let y = 0; y <= this.rows; y++) { c.beginPath(); c.moveTo(this.offsetX, this.offsetY + y * this.cell); c.lineTo(this.offsetX + this.cols * this.cell, this.offsetY + y * this.cell); c.stroke(); }

    // Placed blocks
    for (let r = 0; r < this.rows; r++) for (let col = 0; col < this.cols; col++)
      if (this.board[r][col]) {
        const isClearing = this.clearingRows.includes(r);
        if (isClearing && this.clearAnim > 0) { c.fillStyle = `rgba(0,255,255,${this.clearAnim / 12})`; c.fillRect(this.offsetX + col * this.cell + 1, this.offsetY + r * this.cell + 1, this.cell - 2, this.cell - 2); }
        else {
          const bx = this.offsetX + col * this.cell + 1, by = this.offsetY + r * this.cell + 1;
          VFX.drawBlock3D(c, bx, by, this.cell - 2, this.cell - 2, this.board[r][col], 4);
        }
      }

    // Ghost
    if (this.piece && !this.gameOver) {
      let ghostY = this.piece.y;
      while (!this.collides(this.piece.shape, this.piece.x, ghostY + 1)) ghostY++;
      this.piece.shape.forEach((row, r) => row.forEach((cell, col) => {
        if (cell) {
          c.save(); c.globalAlpha = 0.25 + 0.1 * Math.sin(this.frame * 0.1);
          VFX.drawNeonRect(c, this.offsetX + (this.piece.x + col) * this.cell + 1, this.offsetY + (ghostY + r) * this.cell + 1, this.cell - 2, this.cell - 2, this.piece.color, 3, 1);
          c.restore();
        }
      }));
    }

    // Current piece
    if (this.piece && !this.gameOver) {
      this.piece.shape.forEach((row, r) => row.forEach((cell, col) => {
        if (cell) {
          const bx = this.offsetX + (this.piece.x + col) * this.cell + 1, by = this.offsetY + (this.piece.y + r) * this.cell + 1;
          VFX.drawBlock3D(c, bx, by, this.cell - 2, this.cell - 2, this.piece.color, 4);
        }
      }));
    }

    this.particles.draw(c);

    // Side panel
    const panelX = this.offsetX + this.cols * this.cell + 30;
    VFX.panel(c, panelX - 10, 20, 210, H - 40, { bg: 'rgba(0,0,20,0.6)', border: 'rgba(0,255,255,0.12)', radius: 10 });

    VFX.glowText(c, 'NEXT', panelX, 50, { font: 'bold 13px monospace', color: '#00ffff', align: 'left' });
    this.queue.slice(0, 3).forEach((piece, i) => {
      const y0 = 60 + i * 52;
      piece.shape.forEach((row, r) => row.forEach((cell, col) => {
        if (cell) { c.save(); c.globalAlpha = i === 0 ? 1 : 0.65; VFX.drawBlock3D(c, panelX + col * 16, y0 + r * 16, 14, 14, piece.color, 3); c.restore(); }
      }));
    });

    VFX.glowText(c, 'HOLD', panelX, 225, { font: 'bold 13px monospace', color: this.canHold ? '#ff00ff' : '#444', align: 'left' });
    if (this.holdPiece) this.holdPiece.shape.forEach((row, r) => row.forEach((cell, col) => {
      if (cell) { c.save(); c.globalAlpha = this.canHold ? 1 : 0.3; VFX.drawBlock3D(c, panelX + col * 18, 235 + r * 18, 16, 16, this.holdPiece.color, 3); c.restore(); }
    }));

    VFX.drawLEDText(c, `${this.score}`, panelX + 95, 330, '#00ffff', 22);
    VFX.glowText(c, 'SCORE', panelX, 330, { font: '11px monospace', color: '#888', align: 'left' });
    VFX.glowText(c, `LEVEL: ${this.level}`, panelX, 355, { font: '13px monospace', color: '#ff00ff', align: 'left' });
    VFX.glowText(c, `LINES: ${this.lines}`, panelX, 375, { font: '13px monospace', color: '#ffff00', align: 'left' });
    if (this.combo > 0) VFX.glowText(c, `COMBO x${this.combo + 1}`, panelX, 395, { font: '12px monospace', color: '#00ff88', align: 'left' });
    if (this.backToBack) VFX.glowText(c, 'BACK-TO-BACK', panelX, 415, { font: '11px monospace', color: '#ff3366', align: 'left' });
    VFX.glowText(c, `HIGH: ${window.gameStorage.getHighScore('tetris')}`, panelX, 435, { font: '11px monospace', color: '#666', align: 'left' });

    ['← → MOVE', '↑ ROTATE', '↓ SOFT DROP', 'SPACE HARD', 'C HOLD', 'P PAUSE'].forEach((t, i) => {
      VFX.glowText(c, t, panelX, 465 + i * 18, { font: '10px monospace', color: '#444', align: 'left' });
    });

    if (this.paused) {
      c.fillStyle = 'rgba(10,0,21,0.7)'; c.fillRect(0, 0, W, H);
      VFX.drawNeonRect(c, W / 2 - 150, H / 2 - 40, 300, 80, '#ff00ff', 12, 2);
      VFX.drawLEDText(c, 'PAUSED', W / 2, H / 2, '#ff00ff', 36);
    }

    if (this.gameOver) {
      c.fillStyle = 'rgba(10,0,21,0.8)'; c.fillRect(0, 0, W, H);
      VFX.drawNeonRect(c, W / 2 - 180, H / 2 - 80, 360, 160, '#ff3366', 12, 2);
      VFX.drawLEDText(c, 'GAME OVER', W / 2, H / 2 - 30, '#ff3366', 38);
      VFX.drawLEDText(c, `SCORE: ${this.score}`, W / 2, H / 2 + 15, '#00ffff', 22);
      VFX.glowText(c, 'R = RESTART  |  ESC = MENU', W / 2, H / 2 + 55, { font: '12px monospace', color: '#666' });
    }

    if (this.glitchTimer > 0) VFX.drawGlitch(c, W, H, 0.5);
    VFX.drawCRTEffect(c, W, H, 0.15);
    c.restore();
  }

  loop() {
    if (!this.running) return;
    const now = performance.now(); const dt = now - this.lastTime; this.lastTime = now;
    this.frame++; this.update(dt); this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
