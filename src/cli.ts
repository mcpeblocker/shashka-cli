#!/usr/bin/env node
import readline from 'node:readline';
import { createInitialState } from './board.js';
import { playGame } from './game.js';
import { HumanPlayer } from './player.js';
import { AIPlayer } from './ai.js';
import { renderBoard } from './render.js';
import { createArrowInput } from './input-keyboard.js';
import { squareToCoord } from './notation.js';
import { loadConfig, saveConfig, clearAuth } from './config.js';
import type { ShashkaConfig } from './config.js';
import { login, logout } from './auth.js';
import { runOnlineGame } from './online-game.js';
import { printMenu, readMenuChoice } from './menu.js';
import type { Color, SquareIndex } from './types.js';

const DIVIDER = '═'.repeat(44);

async function playVsAI(): Promise<void> {
  const humanColor: Color = 'b';
  const aiColor: Color = 'w';

  let aiLastMove: { from: SquareIndex; to: SquareIndex; captures: SquareIndex[] } | null = null;

  const getHeader = (): string => {
    const lines = [DIVIDER, '  >>>  YOUR TURN  <<<', DIVIDER];
    if (aiLastMove) {
      const from = squareToCoord(aiLastMove.from);
      const to = squareToCoord(aiLastMove.to);
      const caps = aiLastMove.captures.map(squareToCoord).join(' ');
      lines.push(`AI last move:  ${from} → ${to}${caps ? `  (captured: ${caps})` : ''}`);
    }
    return lines.join('\n');
  };

  const getLastMove = () => aiLastMove ? { from: aiLastMove.from, to: aiLastMove.to } : null;

  const human = new HumanPlayer(humanColor, createArrowInput({ getHeader, getLastMove }));
  const ai = new AIPlayer(aiColor);

  let finalBoard = createInitialState().board;
  const winner = await playGame(
    createInitialState(),
    { [humanColor]: human, [aiColor]: ai } as Parameters<typeof playGame>[1],
    {
      onTurnStart: (state, legal) => {
        if (state.turn !== humanColor) {
          // AI is thinking — show board with human's last move while AI computes
          console.clear();
          console.log(renderBoard(state.board, {
            lastMoveFrom: aiLastMove ? undefined : undefined, // no "my" last move tracking needed here
          }));
          const movable = [...new Set(legal.map((m) => squareToCoord(m.from)))];
          console.log(`AI thinking...  (pieces at: ${movable.join(', ')})`);
        }
      },
      onMoveMade: (_state, move, mover) => {
        finalBoard = _state.board;
        if (mover === aiColor) {
          aiLastMove = { from: move.from, to: move.to, captures: move.captures };
        }
      },
    },
  );

  console.clear();
  console.log(renderBoard(finalBoard));
  if (winner === 'draw') console.log("It's a draw (no captures for too long).");
  else console.log(winner === humanColor ? 'You win!' : 'AI wins!');

  await pause('Press Enter to return to menu...');
}

function pause(msg = 'Press Enter to continue...'): Promise<void> {
  return new Promise((resolve) => {
    process.stdout.write(msg);
    const handler = () => {
      process.stdin.removeListener('data', handler);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    };
    process.stdin.resume();
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.once('data', handler);
  });
}

async function main(): Promise<void> {
  // Allow direct --input flag for backwards compat (no menu)
  const args = process.argv.slice(2);
  if (args.some((a) => a.startsWith('--input'))) {
    // Legacy: play vs AI immediately
    await playVsAI();
    return;
  }

  let config = loadConfig();

  for (;;) {
    printMenu(config);
    const choice = await readMenuChoice(config);

    const loggedIn = !!(config.token && config.name);

    if (choice === '1') {
      await playVsAI();
    } else if (choice === '2' && !loggedIn) {
      // Login
      try {
        const { name, token } = await login(config.serverUrl);
        config = { ...config, name, token };
        saveConfig(config);
        console.log(`\nWelcome, ${name}!`);
        await pause();
      } catch (err) {
        console.error('\nLogin failed:', err instanceof Error ? err.message : err);
        await pause();
      }
    } else if (choice === '2' && loggedIn) {
      // Create online game
      try {
        await runOnlineGame(config, 'create');
        await pause();
      } catch (err) {
        console.error('\nError:', err instanceof Error ? err.message : err);
        await pause();
      }
    } else if (choice === '3' && !loggedIn) {
      // Create online game (guest)
      console.log('\nYou can play online as a guest — your name will be "Player".');
      try {
        await runOnlineGame(config, 'create');
        await pause();
      } catch (err) {
        console.error('\nError:', err instanceof Error ? err.message : err);
        await pause();
      }
    } else if (choice === '3' && loggedIn) {
      // Join online game
      try {
        await runOnlineGame(config, 'join');
        await pause();
      } catch (err) {
        console.error('\nError:', err instanceof Error ? err.message : err);
        await pause();
      }
    } else if (choice === '4' && !loggedIn) {
      // Join online game (guest)
      console.log('\nYou can join as a guest — your name will be "Player".');
      try {
        await runOnlineGame(config, 'join');
        await pause();
      } catch (err) {
        console.error('\nError:', err instanceof Error ? err.message : err);
        await pause();
      }
    } else if (choice === '4' && loggedIn) {
      // Logout
      if (config.token) await logout(config.serverUrl, config.token);
      config = saveConfigAndReturn(clearAuth(config));
      console.log('\nLogged out.');
      await pause();
    } else if (choice === '5') {
      await showSettings(config, (updated) => { config = updated; });
    } else {
      // ignore invalid input, redraw
    }
  }
}

function saveConfigAndReturn(config: Parameters<typeof saveConfig>[0]) {
  saveConfig(config);
  return config;
}

function promptLine(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

async function showSettings(
  config: ShashkaConfig,
  onUpdate: (c: ShashkaConfig) => void,
): Promise<void> {
  console.clear();
  console.log('\n  ♟  SHASHKA  —  Settings');
  console.log('  ' + '─'.repeat(40));
  console.log(`\n  Server URL:  ${config.serverUrl}`);
  console.log('  (Leave blank to keep current)\n');

  const newUrl = await promptLine('  New server URL: ');
  if (newUrl) {
    const updated = { ...config, serverUrl: newUrl };
    saveConfig(updated);
    onUpdate(updated);
    console.log(`\n  Server URL updated to: ${newUrl}`);
  } else {
    console.log('\n  No changes.');
  }
  await pause();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
