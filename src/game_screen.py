import pygame
import time
from snake_logic import (cell_size, grid_width, grid_height, draw_grid, draw_food,
                          draw_snake, draw_trail, FoodType)
from powerups import PowerUpType
from ui import draw_combo, draw_powerup_bar, draw_border_glow, draw_flash
from particles import ParticleSystem


W = grid_width * cell_size
H = grid_height * cell_size

BG_TOP = (20, 20, 30)
BG_BOTTOM = (35, 35, 50)


def draw_background(screen):
    for y in range(H):
        t = y / H
        r = int(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t)
        pygame.draw.line(screen, (r, g, b), (0, y), (W, y))


def draw(screen, snake, food, score, high_score, level, paused, frame_count,
         combo, combo_timer, particles, powerup_manager, trail, flash_alpha, obstacles,
         pause_menu_index=0):
    draw_background(screen)
    draw_grid(screen)

    draw_trail(screen, trail, frame_count)

    if obstacles:
        from obstacles import ObstacleManager
        obstacles.draw(screen, frame_count)

    draw_food(screen, food, frame_count)
    powerup_manager.draw(screen)
    draw_snake(screen, snake, frame_count)
    particles.draw(screen)
    draw_flash(screen, flash_alpha)

    draw_border_glow(screen, level, frame_count)

    font_small = pygame.font.Font(None, 28)
    font_big = pygame.font.Font(None, 24)

    score_text = font_small.render(f"Score: {score}", True, (255, 255, 255))
    screen.blit(score_text, (10, 5))

    high_text = font_big.render(f"High: {high_score}", True, (200, 200, 200))
    screen.blit(high_text, (10, 28))

    level_text = font_big.render(f"Level: {level}", True, (180, 180, 255))
    screen.blit(level_text, (W - 100, 5))

    if food.special_type == FoodType.SPEED:
        special_text = font_big.render("SPEED FOOD!", True, ORANGE)
        screen.blit(special_text, (W // 2 - 50, 5))
    elif food.special_type == FoodType.POISON:
        special_text = font_big.render("POISON!", True, PURPLE)
        screen.blit(special_text, (W // 2 - 35, 5))

    draw_combo(screen, combo, combo_timer)
    draw_powerup_bar(screen, powerup_manager.active)

    if snake.is_invincible:
        inv_text = font_big.render("SHIELD ACTIVE", True, (255, 215, 0))
        inv_rect = inv_text.get_rect(center=(W // 2, H - 20))
        screen.blit(inv_text, inv_rect)

    if paused:
        overlay = pygame.Surface((W, H))
        overlay.set_alpha(150)
        overlay.fill((0, 0, 0))
        screen.blit(overlay, (0, 0))
        font = pygame.font.Font(None, 60)
        text = font.render("PAUSED", True, (255, 255, 255))
        rect = text.get_rect(center=(W // 2, H // 2 - 40))
        screen.blit(text, rect)

        font_menu = pygame.font.Font(None, 32)
        menu_items = ["Continue", "Restart", "Sound ON/OFF", "Main Menu"]
        for i, item in enumerate(menu_items):
            color = (255, 215, 0) if i == pause_menu_index else (180, 180, 180)
            prefix = "> " if i == pause_menu_index else "  "
            item_text = font_menu.render(prefix + item, True, color)
            item_rect = item_text.get_rect(center=(W // 2, H // 2 + 20 + i * 30))
            screen.blit(item_text, item_rect)


ORANGE = (255, 140, 0)
PURPLE = (160, 50, 200)


def draw_start_screen(screen, frame_count, high_score, stats, anim_snake):
    draw_background(screen)

    if anim_snake:
        draw_snake(screen, anim_snake, frame_count)

    pulse = abs(((frame_count % 40) / 20) - 1)
    title_size = int(80 + 10 * pulse)
    font_title = pygame.font.Font(None, max(40, title_size))
    font_sub = pygame.font.Font(None, 36)
    font_hint = pygame.font.Font(None, 28)
    font_stats = pygame.font.Font(None, 22)

    title = font_title.render("SNAKE", True, (0, 200, 50))
    title_rect = title.get_rect(center=(W // 2, H // 2 - 100))
    screen.blit(title, title_rect)

    sub = font_sub.render("Press ENTER to play", True, (255, 255, 255))
    sub_rect = sub.get_rect(center=(W // 2, H // 2 - 40))
    screen.blit(sub, sub_rect)

    if high_score > 0:
        hi = font_hint.render(f"High Score: {high_score}", True, (255, 215, 0))
        hi_rect = hi.get_rect(center=(W // 2, H // 2))
        screen.blit(hi, hi_rect)

    if stats:
        stat_lines = stats.summary_lines()
        for i, line in enumerate(stat_lines[:5]):
            text = font_stats.render(line, True, (130, 130, 150))
            rect = text.get_rect(center=(W // 2, H // 2 + 40 + i * 20))
            screen.blit(text, rect)

    controls = [
        "Arrows: Move | P: Pause | ESC: Quit",
    ]
    for i, line in enumerate(controls):
        hint = font_hint.render(line, True, (120, 120, 120))
        hint_rect = hint.get_rect(center=(W // 2, H - 50))
        screen.blit(hint, hint_rect)


def draw_game_over(screen, score, high_score, stats, frame_count):
    overlay = pygame.Surface((W, H))
    overlay.set_alpha(160)
    overlay.fill((0, 0, 0))
    screen.blit(overlay, (0, 0))

    font_big = pygame.font.Font(None, 60)
    font_med = pygame.font.Font(None, 40)
    font_small = pygame.font.Font(None, 30)
    font_stats = pygame.font.Font(None, 22)

    go_text = font_big.render("GAME OVER", True, (255, 80, 80))
    go_rect = go_text.get_rect(center=(W // 2, H // 2 - 80))
    screen.blit(go_text, go_rect)

    score_text = font_med.render(f"Score: {score}", True, (255, 255, 255))
    score_rect = score_text.get_rect(center=(W // 2, H // 2 - 30))
    screen.blit(score_text, score_rect)

    if score >= high_score and score > 0:
        new_hi = font_med.render("NEW HIGH SCORE!", True, (255, 215, 0))
        new_hi_rect = new_hi.get_rect(center=(W // 2, H // 2 + 10))
        screen.blit(new_hi, new_hi_rect)
    else:
        hi_text = font_small.render(f"High Score: {high_score}", True, (180, 180, 180))
        hi_rect = hi_text.get_rect(center=(W // 2, H // 2 + 10))
        screen.blit(hi_text, hi_rect)

    if stats:
        stat_lines = stats.summary_lines()
        for i, line in enumerate(stat_lines[:4]):
            text = font_stats.render(line, True, (130, 130, 150))
            rect = text.get_rect(center=(W // 2, H // 2 + 55 + i * 18))
            screen.blit(text, rect)

    restart = font_small.render("R = Restart  |  ESC = Quit", True, (150, 150, 150))
    restart_rect = restart.get_rect(center=(W // 2, H - 40))
    screen.blit(restart, restart_rect)
