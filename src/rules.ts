import { pathToFileURL } from 'node:url';
import { backRankRow, cloneBoard, rowColToSquare, squareToRowCol } from './board.js';
import type { Board, Color, GameState, Move, Rank, SquareIndex } from './types.js';

type Dir = readonly [number, number];
const ALL_DIRS: readonly Dir[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const FORWARD_DIRS: Record<Color, readonly Dir[]> = {
  b: [
    [1, -1],
    [1, 1],
  ],
  w: [
    [-1, -1],
    [-1, 1],
  ],
};

function dirsFor(color: Color, rank: Rank): readonly Dir[] {
  return rank === 'king' ? ALL_DIRS : FORWARD_DIRS[color];
}

function neighbor(square: SquareIndex, dr: number, dc: number): SquareIndex | -1 {
  const { row, col } = squareToRowCol(square);
  return rowColToSquare(row + dr, col + dc);
}

export function generateSimpleMoves(state: GameState): Move[] {
  const { board, turn } = state;
  const moves: Move[] = [];
  for (let square = 0; square < 32; square++) {
    const piece = board[square];
    if (!piece || piece.color !== turn) continue;
    for (const [dr, dc] of dirsFor(piece.color, piece.rank)) {
      const to = neighbor(square, dr, dc);
      if (to === -1 || board[to] !== null) continue;
      const { row: toRow } = squareToRowCol(to);
      const promotes = piece.rank === 'man' && toRow === backRankRow(piece.color);
      moves.push({ from: square, to, captures: [], promotes });
    }
  }
  return moves;
}

function captureChainsFrom(
  workBoard: Board,
  origin: SquareIndex,
  color: Color,
  rank: Rank,
  currentSquare: SquareIndex,
  capturedSoFar: SquareIndex[],
): Move[] {
  const results: Move[] = [];
  for (const [dr, dc] of dirsFor(color, rank)) {
    const mid = neighbor(currentSquare, dr, dc);
    if (mid === -1) continue;
    const land = neighbor(mid, dr, dc);
    if (land === -1) continue;
    const midPiece = workBoard[mid];
    if (!midPiece || midPiece.color === color) continue;
    if (capturedSoFar.includes(mid)) continue;
    const landIsEmpty = workBoard[land] === null || capturedSoFar.includes(land);
    if (!landIsEmpty) continue;

    const newCaptured = [...capturedSoFar, mid];
    const { row: landRow } = squareToRowCol(land);
    const promotes = rank === 'man' && landRow === backRankRow(color);

    if (promotes) {
      // American rules: a man that promotes mid-chain stops jumping immediately.
      results.push({ from: origin, to: land, captures: newCaptured, promotes: true });
      continue;
    }
    const deeper = captureChainsFrom(workBoard, origin, color, rank, land, newCaptured);
    if (deeper.length > 0) {
      results.push(...deeper);
    } else {
      results.push({ from: origin, to: land, captures: newCaptured, promotes: false });
    }
  }
  return results;
}

export function generateCaptureMoves(state: GameState): Move[] {
  const { board, turn } = state;
  const moves: Move[] = [];
  for (let square = 0; square < 32; square++) {
    const piece = board[square];
    if (!piece || piece.color !== turn) continue;
    const workBoard = cloneBoard(board);
    workBoard[square] = null; // picked up; irrelevant to its own capture search
    moves.push(...captureChainsFrom(workBoard, square, piece.color, piece.rank, square, []));
  }
  return moves;
}

/** Mandatory-capture rule: if any capture is available, only capture moves are legal. */
export function legalMoves(state: GameState): Move[] {
  const captures = generateCaptureMoves(state);
  return captures.length > 0 ? captures : generateSimpleMoves(state);
}

// ponytail: assert-based self-check, not a test framework — run via `npm run selftest`.
function selfCheck() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`rules self-check failed: ${msg}`);
  };
  const empty = (): Board => new Array(32).fill(null);
  const sq = (row: number, col: number): SquareIndex => {
    const s = rowColToSquare(row, col);
    if (s === -1) throw new Error(`test setup: (${row},${col}) is not a dark square`);
    return s;
  };

  // Forced single capture: black man jumps a white man diagonally forward.
  {
    const from = sq(2, 1);
    const mid = sq(3, 2);
    const to = sq(4, 3);
    const board = empty();
    board[from] = { color: 'b', rank: 'man' };
    board[mid] = { color: 'w', rank: 'man' };
    const moves = legalMoves({ board, turn: 'b' });
    assert(moves.length === 1, `expected 1 forced capture, got ${moves.length}`);
    assert(moves[0].to === to && moves[0].captures.length === 1 && moves[0].captures[0] === mid, 'single capture geometry wrong');
  }

  // Forced double jump: black man jumps two white men in a row.
  {
    const from = sq(2, 1);
    const mid1 = sq(3, 2);
    const land1 = sq(4, 3);
    const mid2 = sq(5, 4);
    const land2 = sq(6, 5);
    const board = empty();
    board[from] = { color: 'b', rank: 'man' };
    board[mid1] = { color: 'w', rank: 'man' };
    board[mid2] = { color: 'w', rank: 'man' };
    const moves = legalMoves({ board, turn: 'b' });
    assert(moves.length === 1, `expected 1 forced double-jump, got ${moves.length}`);
    assert(
      moves[0].to === land2 && moves[0].captures.length === 2,
      `expected double capture to land on ${land2}, got ${JSON.stringify(moves[0])} (land1=${land1})`,
    );
  }

  // Promotion mid-chain stops the chain even though another capture would be available.
  {
    const from = sq(5, 2);
    const mid = sq(6, 1);
    const land = sq(7, 0); // black's back rank -> promotes, chain must stop here
    const board = empty();
    board[from] = { color: 'b', rank: 'man' };
    board[mid] = { color: 'w', rank: 'man' };
    const moves = legalMoves({ board, turn: 'b' });
    assert(moves.length === 1, `expected 1 promoting capture, got ${moves.length}`);
    const mv = moves[0];
    assert(
      mv.to === land && mv.promotes === true && mv.captures.length === 1,
      `expected promotion stop at ${land}, got ${JSON.stringify(mv)}`,
    );
  }

  // No moves at all -> empty legalMoves (used by game.ts for loss detection).
  {
    const board = empty();
    board[sq(2, 1)] = { color: 'w', rank: 'man' };
    const moves = legalMoves({ board, turn: 'b' });
    assert(moves.length === 0, 'expected no legal moves for side with no pieces');
  }

  console.log('rules.ts self-check passed');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) selfCheck();
