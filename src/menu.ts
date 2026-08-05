import readline from 'node:readline';
import type { ShashkaConfig } from './config.js';

const DIVIDER = '─'.repeat(40);

export function printMenu(config: ShashkaConfig): void {
  console.clear();
  console.log('');
  console.log('  ♟  SHASHKA');
  console.log(`  ${DIVIDER}`);
  if (config.name && config.token) {
    console.log(`  Logged in as: ${config.name}`);
    console.log('');
    console.log('  [1]  Play vs AI');
    console.log('  [2]  Create online game');
    console.log('  [3]  Join online game');
    console.log('  [4]  Logout');
    console.log('  [5]  Settings');
  } else {
    console.log('');
    console.log('  [1]  Play vs AI');
    console.log('  [2]  Login to shashka.uz');
    console.log('  [3]  Create online game  (login required)');
    console.log('  [4]  Join online game    (login required)');
    console.log('  [5]  Settings');
  }
  console.log('');
  console.log(`  Server: ${config.serverUrl}`);
  console.log('  Ctrl+C to exit');
  console.log('');
}

export function readMenuChoice(config: ShashkaConfig): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('  Choice: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
