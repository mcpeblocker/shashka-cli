import readline from 'node:readline';
import { squareToRowCol } from './board.js';
import { renderBoard } from './render.js';
import { squareToCoord } from './notation.js';
import type { MoveResolver } from './player.js';
import type { SquareIndex } from './types.js';

type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Closest candidate strictly in `dir` from `from`: nearest row/col line first
 * (even if the match on that line is diagonally offset), then nearest on the
 * other axis. Playable squares never share a row or column with their
 * diagonal neighbors, so a plain "move by 1" cursor would skip over them —
 * this hops straight to the next reachable square instead.
 */
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
            ? `Arrows to jump between movable pieces, Enter to select. Cursor: ${squareToCoord(cursor)}`
            : `Piece at ${squareToCoord(selectedFrom)} selected. Arrows to jump between destinations, Enter to move, Esc to cancel. Cursor: ${squareToCoord(cursor)}`,
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
          const next = nearestInDirection(cursor, candidates(), dir);
          if (next !== null) cursor = next;
        } else if (key.name === 'escape') {
          if (selectedFrom !== null) {
            const previous = selectedFrom;
            selectedFrom = null;
            cursor = nearestOverall(previous, movableSquares);
          }
        } else if (key.name === 'return') {
          if (selectedFrom === null) {
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
