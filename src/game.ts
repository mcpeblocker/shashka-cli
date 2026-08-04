import { applyMove } from './board.js';
import { legalMoves } from './rules.js';
import { otherColor } from './types.js';
import type { Color, GameState, Move } from './types.js';
import type { Player } from './player.js';

export interface GameHooks {
  onTurnStart?: (state: GameState, legal: Move[]) => void;
  onMoveMade?: (state: GameState, move: Move, mover: Color) => void;
}

// ponytail: without this, two evenly-matched players (esp. two AIs) can shuffle
// non-capturing moves forever — a hard cap on capture-less plies forces a draw,
// mirroring the standard checkers no-progress rule.
const NO_PROGRESS_PLY_LIMIT = 80;

/**
 * Runs a full game to completion and returns the winning color, or 'draw' if
 * no capture has been made for NO_PROGRESS_PLY_LIMIT plies. A side loses when
 * it has no legal moves on its turn — this also covers having zero pieces
 * left, since a piece-less side generates no moves.
 */
export async function playGame(
  initialState: GameState,
  players: Record<Color, Player>,
  hooks: GameHooks = {},
): Promise<Color | 'draw'> {
  let state = initialState;
  let plySinceCapture = 0;
  for (;;) {
    const moves = legalMoves(state);
    if (moves.length === 0) return otherColor(state.turn);
    if (plySinceCapture >= NO_PROGRESS_PLY_LIMIT) return 'draw';

    hooks.onTurnStart?.(state, moves);
    const mover = state.turn;
    const move = await players[mover].chooseMove(state, moves);
    plySinceCapture = move.captures.length > 0 ? 0 : plySinceCapture + 1;
    state = { board: applyMove(state.board, move), turn: otherColor(mover) };
    hooks.onMoveMade?.(state, move, mover);
  }
}
