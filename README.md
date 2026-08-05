# @shashka/cli

[![npm version](https://img.shields.io/npm/v/@shashka/cli?color=cb3837&label=npm)](https://www.npmjs.com/package/@shashka/cli)
[![license](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/node/v/@shashka/cli?label=node)](https://www.npmjs.com/package/@shashka/cli)

Terminal shashka — checkers / draughts — played right inside your shell, with an optional live connection to [shashka.mcpeblocker.uz](https://shashka.mcpeblocker.uz) for online play against real opponents.

## Features

- Play shashka offline against a built-in minimax AI.
- **Play online** against real opponents via [shashka.mcpeblocker.uz](https://shashka.mcpeblocker.uz).
- **Browser login** — authenticate with your display name in the browser; the terminal picks it up automatically.
- **Create or join** a game with a short code or URL.
- Last-move highlighting — the board marks where the opponent's piece came from (`-x-`) and where it landed (`>x<`).
- Turn header tells you when it is your move.
- Arrow-key cursor UI or text-based coordinate entry.
- Legal-move enforcement, forced captures, multi-jump chains, promotion, and draw detection.
- Settings menu to change the server URL.

## Install

```bash
npm install -g @shashka/cli
```

Or run without installing:

```bash
npx @shashka/cli
```

## Quick start

```bash
shashka
```

A menu appears:

```
  ♟  SHASHKA
  ────────────────────────────────────────

  [1]  Play vs AI
  [2]  Login to shashka.uz
  [3]  Create online game  (login required)
  [4]  Join online game    (login required)
  [5]  Settings

  Server: https://shashka.mcpeblocker.uz
  Ctrl+C to exit
```

## Playing online

### 1. Log in

Pick **[2] Login to shashka.uz**. A URL is printed in the terminal and your browser opens automatically. Enter your display name and click **Log In**. The terminal detects the confirmation and greets you by name. Your token is saved to `~/.shashka/config.json` for future sessions.

### 2. Create a game

Pick **[2] Create online game**. The terminal prints a short code and a URL:

```
Game created!
  Code: a1b2c3d4
  URL:  https://shashka.mcpeblocker.uz/?room=a1b2c3d4

Waiting for opponent to join...
```

Share the code or URL with your opponent. They can join from a browser at shashka.mcpeblocker.uz or from another `shashka` terminal session.

### 3. Join a game

Pick **[3] Join online game** and enter the code your opponent shared.

### 4. Play

The board uses a cursor UI. Piece movements are streamed live over WebSocket. When it is your turn:

```
════════════════════════════════════════════
  >>>  YOUR TURN  <<<
════════════════════════════════════════════
Last move:  Opponent  e3 → f4  (captured: g5)

    a   b   c   d   e   f   g   h
 8  . b . b . b . b
 ...
```

The opponent's last move is shown in the header and highlighted on the board (`-.-` = origin, `>x<` = destination). While waiting for the opponent, your last move is highlighted instead.

## Controls

### Arrow-key mode (default)

| Key | Action |
|---|---|
| Arrow keys | Move cursor between pieces / destinations |
| `Enter` | Select piece / confirm move |
| `Esc` | Cancel selection |
| `Ctrl+C` | Quit |

### Text mode

```bash
shashka --input text
```

Enter moves as `from-to`, e.g. `c3-d4`. Capture is mandatory when available.

## Settings

Pick **[5] Settings** to change the server URL. The new value is saved to `~/.shashka/config.json`. You can also set it via environment variable (takes effect without editing the file):

```bash
SHASHKA_SERVER_URL=http://localhost:3002 shashka
```

## Rules

Standard American checkers:

- White moves first (in online games).
- Black moves first (vs AI).
- Captures are mandatory.
- Multi-jump chains supported.
- A man promotes to king on reaching the back rank; the chain stops on promotion.
- A side with no legal moves loses.
- Draw after too many capture-less plies.

## Development

```bash
npm install
npm run build
npm start          # run the CLI
npm run selftest   # run built-in rule / notation checks
```

## Uninstall

```bash
npm uninstall -g @shashka/cli
```

If you used `npx`, nothing is installed globally.

## License

Apache 2.0 — see [LICENSE](LICENSE).  
Author: Alisher Ortikov ([mcpeblocker](https://mcpeblocker.uz))
