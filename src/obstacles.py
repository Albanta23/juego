"""Sistema de obstáculos progresivos."""

import random
import pygame
from snake_logic import grid_width, grid_height, cell_size


class ObstacleManager:
    def __init__(self):
        self.blocks = []
        self.last_spawn_level = 0

    def update(self, level, snake_body, food_pos):
        if level >= 3 and level // 2 > self.last_spawn_level // 2:
            self._generate(level, snake_body, food_pos)
            self.last_spawn_level = level

    def _generate(self, level, snake_body, food_pos):
        self.blocks = []
        count = min(2 + (level - 3), 12)
        occupied = {pos.to_tuple() for pos in snake_body}
        if food_pos:
            occupied.add(food_pos.to_tuple())

        for _ in range(count):
            attempts = 0
            while attempts < 50:
                x = random.randint(2, grid_width - 3)
                y = random.randint(2, grid_height - 3)
                if (x, y) not in occupied and self._is_safe(x, y, snake_body):
                    self.blocks.append((x, y))
                    occupied.add((x, y))
                    break
                attempts += 1

    def _is_safe(self, x, y, snake_body):
        head = snake_body[0].to_tuple()
        dist = abs(head[0] - x) + abs(head[1] - y)
        return dist > 5

    def collides(self, pos):
        return pos in self.blocks

    def draw(self, screen, frame_count):
        for bx, by in self.blocks:
            rect = pygame.Rect(bx * cell_size, by * cell_size, cell_size, cell_size)
            base = 90 + int(5 * ((frame_count + bx * 7 + by * 13) % 10) / 10)
            color = (base, base - 10, base - 20)
            pygame.draw.rect(screen, color, rect)
            inner = rect.inflate(-4, -4)
            lighter = (base + 20, base + 10, base)
            pygame.draw.rect(screen, lighter, inner, border_radius=2)
            highlight = pygame.Rect(inner.x + 2, inner.y + 2, 4, 4)
            pygame.draw.rect(screen, (base + 40, base + 30, base + 20), highlight, border_radius=1)
