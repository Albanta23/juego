from enum import Enum
import random
import time

import pygame


class Direction(Enum):
    UP = (0, -1)
    DOWN = (0, 1)
    LEFT = (-1, 0)
    RIGHT = (1, 0)


grid_width = 30
grid_height = 20
cell_size = 20

WHITE = (255, 255, 255)
GREEN = (0, 181, 39)
RED = (178, 34, 34)
GRAY = (50, 50, 50)
GOLD = (255, 215, 0)
DARK_GREEN = (0, 120, 27)
PURPLE = (160, 50, 200)
ORANGE = (255, 140, 0)


class Position:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def to_tuple(self):
        return (self.x, self.y)

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __hash__(self):
        return hash((self.x, self.y))


class FoodType:
    NORMAL = "normal"
    SPEED = "speed"
    POISON = "poison"


FOOD_COLORS = {
    FoodType.NORMAL: RED,
    FoodType.SPEED: ORANGE,
    FoodType.POISON: PURPLE,
}


class Food:
    def __init__(self):
        self.pos = Position(0, 0)
        self.food_type = FoodType.NORMAL
        self.bonus_pos = None
        self.bonus_spawn_time = 0
        self.bonus_lifetime = 5.0
        self.bonus_spawn_interval = 10.0
        self.last_bonus_spawn = 0
        self.special_type = None
        self.special_timer = 0
        self.special_interval = 15.0

    def generate_random(self, snake_body=None, occupied_extra=None):
        occupied = set()
        if snake_body:
            occupied = {pos.to_tuple() for pos in snake_body}
        if self.bonus_pos:
            occupied.add(self.bonus_pos.to_tuple())
        if occupied_extra:
            occupied.update(occupied_extra)
        available = [(x, y) for x in range(grid_width) for y in range(grid_height) if (x, y) not in occupied]
        if available:
            self.pos = Position(*random.choice(available))
            return
        self.pos = Position(random.randint(0, grid_width - 1), random.randint(0, grid_height - 1))

    def update_special(self, snake_body, obstacles):
        now = time.time()
        if now - self.special_timer >= self.special_interval:
            self.special_type = random.choice([FoodType.SPEED, FoodType.POISON])
            self.special_timer = now
        if self.special_type and now - self.special_timer >= 8.0:
            self.special_type = None

    def try_spawn_bonus(self, snake_body, obstacles=None):
        now = time.time()
        if self.bonus_pos is None and now - self.last_bonus_spawn >= self.bonus_spawn_interval:
            occupied = {pos.to_tuple() for pos in snake_body}
            occupied.add(self.pos.to_tuple())
            if obstacles:
                occupied.update(obstacles)
            available = [(x, y) for x in range(grid_width) for y in range(grid_height) if (x, y) not in occupied]
            if available:
                self.bonus_pos = Position(*random.choice(available))
                self.bonus_spawn_time = now
                self.last_bonus_spawn = now

    def check_bonus_expired(self):
        if self.bonus_pos and time.time() - self.bonus_spawn_time >= self.bonus_lifetime:
            self.bonus_pos = None

    def is_bonus_visible(self):
        if self.bonus_pos is None:
            return False
        elapsed = time.time() - self.bonus_spawn_time
        return int(elapsed * 4) % 2 == 0


class Snake:
    def __init__(self):
        self.body = [Position(9, 8), Position(8, 8)]
        self.direction = Direction.RIGHT
        self.grow_flag = False
        self.invincible_until = 0

    def grow(self):
        self.grow_flag = True

    def shrink(self, amount):
        remove = min(amount, len(self.body) - 2)
        for _ in range(remove):
            self.body.pop()

    @property
    def is_invincible(self):
        return time.time() < self.invincible_until

    def move(self, food, obstacles=None):
        head_x, head_y = self.body[0].to_tuple()
        dx, dy = self.direction.value
        new_x = (head_x + dx) % grid_width
        new_y = (head_y + dy) % grid_height
        new_pos = Position(new_x, new_y)

        result = {"normal": False, "bonus": False, "speed": False, "poison": False}

        if new_pos == food.pos:
            food.generate_random(self.body)
            self.grow()
            if food.food_type == FoodType.SPEED:
                result["speed"] = True
            elif food.food_type == FoodType.POISON:
                result["poison"] = True
            else:
                result["normal"] = True
            food.update_special(self.body, obstacles)

        if food.bonus_pos and new_pos == food.bonus_pos:
            food.bonus_pos = None
            self.grow()
            result["bonus"] = True

        self.body.insert(0, new_pos)

        if not self.grow_flag:
            self.body.pop(-1)
        else:
            self.grow_flag = False

        return result

    def is_dead(self, obstacles=None):
        head = self.body[0].to_tuple()
        for i in range(1, len(self.body)):
            if self.body[i].to_tuple() == head:
                return True
        if obstacles and head in obstacles:
            return True
        return False


def draw_grid(screen):
    for x in range(0, grid_width * cell_size, cell_size):
        pygame.draw.line(screen, GRAY, (x, 0), (x, grid_height * cell_size))
    for y in range(0, grid_height * cell_size, cell_size):
        pygame.draw.line(screen, GRAY, (0, y), (grid_width * cell_size, y))


def draw_food(screen, food, frame_count):
    color = FOOD_COLORS.get(food.food_type, RED)
    rect = pygame.Rect(food.pos.x * cell_size, food.pos.y * cell_size, cell_size, cell_size)
    inner = rect.inflate(-4, -4)
    pygame.draw.rect(screen, color, inner, border_radius=4)
    highlight = inner.inflate(-6, -6)
    highlight.x += 1
    highlight.y += 1
    lighter = tuple(min(255, c + 80) for c in color)
    pygame.draw.rect(screen, lighter, highlight, border_radius=3)

    if food.food_type == FoodType.POISON:
        pulse = abs(((frame_count % 30) / 15) - 1)
        glow = int(40 * pulse)
        glow_color = (PURPLE[0], PURPLE[1], min(255, PURPLE[2] + glow))
        pygame.draw.rect(screen, glow_color, inner.inflate(4, 4), 2, border_radius=5)
    elif food.food_type == FoodType.SPEED:
        for i in range(3):
            dx_off = (frame_count + i * 5) % 20 - 10
            trail_rect = inner.move(dx_off, 0)
            trail_alpha = max(0, 200 - abs(dx_off) * 20)
            trail_color = (ORANGE[0], ORANGE[1], min(255, ORANGE[2]))
            s = pygame.Surface((trail_rect.w, trail_rect.h), pygame.SRCALPHA)
            s.fill((*trail_color, trail_alpha))
            screen.blit(s, trail_rect.topleft)

    if food.bonus_pos and food.is_bonus_visible():
        brect = pygame.Rect(food.bonus_pos.x * cell_size, food.bonus_pos.y * cell_size, cell_size, cell_size)
        pygame.draw.rect(screen, GOLD, brect, border_radius=5)
        inner_b = brect.inflate(-6, -6)
        pygame.draw.rect(screen, (255, 255, 150), inner_b, border_radius=3)
        pulse = abs(((frame_count % 20) / 10) - 1)
        glow_s = pygame.Surface((cell_size + 8, cell_size + 8), pygame.SRCALPHA)
        glow_alpha = int(60 * pulse)
        pygame.draw.rect(glow_s, (255, 215, 0, glow_alpha), glow_s.get_rect(), border_radius=8)
        screen.blit(glow_s, (brect.x - 4, brect.y - 4))


def draw_snake(screen, snake, frame_count):
    n = len(snake.body)
    shielded = snake.is_invincible

    for i, segment in enumerate(snake.body):
        t = i / max(n - 1, 1)
        r = int(GREEN[0] * (1 - t) + DARK_GREEN[0] * t)
        g = int(GREEN[1] * (1 - t) + DARK_GREEN[1] * t)
        b = int(GREEN[2] * (1 - t) + DARK_GREEN[2] * t)

        if shielded:
            pulse = abs(((frame_count % 15) / 7.5) - 1)
            r = int(r * (1 - pulse * 0.3) + 255 * pulse * 0.3)
            g = int(g * (1 - pulse * 0.3) + 215 * pulse * 0.3)
            b = int(b * (1 - pulse * 0.3) + 0 * pulse * 0.3)

        color = (r, g, b)
        rect = pygame.Rect(segment.x * cell_size, segment.y * cell_size, cell_size, cell_size)
        inner = rect.inflate(-2, -2)
        pygame.draw.rect(screen, color, inner, border_radius=4)

    head = snake.body[0]
    hx = head.x * cell_size + cell_size // 2
    hy = head.y * cell_size + cell_size // 2
    dx, dy = snake.direction.value

    eye_offset = 4
    perp_x, perp_y = -dy, dx

    for sign in (-1, 1):
        ex = hx + dx * 3 + perp_x * eye_offset * sign
        ey = hy + dy * 3 + perp_y * eye_offset * sign
        pygame.draw.circle(screen, WHITE, (int(ex), int(ey)), 3)
        px = ex + dx * 1.5
        py = ey + dy * 1.5
        pygame.draw.circle(screen, (0, 0, 0), (int(px), int(py)), 1)

    if shielded:
        shield_rect = pygame.Rect(
            head.x * cell_size - 3, head.y * cell_size - 3,
            cell_size + 6, cell_size + 6
        )
        pulse = abs(((frame_count % 20) / 10) - 1)
        alpha = int(100 + 80 * pulse)
        shield_s = pygame.Surface((shield_rect.w, shield_rect.h), pygame.SRCALPHA)
        pygame.draw.rect(shield_s, (255, 215, 0, alpha), shield_s.get_rect(), 3, border_radius=8)
        screen.blit(shield_s, shield_rect.topleft)


def draw_trail(screen, trail_positions, frame_count):
    for i, (tx, ty, timestamp) in enumerate(trail_positions):
        age = frame_count - timestamp
        if age > 15:
            continue
        alpha = max(0, 180 - age * 12)
        s = pygame.Surface((cell_size, cell_size), pygame.SRCALPHA)
        color = (0, 181, 39, alpha)
        pygame.draw.rect(s, color, (2, 2, cell_size - 4, cell_size - 4), border_radius=3)
        screen.blit(s, (tx * cell_size, ty * cell_size))
