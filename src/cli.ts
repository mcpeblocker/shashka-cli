#!/usr/bin/env node
import readline from 'node:readline';
import { createInitialState } from './board.js';
import { playGame } from './game.js';
import { HumanPlayer } from './player.js';
import type { MoveResolver } from './player.js';
import { AIPlayer } from './ai.js';
import { renderBoard } from './render.js';
import { createArrowInput } from './input-keyboard.js';
import { parseMove, squareToCoord } from './notation.js';
import type { Color } from './types.js';

function createTextInput(): MoveResolver {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return (state, legal) =>
    new Promise((resolve) => {
      const ask = () => {
        const name = state.turn === 'b' ? 'Black' : 'White';
        rl.question(`${name} move (e.g. c3-d4)> `, (answer) => {
          const parsed = parseMove(answer);
          const move = parsed && legal.find((m) => m.from === parsed.from && m.to === parsed.to);
          if (!move) {
            console.log('Not a legal move. Use "from-to" notation, e.g. c3-d4. Capture is mandatory if available.');
            ask();
            return;
          }
          resolve(move);
        });
      };
      ask();
    });
}

function parseArgs(argv: string[]): { input: 'arrows' | 'text' } {
  const flag = argv.find((a) => a.startsWith('--input'));
  const value = flag?.includes('=') ? flag.split('=')[1] : argv[argv.indexOf(flag ?? '') + 1];
  const input = value === 'text' ? 'text' : 'arrows';
  return { input };
}

async function main() {
  const { input } = parseArgs(process.argv.slice(2));
  const resolveMove = input === 'text' ? createTextInput() : createArrowInput();

  const humanColor: Color = 'b';
  const aiColor: Color = 'w';
  const human = new HumanPlayer(humanColor, resolveMove);
  const ai = new AIPlayer(aiColor);

  let finalBoard = createInitialState().board;
  const winner = await playGame(
    createInitialState(),
    { [humanColor]: human, [aiColor]: ai } as Record<Color, typeof human | typeof ai>,
    {
      onTurnStart: (state, legal) => {
        if (input === 'text') {
          console.log(renderBoard(state.board));
          if (state.turn === humanColor) {
            const movable = [...new Set(legal.map((m) => squareToCoord(m.from)))];
            const forced = legal[0].captures.length > 0 ? ' (capture forced)' : '';
            console.log(`Pieces that can move${forced}: ${movable.join(', ')}`);
          }
        }
      },
      onMoveMade: (state) => {
        finalBoard = state.board;
      },
    },
  );

  console.log(renderBoard(finalBoard));
  if (winner === 'draw') console.log("It's a draw (no captures for too long).");
  else console.log(winner === humanColor ? 'You win!' : 'AI wins!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
