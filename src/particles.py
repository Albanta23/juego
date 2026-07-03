"""Sistema de partículas para efectos visuales."""

import random
import math
import pygame


class Particle:
    __slots__ = ('x', 'y', 'vx', 'vy', 'life', 'max_life', 'color', 'size', 'gravity')

    def __init__(self, x, y, vx, vy, life, color, size=3, gravity=0.0):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.life = life
        self.max_life = life
        self.color = color
        self.size = size
        self.gravity = gravity

    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.vy += self.gravity * dt
        self.life -= dt

    @property
    def alive(self):
        return self.life > 0

    @property
    def alpha(self):
        return max(0, self.life / self.max_life)

    @property
    def current_size(self):
        return max(1, int(self.size * self.alpha))


class ParticleSystem:
    def __init__(self):
        self.particles = []

    def emit(self, x, y, count, colors, speed_range=(50, 150), life_range=(0.3, 0.8),
             size_range=(2, 5), gravity=30.0):
        for _ in range(count):
            angle = random.uniform(0, 2 * math.pi)
            speed = random.uniform(*speed_range)
            vx = math.cos(angle) * speed
            vy = math.sin(angle) * speed
            life = random.uniform(*life_range)
            color = random.choice(colors)
            size = random.randint(*size_range)
            self.particles.append(Particle(x, y, vx, vy, life, color, size, gravity))

    def emit_eat(self, x, y):
        colors = [(0, 255, 80), (100, 255, 120), (50, 200, 60), (150, 255, 150)]
        self.emit(x, y, 10, colors, speed_range=(60, 140), life_range=(0.2, 0.5),
                  size_range=(2, 4), gravity=40.0)

    def emit_bonus(self, x, y):
        colors = [(255, 215, 0), (255, 255, 100), (255, 180, 0), (255, 255, 200)]
        self.emit(x, y, 18, colors, speed_range=(80, 180), life_range=(0.3, 0.7),
                  size_range=(3, 6), gravity=20.0)

    def emit_powerup(self, x, y, color):
        colors = [color, tuple(min(255, c + 80) for c in color), tuple(max(0, c - 40) for c in color)]
        self.emit(x, y, 20, colors, speed_range=(60, 160), life_range=(0.4, 0.8),
                  size_range=(3, 6), gravity=10.0)

    def emit_death(self, x, y):
        colors = [(255, 50, 50), (255, 100, 50), (255, 150, 50), (200, 50, 50)]
        self.emit(x, y, 35, colors, speed_range=(100, 250), life_range=(0.5, 1.2),
                  size_range=(3, 7), gravity=60.0)

    def emit_obstacle_death(self, x, y):
        colors = [(180, 180, 180), (120, 120, 120), (200, 200, 200)]
        self.emit(x, y, 25, colors, speed_range=(80, 200), life_range=(0.4, 0.9),
                  size_range=(2, 5), gravity=50.0)

    def update(self, dt):
        for p in self.particles:
            p.update(dt)
        self.particles = [p for p in self.particles if p.alive]

    def draw(self, screen):
        for p in self.particles:
            alpha = int(255 * p.alpha)
            color = (
                min(255, int(p.color[0] * p.alpha + 255 * (1 - p.alpha) * 0.3)),
                min(255, int(p.color[1] * p.alpha + 255 * (1 - p.alpha) * 0.3)),
                min(255, int(p.color[2] * p.alpha + 255 * (1 - p.alpha) * 0.3)),
            )
            size = p.current_size
            if size > 0:
                pygame.draw.circle(screen, color, (int(p.x), int(p.y)), size)
