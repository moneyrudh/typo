// Fixed logical frame. Everything is laid out in these units and scaled to fit.
export const FRAME_W = 450;
export const FRAME_H = 800;
export const GAME_H = 464; // top ~58% is the game view, the rest is HUD + keyboard

// World
export const GROUND_Y = 384; // y of the ground surface inside the game view
export const RUNNER_SCREEN_X = 80; // where the runner sits on screen
export const RUN_SPEED = 340; // world units per game-second

// Word windows (see ROADMAP §2.1)
export const TARGET_WPM = 35;
export const SEC_PER_LETTER = 60 / (TARGET_WPM * 5);
export const REACTION_SEC = 0.9;
export const WINDOW_GAME_GAP = 0.5; // game-seconds between t1 and t2, constant for all words
export const SLOWMO_RAMP_GAME = 0.22; // game-seconds spent easing into slow-mo before t1
export const SLOWMO_EXIT_REAL = 0.15; // real seconds to ease back to 1x after early completion
export const MIN_SLOT_GAP_GAME = 0.35; // breathing room between one action ending and the next ramp

// Scoring (see ROADMAP §2.3)
export const BASE_POINTS = 100;
export const TRICKY_MULTIPLIER = 2;
export const COMBO_STEP = 0.1;
export const COMBO_CAP = 10;

// Run shape
export const TARGET_SLOTS = 16; // regular words, plus one tricky finale
export const RUN_TAIL_GAME = 1.6; // game-seconds of running after the last obstacle

export const LAUNCH_DATE = "2026-11-26"; // daily #1

export function windowRealFor(word: string): number {
  return REACTION_SEC + word.length * SEC_PER_LETTER;
}
