class PongGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.running = false; this.frame = 0;
    this.state = 'menu'; this.vsAI = true; this.scoreToWin = 7;
    this.serveTimer = 0; this.lastScorer = 0;
    this.paddleW = 14; this.paddleH = Math.min(96, this.H * 0.22);
    this.ballSize = 12;
    this.particles = new VFX.particles();
    this.shake = new VFX.screenShake();
    this.stars = VFX.generateStars(50);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.keys = {}; this.rafId = null;
    this.reset();
  }

  reset() {
    this.p1 = { x: 30, y: this.H / 2 - this.paddleH / 2, score: 0, color: '#00ffff' };
    this.p2 = { x: this.W - 44, y: this.H / 2 - this.paddleH / 2, score: 0, color: '#ff00ff' };
    this.ball = { x: this.W / 2, y: this.H / 2, vx: 3.8 * (Math.random() > 0.5 ? 1 : -1), vy: 2.2 * (Math.random() > 0.5 ? 1 : -1), speed: 3.8 };
    this.serveTimer = 70; this.lastScorer = 0;
    this.trail = []; this.state = 'playing';
    window.updateScore('0-0');
  }

  start() { this.running = true; this.state = 'menu'; document.addEventListener('keydown', this.boundKeyDown); document.addEventListener('keyup', this.boundKeyUp); this.loop(); }
  destroy() { this.running = false; document.removeEventListener('keydown', this.boundKeyDown); document.removeEventListener('keyup', this.boundKeyUp); if (this.rafId) cancelAnimationFrame(this.rafId); }

  onKeyDown(e) {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    this.keys[e.key] = true;
    if (this.state === 'menu') { if (e.key === '1') { this.vsAI = true; this.reset(); } if (e.key === '2') { this.vsAI = false; this.reset(); } }
    if (e.key === 'p') this.state = this.state === 'paused' ? 'playing' : 'paused';
    if (e.key === 'Escape') exitGame();
    if (this.state === 'gameover' && e.key === 'r') this.reset();
  }

  onKeyUp(e) { this.keys[e.key] = false; }

  update(dt) {
    if (this.state !== 'playing') return;
    this.shake.update(dt);
    const speed = 7.4;
    if (this.keys['w'] || (this.vsAI && this.keys['ArrowUp'])) this.p1.y = Math.max(0, this.p1.y - speed);
    if (this.keys['s'] || (this.vsAI && this.keys['ArrowDown'])) this.p1.y = Math.min(this.H - this.paddleH, this.p1.y + speed);
    if (this.vsAI) {
      const lead = this.ball.vx > 0 ? Math.max(-45, Math.min(45, this.ball.vy * 5)) : 0;
      const error = Math.sin(this.frame * 0.025) * (34 - Math.min(16, (this.p1.score + this.p2.score) * 1.5));
      const t = this.ball.y + lead + error - this.paddleH / 2;
      const aiSpeed = 2.8 + Math.min(2.8, Math.abs(this.ball.vx) * 0.18) + Math.min(1.2, (this.p1.score + this.p2.score) * 0.08);
      this.p2.y += Math.max(-aiSpeed, Math.min(aiSpeed, t - this.p2.y));
      this.p2.y = Math.max(0, Math.min(this.H - this.paddleH, this.p2.y));
    }
    else { if (this.keys['ArrowUp']) this.p2.y = Math.max(0, this.p2.y - speed); if (this.keys['ArrowDown']) this.p2.y = Math.min(this.H - this.paddleH, this.p2.y + speed); }

    this.trail.push({ x: this.ball.x, y: this.ball.y, t: this.frame });
    if (this.trail.length > 12) this.trail.shift();
    if (this.serveTimer > 0) { this.serveTimer--; return; }
    this.ball.x += this.ball.vx; this.ball.y += this.ball.vy;

    if (this.ball.y <= 0 || this.ball.y >= this.H - this.ballSize) { this.ball.vy *= -1; this.ball.y = Math.max(0, Math.min(this.H - this.ballSize, this.ball.y)); window.audioManager.playBounce(); }

    const bx = this.ball.x, by = this.ball.y;
    if (bx <= this.p1.x + this.paddleW && by + this.ballSize >= this.p1.y && by <= this.p1.y + this.paddleH && this.ball.vx < 0) {
      this.ball.vx = Math.min(11.5, Math.abs(this.ball.vx) * 1.045); const hp = (by + this.ballSize / 2 - this.p1.y) / this.paddleH; this.ball.vy = (hp - 0.5) * 9.2;
      this.ball.speed = Math.min(11.5, this.ball.speed + 0.22);
      window.audioManager.playHit();
      this.particles.emit(this.p1.x + this.paddleW, by + this.ballSize / 2, 12, ['#00ffff','#fff','#00ff88']);
    }
    if (bx + this.ballSize >= this.p2.x && by + this.ballSize >= this.p2.y && by <= this.p2.y + this.paddleH && this.ball.vx > 0) {
      this.ball.vx = -Math.min(11.5, Math.abs(this.ball.vx) * 1.045); const hp = (by + this.ballSize / 2 - this.p2.y) / this.paddleH; this.ball.vy = (hp - 0.5) * 9.2;
      this.ball.speed = Math.min(11.5, this.ball.speed + 0.22);
      window.audioManager.playHit();
      this.particles.emit(this.p2.x, by + this.ballSize / 2, 12, ['#ff00ff','#fff','#ff3366']);
    }

    if (bx < 0) {
      this.lastScorer = 2;
      this.p2.score++; window.audioManager.playGameOver(); this.shake.trigger(8, 200);
      this.particles.emit(this.W / 4, this.H / 2, 30, ['#ff3366','#ff00ff','#fff'], [100, 300], [0.5, 1.0]);
      if (this.p2.score >= this.scoreToWin) { this.state = 'gameover'; window.gameStorage.setHighScore('pong', this.p1.score * 100); }
      else this.resetBall(1);
      window.updateScore(`${this.p1.score}-${this.p2.score}`);
    }
    if (bx > this.W) {
      this.lastScorer = 1;
      this.p1.score++; window.audioManager.playScore(); this.shake.trigger(6, 150);
      this.particles.emit(this.W * 3 / 4, this.H / 2, 20, ['#00ffff','#fff','#00ff88'], [80, 200], [0.3, 0.7]);
      if (this.p1.score >= this.scoreToWin) { this.state = 'gameover'; window.gameStorage.setHighScore('pong', this.p1.score * 100); }
      else this.resetBall(-1);
      window.updateScore(`${this.p1.score}-${this.p2.score}`);
    }
  }

  resetBall(dir) {
    const rallySpeed = Math.min(5.8, 3.8 + (this.p1.score + this.p2.score) * 0.22);
    this.ball = { x: this.W / 2, y: this.H / 2, speed: rallySpeed, vx: rallySpeed * dir, vy: 2.2 * (Math.random() > 0.5 ? 1 : -1) };
    this.trail = [];
    this.serveTimer = 70;
  }

  draw() {
    const c = this.ctx, W = this.W, H = this.H;
    VFX.backgroundGradient(c, W, H, '#0a0015', '#150030');
    VFX.starfield(c, W, H, this.stars, this.frame * 0.015);

    if (this.state === 'menu') {
      VFX.drawLEDText(c, 'PONG', W / 2, H / 2 - 80, '#ff00ff', 72);
      VFX.glowText(c, 'PRESS 1 FOR VS AI', W / 2, H / 2 - 10, { font: '20px monospace', color: '#00ffff' });
      VFX.glowText(c, 'PRESS 2 FOR 2 PLAYERS', W / 2, H / 2 + 25, { font: '20px monospace', color: '#ff00ff' });
      VFX.glowText(c, 'P1: W/S  |  P2: ↑/↓', W / 2, H / 2 + 70, { font: '12px monospace', color: '#555' });
      VFX.drawCRTEffect(c, W, H, 0.25);
      return;
    }

    c.save(); this.shake.apply(c);

    // Center line neon
    VFX.drawNeonLine(c, W / 2, 0, W / 2, H, '#ff00ff', 2);

    // Trail
    this.trail.forEach((t, i) => {
      const alpha = (i + 1) / this.trail.length * 0.3;
      const size = this.ballSize / 2 * (i / this.trail.length);
      c.fillStyle = `rgba(255,0,255,${alpha})`;
      c.beginPath(); c.arc(t.x + this.ballSize / 2, t.y + this.ballSize / 2, size, 0, Math.PI * 2); c.fill();
    });

    // Ball
    VFX.radialGlow(c, this.ball.x + this.ballSize / 2, this.ball.y + this.ballSize / 2, 44, '#fff', 0.28);
    VFX.drawOrb3D(c, this.ball.x + this.ballSize / 2, this.ball.y + this.ballSize / 2, this.ballSize / 2 + 2, '#ffffff', { glow: true });

    // Paddles
    [{ p: this.p1, col: this.p1.color }, { p: this.p2, col: this.p2.color }].forEach(({ p, col }) => {
      c.save(); c.shadowColor = col; c.shadowBlur = 20;
      VFX.drawMetalPanel3D(c, p.x, p.y, this.paddleW, this.paddleH, col, 6);
      VFX.drawNeonRect(c, p.x, p.y, this.paddleW, this.paddleH, col, 6, 1.5);
      c.restore();
    });

    this.particles.draw(c);

    // Score LED
    VFX.panel(c, W / 4 - 70, 15, 140, 70, { bg: 'rgba(0,0,20,0.6)', border: 'rgba(0,255,255,0.15)', radius: 8 });
    VFX.panel(c, W * 3 / 4 - 70, 15, 140, 70, { bg: 'rgba(0,0,20,0.6)', border: 'rgba(255,0,255,0.15)', radius: 8 });
    VFX.drawLEDText(c, `${this.p1.score}`, W / 4, 38, '#00ffff', 36);
    VFX.drawLEDText(c, `${this.p2.score}`, W * 3 / 4, 38, '#ff00ff', 36);
    VFX.glowText(c, 'P1', W / 4, 72, { font: '10px monospace', color: '#00ffff' });
    VFX.glowText(c, this.vsAI ? 'CPU' : 'P2', W * 3 / 4, 72, { font: '10px monospace', color: '#ff00ff' });
    if (this.serveTimer > 0 && this.state === 'playing') {
      const label = this.lastScorer === 0 ? 'READY' : `POINT P${this.lastScorer}`;
      VFX.glowText(c, label, W / 2, H / 2 - 38, { font: '18px monospace', color: '#ffff00' });
      VFX.drawLEDText(c, `${Math.ceil(this.serveTimer / 15)}`, W / 2, H / 2, '#00ffff', 52);
    }

    if (this.state === 'paused') {
      c.fillStyle = 'rgba(10,0,21,0.7)'; c.fillRect(0, 0, W, H);
      VFX.drawNeonRect(c, W / 2 - 140, H / 2 - 40, 280, 80, '#ff00ff', 12, 2);
      VFX.drawLEDText(c, 'PAUSED', W / 2, H / 2, '#ff00ff', 36);
    }

    if (this.state === 'gameover') {
      c.fillStyle = 'rgba(10,0,21,0.8)'; c.fillRect(0, 0, W, H);
      VFX.drawNeonRect(c, W / 2 - 200, H / 2 - 70, 400, 140, '#ffff00', 12, 2);
      const winner = this.p1.score >= this.scoreToWin ? 'P1 WINS!' : (this.vsAI ? 'CPU WINS!' : 'P2 WINS!');
      VFX.drawLEDText(c, winner, W / 2, H / 2 - 15, '#ffff00', 40);
      VFX.glowText(c, 'R = RESTART  |  ESC = MENU', W / 2, H / 2 + 35, { font: '12px monospace', color: '#666' });
    }

    VFX.drawCRTEffect(c, W, H, 0.2);
    c.restore();
  }

  loop() {
    if (!this.running) return;
    this.frame++; this.update(1 / 60); this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
