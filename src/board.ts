import type { Board, Color, GameState, Move, Piece, SquareIndex } from './types.js';

/**
 * Row 0 is the top of the board (black's back rank), row 7 is the bottom
 * (white's back rank). Only dark squares ((row+col) odd) are playable and
 * addressable; they're numbered 0-31 in row-major order.
 */
const ROW_OF: number[] = [];
const COL_OF: number[] = [];
const INDEX_OF: number[][] = Array.from({ length: 8 }, () => Array(8).fill(-1));

(function buildLookup() {
  let idx = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        ROW_OF[idx] = row;
        COL_OF[idx] = col;
        INDEX_OF[row][col] = idx;
        idx++;
      }
    }
  }
})();

export function squareToRowCol(square: SquareIndex): { row: number; col: number } {
  return { row: ROW_OF[square], col: COL_OF[square] };
}

export function rowColToSquare(row: number, col: number): SquareIndex | -1 {
  if (row < 0 || row > 7 || col < 0 || col > 7) return -1;
  return INDEX_OF[row][col];
}

export function createInitialBoard(): Board {
  const board: Board = new Array(32).fill(null);
  for (let i = 0; i < 12; i++) board[i] = { color: 'b', rank: 'man' };
  for (let i = 20; i < 32; i++) board[i] = { color: 'w', rank: 'man' };
  return board;
}

export function createInitialState(): GameState {
  return { board: createInitialBoard(), turn: 'b' };
}

export function cloneBoard(board: Board): Board {
  return board.map((p) => (p ? { ...p } : null));
}

/** Row a man of this color must reach to be promoted to king. */
export function backRankRow(color: Color): number {
  return color === 'b' ? 7 : 0;
}

/**
 * Applies a move to a board, returning a new board. Does not validate
 * legality — callers must only pass moves produced by the rules engine.
 */
export function applyMove(board: Board, move: Move): Board {
  const next = cloneBoard(board);
  const piece = next[move.from];
  if (!piece) throw new Error(`applyMove: no piece at square ${move.from}`);
  next[move.from] = null;
  for (const captured of move.captures) next[captured] = null;
  next[move.to] = move.promotes ? { ...piece, rank: 'king' } : piece;
  return next;
}

export function countPieces(board: Board, color: Color): number {
  return board.reduce((n, p) => n + (p && p.color === color ? 1 : 0), 0);
}
