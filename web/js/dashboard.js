// Dashboard controller - Arcade Synthwave
const GAMES = [
  { id: 'snake', name: 'SNAKE', icon: '🐍', color: '#00ff88', desc: 'El clasico serpiente. Come, crece, sobrevive.' },
  { id: 'tetris', name: 'TETRIS', icon: '🧩', color: '#00ffff', desc: 'Apila bloques y completa lineas.' },
  { id: 'pong', name: 'PONG', icon: '🏓', color: '#ff00ff', desc: '1v1 o vs CPU. El original.' },
  { id: 'game2048', name: '2048', icon: '🔢', color: '#ffff00', desc: 'Desliza y combina numeros.' },
  { id: 'carreras', name: 'RACING', icon: '🏎️', color: '#ff3366', desc: 'Circuito neon con power-ups.' },
];

let currentGame = null;
let gameInstance = null;

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
  // Use reasonable canvas size, not fullscreen
  const maxW = Math.min(window.innerWidth - 40, 900);
  const maxH = Math.min(window.innerHeight - 100, 600);
  canvas.width = maxW;
  canvas.height = maxH;
  canvas.style.width = maxW + 'px';
  canvas.style.height = maxH + 'px';
  canvas.tabIndex = 1;
  canvas.focus();

  switch (id) {
    case 'snake': gameInstance = new SnakeGame(canvas); break;
    case 'tetris': gameInstance = new TetrisGame(canvas); break;
    case 'pong': gameInstance = new PongGame(canvas); break;
    case 'game2048': gameInstance = new Game2048(canvas); break;
    case 'carreras': gameInstance = new CarrerasGame(canvas); break;
  }
  if (gameInstance) gameInstance.start();
}

function exitGame() {
  if (gameInstance) { gameInstance.destroy(); gameInstance = null; }
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('dashboard').style.display = 'block';
  initDashboard();
}

function updateScore(score) {
  document.getElementById('toolbar-score').textContent = `SCORE: ${score}`;
}

document.addEventListener('DOMContentLoaded', initDashboard);
