import readline from 'node:readline';
import { squareToRowCol, rowColToSquare } from './board.js';
import { renderBoard } from './render.js';
import { squareToCoord } from './notation.js';
import type { MoveResolver } from './player.js';
import type { SquareIndex } from './types.js';

type Direction = 'up' | 'down' | 'left' | 'right';

// Row/column nav: ↑/↓ change row (snap to nearest dark square in that row),
// ←/→ move between dark squares within the same row (2 cols apart).
function gridStep(from: SquareIndex, dir: Direction): SquareIndex | null {
  const { row, col } = squareToRowCol(from);
  if (dir === 'up' || dir === 'down') {
    const newRow = dir === 'up' ? row - 1 : row + 1;
    if (newRow < 0 || newRow > 7) return null;
    // dark squares in newRow are the cols where (newRow+c)%2===1
    const darkCols = [0, 1, 2, 3, 4, 5, 6, 7].filter((c) => (newRow + c) % 2 === 1);
    const nearest = darkCols.reduce((best, c) =>
      Math.abs(c - col) < Math.abs(best - col) ? c : best,
    );
    const sq = rowColToSquare(newRow, nearest);
    return sq === -1 ? null : sq;
  } else {
    const newCol = dir === 'left' ? col - 2 : col + 2;
    if (newCol < 0 || newCol > 7) return null;
    const sq = rowColToSquare(row, newCol);
    return sq === -1 ? null : sq;
  }
}

function nearestInDirection(from: SquareIndex, candidates: SquareIndex[], dir: Direction): SquareIndex | null {
  const { row: fr, col: fc } = squareToRowCol(from);
  let best: SquareIndex | null = null;
  let bestPrimary = Infinity;
  let bestSecondary = Infinity;
  for (const sq of candidates) {
    if (sq === from) continue;
    const { row, col } = squareToRowCol(sq);
    let primary: number;
    let secondary: number;
    if (dir === 'up') {
      if (row >= fr) continue;
      primary = fr - row;
      secondary = Math.abs(col - fc);
    } else if (dir === 'down') {
      if (row <= fr) continue;
      primary = row - fr;
      secondary = Math.abs(col - fc);
    } else if (dir === 'left') {
      if (col >= fc) continue;
      primary = fc - col;
      secondary = Math.abs(row - fr);
    } else {
      if (col <= fc) continue;
      primary = col - fc;
      secondary = Math.abs(row - fr);
    }
    if (primary < bestPrimary || (primary === bestPrimary && secondary < bestSecondary)) {
      bestPrimary = primary;
      bestSecondary = secondary;
      best = sq;
    }
  }
  return best;
}

function nearestOverall(from: SquareIndex, candidates: SquareIndex[]): SquareIndex {
  const { row: fr, col: fc } = squareToRowCol(from);
  let best = candidates[0];
  let bestDist = Infinity;
  for (const sq of candidates) {
    const { row, col } = squareToRowCol(sq);
    const dist = Math.abs(row - fr) + Math.abs(col - fc);
    if (dist < bestDist) {
      bestDist = dist;
      best = sq;
    }
  }
  return best;
}

export interface ArrowInputOpts {
  /** Called each draw to get an optional header printed above the board. */
  getHeader?: () => string;
  /** Called each draw to get the last-move squares to highlight on the board. */
  getLastMove?: () => { from: SquareIndex; to: SquareIndex } | null;
}

/** Cursor-based selection: hops between movable pieces, then between that piece's legal destinations. */
export function createArrowInput(opts?: ArrowInputOpts): MoveResolver {
  return (state, legal) =>
    new Promise((resolve) => {
      const movableSquares = [...new Set(legal.map((m) => m.from))];
      let selectedFrom: number | null = null;
      let cursor: SquareIndex = movableSquares[0];
      let message = '';
      const stdin = process.stdin;

      const candidates = (): SquareIndex[] =>
        selectedFrom === null ? movableSquares : legal.filter((m) => m.from === selectedFrom).map((m) => m.to);

      const draw = () => {
        console.clear();
        const header = opts?.getHeader?.();
        if (header) console.log(header);
        const lastMove = opts?.getLastMove?.();
        console.log(
          renderBoard(state.board, {
            cursor,
            selected: selectedFrom ?? undefined,
            movable: selectedFrom === null ? movableSquares : undefined,
            destinations: selectedFrom === null ? [] : candidates(),
            lastMoveFrom: lastMove?.from,
            lastMoveTo: lastMove?.to,
          }),
        );
        console.log('[x]=cursor  (x)=selected  ^x^=movable  *=destination  >x<=last move');
        console.log(
          selectedFrom === null
            ? `↑↓=row  ←→=column  Enter=select piece  |  Cursor: ${squareToCoord(cursor)}${movableSquares.includes(cursor) ? ' (movable)' : ''}`
            : `↑↓←→=destination  Enter=move  Esc=cancel  |  Cursor: ${squareToCoord(cursor)}`,
        );
        if (message) console.log(message);
      };

      const cleanup = () => {
        stdin.removeListener('keypress', onKeypress);
        if (stdin.isTTY) stdin.setRawMode(false);
        stdin.pause();
      };

      const onKeypress = (_str: string, key: readline.Key) => {
        if (key.ctrl && key.name === 'c') {
          cleanup();
          process.exit(0);
        }
        message = '';
        const dir: Direction | null =
          key.name === 'up' || key.name === 'down' || key.name === 'left' || key.name === 'right' ? key.name : null;

        if (dir) {
          if (selectedFrom === null) {
            const next = gridStep(cursor, dir);
            if (next !== null) cursor = next;
          } else {
            // Jump between destination candidates
            const next = nearestInDirection(cursor, candidates(), dir);
            if (next !== null) cursor = next;
          }
        } else if (key.name === 'escape') {
          if (selectedFrom !== null) {
            const previous = selectedFrom;
            selectedFrom = null;
            cursor = nearestOverall(previous, movableSquares);
          }
        } else if (key.name === 'return') {
          if (selectedFrom === null) {
            if (!movableSquares.includes(cursor)) {
              message = 'No movable piece here — navigate to a ^x^ square.';
              draw();
              return;
            }
            selectedFrom = cursor;
            cursor = nearestOverall(cursor, candidates());
          } else {
            const move = legal.find((m) => m.from === selectedFrom && m.to === cursor);
            if (move) {
              cleanup();
              resolve(move);
              return;
            }
            // Cursor is always kept within the legal candidate set, so this shouldn't happen.
            message = 'Illegal move.';
          }
        }
        draw();
      };

      readline.emitKeypressEvents(stdin);
      if (stdin.isTTY) stdin.setRawMode(true);
      stdin.resume();
      stdin.on('keypress', onKeypress);
      draw();
    });
}
