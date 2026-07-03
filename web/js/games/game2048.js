class Game2048 {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = 440;
    this.canvas.height = 440;
    this.size = 4;
    this.cell = 100;
    this.gap = 8;
    this.offset = 20;
    this.running = false;
    this.frame = 0;
    this.score = 0;
    this.best = 0;
    this.grid = [];
    this.moving = false;
    this.gameOver = false;
    this.won = false;
    this.keepPlaying = false;
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);
    this.rafId = null;
    this.TILES = {
      2: { bg: '#eee4da', fg: '#776e65' },
      4: { bg: '#ede0c8', fg: '#776e65' },
      8: { bg: '#f2b179', fg: '#f9f6f2' },
      16: { bg: '#f59563', fg: '#f9f6f2' },
      32: { bg: '#f67c5f', fg: '#f9f6f2' },
      64: { bg: '#f65e3b', fg: '#f9f6f2' },
      128: { bg: '#edcf72', fg: '#f9f6f2' },
      256: { bg: '#edcc61', fg: '#f9f6f2' },
      512: { bg: '#edc850', fg: '#f9f6f2' },
      1024: { bg: '#edc53f', fg: '#f9f6f2' },
      2048: { bg: '#edc22e', fg: '#f9f6f2' },
    };
  }

  start() {
    this.running = true;
    this.reset();
    document.addEventListener('keydown', this.boundKeyDown);
    this.canvas.addEventListener('touchstart', this.boundTouchStart);
    this.canvas.addEventListener('touchend', this.boundTouchEnd);
    this.loop();
  }

  destroy() {
    this.running = false;
    document.removeEventListener('keydown', this.boundKeyDown);
    this.canvas.removeEventListener('touchstart', this.boundTouchStart);
    this.canvas.removeEventListener('touchend', this.boundTouchEnd);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  reset() {
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(0));
    this.score = 0;
    this.gameOver = false;
    this.won = false;
    this.keepPlaying = false;
    this.addRandom();
    this.addRandom();
    window.updateScore(0);
  }

  addRandom() {
    const empty = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++)
        if (this.grid[r][c] === 0) empty.push({ r, c });
    if (empty.length === 0) return;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }

  slide(row) {
    let arr = row.filter(v => v !== 0);
    let score = 0;
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        score += arr[i];
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < this.size) arr.push(0);
    return { result: arr, score, moved: JSON.stringify(arr) !== JSON.stringify(row) };
  }

  move(dir) {
    if (this.gameOver || this.moving) return;
    let moved = false;
    let totalScore = 0;
    const g = this.grid.map(r => [...r]);

    if (dir === 'left') {
      for (let r = 0; r < this.size; r++) {
        const { result, score, moved: m } = this.slide(g[r]);
        this.grid[r] = result;
        totalScore += score;
        if (m) moved = true;
      }
    } else if (dir === 'right') {
      for (let r = 0; r < this.size; r++) {
        const { result, score, moved: m } = this.slide([...g[r]].reverse());
        this.grid[r] = result.reverse();
        totalScore += score;
        if (m) moved = true;
      }
    } else if (dir === 'up') {
      for (let c = 0; c < this.size; c++) {
        const col = [g[0][c], g[1][c], g[2][c], g[3][c]];
        const { result, score, moved: m } = this.slide(col);
        for (let r = 0; r < this.size; r++) this.grid[r][c] = result[r];
        totalScore += score;
        if (m) moved = true;
      }
    } else if (dir === 'down') {
      for (let c = 0; c < this.size; c++) {
        const col = [g[3][c], g[2][c], g[1][c], g[0][c]];
        const { result, score, moved: m } = this.slide(col);
        const reversed = result.reverse();
        for (let r = 0; r < this.size; r++) this.grid[r][c] = reversed[r];
        totalScore += score;
        if (m) moved = true;
      }
    }

    if (moved) {
      this.score += totalScore;
      this.addRandom();
      window.updateScore(this.score);
      if (totalScore > 0) window.audioManager.playMerge();

      // Check win
      if (!this.won && !this.keepPlaying) {
        for (let r = 0; r < this.size; r++)
          for (let c = 0; c < this.size; c++)
            if (this.grid[r][c] === 2048) this.won = true;
      }

      // Check game over
      if (!this.canMove()) {
        this.gameOver = true;
        window.audioManager.playGameOver();
        window.gameStorage.setHighScore('game2048', this.score);
      }
    }
  }

  canMove() {
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0) return true;
        if (c < this.size - 1 && this.grid[r][c] === this.grid[r][c + 1]) return true;
        if (r < this.size - 1 && this.grid[r][c] === this.grid[r + 1][c]) return true;
      }
    return false;
  }

  onKeyDown(e) {
    if (e.key === 'Escape') { exitGame(); return; }
    if (e.key === 'r' || e.key === 'R') { this.reset(); return; }
    if (this.won && !this.keepPlaying) {
      if (e.key === 'Enter') this.keepPlaying = true;
      return;
    }
    if (this.gameOver) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') this.move('left');
    else if (e.key === 'ArrowRight' || e.key === 'd') this.move('right');
    else if (e.key === 'ArrowUp' || e.key === 'w') this.move('up');
    else if (e.key === 'ArrowDown' || e.key === 's') this.move('down');
  }

  onTouchStart(e) {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 30) return;
    if (absDx > absDy) this.move(dx > 0 ? 'right' : 'left');
    else this.move(dy > 0 ? 'down' : 'up');
  }

  draw() {
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    c.fillStyle = '#0a0a1a';
    c.fillRect(0, 0, W, H);

    // Grid background
    c.fillStyle = '#1a1a2a';
    c.beginPath();
    c.roundRect(this.offset - 4, this.offset - 4, this.size * (this.cell + this.gap) + this.gap + 8, this.size * (this.cell + this.gap) + this.gap + 8, 12);
    c.fill();

    // Empty cells
    for (let r = 0; r < this.size; r++)
      for (let col = 0; col < this.size; col++) {
        c.fillStyle = '#222';
        c.beginPath();
        c.roundRect(this.offset + col * (this.cell + this.gap), this.offset + r * (this.cell + this.gap), this.cell, this.cell, 8);
        c.fill();
      }

    // Tiles
    for (let r = 0; r < this.size; r++)
      for (let col = 0; col < this.size; col++) {
        const val = this.grid[r][col];
        if (val === 0) continue;
        const t = this.TILES[val] || { bg: '#3c3a32', fg: '#f9f6f2' };
        const x = this.offset + col * (this.cell + this.gap);
        const y = this.offset + r * (this.cell + this.gap);
        c.fillStyle = t.bg;
        c.beginPath();
        c.roundRect(x, y, this.cell, this.cell, 8);
        c.fill();
        c.fillStyle = t.fg;
        c.font = `bold ${val >= 1024 ? 28 : val >= 128 ? 34 : 40}px sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(val, x + this.cell / 2, y + this.cell / 2);
      }

    // Score panel
    const panelY = this.offset + this.size * (this.cell + this.gap) + 16;
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = '#fff';
    c.font = 'bold 16px sans-serif';
    c.fillText(`Score: ${this.score}`, this.offset, panelY);
    c.fillStyle = '#888';
    c.fillText(`Best: ${Math.max(this.best, this.score)}`, this.offset + 150, panelY);
    c.fillStyle = '#666';
    c.font = '12px sans-serif';
    c.fillText('R = New Game  |  ESC = Menu', this.offset, panelY + 24);
    c.fillText('Arrows / WASD / Swipe', this.offset + 220, panelY + 24);

    // Win overlay
    if (this.won && !this.keepPlaying) {
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(0, 0, W, H);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#ff0';
      c.font = 'bold 48px sans-serif';
      c.fillText('YOU WIN!', W / 2, H / 2 - 20);
      c.fillStyle = '#fff';
      c.font = '18px sans-serif';
      c.fillText('Press ENTER to keep playing', W / 2, H / 2 + 25);
      c.fillText('R = New Game  |  ESC = Menu', W / 2, H / 2 + 55);
    }

    // Game over
    if (this.gameOver) {
      c.fillStyle = 'rgba(0,0,0,0.7)';
      c.fillRect(0, 0, W, H);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#f55';
      c.font = 'bold 44px sans-serif';
      c.fillText('GAME OVER', W / 2, H / 2 - 20);
      c.fillStyle = '#fff';
      c.font = '18px sans-serif';
      c.fillText(`Score: ${this.score}`, W / 2, H / 2 + 20);
      c.fillStyle = '#888';
      c.fillText('R = New Game  |  ESC = Menu', W / 2, H / 2 + 55);
    }
  }

  loop() {
    if (!this.running) return;
    this.frame++;
    this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
