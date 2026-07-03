class TetrisGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = 500;
    this.canvas.height = 500;
    this.cols = 10; this.rows = 20; this.cell = 24;
    this.offsetX = 20; this.offsetY = 20;
    this.running = false; this.frame = 0;
    this.board = []; this.score = 0; this.level = 1; this.lines = 0;
    this.piece = null; this.nextPiece = null; this.holdPiece = null;
    this.canHold = true; this.gameOver = false; this.paused = false;
    this.dropTimer = 0; this.dropInterval = 500; this.lastTime = 0;
    this.lockDelay = 500; this.lockTimer = 0; this.onGround = false;
    this.clearingRows = []; this.clearAnim = 0;
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.rafId = null;
    this.PIECES = {
      I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#00e5ff' },
      O: { shape: [[1,1],[1,1]], color: '#ffeb3b' },
      T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: '#aa00ff' },
      S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: '#76ff03' },
      Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: '#ff1744' },
      J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: '#2979ff' },
      L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: '#ff9100' },
    };
  }

  start() {
    this.running = true;
    this.reset();
    document.addEventListener('keydown', this.boundKeyDown);
    this.lastTime = performance.now();
    this.loop();
  }

  destroy() {
    this.running = false;
    document.removeEventListener('keydown', this.boundKeyDown);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  reset() {
    this.board = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.score = 0; this.level = 1; this.lines = 0;
    this.piece = null; this.nextPiece = null; this.holdPiece = null;
    this.canHold = true; this.gameOver = false; this.paused = false;
    this.dropInterval = 500; this.clearingRows = []; this.clearAnim = 0;
    this.spawnPiece();
    this.nextPiece = this.randomPiece();
    window.updateScore(0);
  }

  randomPiece() {
    const keys = Object.keys(this.PIECES);
    const key = keys[Math.floor(Math.random() * keys.length)];
    const p = this.PIECES[key];
    return { shape: p.shape.map(r => [...r]), color: p.color, key };
  }

  spawnPiece() {
    this.piece = this.nextPiece || this.randomPiece();
    this.nextPiece = this.randomPiece();
    this.piece.x = Math.floor((this.cols - this.piece.shape[0].length) / 2);
    this.piece.y = 0;
    this.canHold = true;
    this.onGround = false;
    this.lockTimer = 0;
    if (this.collides(this.piece.shape, this.piece.x, this.piece.y)) {
      this.gameOver = true;
      window.audioManager.playGameOver();
      window.gameStorage.setHighScore('tetris', this.score);
      window.gameStorage.updateStats('tetris', { games: 1, lines: this.lines });
    }
  }

  collides(shape, px, py) {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) {
          const x = px + c, y = py + r;
          if (x < 0 || x >= this.cols || y >= this.rows) return true;
          if (y >= 0 && this.board[y][x]) return true;
        }
    return false;
  }

  rotate(shape) {
    const n = shape.length;
    const rotated = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        rotated[c][n - 1 - r] = shape[r][c];
    return rotated;
  }

  lock() {
    const shape = this.piece.shape;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) {
          const y = this.piece.y + r;
          const x = this.piece.x + c;
          if (y >= 0) this.board[y][x] = this.piece.color;
        }
    window.audioManager.playDrop();
    this.clearLines();
  }

  clearLines() {
    const fullRows = [];
    for (let r = 0; r < this.rows; r++)
      if (this.board[r].every(cell => cell !== null)) fullRows.push(r);

    if (fullRows.length === 0) {
      this.spawnPiece();
      return;
    }

    this.clearingRows = fullRows;
    this.clearAnim = 10;

    const linePoints = [0, 100, 300, 500, 800];
    this.score += (linePoints[fullRows.length] || 800) * this.level;
    this.lines += fullRows.length;
    this.level = Math.min(1 + Math.floor(this.lines / 10), 15);
    this.dropInterval = Math.max(50, 500 - (this.level - 1) * 30);
    window.updateScore(this.score);
    window.audioManager.playLineClear();
  }

  finishClear() {
    this.clearingRows.sort((a, b) => b - a).forEach(r => {
      this.board.splice(r, 1);
      this.board.unshift(Array(this.cols).fill(null));
    });
    this.clearingRows = [];
    this.spawnPiece();
  }

  hold() {
    if (!this.canHold) return;
    this.canHold = false;
    if (this.holdPiece) {
      const tmp = this.holdPiece;
      this.holdPiece = { ...this.piece, shape: this.piece.shape.map(r => [...r]) };
      this.piece = { ...tmp, shape: tmp.shape.map(r => [...r]) };
      this.piece.x = Math.floor((this.cols - this.piece.shape[0].length) / 2);
      this.piece.y = 0;
    } else {
      this.holdPiece = { ...this.piece, shape: this.piece.shape.map(r => [...r]) };
      this.spawnPiece();
    }
    window.audioManager.playRotate();
  }

  hardDrop() {
    while (!this.collides(this.piece.shape, this.piece.x, this.piece.y + 1)) {
      this.piece.y++;
      this.score += 2;
    }
    this.lock();
    window.updateScore(this.score);
  }

  onKeyDown(e) {
    if (this.gameOver) {
      if (e.key === 'r' || e.key === 'R') { this.reset(); return; }
      if (e.key === 'Escape') { exitGame(); return; }
    }
    if (e.key === 'p' || e.key === 'P') { this.paused = !this.paused; return; }
    if (e.key === 'Escape') { exitGame(); return; }
    if (this.paused || this.gameOver) return;

    if (e.key === 'ArrowLeft' || e.key === 'a') {
      if (!this.collides(this.piece.shape, this.piece.x - 1, this.piece.y)) this.piece.x--;
      window.audioManager.playMove();
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
      if (!this.collides(this.piece.shape, this.piece.x + 1, this.piece.y)) this.piece.x++;
      window.audioManager.playMove();
    } else if (e.key === 'ArrowDown' || e.key === 's') {
      if (!this.collides(this.piece.shape, this.piece.x, this.piece.y + 1)) { this.piece.y++; this.score++; }
      window.updateScore(this.score);
    } else if (e.key === 'ArrowUp' || e.key === 'w') {
      const rotated = this.rotate(this.piece.shape);
      if (!this.collides(rotated, this.piece.x, this.piece.y)) {
        this.piece.shape = rotated;
        window.audioManager.playRotate();
      } else if (!this.collides(rotated, this.piece.x - 1, this.piece.y)) {
        this.piece.shape = rotated; this.piece.x--;
        window.audioManager.playRotate();
      } else if (!this.collides(rotated, this.piece.x + 1, this.piece.y)) {
        this.piece.shape = rotated; this.piece.x++;
        window.audioManager.playRotate();
      }
    } else if (e.key === ' ') {
      e.preventDefault();
      this.hardDrop();
    } else if (e.key === 'c' || e.key === 'C') {
      this.hold();
    }
  }

  update(dt) {
    if (this.gameOver || this.paused) return;

    if (this.clearingRows.length > 0) {
      this.clearAnim--;
      if (this.clearAnim <= 0) this.finishClear();
      return;
    }

    this.dropTimer += dt;
    const onGround = this.collides(this.piece.shape, this.piece.x, this.piece.y + 1);
    if (onGround) {
      this.lockTimer += dt;
      if (this.lockTimer >= this.lockDelay) {
        this.lock();
        this.lockTimer = 0;
      }
    } else {
      this.lockTimer = 0;
      if (this.dropTimer >= this.dropInterval) {
        this.dropTimer = 0;
        this.piece.y++;
      }
    }
  }

  draw() {
    const c = this.ctx;
    c.fillStyle = '#0a0a1a';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Board
    c.strokeStyle = '#1a1a2a';
    c.lineWidth = 0.5;
    for (let x = 0; x <= this.cols; x++) { c.beginPath(); c.moveTo(this.offsetX + x * this.cell, this.offsetY); c.lineTo(this.offsetX + x * this.cell, this.offsetY + this.rows * this.cell); c.stroke(); }
    for (let y = 0; y <= this.rows; y++) { c.beginPath(); c.moveTo(this.offsetX, this.offsetY + y * this.cell); c.lineTo(this.offsetX + this.cols * this.cell, this.offsetY + y * this.cell); c.stroke(); }

    // Placed blocks
    for (let r = 0; r < this.rows; r++)
      for (let col = 0; col < this.cols; col++)
        if (this.board[r][col]) {
          const isClearing = this.clearingRows.includes(r);
          if (isClearing && this.clearAnim > 0) {
            c.fillStyle = `rgba(255,255,255,${this.clearAnim / 10})`;
          } else {
            c.fillStyle = this.board[r][col];
          }
          c.fillRect(this.offsetX + col * this.cell + 1, this.offsetY + r * this.cell + 1, this.cell - 2, this.cell - 2);
        }

    // Ghost piece
    if (this.piece && !this.gameOver) {
      let ghostY = this.piece.y;
      while (!this.collides(this.piece.shape, this.piece.x, ghostY + 1)) ghostY++;
      this.piece.shape.forEach((row, r) => row.forEach((cell, col) => {
        if (cell) {
          c.fillStyle = this.piece.color + '40';
          c.fillRect(this.offsetX + (this.piece.x + col) * this.cell + 1, this.offsetY + (ghostY + r) * this.cell + 1, this.cell - 2, this.cell - 2);
        }
      }));
    }

    // Current piece
    if (this.piece && !this.gameOver) {
      this.piece.shape.forEach((row, r) => row.forEach((cell, col) => {
        if (cell) {
          c.fillStyle = this.piece.color;
          c.fillRect(this.offsetX + (this.piece.x + col) * this.cell + 1, this.offsetY + (this.piece.y + r) * this.cell + 1, this.cell - 2, this.cell - 2);
        }
      }));
    }

    // Side panels
    const panelX = this.offsetX + this.cols * this.cell + 20;

    c.fillStyle = '#aaa';
    c.font = '12px sans-serif';
    c.textAlign = 'left';

    // Next
    c.fillText('NEXT', panelX, 40);
    if (this.nextPiece) {
      this.nextPiece.shape.forEach((row, r) => row.forEach((cell, col) => {
        if (cell) {
          c.fillStyle = this.nextPiece.color;
          c.fillRect(panelX + col * 18, 50 + r * 18, 16, 16);
        }
      }));
    }

    // Hold
    c.fillStyle = '#aaa';
    c.fillText('HOLD', panelX, 150);
    if (this.holdPiece) {
      this.holdPiece.shape.forEach((row, r) => row.forEach((cell, col) => {
        if (cell) {
          c.fillStyle = this.canHold ? this.holdPiece.color : '#555';
          c.fillRect(panelX + col * 18, 160 + r * 18, 16, 16);
        }
      }));
    }

    // Stats
    c.fillStyle = '#fff';
    c.font = 'bold 14px sans-serif';
    c.fillText(`Score: ${this.score}`, panelX, 260);
    c.fillText(`Level: ${this.level}`, panelX, 285);
    c.fillText(`Lines: ${this.lines}`, panelX, 310);
    c.fillStyle = '#aaa';
    c.font = '11px sans-serif';
    c.fillText(`High: ${window.gameStorage.getHighScore('tetris')}`, panelX, 335);

    // Controls
    c.fillStyle = '#666';
    c.font = '10px sans-serif';
    const ctrlY = 380;
    c.fillText('← → Move', panelX, ctrlY);
    c.fillText('↑ Rotate', panelX, ctrlY + 14);
    c.fillText('↓ Soft Drop', panelX, ctrlY + 28);
    c.fillText('Space Hard Drop', panelX, ctrlY + 42);
    c.fillText('C Hold', panelX, ctrlY + 56);
    c.fillText('P Pause', panelX, ctrlY + 70);

    // Paused
    if (this.paused) {
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      c.textAlign = 'center';
      c.fillStyle = '#fff';
      c.font = 'bold 40px sans-serif';
      c.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
      c.font = '16px sans-serif';
      c.fillStyle = '#aaa';
      c.fillText('Press P to resume', this.canvas.width / 2, this.canvas.height / 2 + 30);
    }

    // Game over
    if (this.gameOver) {
      c.fillStyle = 'rgba(0,0,0,0.7)';
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      c.textAlign = 'center';
      c.fillStyle = '#f55';
      c.font = 'bold 44px sans-serif';
      c.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 30);
      c.fillStyle = '#fff';
      c.font = '20px sans-serif';
      c.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 15);
      c.fillStyle = '#888';
      c.font = '14px sans-serif';
      c.fillText('R = Restart  |  ESC = Menu', this.canvas.width / 2, this.canvas.height / 2 + 50);
    }
  }

  loop() {
    if (!this.running) return;
    const now = performance.now();
    const dt = now - this.lastTime;
    this.lastTime = now;
    this.frame++;
    this.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
