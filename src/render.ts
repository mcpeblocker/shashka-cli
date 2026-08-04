import { rowColToSquare } from './board.js';
import type { Board, SquareIndex } from './types.js';

export interface RenderOverlay {
  cursor?: SquareIndex;
  selected?: SquareIndex;
  /** Squares whose piece has at least one legal move (shown when nothing selected yet). */
  movable?: SquareIndex[];
  /** Legal destination squares for the currently selected piece. */
  destinations?: SquareIndex[];
}

function pieceChar(board: Board, square: SquareIndex): string {
  const piece = board[square];
  if (!piece) return '.';
  const letter = piece.color === 'b' ? 'b' : 'w';
  return piece.rank === 'king' ? letter.toUpperCase() : letter;
}

function cellStr(board: Board, square: SquareIndex, overlay: RenderOverlay): string {
  const ch = pieceChar(board, square);
  const isCursor = overlay.cursor === square;
  const isSelected = overlay.selected === square;
  const isDest = overlay.destinations?.includes(square) ?? false;
  const isMovable = overlay.movable?.includes(square) ?? false;

  if (isCursor && isSelected) return `{${ch}}`;
  if (isCursor) return `[${ch}]`;
  if (isSelected) return `(${ch})`;
  if (isDest) return ' * ';
  if (isMovable) return `^${ch}^`;
  return ` ${ch} `;
}

export function renderBoard(board: Board, overlay: RenderOverlay = {}): string {
  const lines: string[] = [];
  lines.push('    a   b   c   d   e   f   g   h');
  for (let row = 0; row < 8; row++) {
    const displayRow = 8 - row;
    const cells: string[] = [];
    for (let col = 0; col < 8; col++) {
      const square = rowColToSquare(row, col);
      cells.push(square === -1 ? '   ' : cellStr(board, square, overlay));
    }
    lines.push(`${String(displayRow).padStart(2, ' ')} ${cells.join('')}`);
  }
  return lines.join('\n');
}
