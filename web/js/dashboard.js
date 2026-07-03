// Dashboard controller
const GAMES = [
  { id: 'snake', name: 'Snake', icon: '🐍', color: '#00e676', desc: 'El clasico serpiente. Come, crece, sobrevive.' },
  { id: 'tetris', name: 'Tetris', icon: '🧩', color: '#00b0ff', desc: 'Apila bloques y completa lineas.' },
  { id: 'pong', name: 'Pong', icon: '🏓', color: '#e040fb', desc: '1v1 o vs CPU. El original.' },
  { id: 'game2048', name: '2048', icon: '🔢', color: '#ff9100', desc: 'Desliza y combina numeros.' },
  { id: 'carreras', name: 'Carreras', icon: '🏎️', color: '#ff1744', desc: 'Circuito con curvas y power-ups.' },
];

let currentGame = null;
let gameInstance = null;

function initDashboard() {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '';
  GAMES.forEach(game => {
    const high = window.gameStorage.getHighScore(game.id);
    const card = document.createElement('div');
    card.className = 'game-card';
    card.style.setProperty('--game-color', game.color);
    card.innerHTML = `
      <div class="icon">${game.icon}</div>
      <h2>${game.name}</h2>
      <p class="desc">${game.desc}</p>
      <p class="high-score">High Score: ${high}</p>
      <p class="play-hint">Click para jugar</p>
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
  canvas.width = 600;
  canvas.height = 500;

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
  document.getElementById('toolbar-score').textContent = `Score: ${score}`;
}

document.addEventListener('DOMContentLoaded', initDashboard);
