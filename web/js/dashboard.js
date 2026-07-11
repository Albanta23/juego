// Dashboard controller - Arcade Synthwave
const GAMES = [
  { id: 'snake', name: 'SNAKE', icon: '🐍', color: '#00ff88', desc: 'El clasico serpiente. Come, crece, sobrevive.' },
  { id: 'tetris', name: 'TETRIS', icon: '🧩', color: '#00ffff', desc: 'Apila bloques y completa lineas.' },
  { id: 'pong', name: 'PONG', icon: '🏓', color: '#ff00ff', desc: '1v1 o vs CPU. El original.' },
  { id: 'game2048', name: '2048', icon: '🔢', color: '#ffff00', desc: 'Desliza y combina numeros.' },
  { id: 'carreras', name: 'RACING', icon: '🏎️', color: '#ff3366', desc: 'Circuito neon con power-ups.' },
  { id: 'graveknight', name: 'GRAVE KNIGHT', icon: '🛡️', color: '#c8f7ff', desc: 'Arcade de cementerio: salta, lanza y sobrevive.' },
  { id: 'starfighter', name: 'STARFIGHTER 3D', icon: '🚀', color: '#00ffff', desc: 'Nave espacial con asteroides, escudo y jefe.' },
  { id: 'unity-starrunner', name: 'UNITY STAR RUNNER', icon: '🛰️', color: '#7f5cff', desc: 'Runner 3D con disparos, enemigos y dificultad progresiva.', type: 'unity', url: 'unity/starrunner/index.html?v=20260711-1' },
  { id: 'unity-neonmaze', name: 'UNITY NEON MAZE', icon: '🟡', color: '#ffd84d', desc: 'Comecocos 3D moderno con niveles y controles tactiles.', type: 'unity', url: 'unity/neonmaze/index.html?v=20260711-1' },
  { id: 'unity-zombiestoro', name: 'ZOMBIES TORO', icon: '🧟', color: '#66ff33', desc: 'Shooter 3D con rutas, escenarios dinamicos, oleadas y audio tematico.', type: 'unity', url: 'unity/zombiestoro/index.html?v=20260711-7' },
];

let currentGame = null;
let gameInstance = null;
let pressedTouchKeys = new Set();
let touchRepeatTimers = new Map();

const TOUCH_LAYOUTS = {
  snake: {
    pad: [['↑', 'ArrowUp', 'up'], ['←', 'ArrowLeft', 'left'], ['↓', 'ArrowDown', 'down'], ['→', 'ArrowRight', 'right']],
    actions: [['START', 'Enter'], ['RETRY', 'r']]
  },
  tetris: {
    pad: [['↻', 'ArrowUp', 'up'], ['←', 'ArrowLeft', 'left'], ['↓', 'ArrowDown', 'down'], ['→', 'ArrowRight', 'right']],
    actions: [['DROP', ' '], ['HOLD', 'c'], ['PAUSE', 'p']]
  },
  pong: {
    pad: [['↑', 'ArrowUp', 'up'], ['↓', 'ArrowDown', 'down']],
    actions: [['VS CPU', '1'], ['2P', '2'], ['PAUSE', 'p']]
  },
  game2048: {
    pad: [['↑', 'ArrowUp', 'up'], ['←', 'ArrowLeft', 'left'], ['↓', 'ArrowDown', 'down'], ['→', 'ArrowRight', 'right']],
    actions: [['UNDO', 'u'], ['NEW', 'r']]
  },
  carreras: {
    pad: [['↑', 'ArrowUp', 'up'], ['←', 'ArrowLeft', 'left'], ['↓', 'ArrowDown', 'down'], ['→', 'ArrowRight', 'right']],
    actions: [['START', 'Enter'], ['NITRO', 'n'], ['RETRY', 'r']]
  },
  graveknight: {
    pad: [['JMP', 'ArrowUp', 'up'], ['←', 'ArrowLeft', 'left'], ['↓', 'ArrowDown', 'down'], ['→', 'ArrowRight', 'right']],
    actions: [['START', 'Enter'], ['ATTACK', 'x'], ['RETRY', 'r']]
  },
  starfighter: {
    pad: [['↑', 'ArrowUp', 'up'], ['←', 'ArrowLeft', 'left'], ['↓', 'ArrowDown', 'down'], ['→', 'ArrowRight', 'right']],
    actions: [['START', 'Enter'], ['FIRE', 'x'], ['BOMB', 'b'], ['RETRY', 'r']]
  }
};

function initDashboard() {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '';
  GAMES.forEach((game, i) => {
    const high = window.gameStorage.getHighScore(game.id);
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
      <div class="icon">${game.icon}</div>
      <h2>${game.name}</h2>
      <p class="desc">${game.desc}</p>
      <p class="high-score">HIGH SCORE: ${high}</p>
      <p class="play-hint">[ INSERT COIN ]</p>
    `;
    card.addEventListener('click', () => launchGame(game.id));
    grid.appendChild(card);
  });
}

function launchGame(id) {
  window.audioManager.init();
  currentGame = id;
  const game = GAMES.find(g => g.id === id);
  document.getElementById('dashboard').style.display = 'none';
  const screen = document.getElementById('game-screen');
  screen.classList.add('active');
  screen.querySelector('.game-title').textContent = game.name;
  document.getElementById('toolbar-back').onclick = exitGame;
  const canvas = document.getElementById('game-canvas');
  document.getElementById('toolbar-pause').onclick = () => {
    dispatchGameKey('keydown', 'p');
    dispatchGameKey('keyup', 'p');
    canvas.focus();
  };
  const soundButton = document.getElementById('toolbar-sound');
  soundButton.textContent = window.audioManager.enabled ? 'SND' : 'MUTE';
  soundButton.onclick = () => {
    const enabled = window.audioManager.toggle();
    soundButton.textContent = enabled ? 'SND' : 'MUTE';
    canvas.focus();
  };

  const touchControls = document.getElementById('touch-controls');
  const unityFrame = ensureUnityFrame();
  const isTouchViewport = window.matchMedia('(hover: none), (pointer: coarse), (max-width: 600px)').matches;
  const controlsReserve = isTouchViewport ? Math.min(150, Math.max(112, window.innerHeight * 0.2)) : 0;
  const toolbarReserve = isTouchViewport ? 58 : 78;
  const maxW = Math.max(320, Math.min(window.innerWidth - (isTouchViewport ? 12 : 40), isTouchViewport ? 760 : 900));
  const maxH = Math.max(320, Math.min(window.innerHeight - toolbarReserve - controlsReserve, isTouchViewport ? 680 : 600));
  canvas.width = maxW;
  canvas.height = maxH;
  canvas.style.width = maxW + 'px';
  canvas.style.height = maxH + 'px';
  canvas.style.display = 'block';
  unityFrame.classList.remove('active');
  unityFrame.removeAttribute('src');
  canvas.tabIndex = 1;
  canvas.focus();

  if (game.type === 'unity') {
    canvas.style.display = 'none';
    unityFrame.src = game.url;
    unityFrame.classList.add('active');
    unityFrame.onload = () => focusUnityGame(unityFrame);
    unityFrame.onpointerdown = () => focusUnityGame(unityFrame);
    document.getElementById('toolbar-score').textContent = 'UNITY WEBGL';
    setupTouchControls(null);
    return;
  }

  switch (id) {
    case 'snake': gameInstance = new SnakeGame(canvas); break;
    case 'tetris': gameInstance = new TetrisGame(canvas); break;
    case 'pong': gameInstance = new PongGame(canvas); break;
    case 'game2048': gameInstance = new Game2048(canvas); break;
    case 'carreras': gameInstance = new CarrerasGame(canvas); break;
    case 'graveknight': gameInstance = new GraveKnightGame(canvas); break;
    case 'starfighter': gameInstance = new StarfighterGame(canvas); break;
  }
  setupTouchControls(id);
  if (gameInstance) gameInstance.start();
}

function focusUnityGame(frame) {
  frame.focus();
  try {
    const unityCanvas = frame.contentDocument?.getElementById('unity-canvas');
    if (unityCanvas) {
      unityCanvas.tabIndex = 0;
      unityCanvas.focus();
    }
    frame.contentWindow?.focus();
  } catch (_) {
    // The iframe can still receive focus if deployment headers isolate its origin.
  }
}

function exitGame() {
  releaseTouchKeys();
  setupTouchControls(null);
  const unityFrame = document.getElementById('unity-frame');
  if (unityFrame) {
    unityFrame.classList.remove('active');
    unityFrame.removeAttribute('src');
  }
  if (gameInstance) { gameInstance.destroy(); gameInstance = null; }
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('dashboard').style.display = 'block';
  initDashboard();
}

function ensureUnityFrame() {
  const container = document.querySelector('.game-canvas-container');
  let frame = document.getElementById('unity-frame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'unity-frame';
    frame.className = 'unity-frame';
    frame.title = 'Unity WebGL Game';
    frame.setAttribute('allow', 'fullscreen; gamepad');
    container.appendChild(frame);
  }
  return frame;
}

function updateScore(score) {
  document.getElementById('toolbar-score').textContent = `SCORE: ${score}`;
}

document.addEventListener('DOMContentLoaded', initDashboard);

function setupTouchControls(gameId) {
  const controls = document.getElementById('touch-controls');
  if (!controls) return;
  releaseTouchKeys();
  controls.innerHTML = '';
  const layout = TOUCH_LAYOUTS[gameId];
  if (!layout) {
    controls.classList.remove('active');
    return;
  }

  const pad = document.createElement('div');
  pad.className = 'touch-pad';
  layout.pad.forEach(([label, key, cls]) => pad.appendChild(makeTouchButton(label, key, cls)));

  const actions = document.createElement('div');
  actions.className = 'touch-actions';
  layout.actions.forEach(([label, key]) => actions.appendChild(makeTouchButton(label, key, 'wide')));

  controls.appendChild(pad);
  controls.appendChild(actions);
  controls.classList.add('active');
}

function makeTouchButton(label, key, cls = '') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `touch-btn ${cls}`;
  btn.textContent = label;
  btn.setAttribute('aria-label', label);
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.setPointerCapture?.(e.pointerId);
    btn.classList.add('is-pressed');
    pressTouchKey(key);
  });
  const release = (e) => {
    e.preventDefault();
    btn.classList.remove('is-pressed');
    releaseTouchKey(key);
  };
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
  return btn;
}

function pressTouchKey(key) {
  if (pressedTouchKeys.has(key)) return;
  pressedTouchKeys.add(key);
  dispatchGameKey('keydown', key);
  if (shouldRepeatTouchKey(key)) {
    touchRepeatTimers.set(key, setInterval(() => dispatchGameKey('keydown', key), 120));
  }
}

function releaseTouchKey(key) {
  if (!pressedTouchKeys.has(key)) return;
  pressedTouchKeys.delete(key);
  if (touchRepeatTimers.has(key)) {
    clearInterval(touchRepeatTimers.get(key));
    touchRepeatTimers.delete(key);
  }
  dispatchGameKey('keyup', key);
}

function releaseTouchKeys() {
  [...pressedTouchKeys].forEach(key => releaseTouchKey(key));
}

function dispatchGameKey(type, key) {
  document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
}

function shouldRepeatTouchKey(key) {
  if (currentGame === 'tetris') return ['ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(key);
  if (currentGame === 'graveknight') return ['ArrowLeft', 'ArrowRight', 'x'].includes(key);
  if (currentGame === 'starfighter') return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'x'].includes(key);
  return false;
}
