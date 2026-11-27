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
// Every word is worth up to 1 point, so a run is scored out of WORDS_PER_RUN.
export const CLEAR_POINTS = 0.8; // clearing a word with no typos
export const SPEED_POINTS = 0.2; // extra for speed, full when finished within the PERFECT band
export const TYPO_PENALTY = 0.05; // per wrong key inside the window
export const MIN_CLEAR_POINTS = 0.3; // a cleared word never scores less than this

// Run shape
export const WORDS_PER_RUN = 20; // including the tricky finale
export const RUN_TAIL_GAME = 1.6; // game-seconds of running after the last obstacle

export const LAUNCH_DATE = "2026-11-26"; // daily #1

export function windowRealFor(word: string): number {
  return REACTION_SEC + word.length * SEC_PER_LETTER;
}
