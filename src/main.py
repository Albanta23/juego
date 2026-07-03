#!/usr/bin/env python3
import sys
import os
import time

import pygame

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from game_screen import draw, draw_start_screen, draw_game_over
from snake_logic import Direction, Food, Snake, FoodType, grid_width, grid_height, cell_size
from sounds import SoundManager
from particles import ParticleSystem
from powerups import PowerUpManager, PowerUpType
from obstacles import ObstacleManager
from stats import Stats
from snake_logic import Position


HIGHSCORE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "highscore.txt")

W = grid_width * cell_size
H = grid_height * cell_size

STATE_START = 0
STATE_PLAYING = 1
STATE_GAME_OVER = 2


def load_high_score():
    try:
        with open(HIGHSCORE_FILE, "r") as f:
            return int(f.read().strip())
    except (FileNotFoundError, ValueError):
        return 0


def save_high_score(score):
    with open(HIGHSCORE_FILE, "w") as f:
        f.write(str(score))


def calc_level(score):
    return min(1 + score // 5, 10)


def calc_fps(level):
    return 8 + level * 2


def create_anim_snake():
    s = Snake()
    s.body = [Position(i, 5) for i in range(8, 0, -1)]
    s.direction = Direction.RIGHT
    return s


def move_anim_snake(snake):
    head = snake.body[0]
    dx, dy = snake.direction.value
    new_x = (head.x + dx) % grid_width
    new_y = (head.y + dy) % grid_height
    snake.body.insert(0, Position(new_x, new_y))
    snake.body.pop()

    if new_x >= grid_width - 2 or new_x <= 1:
        snake.direction = Direction.DOWN if dy == 0 else Direction.UP
    elif new_y >= grid_height - 2 or new_y <= 1:
        snake.direction = Direction.RIGHT if dx == 0 else Direction.LEFT


def main():
    pygame.init()
    screen = pygame.display.set_mode((W, H))
    pygame.display.set_caption("Snake Ultimate")
    clock = pygame.time.Clock()

    sound = SoundManager()
    high_score = load_high_score()
    stats = Stats()

    state = STATE_START
    frame_count = 0
    anim_snake = create_anim_snake()
    anim_timer = 0

    snake = None
    food = None
    particles = ParticleSystem()
    powerup_manager = PowerUpManager()
    obstacle_manager = ObstacleManager()
    score = 0
    paused = False
    pause_menu_index = 0
    sound_enabled = True
    combo = 0
    combo_timer = 0
    trail = []
    flash_alpha = 0
    game_start_time = 0
    last_level = 1

    while True:
        dt = clock.tick(60) / 1000.0
        frame_count += 1

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()

            if event.type == pygame.KEYDOWN:
                if state == STATE_START:
                    if event.key == pygame.K_RETURN:
                        snake = Snake()
                        food = Food()
                        food.generate_random(snake.body)
                        score = 0
                        paused = False
                        combo = 0
                        trail = []
                        flash_alpha = 0
                        particles = ParticleSystem()
                        powerup_manager = PowerUpManager()
                        obstacle_manager = ObstacleManager()
                        last_level = 1
                        game_start_time = time.time()
                        state = STATE_PLAYING
                    elif event.key == pygame.K_ESCAPE:
                        pygame.quit()
                        sys.exit()

                elif state == STATE_PLAYING:
                    if event.key == pygame.K_p:
                        paused = not paused
                        if paused:
                            pause_menu_index = 0
                    elif event.key == pygame.K_ESCAPE:
                        pygame.quit()
                        sys.exit()
                    elif paused:
                        if event.key == pygame.K_UP:
                            pause_menu_index = (pause_menu_index - 1) % 4
                        elif event.key == pygame.K_DOWN:
                            pause_menu_index = (pause_menu_index + 1) % 4
                        elif event.key == pygame.K_RETURN:
                            if pause_menu_index == 0:
                                paused = False
                            elif pause_menu_index == 1:
                                snake = Snake()
                                food = Food()
                                food.generate_random(snake.body)
                                score = 0
                                paused = False
                                pause_menu_index = 0
                                combo = 0
                                trail = []
                                flash_alpha = 0
                                particles = ParticleSystem()
                                powerup_manager = PowerUpManager()
                                obstacle_manager = ObstacleManager()
                                last_level = 1
                                game_start_time = time.time()
                            elif pause_menu_index == 2:
                                sound_enabled = not sound_enabled
                                sound.enabled = sound_enabled
                            elif pause_menu_index == 3:
                                state = STATE_START
                                paused = False
                                pause_menu_index = 0
                    elif not paused:
                        if snake.direction != Direction.DOWN and event.key == pygame.K_UP:
                            snake.direction = Direction.UP
                        elif snake.direction != Direction.UP and event.key == pygame.K_DOWN:
                            snake.direction = Direction.DOWN
                        elif snake.direction != Direction.RIGHT and event.key == pygame.K_LEFT:
                            snake.direction = Direction.LEFT
                        elif snake.direction != Direction.LEFT and event.key == pygame.K_RIGHT:
                            snake.direction = Direction.RIGHT

                elif state == STATE_GAME_OVER:
                    if event.key == pygame.K_r:
                        snake = Snake()
                        food = Food()
                        food.generate_random(snake.body)
                        score = 0
                        paused = False
                        combo = 0
                        trail = []
                        flash_alpha = 0
                        particles = ParticleSystem()
                        powerup_manager = PowerUpManager()
                        obstacle_manager = ObstacleManager()
                        last_level = 1
                        game_start_time = time.time()
                        state = STATE_PLAYING
                    elif event.key == pygame.K_ESCAPE:
                        pygame.quit()
                        sys.exit()

        if state == STATE_START:
            anim_timer += dt
            if anim_timer >= 0.15:
                anim_timer = 0
                move_anim_snake(anim_snake)
            draw_start_screen(screen, frame_count, high_score, stats, anim_snake)

        elif state == STATE_PLAYING:
            if not paused:
                effective_fps = calc_fps(calc_level(score))
                speed_mult = powerup_manager.speed_multiplier()

                food.try_spawn_bonus(snake.body, obstacle_manager.blocks)
                food.check_bonus_expired()
                powerup_manager.update(snake.body, food.pos)

                obstacle_manager.update(calc_level(score), snake.body, food.pos)

                prev_head = snake.body[0].to_tuple()
                result = snake.move(food, obstacle_manager.blocks)

                if result["normal"]:
                    score += 1 * powerup_manager.score_multiplier()
                    particles.emit_eat(
                        snake.body[0].x * cell_size + cell_size // 2,
                        snake.body[0].y * cell_size + cell_size // 2
                    )
                    sound.play_eat()
                    stats.on_food_eaten()
                    combo += 1
                    combo_timer = time.time()
                    flash_alpha = 80
                    stats.on_combo(combo)
                    if combo > 1:
                        sound.play_combo(combo)

                elif result["bonus"]:
                    score += 3 * powerup_manager.score_multiplier()
                    particles.emit_bonus(
                        snake.body[0].x * cell_size + cell_size // 2,
                        snake.body[0].y * cell_size + cell_size // 2
                    )
                    sound.play_bonus()
                    stats.on_food_eaten()
                    combo += 1
                    combo_timer = time.time()
                    flash_alpha = 120

                elif result["speed"]:
                    score += 1 * powerup_manager.score_multiplier()
                    snake.invincible_until = time.time() + 2.0
                    particles.emit_powerup(
                        snake.body[0].x * cell_size + cell_size // 2,
                        snake.body[0].y * cell_size + cell_size // 2,
                        (255, 140, 0)
                    )
                    sound.play_speed_food()
                    stats.on_food_eaten()
                    combo += 1
                    combo_timer = time.time()
                    flash_alpha = 60

                elif result["poison"]:
                    score = max(0, score - 2)
                    snake.shrink(2)
                    particles.emit_powerup(
                        snake.body[0].x * cell_size + cell_size // 2,
                        snake.body[0].y * cell_size + cell_size // 2,
                        (160, 50, 200)
                    )
                    sound.play_poison()
                    combo = 0
                    flash_alpha = 40

                if time.time() - combo_timer > 2.0:
                    combo = 0

                collected = powerup_manager.collect(snake.body[0])
                if collected:
                    sound.play_powerup()
                    stats.on_powerup()
                    particles.emit_powerup(
                        snake.body[0].x * cell_size + cell_size // 2,
                        snake.body[0].y * cell_size + cell_size // 2,
                        collected.color
                    )
                    if collected.ptype == PowerUpType.SHIELD:
                        snake.invincible_until = time.time() + collected.duration

                if snake.is_dead():
                    is_shielded = powerup_manager.is_shielded()
                    if is_shielded:
                        powerup_manager.active = [a for a in powerup_manager.active if a.ptype != PowerUpType.SHIELD]
                        snake.invincible_until = 0
                        particles.emit_powerup(
                            snake.body[0].x * cell_size + cell_size // 2,
                            snake.body[0].y * cell_size + cell_size // 2,
                            (255, 215, 0)
                        )
                    else:
                        state = STATE_GAME_OVER
                        playtime = time.time() - game_start_time
                        stats.on_game_end(score, len(snake.body), playtime)
                        if score > high_score:
                            high_score = score
                            save_high_score(high_score)
                        particles.emit_death(
                            snake.body[0].x * cell_size + cell_size // 2,
                            snake.body[0].y * cell_size + cell_size // 2
                        )
                        sound.play_game_over()

                trail.insert(0, (prev_head[0], prev_head[1], frame_count))
                trail = [(x, y, t) for x, y, t in trail if frame_count - t < 15]

                current_level = calc_level(score)
                if current_level > last_level:
                    sound.play_level_up()
                    last_level = current_level

                if flash_alpha > 0:
                    flash_alpha = max(0, flash_alpha - 300 * dt)

            particles.update(dt)

            draw(screen, snake, food, score, high_score, calc_level(score), paused,
                 frame_count, combo, combo_timer, particles, powerup_manager,
                 trail, flash_alpha, obstacle_manager, pause_menu_index)

            game_fps = calc_fps(calc_level(score))
            speed_mult = powerup_manager.speed_multiplier()
            adjusted_fps = int(game_fps * speed_mult)
            clock.tick(adjusted_fps)

        elif state == STATE_GAME_OVER:
            particles.update(dt)
            draw(screen, snake, food, score, high_score, calc_level(score), False,
                 frame_count, combo, combo_timer, particles, powerup_manager,
                 trail, 0, obstacle_manager)
            draw_game_over(screen, score, high_score, stats, frame_count)

        pygame.display.update()


if __name__ == "__main__":
    main()
