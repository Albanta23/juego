"""Generador programático de efectos de sonido para el Snake."""

import pygame
import array
import math


def _generate_tone(frequency, duration_ms, volume=0.5, wave_type="sine"):
    sample_rate = 22050
    n_samples = int(sample_rate * duration_ms / 1000)
    buf = array.array('h', [0] * n_samples)
    max_amp = int(32767 * volume)

    for i in range(n_samples):
        t = i / sample_rate
        envelope = 1.0 - (i / n_samples)
        if wave_type == "sine":
            val = math.sin(2 * math.pi * frequency * t)
        elif wave_type == "square":
            val = 1.0 if math.sin(2 * math.pi * frequency * t) >= 0 else -1.0
        elif wave_type == "sawtooth":
            val = 2.0 * (frequency * t - math.floor(0.5 + frequency * t))
        else:
            val = math.sin(2 * math.pi * frequency * t)
        buf[i] = int(val * max_amp * envelope)

    return pygame.mixer.Sound(buffer=buf)


def _generate_chord(frequencies, duration_ms, volume=0.4):
    sample_rate = 22050
    n_samples = int(sample_rate * duration_ms / 1000)
    buf = array.array('h', [0] * n_samples)
    max_amp = int(32767 * volume / len(frequencies))

    for i in range(n_samples):
        t = i / sample_rate
        envelope = 1.0 - (i / n_samples)
        val = sum(math.sin(2 * math.pi * f * t) for f in frequencies)
        buf[i] = int(val * max_amp * envelope)

    return pygame.mixer.Sound(buffer=buf)


def _generate_ascending(base_freq, steps, step_duration_ms, volume=0.3):
    sample_rate = 22050
    total_ms = step_duration_ms * steps
    n_samples = int(sample_rate * total_ms / 1000)
    buf = array.array('h', [0] * n_samples)
    max_amp = int(32767 * volume)

    for i in range(n_samples):
        t = i / sample_rate
        step = int(i / (sample_rate * step_duration_ms / 1000))
        freq = base_freq * (2 ** (step / 12.0))
        global_t = i / n_samples
        envelope = 1.0 - global_t * 0.5
        val = math.sin(2 * math.pi * freq * t) * envelope
        buf[i] = int(val * max_amp)

    return pygame.mixer.Sound(buffer=buf)


def _generate_fanfare(volume=0.3):
    sample_rate = 22050
    notes = [523, 659, 784, 1047]
    note_dur = 0.1
    total_ms = int(note_dur * 1000 * len(notes))
    n_samples = int(sample_rate * total_ms / 1000)
    buf = array.array('h', [0] * n_samples)
    max_amp = int(32767 * volume)

    for i in range(n_samples):
        t = i / sample_rate
        note_idx = min(int(t / note_dur), len(notes) - 1)
        freq = notes[note_idx]
        note_t = t - note_idx * note_dur
        envelope = max(0, 1.0 - note_t / note_dur * 0.3)
        val = math.sin(2 * math.pi * freq * t) * envelope
        buf[i] = int(val * max_amp)

    return pygame.mixer.Sound(buffer=buf)


class SoundManager:
    def __init__(self):
        self.enabled = True
        try:
            pygame.mixer.init()
            self.eat = _generate_tone(880, 80, volume=0.25)
            self.eat_bonus = _generate_chord([523, 659, 784], 200, volume=0.25)
            self.game_over = _generate_tone(220, 400, volume=0.25)
            self.powerup = _generate_ascending(440, 6, 50, volume=0.2)
            self.level_up = _generate_fanfare(volume=0.2)
            self.obstacle_hit = _generate_tone(150, 200, volume=0.25, wave_type="square")
            self.poison = _generate_tone(300, 150, volume=0.2, wave_type="sawtooth")
            self.speed_food = _generate_tone(660, 100, volume=0.2)
            self.combo_2 = _generate_tone(600, 60, volume=0.15)
            self.combo_3 = _generate_tone(750, 60, volume=0.15)
            self.combo_4 = _generate_tone(900, 60, volume=0.15)
            self.combo_5 = _generate_chord([600, 750, 900], 100, volume=0.15)
        except Exception:
            self.enabled = False

    def play_eat(self):
        if self.enabled:
            self.eat.play()

    def play_bonus(self):
        if self.enabled:
            self.eat_bonus.play()

    def play_game_over(self):
        if self.enabled:
            self.game_over.play()

    def play_powerup(self):
        if self.enabled:
            self.powerup.play()

    def play_level_up(self):
        if self.enabled:
            self.level_up.play()

    def play_obstacle_hit(self):
        if self.enabled:
            self.obstacle_hit.play()

    def play_poison(self):
        if self.enabled:
            self.poison.play()

    def play_speed_food(self):
        if self.enabled:
            self.speed_food.play()

    def play_combo(self, level):
        if not self.enabled:
            return
        if level <= 2:
            self.combo_2.play()
        elif level <= 3:
            self.combo_3.play()
        elif level <= 4:
            self.combo_4.play()
        else:
            self.combo_5.play()
