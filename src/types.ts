export type Color = 'b' | 'w';
export type Rank = 'man' | 'king';

export interface Piece {
  color: Color;
  rank: Rank;
}

/** Index 0-31 into the 32 playable (dark) squares of an 8x8 board. */
export type SquareIndex = number;

export type Board = (Piece | null)[];

export interface Move {
  from: SquareIndex;
  to: SquareIndex;
  /** Ordered squares of captured pieces; empty for a simple (non-capturing) move. */
  captures: SquareIndex[];
  promotes: boolean;
}

export interface GameState {
  board: Board;
  turn: Color;
}

export function otherColor(c: Color): Color {
  return c === 'b' ? 'w' : 'b';
}
