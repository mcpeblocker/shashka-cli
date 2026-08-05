import readline from 'node:readline';
import { createInitialBoard } from './board.js';
import { playGame } from './game.js';
import { HumanPlayer } from './player.js';
import { createArrowInput } from './input-keyboard.js';
import { renderBoard } from './render.js';
import { squareToCoord } from './notation.js';
import {
  GameSocket,
  cliBoardToServer,
  cliColorToServer,
  cliMoveToServer,
  serverMoveToCli,
} from './network.js';
import type { ServerMessage, ServerMove } from './network.js';
import type { ShashkaConfig } from './config.js';
import type { Color, GameState, Move, SquareIndex } from './types.js';
import type { Player } from './player.js';

// ── NetworkPlayer ──────────────────────────────────────────────────────────

class NetworkPlayer implements Player {
  private pendingResolve: ((m: Move) => void) | null = null;
  private pendingReject: ((e: Error) => void) | null = null;
  private pendingLegal: Move[] = [];

  constructor(public color: Color) {}

  chooseMove(_state: GameState, legalMoves: Move[]): Promise<Move> {
    this.pendingLegal = legalMoves;
    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
    });
  }

  handleServerMove(serverMove: ServerMove): void {
    if (!this.pendingResolve) return;
    const move = serverMoveToCli(serverMove, this.pendingLegal);
    if (move) {
      this.pendingResolve(move);
      this.pendingResolve = null;
      this.pendingReject = null;
    } else {
      console.error('\nFailed to match opponent move to a legal move. Possible desync.');
    }
  }

  abort(reason = 'Opponent disconnected'): void {
    if (this.pendingReject) {
      this.pendingReject(new Error(reason));
      this.pendingResolve = null;
      this.pendingReject = null;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function wsUrl(serverUrl: string): string {
  return serverUrl.replace(/^http/, 'ws') + '/api';
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

interface LastMoveInfo {
  moverName: string;
  from: SquareIndex;
  to: SquareIndex;
  captures: SquareIndex[];
}

function formatMove(info: LastMoveInfo): string {
  const from = squareToCoord(info.from);
  const to = squareToCoord(info.to);
  const caps = info.captures.map(squareToCoord).join(' ');
  return caps
    ? `${info.moverName}  ${from} → ${to}  (captured: ${caps})`
    : `${info.moverName}  ${from} → ${to}`;
}

const DIVIDER = '═'.repeat(44);

// ── Setup phase ────────────────────────────────────────────────────────────

async function waitForSetup(
  socket: GameSocket,
  mode: 'create' | 'join',
  roomId: string,
  displayName: string,
  serverUrl: string,
): Promise<{ myColor: Color; opponentName: string }> {
  return new Promise((resolve, reject) => {
    let myColor: Color | null = null;
    let opponentName: string | null = null;
    let opponentOnline = false;

    if (mode === 'create') {
      console.log(`\nGame created!`);
      console.log(`  Code: ${roomId}`);
      console.log(`  URL:  ${serverUrl}/?room=${roomId}`);
      console.log('\nWaiting for opponent to join...\n');
    } else {
      console.log(`\nJoining game ${roomId}...\n`);
    }

    const unsub = socket.onMessage((msg: ServerMessage) => {
      if (msg.type === 'ERROR') {
        unsub();
        reject(new Error(msg.message ?? 'Server error'));
        return;
      }
      if (msg.type === 'PLAYER_JOINED') {
        if (!myColor) {
          myColor = msg.color === 'white' ? 'w' : 'b';
          const seat = msg.color === 'white' ? 'white (bottom)' : 'black (top)';
          console.log(`You are playing as ${seat}.`);
        } else {
          opponentName = msg.player?.name ?? 'Opponent';
          console.log(`Opponent: ${opponentName}`);
        }
      }
      if (msg.type === 'OPPONENT_STATUS' && msg.online === true) {
        opponentOnline = true;
      }
      if (myColor && opponentOnline && opponentName !== null) {
        unsub();
        resolve({ myColor, opponentName });
      }
    });

    socket.send({ type: 'JOIN_ROOM', roomId, name: displayName });
  });
}

// ── Main online game runner ────────────────────────────────────────────────

export async function runOnlineGame(
  config: ShashkaConfig,
  mode: 'create' | 'join',
  providedRoomId?: string,
): Promise<void> {
  const socket = new GameSocket();
  const displayName = config.name ?? 'Player';

  let roomId: string;
  if (mode === 'join') {
    roomId = providedRoomId ?? (await prompt('Enter game code: '));
    if (!roomId) throw new Error('No game code provided.');
  } else {
    roomId = providedRoomId ?? generateRoomId();
  }

  process.stdout.write('Connecting to server...');
  await socket.connect(wsUrl(config.serverUrl), config.token);
  console.log(' done.');

  const { myColor, opponentName } = await waitForSetup(
    socket,
    mode,
    roomId,
    displayName,
    config.serverUrl,
  );

  const opponentColor: Color = myColor === 'w' ? 'b' : 'w';
  const networkPlayer = new NetworkPlayer(opponentColor);

  // ── Last-move state (updated in onMoveMade) ──────────────────────────────
  let opponentLastMove: LastMoveInfo | null = null; // shown on YOUR TURN screen
  let myLastMove: LastMoveInfo | null = null;        // shown on WAITING screen

  // Header shown at top of board during human's turn
  const getHeader = (): string => {
    const lines = [DIVIDER, `  >>>  YOUR TURN  <<<`, DIVIDER];
    if (opponentLastMove) {
      lines.push(`Last move:  ${formatMove(opponentLastMove)}`);
    }
    return lines.join('\n');
  };

  // Last-move squares to highlight during human's turn
  const getLastMove = (): { from: SquareIndex; to: SquareIndex } | null =>
    opponentLastMove ? { from: opponentLastMove.from, to: opponentLastMove.to } : null;

  const localPlayer = new HumanPlayer(myColor, createArrowInput({ getHeader, getLastMove }));

  // Forward server moves to NetworkPlayer
  const unsubMove = socket.onMessage((msg: ServerMessage) => {
    if (msg.type === 'MOVE' && msg.move) {
      networkPlayer.handleServerMove(msg.move);
    }
    if (msg.type === 'OPPONENT_STATUS' && msg.online === false) {
      console.log('\nOpponent disconnected.');
      networkPlayer.abort('Opponent disconnected');
    }
  });

  const initialState: GameState = { board: createInitialBoard(), turn: 'w' };
  const players = {
    [myColor]: localPlayer,
    [opponentColor]: networkPlayer,
  } as unknown as Record<Color, Player>;

  console.log(`\nGame started!  You (${displayName}) vs ${opponentName}`);
  if (myColor === 'w') console.log('You go first (white).\n');
  else console.log('Waiting for white to move first...\n');

  let finalBoard = initialState.board;

  try {
    const winner = await playGame(initialState, players, {
      onTurnStart: (state, legal) => {
        if (state.turn === myColor) {
          // createArrowInput's draw() will show the header + board
        } else {
          // Waiting for opponent — show board with MY last move highlighted
          console.clear();
          console.log(DIVIDER);
          console.log(`  Waiting for ${opponentName} to move...`);
          console.log(DIVIDER);
          if (myLastMove) {
            console.log(`Your last move:  ${formatMove(myLastMove)}`);
          }
          console.log(
            renderBoard(state.board, {
              lastMoveFrom: myLastMove?.from,
              lastMoveTo: myLastMove?.to,
            }),
          );
          const movable = [...new Set(legal.map((m) => squareToCoord(m.from)))];
          console.log(`Their movable pieces: ${movable.join(', ')}`);
        }
      },
      onMoveMade: (state, move, mover) => {
        finalBoard = state.board;
        const info: LastMoveInfo = {
          moverName: mover === myColor ? displayName : opponentName,
          from: move.from,
          to: move.to,
          captures: move.captures,
        };
        if (mover === myColor) {
          myLastMove = info;
          socket.send({
            type: 'MOVE',
            roomId,
            move: cliMoveToServer(move),
            gameState: {
              board: cliBoardToServer(state.board),
              turn: cliColorToServer(state.turn),
              winner: null,
              mustCaptureFrom: null,
              lastMove: cliMoveToServer(move),
            },
          });
        } else {
          opponentLastMove = info;
        }
      },
    });

    console.clear();
    console.log(renderBoard(finalBoard));
    if (winner === 'draw') console.log("It's a draw!");
    else if (winner === myColor) console.log('You win!');
    else console.log(`${opponentName} wins!`);
  } catch (err) {
    if (err instanceof Error && err.message.includes('Opponent disconnected')) {
      console.log('\nGame ended: opponent disconnected.');
    } else {
      throw err;
    }
  } finally {
    unsubMove();
    socket.disconnect();
  }
}
