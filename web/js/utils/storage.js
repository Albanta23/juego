// LocalStorage high scores and stats
class GameStorage {
  constructor() {
    this.prefix = 'gamescore_';
  }

  getHighScore(game) {
    return parseInt(localStorage.getItem(this.prefix + game + '_high') || '0');
  }

  setHighScore(game, score) {
    const current = this.getHighScore(game);
    if (score > current) {
      localStorage.setItem(this.prefix + game + '_high', score);
      return true;
    }
    return false;
  }

  getStats(game) {
    try {
      return JSON.parse(localStorage.getItem(this.prefix + game + '_stats') || '{}');
    } catch { return {}; }
  }

  setStats(game, stats) {
    localStorage.setItem(this.prefix + game + '_stats', JSON.stringify(stats));
  }

  updateStats(game, updates) {
    const stats = this.getStats(game);
    for (const [k, v] of Object.entries(updates)) {
      stats[k] = (stats[k] || 0) + v;
    }
    this.setStats(game, stats);
    return stats;
  }

  getTopScores(game, limit = 5) {
    try {
      return JSON.parse(localStorage.getItem(this.prefix + game + '_top') || '[]');
    } catch { return []; }
  }

  addTopScore(game, score, name = 'Player') {
    const top = this.getTopScores(game);
    top.push({ name, score, date: Date.now() });
    top.sort((a, b) => b.score - a.score);
    const trimmed = top.slice(0, 5);
    localStorage.setItem(this.prefix + game + '_top', JSON.stringify(trimmed));
    return trimmed;
  }
}

window.gameStorage = new GameStorage();
