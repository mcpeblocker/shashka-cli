import { pathToFileURL } from 'node:url';
import { rowColToSquare, squareToRowCol } from './board.js';
import type { SquareIndex } from './types.js';

/** Square index -> coordinate like "c3" (columns a-h, rows 1-8 bottom to top). */
export function squareToCoord(square: SquareIndex): string {
  const { row, col } = squareToRowCol(square);
  const letter = String.fromCharCode(97 + col);
  const displayRow = 8 - row;
  return `${letter}${displayRow}`;
}

/** Coordinate like "c3" -> square index, or -1 if invalid or a light square. */
export function coordToSquare(coord: string): SquareIndex | -1 {
  const m = /^([a-h])([1-8])$/.exec(coord.trim().toLowerCase());
  if (!m) return -1;
  const col = m[1].charCodeAt(0) - 97;
  const displayRow = Number(m[2]);
  const row = 8 - displayRow;
  return rowColToSquare(row, col);
}

export function parseMove(input: string): { from: SquareIndex; to: SquareIndex } | null {
  const m = /^\s*([a-h][1-8])\s*-\s*([a-h][1-8])\s*$/i.exec(input);
  if (!m) return null;
  const from = coordToSquare(m[1]);
  const to = coordToSquare(m[2]);
  if (from === -1 || to === -1) return null;
  return { from, to };
}

// ponytail: assert-based self-check, not a test framework — run via `npm run selftest`.
function selfCheck() {
  for (let i = 0; i < 32; i++) {
    const coord = squareToCoord(i);
    const back = coordToSquare(coord);
    if (back !== i) throw new Error(`notation round-trip failed for square ${i} (${coord} -> ${back})`);
  }
  const known: [SquareIndex, string][] = [
    [0, 'b8'],
    [31, 'g1'],
  ];
  for (const [square, coord] of known) {
    if (squareToCoord(square) !== coord) {
      throw new Error(`expected square ${square} to be ${coord}, got ${squareToCoord(square)}`);
    }
  }
  if (parseMove('c3-d4') === null) throw new Error('parseMove failed on valid input');
  if (parseMove('z9-d4') !== null) throw new Error('parseMove accepted invalid input');
  console.log('notation.ts self-check passed');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) selfCheck();
