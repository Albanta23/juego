"""Estadísticas persistentes del jugador."""

import os
import json


STATS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "stats.json")

DEFAULT_STATS = {
    "total_games": 0,
    "total_food": 0,
    "total_score": 0,
    "longest_snake": 0,
    "best_combo": 0,
    "total_playtime": 0.0,
    "powerups_collected": 0,
}


class Stats:
    def __init__(self):
        self.data = self._load()

    def _load(self):
        try:
            with open(STATS_FILE, "r") as f:
                loaded = json.load(f)
                for k, v in DEFAULT_STATS.items():
                    if k not in loaded:
                        loaded[k] = v
                return loaded
        except (FileNotFoundError, json.JSONDecodeError):
            return dict(DEFAULT_STATS)

    def save(self):
        with open(STATS_FILE, "w") as f:
            json.dump(self.data, f, indent=2)

    def on_game_end(self, score, snake_length, playtime):
        self.data["total_games"] += 1
        self.data["total_score"] += score
        self.data["longest_snake"] = max(self.data["longest_snake"], snake_length)
        self.data["total_playtime"] += playtime
        self.save()

    def on_food_eaten(self):
        self.data["total_food"] += 1
        self.save()

    def on_combo(self, combo):
        if combo > self.data["best_combo"]:
            self.data["best_combo"] = combo
            self.save()

    def on_powerup(self):
        self.data["powerups_collected"] += 1
        self.save()

    def summary_lines(self):
        return [
            f"Games: {self.data['total_games']}",
            f"Food eaten: {self.data['total_food']}",
            f"Total score: {self.data['total_score']}",
            f"Longest snake: {self.data['longest_snake']}",
            f"Best combo: {self.data['best_combo']}x",
            f"Power-ups: {self.data['powerups_collected']}",
            f"Playtime: {int(self.data['total_playtime'])}s",
        ]
