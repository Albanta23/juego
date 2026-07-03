"""HUD e indicadores de estado en pantalla."""

import pygame
import time
from snake_logic import grid_width, grid_height, cell_size
from powerups import PowerUpType


W = grid_width * cell_size
H = grid_height * cell_size


def draw_combo(screen, combo, combo_timer):
    if combo <= 1:
        return
    elapsed = time.time() - combo_timer
    if elapsed > 2.0:
        return
    fade = max(0, 1.0 - elapsed / 2.0)
    scale = 1.0 + 0.1 * combo + 0.2 * max(0, 0.3 - elapsed)
    font_size = int(30 * scale)
    font = pygame.font.Font(None, max(20, font_size))

    colors = {
        2: (255, 200, 50),
        3: (255, 150, 30),
        4: (255, 100, 0),
        5: (255, 50, 50),
    }
    color = colors.get(min(combo, 5), (255, 50, 50))

    alpha = int(255 * fade)
    text = font.render(f"COMBO x{combo}", True, color)
    text_rect = text.get_rect(center=(W // 2, H // 2 - 80))
    screen.blit(text, text_rect)


def draw_powerup_bar(screen, active_powerups):
    x = W - 160
    y = 5
    for ap in active_powerups:
        bar_w = 150
        bar_h = 18
        bg = (40, 40, 40)
        fg = ap.color
        pygame.draw.rect(screen, bg, (x, y, bar_w, bar_h), border_radius=4)
        fill_w = int(bar_w * ap.progress)
        if fill_w > 0:
            pygame.draw.rect(screen, fg, (x, y, fill_w, bar_h), border_radius=4)
        border_color = tuple(min(255, c + 40) for c in fg)
        pygame.draw.rect(screen, border_color, (x, y, bar_w, bar_h), 1, border_radius=4)
        font = pygame.font.Font(None, 16)
        text = font.render(f"{ap.label} {ap.remaining:.1f}s", True, (255, 255, 255))
        text_rect = text.get_rect(center=(x + bar_w // 2, y + bar_h // 2))
        screen.blit(text, text_rect)
        y += bar_h + 4


def draw_border_glow(screen, level, frame_count):
    colors = [
        (30, 60, 30),
        (30, 80, 50),
        (40, 100, 80),
        (50, 120, 120),
        (80, 80, 180),
        (120, 60, 200),
        (180, 50, 180),
        (200, 80, 120),
        (220, 120, 60),
        (255, 160, 40),
    ]
    base = colors[min(level - 1, len(colors) - 1)]
    pulse = 0.7 + 0.3 * abs(((frame_count % 60) / 30) - 1)
    color = tuple(int(c * pulse) for c in base)

    border = 3
    s = pygame.Surface((W, H), pygame.SRCALPHA)
    pygame.draw.rect(s, (*color, 120), (0, 0, W, border))
    pygame.draw.rect(s, (*color, 120), (0, H - border, W, border))
    pygame.draw.rect(s, (*color, 120), (0, 0, border, H))
    pygame.draw.rect(s, (*color, 120), (W - border, 0, border, H))
    screen.blit(s, (0, 0))


def draw_flash(screen, flash_alpha):
    if flash_alpha > 0:
        s = pygame.Surface((W, H))
        s.set_alpha(int(flash_alpha))
        s.fill((255, 255, 255))
        screen.blit(s, (0, 0))
