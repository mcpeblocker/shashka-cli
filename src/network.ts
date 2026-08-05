import WebSocket from 'ws';
import { squareToRowCol, rowColToSquare } from './board.js';
import type { Board, Color, Move, Piece } from './types.js';

// ── Server-side types ──────────────────────────────────────────────────────

interface ServerPos {
  row: number;
  col: number;
}
interface ServerPiece {
  color: 'white' | 'black';
  isKing: boolean;
}
export interface ServerMove {
  from: ServerPos;
  to: ServerPos;
  captures?: ServerPos[];
  isPromotion?: boolean;
}
interface ServerGameState {
  board: (ServerPiece | null)[][];
  turn: 'white' | 'black';
  winner: 'white' | 'black' | 'draw' | null;
  mustCaptureFrom: ServerPos | null;
  lastMove: ServerMove | null;
}

export interface ServerMessage {
  type: string;
  color?: 'white' | 'black';
  player?: { name: string };
  online?: boolean;
  move?: ServerMove;
  gameState?: ServerGameState;
  message?: string;
}

// ── Conversion utilities ───────────────────────────────────────────────────

export function cliBoardToServer(board: Board): (ServerPiece | null)[][] {
  const result: (ServerPiece | null)[][] = Array.from({ length: 8 }, () =>
    new Array<ServerPiece | null>(8).fill(null),
  );
  for (let sq = 0; sq < 32; sq++) {
    const piece = board[sq] as Piece | null;
    if (piece) {
      const { row, col } = squareToRowCol(sq);
      result[row][col] = {
        color: piece.color === 'b' ? 'black' : 'white',
        isKing: piece.rank === 'king',
      };
    }
  }
  return result;
}

export function cliColorToServer(c: Color): 'black' | 'white' {
  return c === 'b' ? 'black' : 'white';
}

export function cliMoveToServer(move: Move): ServerMove {
  return {
    from: squareToRowCol(move.from),
    to: squareToRowCol(move.to),
    captures: move.captures.map(squareToRowCol),
    isPromotion: move.promotes,
  };
}

/** Find the CLI legal move matching a server-side move (match by from+to square). */
export function serverMoveToCli(serverMove: ServerMove, legalMoves: Move[]): Move | null {
  const from = rowColToSquare(serverMove.from.row, serverMove.from.col);
  const to = rowColToSquare(serverMove.to.row, serverMove.to.col);
  if (from === -1 || to === -1) return null;
  return legalMoves.find((m) => m.from === from && m.to === to) ?? null;
}

// ── WebSocket client ───────────────────────────────────────────────────────

type Unsubscribe = () => void;

export class GameSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<(msg: ServerMessage) => void>();

  connect(url: string, token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      this.ws = new WebSocket(url, { headers });
      this.ws.once('open', () => resolve());
      this.ws.once('error', (err) => reject(err));
      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as ServerMessage;
          this.handlers.forEach((h) => h(msg));
        } catch {
          // ignore malformed frames
        }
      });
    });
  }

  send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** Register a message handler; returns an unsubscribe function. */
  onMessage(handler: (msg: ServerMessage) => void): Unsubscribe {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }
}
