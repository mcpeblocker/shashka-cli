# @shashka/cli

[![npm version](https://img.shields.io/npm/v/@shashka/cli?color=cb3837&label=npm)](https://www.npmjs.com/package/@shashka/cli)
[![license](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/node/v/@shashka/cli?label=node)](https://www.npmjs.com/package/@shashka/cli)

Terminal shashka, also known as checkers or draughts, played right inside your shell.

`@shashka/cli` is a small open source CLI game with a built-in AI opponent, two input modes, and rule enforcement for the core checkers experience. It is designed to feel native in the terminal while still being easy to install, run, and remove.

## Features

- Play shashka, checkers, or draughts from the terminal.
- Challenge a built-in AI opponent.
- Choose between cursor-based arrow controls and text-based move entry.
- Enforces legal moves, forced captures, and multi-capture chains.
- Ends the game when a side has no legal moves or when the no-progress draw limit is reached.

## Install

```bash
npm install -g @shashka/cli
```

You can also run it without installing globally:

```bash
npx @shashka/cli
```

## Usage

Start a game with the default arrow-key interface:

```bash
shashka
```

Use coordinate input instead of the cursor UI:

```bash
shashka --input text
```

The CLI also accepts the equivalent form:

```bash
shashka --input=text
```

## Controls

### Arrow input mode

- Use the arrow keys to move between pieces that can legally move.
- Press `Enter` to select a piece.
- Use the arrow keys again to move between that piece’s legal destinations.
- Press `Enter` to confirm the move.
- Press `Esc` to cancel a selection.
- Press `Ctrl+C` to quit.

### Text input mode

Enter moves in `from-to` notation, for example:

```text
c3-d4
```

If a capture is available, the CLI requires you to take it.

## Rules

This implementation follows standard American checkers-style behavior:

- Black moves first.
- Captures are mandatory.
- Multi-jump capture chains are supported.
- A man that reaches the back rank is promoted to king.
- If a man promotes during a capture chain, the chain stops immediately.
- A side loses when it has no legal moves.
- The game is declared a draw after too many capture-less plies.

## Example

```bash
$ shashka --input text
	a   b   c   d   e   f   g   h
 8  . b . b . b . b
 7  b . b . b . b .
 6  . b . b . b . b
 5  . . . . . . . .
 4  . . . . . . . .
 3  w . w . w . w .
 2  . w . w . w . w
 1  w . w . w . w .
Black move (e.g. c3-d4)> c3-d4
```

## Development

```bash
npm install
npm run build
npm run selftest
```

## Package

- Name: `@shashka/cli`
- Binary: `shashka`
- Entry point: `dist/cli.js`

## Uninstall

Remove the global package with:

```bash
npm uninstall -g @shashka/cli
```

If you used `npx`, nothing is installed globally and there is nothing to remove.

## License

Released under the Apache 2.0 License. See [LICENSE](LICENSE) for the full text.

Author: Alisher Ortikov, ([mcpeblocker](https://mcpeblocker.uz))
