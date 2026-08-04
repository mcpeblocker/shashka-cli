import type { Color, GameState, Move } from './types.js';

export interface Player {
  color: Color;
  chooseMove(state: GameState, legalMoves: Move[]): Promise<Move>;
}

export type MoveResolver = (state: GameState, legalMoves: Move[]) => Promise<Move>;

export class HumanPlayer implements Player {
  constructor(
    public color: Color,
    private resolve: MoveResolver,
  ) {}

  chooseMove(state: GameState, legalMoves: Move[]): Promise<Move> {
    return this.resolve(state, legalMoves);
  }
}
