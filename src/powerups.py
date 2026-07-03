"""Sistema de power-ups."""

import random
import time
import pygame
from snake_logic import Position, grid_width, grid_height, cell_size


class PowerUpType:
    SPEED = "speed"
    SLOW = "slow"
    SHIELD = "shield"
    DOUBLE = "double"

    COLORS = {
        SPEED: (50, 150, 255),
        SLOW: (180, 50, 255),
        SHIELD: (255, 215, 0),
        DOUBLE: (255, 100, 200),
    }

    DURATIONS = {
        SPEED: 5.0,
        SLOW: 5.0,
        SHIELD: 6.0,
        DOUBLE: 8.0,
    }

    LABELS = {
        SPEED: "SPEED x2",
        SLOW: "SLOW-MO",
        SHIELD: "SHIELD",
        DOUBLE: "SCORE x2",
    }


class PowerUp:
    def __init__(self, ptype, pos):
        self.ptype = ptype
        self.pos = pos
        self.spawn_time = time.time()
        self.lifetime = 6.0

    @property
    def color(self):
        return PowerUpType.COLORS[self.ptype]

    @property
    def expired(self):
        return time.time() - self.spawn_time >= self.lifetime

    def visible(self):
        elapsed = time.time() - self.spawn_time
        return int(elapsed * 5) % 2 == 0


class ActivePowerUp:
    def __init__(self, ptype):
        self.ptype = ptype
        self.start_time = time.time()
        self.duration = PowerUpType.DURATIONS[ptype]

    @property
    def remaining(self):
        return max(0, self.duration - (time.time() - self.start_time))

    @property
    def expired(self):
        return self.remaining <= 0

    @property
    def progress(self):
        return self.remaining / self.duration

    @property
    def color(self):
        return PowerUpType.COLORS[self.ptype]

    @property
    def label(self):
        return PowerUpType.LABELS[self.ptype]


class PowerUpManager:
    def __init__(self):
        self.current = None
        self.active = []
        self.spawn_interval = 15.0
        self.last_spawn = 0

    def update(self, snake_body, food_pos):
        now = time.time()

        if self.current is None and now - self.last_spawn >= self.spawn_interval:
            self._try_spawn(snake_body, food_pos)

        if self.current and self.current.expired:
            self.current = None

        self.active = [a for a in self.active if not a.expired]

    def _try_spawn(self, snake_body, food_pos):
        occupied = {pos.to_tuple() for pos in snake_body}
        if food_pos:
            occupied.add(food_pos.to_tuple())
        available = [(x, y) for x in range(2, grid_width - 2) for y in range(2, grid_height - 2)
                     if (x, y) not in occupied]
        if available:
            ptype = random.choice(list(PowerUpType.COLORS.keys()))
            pos = Position(*random.choice(available))
            self.current = PowerUp(ptype, pos)
            self.last_spawn = time.time()

    def collect(self, head_pos):
        if self.current and head_pos == self.current.pos:
            ptype = self.current.ptype
            self.current = None
            self.last_spawn = time.time()
            active = ActivePowerUp(ptype)
            self.active.append(active)
            return active
        return None

    def has(self, ptype):
        return any(a.ptype == ptype for a in self.active)

    def speed_multiplier(self):
        if self.has(PowerUpType.SPEED):
            return 2.0
        if self.has(PowerUpType.SLOW):
            return 0.5
        return 1.0

    def score_multiplier(self):
        return 2 if self.has(PowerUpType.DOUBLE) else 1

    def is_shielded(self):
        return self.has(PowerUpType.SHIELD)

    def draw(self, screen):
        if self.current and self.current.visible():
            p = self.current
            rect = pygame.Rect(p.pos.x * cell_size, p.pos.y * cell_size, cell_size, cell_size)
            color = p.color
            pygame.draw.rect(screen, color, rect, border_radius=6)
            inner = rect.inflate(-6, -6)
            lighter = tuple(min(255, c + 60) for c in color)
            pygame.draw.rect(screen, lighter, inner, border_radius=4)

            font = pygame.font.Font(None, 18)
            letter = {"speed": "S", "slow": "W", "shield": "D", "double": "x2"}[p.ptype]
            text = font.render(letter, True, (255, 255, 255))
            text_rect = text.get_rect(center=rect.center)
            screen.blit(text, text_rect)
