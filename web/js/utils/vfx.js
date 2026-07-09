// VFX Library - Arcade Synthwave Edition
const VFX = {
  hexToRgb(hex) {
    if (typeof hex !== 'string') return [128, 128, 128];
    if (hex.startsWith('rgb')) { const m = hex.match(/\d+/g); return m ? [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])] : [128, 128, 128]; }
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
  },

  backgroundGradient(ctx, w, h, topColor, bottomColor) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, topColor); g.addColorStop(1, bottomColor);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  },

  starfield(ctx, w, h, stars, time) {
    ctx.save();
    stars.forEach(s => {
      const twinkle = 0.5 + 0.5 * Math.sin(time * s.speed + s.phase);
      ctx.globalAlpha = twinkle * s.brightness;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  },

  generateStars(count = 80) {
    return Array.from({ length: count }, () => ({
      x: Math.random(), y: Math.random(), size: 0.5 + Math.random() * 1.5,
      speed: 0.5 + Math.random() * 2, phase: Math.random() * Math.PI * 2,
      brightness: 0.3 + Math.random() * 0.7
    }));
  },

  radialGlow(ctx, x, y, radius, color, alpha = 0.4) {
    const [r, g, b] = this.hexToRgb(color);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.3})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  },

  panel(ctx, x, y, w, h, opts = {}) {
    const { bg = 'rgba(0,0,0,0.5)', border = 'rgba(0,255,255,0.1)', radius = 12 } = opts;
    ctx.save();
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
    ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  },

  glowText(ctx, text, x, y, opts = {}) {
    const { font = '16px monospace', color = '#fff', glow = null, align = 'center', baseline = 'middle', shadow = true } = opts;
    ctx.save();
    ctx.font = font; ctx.textAlign = align; ctx.textBaseline = baseline;
    if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2; }
    ctx.fillStyle = color; ctx.fillText(text, x, y);
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 20; ctx.fillText(text, x, y); }
    ctx.restore();
  },

  drawBlock3D(ctx, x, y, w, h, color, radius = 4) {
    const [r, g, b] = this.hexToRgb(color);
    ctx.save();
    ctx.shadowColor = `rgba(${r},${g},${b},0.5)`; ctx.shadowBlur = 10;
    const g2 = ctx.createLinearGradient(x, y, x, y + h);
    g2.addColorStop(0, `rgb(${Math.min(255, r + 50)},${Math.min(255, g + 50)},${Math.min(255, b + 50)})`);
    g2.addColorStop(0.5, color);
    g2.addColorStop(1, `rgb(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)})`);
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h * 0.35, [radius, radius, 0, 0]); ctx.fill();
    ctx.restore();
  },

  drawGem3D(ctx, x, y, r, color, opts = {}) {
    const { spin = 0, core = '#ffffff' } = opts;
    const [cr, cg, cb] = this.hexToRgb(color);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.shadowColor = color;
    ctx.shadowBlur = r * 1.6;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, 1, 0, 0, r);
    g.addColorStop(0, core);
    g.addColorStop(0.28, `rgb(${Math.min(255, cr + 80)},${Math.min(255, cg + 80)},${Math.min(255, cb + 80)})`);
    g.addColorStop(0.68, color);
    g.addColorStop(1, `rgb(${Math.max(0, cr - 70)},${Math.max(0, cg - 70)},${Math.max(0, cb - 70)})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.86, -r * 0.28);
    ctx.lineTo(r * 0.58, r * 0.82);
    ctx.lineTo(-r * 0.58, r * 0.82);
    ctx.lineTo(-r * 0.86, -r * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.85)`;
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r * 0.78); ctx.moveTo(-r * 0.82, -r * 0.25); ctx.lineTo(r * 0.82, -r * 0.25); ctx.stroke();
    ctx.restore();
  },

  drawOrb3D(ctx, x, y, r, color, opts = {}) {
    const { glow = true, highlight = '#ffffff' } = opts;
    const [cr, cg, cb] = this.hexToRgb(color);
    ctx.save();
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = r * 1.7; }
    const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.45, r * 0.08, x, y, r);
    g.addColorStop(0, highlight);
    g.addColorStop(0.22, `rgb(${Math.min(255, cr + 70)},${Math.min(255, cg + 70)},${Math.min(255, cb + 70)})`);
    g.addColorStop(0.68, color);
    g.addColorStop(1, `rgb(${Math.max(0, cr - 85)},${Math.max(0, cg - 85)},${Math.max(0, cb - 85)})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.65)`;
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(x - r * 0.32, y - r * 0.38, r * 0.18, r * 0.1, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  drawMetalPanel3D(ctx, x, y, w, h, color = '#243040', radius = 8) {
    const [r, g, b] = this.hexToRgb(color);
    ctx.save();
    ctx.shadowColor = `rgba(${r},${g},${b},0.65)`;
    ctx.shadowBlur = 16;
    const base = ctx.createLinearGradient(x, y, x + w, y + h);
    base.addColorStop(0, `rgb(${Math.min(255, r + 55)},${Math.min(255, g + 55)},${Math.min(255, b + 55)})`);
    base.addColorStop(0.45, color);
    base.addColorStop(1, `rgb(${Math.max(0, r - 60)},${Math.max(0, g - 60)},${Math.max(0, b - 60)})`);
    ctx.fillStyle = base;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.roundRect(x + 3, y + 3, w - 6, h * 0.28, [radius, radius, 2, 2]); ctx.fill();
    ctx.restore();
  },

  drawShip3D(ctx, x, y, size, color = '#00ffff', angle = 0) {
    const [r, g, b] = this.hexToRgb(color);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.7;
    const body = ctx.createLinearGradient(0, -size, 0, size);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.22, `rgb(${Math.min(255, r + 80)},${Math.min(255, g + 80)},${Math.min(255, b + 80)})`);
    body.addColorStop(0.72, color);
    body.addColorStop(1, `rgb(${Math.max(0, r - 90)},${Math.max(0, g - 90)},${Math.max(0, b - 90)})`);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.72, size * 0.62);
    ctx.lineTo(size * 0.22, size * 0.42);
    ctx.lineTo(0, size * 0.95);
    ctx.lineTo(-size * 0.22, size * 0.42);
    ctx.lineTo(-size * 0.72, size * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.stroke();
    ctx.fillStyle = 'rgba(10,30,60,0.8)';
    ctx.beginPath(); ctx.ellipse(0, -size * 0.2, size * 0.22, size * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff8800';
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = size * 0.8;
    ctx.beginPath(); ctx.moveTo(-size * 0.18, size * 0.7); ctx.lineTo(0, size * 1.28); ctx.lineTo(size * 0.18, size * 0.7); ctx.fill();
    ctx.restore();
  },

  drawAsteroid3D(ctx, x, y, r, rot = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.shadowColor = '#9a7b61';
    ctx.shadowBlur = r * 0.8;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, 1, 0, 0, r);
    g.addColorStop(0, '#d6c0a4');
    g.addColorStop(0.35, '#8d705c');
    g.addColorStop(1, '#2e2530');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      const rr = r * (0.72 + 0.28 * Math.sin(i * 2.1 + rot));
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    [[-0.25, -0.2, 0.16], [0.25, 0.12, 0.13], [0.02, 0.38, 0.1]].forEach(([cx, cy, cr]) => {
      ctx.beginPath(); ctx.arc(cx * r, cy * r, cr * r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  },

  drawCar(ctx, x, y, w, h, color, angle = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const [r, g, b] = this.hexToRgb(color);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(3, 5, w * 0.45, h * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 6); ctx.fill();
    ctx.restore();
    const bodyG = ctx.createLinearGradient(-w / 2, -h / 2, -w / 2, h / 2);
    bodyG.addColorStop(0, `rgb(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)})`);
    bodyG.addColorStop(0.5, color);
    bodyG.addColorStop(1, `rgb(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)})`);
    ctx.fillStyle = bodyG;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 6); ctx.fill();
    ctx.fillStyle = 'rgba(150,200,255,0.5)';
    ctx.beginPath(); ctx.roundRect(-w * 0.35, -h * 0.25, w * 0.7, h * 0.22, 3); ctx.fill();
    ctx.fillStyle = '#ffe'; ctx.shadowColor = '#ffe'; ctx.shadowBlur = 10;
    ctx.fillRect(-w * 0.35, -h / 2, w * 0.2, 3); ctx.fillRect(w * 0.15, -h / 2, w * 0.2, 3);
    ctx.shadowColor = '#f00'; ctx.fillStyle = '#f33';
    ctx.fillRect(-w * 0.35, h / 2 - 3, w * 0.2, 3); ctx.fillRect(w * 0.15, h / 2 - 3, w * 0.2, 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#222';
    ctx.fillRect(-w / 2 - 3, -h * 0.35, 5, h * 0.25); ctx.fillRect(w / 2 - 2, -h * 0.35, 5, h * 0.25);
    ctx.fillRect(-w / 2 - 3, h * 0.1, 5, h * 0.25); ctx.fillRect(w / 2 - 2, h * 0.1, 5, h * 0.25);
    ctx.restore();
  },

  // NEW ARCADE EFFECTS
  drawNeonLine(ctx, x1, y1, x2, y2, color, width = 2) {
    const [r, g, b] = this.hexToRgb(color);
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 15;
    ctx.strokeStyle = `rgba(${r},${g},${b},0.3)`; ctx.lineWidth = width + 6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = width * 0.3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  },

  drawNeonRect(ctx, x, y, w, h, color, radius = 0, lineWidth = 2) {
    const [r, g, b] = this.hexToRgb(color);
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.strokeStyle = `rgba(${r},${g},${b},0.25)`; ctx.lineWidth = lineWidth + 6;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = lineWidth * 0.3;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.stroke();
    ctx.restore();
  },

  drawGridFloor(ctx, w, h, offset, color = '#ff00ff', alpha = 0.15) {
    const [r, g, b] = this.hexToRgb(color);
    ctx.save(); ctx.globalAlpha = alpha;
    const horizon = h * 0.4;
    const gridSpacing = 40;
    ctx.strokeStyle = `rgb(${r},${g},${b})`; ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const y = horizon + (i * gridSpacing + offset % gridSpacing) * (h - horizon) / (30 * gridSpacing);
      if (y > horizon && y < h) {
        ctx.globalAlpha = alpha * (1 - (y - horizon) / (h - horizon) * 0.5);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
    }
    for (let i = -15; i <= 15; i++) {
      const x1 = w / 2 + i * 5;
      ctx.globalAlpha = alpha * 0.6;
      ctx.beginPath(); ctx.moveTo(w / 2, horizon); ctx.lineTo(x1 + i * 20, h); ctx.stroke();
    }
    ctx.restore();
  },

  drawCRTEffect(ctx, w, h, intensity = 0.3) {
    // Scanlines
    ctx.save(); ctx.globalAlpha = intensity * 0.15;
    ctx.fillStyle = '#000';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    // Vignette
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${intensity})`);
    ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);
    // Slight color fringing
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = intensity * 0.03;
    ctx.fillStyle = '#ff0000'; ctx.fillRect(1, 0, w, h);
    ctx.fillStyle = '#0000ff'; ctx.fillRect(-1, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  },

  drawLEDText(ctxOrText, textOrX, xOrY, yOrColor, colorOrSize, sizeOrUndefined) {
    let ctx, t, x, y, color, size;
    if (typeof ctxOrText === 'string' || typeof ctxOrText === 'number') {
      t = String(ctxOrText); x = textOrX; y = xOrY; color = yOrColor || '#00ffff'; size = colorOrSize || 32;
    } else {
      ctx = ctxOrText; t = textOrX; x = xOrY; y = yOrColor; color = colorOrSize || '#00ffff'; size = sizeOrUndefined || 32;
    }
    if (!ctx) return;
    const [r, g, b] = this.hexToRgb(color);
    ctx.save();
    ctx.font = `bold ${size}px 'Courier New', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 25;
    ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
    ctx.fillText(t, x, y);
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.fillText(t, x, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255,255,255,0.6)`;
    ctx.fillText(t, x, y);
    ctx.restore();
  },

  drawGlitch(ctx, w, h, intensity = 0.5) {
    if (Math.random() > 0.3) return;
    ctx.save();
    const slices = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < slices; i++) {
      const y = Math.random() * h;
      const sliceH = 2 + Math.random() * 8;
      const offset = (Math.random() - 0.5) * intensity * 30;
      try {
        const imgData = ctx.getImageData(0, Math.max(0, Math.floor(y)), w, Math.min(Math.floor(sliceH), h - Math.floor(y)));
        ctx.putImageData(imgData, offset, Math.floor(y));
      } catch(e) {}
    }
    // Color shift bands
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = intensity * 0.1;
    ctx.fillStyle = '#ff0066';
    ctx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 4);
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  },

  drawNeonCircle(ctx, x, y, r, color, lineWidth = 2) {
    const [cr, cg, cb] = this.hexToRgb(color);
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 20;
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.2)`; ctx.lineWidth = lineWidth + 8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = lineWidth * 0.3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  },

  screenShake: class {
    constructor() { this.intensity = 0; this.duration = 0; this.timer = 0; this.offsetX = 0; this.offsetY = 0; }
    trigger(i = 8, d = 300) { this.intensity = i; this.duration = d; this.timer = d; }
    update(dt) {
      if (this.timer > 0) { this.timer -= dt; const p = this.timer / this.duration; this.offsetX = (Math.random() - 0.5) * this.intensity * p; this.offsetY = (Math.random() - 0.5) * this.intensity * p; }
      else { this.offsetX = 0; this.offsetY = 0; }
    }
    apply(ctx) { ctx.translate(this.offsetX, this.offsetY); }
  },

  particles: class {
    constructor() { this.items = []; }
    emit(x, y, count, colors, speedRange = [50, 150], lifeRange = [0.3, 0.8], sizeRange = [2, 5]) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
        this.items.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: lifeRange[0] + Math.random() * (lifeRange[1] - lifeRange[0]),
          maxLife: lifeRange[1], color: colors[Math.floor(Math.random() * colors.length)],
          size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]) });
      }
    }
    update(dt) {
      this.items.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; p.life -= dt; });
      this.items = this.items.filter(p => p.life > 0);
    }
    draw(ctx) {
      this.items.forEach(p => {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
  },
};

window.VFX = VFX;
