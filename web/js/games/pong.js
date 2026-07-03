class PongGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = 800;
    this.canvas.height = 400;
    this.running = false;
    this.frame = 0;
    this.state = 'menu'; // menu, playing, paused, gameover
    this.vsAI = true;
    this.scoreToWin = 7;
    this.paddleW = 12; this.paddleH = 70;
    this.ballSize = 10;
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.keys = {};
    this.rafId = null;
    this.reset();
  }

  reset() {
    this.p1 = { x: 20, y: this.canvas.height / 2 - this.paddleH / 2, score: 0, vy: 0 };
    this.p2 = { x: this.canvas.width - 32, y: this.canvas.height / 2 - this.paddleH / 2, score: 0, vy: 0 };
    this.ball = { x: this.canvas.width / 2, y: this.canvas.height / 2, vx: 4 * (Math.random() > 0.5 ? 1 : -1), vy: 2 * (Math.random() > 0.5 ? 1 : -1), speed: 4 };
    this.particles = [];
    this.trail = [];
    this.state = 'playing';
    this.vsAI = true;
    window.updateScore('0-0');
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
      if (e.key === '1') { this.vsAI = true; this.reset(); }
      if (e.key === '2') { this.vsAI = false; this.reset(); }
    }
    if (e.key === 'p' || e.key === 'P') this.state = this.state === 'paused' ? 'playing' : 'paused';
    if (e.key === 'Escape') exitGame();
    if (this.state === 'gameover' && (e.key === 'r' || e.key === 'R')) this.reset();
  }

  onKeyUp(e) { this.keys[e.key] = false; }

  update() {
    if (this.state !== 'playing') return;
    const W = this.canvas.width, H = this.canvas.height;

    // Paddle movement
    const speed = 6;
    if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) this.p1.y = Math.max(0, this.p1.y - speed);
    if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) this.p1.y = Math.min(H - this.paddleH, this.p1.y + speed);

    if (this.vsAI) {
      const target = this.ball.y - this.paddleH / 2;
      const diff = target - this.p2.y;
      this.p2.y += Math.max(-4, Math.min(4, diff));
    } else {
      if (this.keys['ArrowUp']) this.p2.y = Math.max(0, this.p2.y - speed);
      if (this.keys['ArrowDown']) this.p2.y = Math.min(H - this.paddleH, this.p2.y + speed);
    }

    // Ball trail
    this.trail.push({ x: this.ball.x, y: this.ball.y, t: this.frame });
    if (this.trail.length > 10) this.trail.shift();

    // Ball movement
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;

    // Wall bounce
    if (this.ball.y <= 0 || this.ball.y >= H - this.ballSize) {
      this.ball.vy *= -1;
      this.ball.y = Math.max(0, Math.min(H - this.ballSize, this.ball.y));
      window.audioManager.playBounce();
    }

    // Paddle collision
    const bx = this.ball.x, by = this.ball.y;
    if (bx <= this.p1.x + this.paddleW && by + this.ballSize >= this.p1.y && by <= this.p1.y + this.paddleH && this.ball.vx < 0) {
      this.ball.vx *= -1.05;
      const hitPos = (by + this.ballSize / 2 - this.p1.y) / this.paddleH;
      this.ball.vy = (hitPos - 0.5) * 8;
      this.ball.speed = Math.min(10, this.ball.speed + 0.2);
      window.audioManager.playHit();
      this.addParticles(this.p1.x + this.paddleW, by + this.ballSize / 2, '#0f0', 8);
    }
    if (bx + this.ballSize >= this.p2.x && by + this.ballSize >= this.p2.y && by <= this.p2.y + this.paddleH && this.ball.vx > 0) {
      this.ball.vx *= -1.05;
      const hitPos = (by + this.ballSize / 2 - this.p2.y) / this.paddleH;
      this.ball.vy = (hitPos - 0.5) * 8;
      this.ball.speed = Math.min(10, this.ball.speed + 0.2);
      window.audioManager.playHit();
      this.addParticles(this.p2.x, by + this.ballSize / 2, '#f0f', 8);
    }

    // Score
    if (bx < 0) {
      this.p2.score++;
      window.audioManager.playGameOver();
      if (this.p2.score >= this.scoreToWin) { this.state = 'gameover'; window.gameStorage.setHighScore('pong', this.p1.score * 100); }
      else this.resetBall(1);
      window.updateScore(`${this.p1.score}-${this.p2.score}`);
    }
    if (bx > W) {
      this.p1.score++;
      window.audioManager.playScore();
      if (this.p1.score >= this.scoreToWin) { this.state = 'gameover'; window.gameStorage.setHighScore('pong', this.p1.score * 100); }
      else this.resetBall(-1);
      window.updateScore(`${this.p1.score}-${this.p2.score}`);
    }

    this.particles = this.particles.filter(p => { p.life -= 0.02; return p.life > 0; });
  }

  resetBall(dir) {
    this.ball.x = this.canvas.width / 2;
    this.ball.y = this.canvas.height / 2;
    this.ball.speed = 4;
    this.ball.vx = this.ball.speed * dir;
    this.ball.vy = 2 * (Math.random() > 0.5 ? 1 : -1);
    this.trail = [];
  }

  addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x, y, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3,
        life: 1, color, size: 2 + Math.random() * 2
      });
    }
  }

  draw() {
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    c.fillStyle = '#0a0a1a';
    c.fillRect(0, 0, W, H);

    // Center line
    c.setLineDash([8, 8]);
    c.strokeStyle = '#333';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke();
    c.setLineDash([]);

    if (this.state === 'menu') {
      c.textAlign = 'center';
      c.fillStyle = '#e040fb';
      c.font = 'bold 48px sans-serif';
      c.fillText('PONG', W / 2, H / 2 - 60);
      c.fillStyle = '#fff';
      c.font = '20px sans-serif';
      c.fillText('Press 1 for vs AI', W / 2, H / 2);
      c.fillText('Press 2 for 2 Players', W / 2, H / 2 + 35);
      c.fillStyle = '#888';
      c.font = '14px sans-serif';
      c.fillText('P1: W/S  |  P2: ↑/↓', W / 2, H / 2 + 80);
      return;
    }

    // Trail
    this.trail.forEach((t, i) => {
      const alpha = (i + 1) / this.trail.length * 0.3;
      c.fillStyle = `rgba(255,255,255,${alpha})`;
      c.beginPath(); c.arc(t.x + this.ballSize / 2, t.y + this.ballSize / 2, this.ballSize / 2 * (i / this.trail.length), 0, Math.PI * 2); c.fill();
    });

    // Ball
    c.fillStyle = '#fff';
    c.shadowColor = '#fff';
    c.shadowBlur = 15;
    c.beginPath();
    c.arc(this.ball.x + this.ballSize / 2, this.ball.y + this.ballSize / 2, this.ballSize / 2, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;

    // Paddles
    c.fillStyle = '#0f0';
    c.fillRect(this.p1.x, this.p1.y, this.paddleW, this.paddleH);
    c.fillStyle = '#f0f';
    c.fillRect(this.p2.x, this.p2.y, this.paddleW, this.paddleH);

    // Particles
    this.particles.forEach(p => {
      c.globalAlpha = p.life;
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill();
    });
    c.globalAlpha = 1;

    // Score
    c.textAlign = 'center';
    c.fillStyle = '#fff';
    c.font = 'bold 48px sans-serif';
    c.fillText(this.p1.score, W / 4, 60);
    c.fillText(this.p2.score, W * 3 / 4, 60);

    c.fillStyle = '#888';
    c.font = '12px sans-serif';
    c.fillText('P1 (W/S)', W / 4, 80);
    c.fillText(this.vsAI ? 'CPU' : 'P2 (↑/↓)', W * 3 / 4, 80);

    if (this.state === 'paused') {
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(0, 0, W, H);
      c.textAlign = 'center';
      c.fillStyle = '#fff';
      c.font = 'bold 40px sans-serif';
      c.fillText('PAUSED', W / 2, H / 2);
    }

    if (this.state === 'gameover') {
      c.fillStyle = 'rgba(0,0,0,0.7)';
      c.fillRect(0, 0, W, H);
      c.textAlign = 'center';
      const winner = this.p1.score >= this.scoreToWin ? 'P1 WINS!' : (this.vsAI ? 'CPU WINS!' : 'P2 WINS!');
      c.fillStyle = '#ff0';
      c.font = 'bold 44px sans-serif';
      c.fillText(winner, W / 2, H / 2 - 20);
      c.fillStyle = '#888';
      c.font = '16px sans-serif';
      c.fillText('R = Restart  |  ESC = Menu', W / 2, H / 2 + 30);
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
