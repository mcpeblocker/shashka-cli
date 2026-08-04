import { applyMove } from './board.js';
import { legalMoves } from './rules.js';
import type { Color, GameState, Move } from './types.js';
import type { Player } from './player.js';

const SEARCH_DEPTH = 6;
const KING_WEIGHT = 1.5;
const MOBILITY_WEIGHT = 0.1;
const WIN_SCORE = 10000;

function evaluate(state: GameState, forColor: Color, movesForTurn: Move[]): number {
  const other = forColor === 'b' ? 'w' : 'b';
  let myMen = 0,
    myKings = 0,
    oppMen = 0,
    oppKings = 0;
  for (const piece of state.board) {
    if (!piece) continue;
    if (piece.color === forColor) piece.rank === 'king' ? myKings++ : myMen++;
    else piece.rank === 'king' ? oppKings++ : oppMen++;
  }
  const myMoves = state.turn === forColor ? movesForTurn.length : 0;
  const oppMoves = state.turn === other ? movesForTurn.length : 0;
  return (
    myMen - oppMen + KING_WEIGHT * (myKings - oppKings) + MOBILITY_WEIGHT * (myMoves - oppMoves)
  );
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizingColor: Color,
): { move: Move | null; score: number } {
  const moves = legalMoves(state);
  if (moves.length === 0) {
    // Side to move has no legal moves: they lose. Score favors the maximizing color.
    const score = state.turn === maximizingColor ? -WIN_SCORE - depth : WIN_SCORE + depth;
    return { move: null, score };
  }
  if (depth === 0) {
    return { move: null, score: evaluate(state, maximizingColor, moves) };
  }

  // Move ordering: captures first (mandatory anyway, but also tend to be strong).
  const ordered = [...moves].sort((a, b) => b.captures.length - a.captures.length);
  const maximizing = state.turn === maximizingColor;
  let best: Move = ordered[0];
  let bestScore = maximizing ? -Infinity : Infinity;

  for (const move of ordered) {
    const nextState: GameState = {
      board: applyMove(state.board, move),
      turn: state.turn === 'b' ? 'w' : 'b',
    };
    const { score } = minimax(nextState, depth - 1, alpha, beta, maximizingColor);
    if (maximizing) {
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
      alpha = Math.max(alpha, bestScore);
    } else {
      if (score < bestScore) {
        bestScore = score;
        best = move;
      }
      beta = Math.min(beta, bestScore);
    }
    if (beta <= alpha) break;
  }
  return { move: best, score: bestScore };
}

export class AIPlayer implements Player {
  constructor(public color: Color) {}

  async chooseMove(state: GameState, legal: Move[]): Promise<Move> {
    if (legal.length === 1) return legal[0];
    const { move } = minimax(state, SEARCH_DEPTH, -Infinity, Infinity, this.color);
    return move ?? legal[0];
  }
}
