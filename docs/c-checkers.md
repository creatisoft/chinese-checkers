# Chinese Checkers: Project Documentation

A browser-based Chinese Checkers game for 2, 3, 4 or 6 players. Any seat can be a human or an AI opponent (Easy, Medium or Hard). It is plain HTML, CSS and JavaScript with no framework. The board is drawn as SVG, and Vite handles the dev server and the production build.

---

## 1. Quick reference

| Item | Value |
| --- | --- |
| Runtime | Browser only (no backend) |
| Build tool | Vite `^7.0.4` (the only dependency, a dev dependency) |
| Entry point | `index.html` |
| Game logic | `script.js` (`ChineseCheckersGame` class + UI setup) |
| AI | `ai-player.js` (`ChineseCheckersAI` class) |
| Styling | `style.css` |
| Static assets | `public/` (logo, app icons, PWA manifest, service worker) |
| PWA | Installable and works offline (production builds on HTTPS or localhost only) |
| Saved game | `localStorage` key `chinese-checkers-saved-game`; resumes after a reload |
| Build output | `dist/` (git-ignored) |
| License | MIT |

### Commands

```bash
npm install       # install Vite
npm run dev       # start the dev server with hot reload
npm run build     # production build into dist/
npm run preview   # serve the built dist/ locally
npm run host      # build, then serve it to other devices on your Wi-Fi (use this to play on a tablet)
```

---

## 2. Repository layout

```
chinese-checkers/
├── .github/description.md   # Short repo description
├── docs/c-checkers.md       # This document
├── public/
│   ├── chinesecheckers-logo.png   # Logo shown on the player-count screen
│   ├── icons/                     # App icons (192, 512, maskable 512, Apple touch 180)
│   ├── manifest.webmanifest       # PWA manifest: name, colors, icons, display mode
│   ├── sw.js                      # Service worker: offline cache
│   └── vite.svg
├── index.html               # Markup for all screens, shared SVG gradients, script/style includes
├── script.js                # Game engine, rendering, setup flow, notifications
├── ai-player.js             # AI opponent logic
├── style.css                # Theme variables, layout, responsive rules
├── vite.config.js           # base: './', publicDir: public, outDir: dist
├── package.json
└── README.md
```

---

## 3. Architecture overview

```
index.html
 ├─ <script type="module" src="ai-player.js">  → defines window.ChineseCheckersAI
 ├─ <script type="module" src="script.js">     → defines ChineseCheckersGame,
 │                                               window.showNotification,
 │                                               window.showGameOverlay,
 │                                               and wires DOMContentLoaded handlers
 └─ Simple Analytics script (async, external)
```

The two modules don't `import` each other. They talk through `window` globals:

- `script.js` checks `window.ChineseCheckersAI` and creates one AI instance per AI seat.
- `ai-player.js` calls `window.showNotification` and reaches straight into the game instance it was given (`game.board`, `game.selectPiece`, `game.movePiece`, `game.endTurn`, and so on).

So the AI is tightly coupled to the game's internal state and method names. If you rename anything in `ChineseCheckersGame`, check `ai-player.js` as well.

### Screens

All screens are in `index.html`. They are shown and hidden by toggling `style.display`:

1. **Player count selection** (`#player-count-selection`): logo plus 2/3/4/6 buttons.
2. **Player setup** (`#color-selection-container`): a wizard that runs once per player and collects the type (Human/AI), the AI difficulty, a name and a color.
3. **Game screen** (`#game-screen`): turn indicator, status text, End Turn and New Game buttons, the "Show Valid Moves" toggle, and the SVG board.
4. **Overlays**: the toast container (`#notification-container`) and the winner overlay (`#game-state-overlay`).

---

## 4. Board model

### Coordinate system

The board uses **axial hex coordinates** `{ q, r }`. The implied third axis is `s = -q - r`. Coordinates are stored as strings (`"q,r"`) in Maps and Sets, using `coordToString` and `stringToCoord`.

The six neighbor directions are listed in `AXIAL_DIRECTIONS`:

```
(1,0) (1,-1) (0,-1) (-1,0) (-1,1) (0,1)
```

### Board shape (121 holes)

`createBoardLayout()` builds `validBoardCoords` from two parts:

1. **Central hexagon**: every `(q, r)` where `|q|`, `|r|` and `|s|` are all ≤ `STAR_TIP_SIZE` (4). That gives 61 holes.
2. **Six star tips**: 10 holes each, made by `getStartingPieces(i)`. A base triangle is rotated by `PLAYER_ROTATIONS[i]` sixty-degree steps using `rotateCoord` (`q' = -r, r' = q + r`).

61 + 6 × 10 = 121 holes, which is the standard Chinese Checkers board.

> `BOARD_RADIUS = 8` is declared but not used.

### Star points and player seating

There are six star points, numbered 0–5. The tip opposite tip `i` is `(i + 3) % 6`, and that is the player's destination. `getPlayerBoardPositions()` assigns tips by player count:

| Players | Tips used |
| --- | --- |
| 2 | 0, 3 |
| 3 | 0, 2, 4 |
| 4 | 0, 1, 3, 4 |
| 6 | 0–5 |

For each seat `i` the game stores:
- `playerHomes[i]`: the 10 starting coordinates
- `playerDestinations[i]`: the 10 coordinates of the opposite tip
- Each seat's home triangle is painted in that seat's color (see Rendering below).

### Pixel layout

`axialToPixel(q, r)` uses a flat-top hex layout centered on `(0, 0)`:

```
x = HEX_SIZE * 1.5 * q
y = HEX_SIZE * (√3/2 * q + √3 * r)
```

`HEX_SIZE` is 20. These are SVG user units, not screen pixels. The `<svg>` in `index.html` has a fixed `viewBox="-265 -265 530 530"` centered on the origin, and CSS sets its on-screen size from `--board-size`. The browser therefore scales the whole board to any screen without the JS knowing the screen size. If you change `HEX_SIZE` or the board shape, update the viewBox so the outer star points (about ±256 × ±224 units including piece radius) still fit.

---

## 5. Game state

Key fields on `ChineseCheckersGame`:

| Field | Meaning |
| --- | --- |
| `board` | `Map<"q,r", { player, colorIndex }>`, the occupied holes |
| `validBoardCoords` | `Set<"q,r">`, all 121 holes |
| `activePlayers` | `[0 … numPlayers-1]` |
| `currentPlayerIndex` | Whose turn it is |
| `turnState` | `'select'` → `'jumping'` or `'moved'` → back to `'select'` |
| `selectedPiece` | `{q, r}` of the selected piece, or `null` |
| `validMoves` | Array of `{q, r}` targets for the selected piece |
| `playerTypes` / `playerDifficulties` | Per-seat `'human'`/`'ai'` and `'easy'`/`'medium'`/`'hard'` |
| `playerNames` / `playerColors` | Names and color indices from setup |
| `aiPlayers` | `Map<seat, ChineseCheckersAI>` |
| `isAITurn` | Blocks human input while an AI is moving |
| `showValidMoves` | Controlled by the "Show Valid Moves" checkbox |

A piece's `player` is its **seat index**. Its `colorIndex` is the color chosen for that seat (0–5, which selects the CSS variable `--playerN-color`).

### Saved game (resume after reload)

A page reload used to lose the game. On tablets that happens easily: the browser discards a tab in the background, or a gesture refreshes the page. Now the game is saved to `localStorage` at every turn boundary:

- **When it's saved:** `saveGame()` runs at the end of `init()` and in `endTurn()` when the turn passes to the next player.
- **What's saved:** `numPlayers`, `playerTypes`, `playerDifficulties`, `playerNames`, `playerColors`, `currentPlayerIndex`, and `board` (the Map's entries).
- **Resuming:** on page load, `loadSavedGame()` checks for a save. If there is one, the setup screens are skipped and `startGame(saved, saved)` calls `init(saved)`, which restores the board and the current player. A toast says "Resumed your game". If it's an AI's turn, the AI simply starts its turn again.
- **Mid-turn reloads:** they resume at the start of that turn. A half-finished jump chain is undone.
- **Clearing:** `clearSavedGame()` runs when someone wins and when **New Game** is tapped.
- **No storage:** if `localStorage` is unavailable (some private-browsing modes), every storage call is wrapped in try/catch, so the game still plays. It just can't resume.

If you add new game state that matters after a reload, add it to `saveGame()` and restore it in `init()`.

---

## 6. Rules and turn flow

### Move generation (`calculateValidMoves`)

- In the `'select'` state, the targets are every empty adjacent hole (a single step) **plus** every hole reachable by jumping.
- In the `'jumping'` state, the targets are jumps only.
- `findJumps` searches recursively. A jump goes over an occupied neighbor (anyone's piece) into the empty hole directly beyond it. Every hole reachable by a chain of jumps becomes a target, so one click can complete a multi-hop chain. A `visited` set stops the search from looping.

### Turn sequence

```
select piece ──► click target
                   ├─ single step → turnState 'moved' → endTurn() automatically
                   └─ jump        → turnState 'jumping'
                                      ├─ piece stays selected; player may keep jumping
                                      └─ "End Turn" button → endTurn()
```

`endTurn()`:
1. Calls `checkWin(currentPlayerIndex)`, which is true when all 10 destination holes hold that player's pieces.
2. On a win, it sets `gameOver`, shows a toast, and shows the winner overlay 500 ms later. The overlay hides itself after 5 s.
3. Otherwise, it moves on to the next seat and calls `checkForAITurn()`.
4. Either way, it resets the selection, valid moves and `turnState`, then re-renders.

### Rendering

`render()` clears the SVG and redraws it completely in four layers. Each layer is built in a `DocumentFragment`:

1. `renderHomeZones()` paints a translucent triangle (`.home-zone.playerN-home`) under each seat's starting point. The triangle's corners are the three home holes farthest from the triangle's center, pushed outward by `1.3 × HEX_SIZE`. Its rounded edges come from a thick stroke with `stroke-linejoin: round`.
2. `renderBoardHoles()` draws the drilled holes (`.hole`).
3. `renderPieces()` draws each marble as two circles: `.piece` in the player's color, then a `.piece-shine` overlay that adds the glass highlight and edge shading. The selected piece gets the `.selected` class.
4. `renderHighlights()` draws a glowing `.valid-move` ring around each reachable hole, if `showValidMoves` is on.

The gradients these use (`#marble-shine`, `#hole-shade`) are defined in a hidden `<svg><defs>` at the top of `index.html`. They can't live inside `#game-board`, because `render()` wipes that SVG on every redraw.

Click handlers are attached to holes and pieces as they are drawn (`onclick`). The `.valid-move` rings, `.piece-shine` overlays and `.home-zone` triangles have `pointer-events: none`, so taps pass through to the hole or piece underneath. Each `.hole` has a transparent 16-unit stroke that makes its tap target about the size of the hole spacing.

---

## 7. AI (`ai-player.js`)

Each AI seat has its own `ChineseCheckersAI(game, difficulty)` instance. Its turn runs like this:

1. `checkForAITurn()` sets `isAITurn`, disables End Turn, and calls `executeAITurn()` after 500 ms. `endTurn()` clears `isAITurn` and re-enables End Turn whenever the turn changes, then calls `checkForAITurn()`, which sets them again if the next seat is also an AI.
2. `executeAITurn()` shows a "thinking…" status and toast, then waits for the difficulty's thinking time (Easy 800 ms, Medium 1200 ms, Hard 1800 ms).
3. `findBestMove()` picks a `{from, to}` move using the strategy for the difficulty.
4. `executeMoveSequence()` uses the **same public game methods a human click would use** (`selectPiece` → `movePiece`), with 300 ms pauses so the move is visible. After a jump it may continue the chain, then it calls `endTurn()`. A single step ends the turn inside `movePiece()`. So after each move, the AI checks whether `currentPlayerIndex` has changed and stops if it has. Without that check it could keep acting during the next player's turn.

### Strategies

All distances are hex distances to the **nearest** destination hole (`getMinDistanceToDestination`).

| Difficulty | Move choice | Continue jumping? |
| --- | --- | --- |
| **Easy** | Shuffles its pieces and takes the first one that can move. 60% of the time it prefers a forward move, otherwise any random move. | 40% chance |
| **Medium** | Greedy score: `distanceGain × 10`, +5 for a jump, +15 for landing in the destination, plus up to 2 random. | 70% chance |
| **Hard** | Ignores pieces already in the destination (unless all of them are). Score: `distanceGain × 15`, +8 for a jump, +3 per follow-up jump available, +20 for landing in the destination, −2 for straying far from the center, plus up to 1 random. | Stops after 3 continuations. Otherwise continues if a jump gains ≥ 1 distance, or 60% of the time. |

Jump chains are capped at `MAX_JUMPS = 10` as a backstop.

> **Note:** `getValidMovesForPiece` calls `game.calculateValidMoves`, which **overwrites `game.validMoves`**. While the AI is evaluating moves, the game's highlight state is temporarily wrong. This doesn't matter in practice, because `selectPiece` recalculates it before the next render.

---

## 8. Setup flow (`script.js`, second `DOMContentLoaded` handler)

1. Clicking a player-count button calls `showColorSelection(n)`. It resets the per-player arrays (`selectedColorIndices`, `playerNames`, `playerTypes`, `playerDifficulties`) and adds a **Next** button if there isn't one yet.
2. `updatePlayerSetup()` runs once for each player. It resets the type to Human and the difficulty to Medium, rebuilds the name input, and re-renders the six color swatches. Colors already chosen by earlier players are faded out and can't be clicked.
3. Choosing **AI** shows the difficulty buttons and pre-fills the name with "AI Player N".
4. `validateSetup()` enables Next (or Start Game for the last player) only when the player has a non-empty name and a color.
5. **Start Game** creates `ChineseCheckersGame`, copies in the names and colors, and calls `init()`.
6. **New Game** (`#restart-btn`) goes back to the player-count screen and discards the game instance.

The first `DOMContentLoaded` handler inserts the logo and adds a ripple effect to button clicks.

---

## 9. UI utilities

- **`showNotification(message, type, duration)`** shows a toast in `#notification-container`. `type` is `info`, `success` or `warning`. When `duration` runs out, the toast slides out and is removed. It is exposed on `window`.
- **`showGameOverlay(winnerName)`** and **`hideGameOverlay()`** show and hide the winner overlay.

---

## 10. Styling (`style.css`)

- **Theme: a wooden board game.** Each part of the page is styled as a physical object:

  | Element | Looks like |
  | --- | --- |
  | Page background | Dark walnut table with planks and a vignette |
  | `#game-board-container` | Round honey-oak board with a raised rim |
  | Holes | Drilled into the wood |
  | Pieces and color swatches | Glass marbles |
  | Setup card and status panel | Oak plaques with burned-in text |
  | Buttons | Lacquered wooden blocks that sink when pressed |
  | Toggle | Brass knob in a routed groove |
  | Toasts | Parchment slips |
  | Winner card | Framed parchment certificate |

  Everything is CSS gradients and inline SVG, with no image files.
- **Theme tokens** live on `:root`:
  - wood and lacquer: `--oak`, `--walnut`, `--mahogany`, `--lacquer-green`, `--brass`, `--parchment`, and so on
  - text: `--ink` for text on light wood or parchment, `--engraved` for the gilded title
  - players: `--player0-color` … `--player5-color` (Cyan, White, Green, Yellow, Dark Gray, Red)
  - `--rim`: the board rim thickness, smaller on small screens
- **`--grain`** is a tileable wood-grain texture: an inline SVG data URI using `feTurbulence`, drawn as translucent brown streaks. It's layered over a solid base color, so the same texture works for the table, board, plaques and buttons. The filters set `x/y/width/height` to the tile bounds; without that, `stitchTiles` stitches at the default filter region and the tiles show a seam.
- **`--marble-shine`** is the CSS version of the SVG `#marble-shine` gradient, used for HTML marbles (color swatches and the turn indicator).
- **Buttons** set `--btn-face` and `--btn-edge`. To add a button variant, override those two variables (see `#end-turn-btn` and `#back-to-players-btn`).
- **Piece and home classes** `.playerN` and `.playerN-home` map to the player color tokens. `.playerN-home` sets both fill and stroke, because the triangle's rounded edge is drawn with its stroke.
- **Fonts**: Cinzel for titles. Lora for body text and anything containing a player number or name, because Cinzel's "1" looks like an "I".
- **Board sizing**: `--board-size` on `:root` sets the SVG's width and height. It's the largest square that fits after the title and status bar, capped at 900px. `--vh` is `100dvh` where supported, so mobile browser toolbars are taken into account.
- **Layouts**:
  - Portrait (default): status bar above the board.
  - `(orientation: landscape) and (min-width: 900px)`: status panel in a column to the left of the board, so the board can use the full height.
- **Touch** (`pointer: coarse`): buttons and color swatches are at least 44px, the toggle is larger, the name field uses 16px text so iOS doesn't zoom in, and toasts move to the bottom (bottom-left in landscape) so they don't cover the controls. Toasts never take taps (`pointer-events: none`).
- **Hover effects** are inside `@media (hover: hover)`, so they don't stay on after a tap on touch screens.
- **Size breakpoints**:
  - `max-width: 1024px`: thinner board rim (`--rim: 7px`) and padding, a narrower setup card, and the Player Type and AI Difficulty trays stacked.
  - `max-width: 480px`: `--rim: 5px`, a compact status bar, and a smaller winner card.
- **Safe areas**: `.container` padding uses `env(safe-area-inset-*)`, because the viewport is `viewport-fit=cover`.
- **No pull-to-refresh**: `html, body { overscroll-behavior: none }`. Without it, a tap on the board that drifts downward can trigger the browser's pull-to-refresh on Chrome for Android and Safari on iPad. That reloads the page and loses the game.
- **No gestures on the board**: `#game-board { touch-action: none }`, so a touch on the board never starts a browser scroll, swipe or zoom. Taps still produce clicks. This matters most for styluses: a stylus on Android tablets scrolls like a finger, and a pen stroke often starts as a tap on a marble and then drifts.
- **Accessibility**: a `prefers-reduced-motion: reduce` block turns animations down.
- **Mobile**: the viewport meta disables zoom, and Apple web-app metas allow a full-screen home-screen launch.

> The color names in `PLAYER_NAMES` (`"Blue"`, `"Black"`) don't quite match the CSS colors (cyan, dark gray). They only appear as swatch tooltips and fallback names.

> `renderColorSwatches()` in `script.js` sets inline borders on the white and dark-gray swatches. Those borders were for the old flat theme. `.color-swatch` overrides them with `border: none !important`, because the marble shading already separates those colors from the wood. If you remove the inline borders from the JS, you can drop the `!important`.

---

## 11. Build and deployment

- `vite.config.js` sets `base: './'`, so the built site uses **relative** asset paths and works from any subdirectory (for example GitHub Pages). The comment in the file still mentions `'/'`, but `'./'` is what's actually set.
- Files in `public/` are copied as-is to the root of `dist/`. That's why the logo is loaded as `'chinesecheckers-logo.png'`, with no `public/` prefix.
- **Playing on a tablet or phone over Wi-Fi:** run `npm run host` and open the "Network" URL it prints (port 4173) on the device. **Don't play real games on the dev server** (`npm run dev -- --host`). Vite's dev client reloads the page whenever its WebSocket connection to the server drops and comes back. Tablets drop idle Wi-Fi connections to save power, and a reload wipes the game in progress. `npm run host` serves the production build, which doesn't include that client. Run `npm run host` again after changing code.
### PWA (install to home screen, offline play)

**Files:**

- **`public/manifest.webmanifest`:** app name, colors and icons. `display: standalone` hides the browser toolbar, so there's no pull-to-refresh or address bar in the installed app.
- **`public/icons/`:** made from the star in the logo, on an oak background.
- **`public/sw.js`:** the service worker. Its caching rules:
  - **On install:** fetches the page and caches it, plus every same-origin file it references and the logo, so one visit is enough to play offline.
  - **Pages:** network first, so updates show up. If the network fails or takes over 3 s, the cached page is used, which helps on flaky tablet Wi-Fi.
  - **Same-origin files and Google Fonts:** cache first. Vite's hashed asset names change on every build, so cached copies are never stale.
- **Registration:** in `script.js`, `navigator.serviceWorker.register('sw.js')` runs **only in production builds** (`import.meta.env.PROD`). In dev, the cache would fight Vite's live updates.

**HTTPS is required.** Browsers only run service workers, and only offer "Install app", on **HTTPS** or **`localhost`**. A plain `http://192.168.x.x:4173` address from `npm run host` still plays fine, with resume. But on another device it won't install as an app or work offline. To install on a tablet, the game must be served over HTTPS. Options:

- **Static HTTPS host** (for example GitHub Pages; `base: './'` already supports it). Install once and it then works offline with no computer running.
- **A trusted local certificate** (for example `mkcert`, with its root certificate installed on the tablet). Needed if it has to stay on your own network, but setup is fiddly.

**Updating cached files:**

- **Hashed build files:** update by themselves.
- **Unhashed files in `public/`** (logo, icons, manifest): installed copies keep the old version. When you change one, bump `CACHE` in `sw.js` (for example `chinese-checkers-v2`). The new service worker deletes old caches when it activates.

**Testing:** the service worker and offline mode can only be tested with `npm run build` then `npm run preview` (localhost counts as secure), not with `npm run dev`. In the browser's dev tools, the Application tab shows the manifest, the service worker and the cache.

### Other runtime dependencies

- Fonts come from Google Fonts (Cinzel, Lora), and analytics come from Simple Analytics (`scripts.simpleanalyticscdn.com`). Both are loaded at runtime, so the page needs network access for them.

---

## 12. Known issues and quirks

These came up while reviewing the code. They're worth knowing about before you change related areas.

1. **Wrong winner in the status bar.** `updateUI()` calculates the winner as `currentPlayerIndex - 1`. But `endTurn()` doesn't advance the turn when someone wins, so the status text names the *previous* player. The toast and overlay are correct because they use `currentPlayerIndex`.
2. **Duplicate event listeners.** `setupPlayerTypeSelection()` and `setupAIDifficultySelection()` add listeners every time a player-count button is clicked. After going Back and choosing again, a single click fires several handlers (you'll see duplicate "AI difficulty set to…" toasts, for example).
3. **No anti-blocking rule.** A player can permanently block an opponent by leaving pieces in that opponent's destination, because `checkWin` requires all 10 destination holes to hold the winner's own pieces.
4. **Toast exit animation is missing.** `showNotification` uses `slideOutRight`, but there is no `@keyframes slideOutRight` in `style.css`, so toasts disappear without animating.
5. **Unused values.** `BOARD_RADIUS`, `turnMovedPiece` (written but never read), and the `window.playerNames` / `window.selectedColorIndices` fallbacks in the constructor.
6. **`renderColorSwatches` makes a throwaway `ChineseCheckersGame`** just to read `PLAYER_NAMES` and `PLAYER_COLORS`. Those could be module-level constants.
7. **Seat 0 always moves first.** The comment says "Human player always starts", but if seat 0 is an AI, the AI starts.

---

## 13. Extending the project

- **New AI difficulty:** add a `find<Level>Move` method and a `case` in `findBestMove()`, `shouldContinueJumping()` and `thinkingTimes`. Then add a `.difficulty-btn` with a matching `data-difficulty` in `index.html`.
- **New player colors:** add `--player6-color` and the matching `.player6` / `.player6-home` classes, then extend `PLAYER_COLORS` and `PLAYER_NAMES`. The swatch loop is currently hard-coded to `< 6`.
- **Different player counts (for example 5):** add a case to `getPlayerBoardPositions()` and a button in `#player-selection`.
- **Changing the look:**
  - Colors and wood tones are the tokens on `:root`. Change `--oak` and `--walnut` for a lighter or darker board, and `--mahogany` / `--lacquer-green` for the buttons.
  - The grain strength is set by the last row of each `feColorMatrix` in `--grain`: the alpha multiplier and offset (for example `1.6 … -0.62`). A bigger multiplier or a smaller negative offset gives darker, denser grain.
  - The marble look is the `#marble-shine` gradient in `index.html` and `--marble-shine` in CSS. Keep the two in sync.
  - The painted triangle size is the `1.3 × HEX_SIZE` outward push in `renderHomeZones()`, plus the `.home-zone` stroke width. Make them larger and the paint starts touching the central holes.
- **Tests:** there are none yet. The pure logic (`rotateCoord`, `getStartingPieces`, `calculateValidMoves`, `checkWin`, `hexDistance`) could be split out of the DOM-dependent class and tested with Vitest, which works with the existing Vite setup.

---

## 14. Checking UI changes

There are no automated UI tests. After changing layout or styling, check the game at these sizes, in browser dev tools or on real devices:

| Device | Viewport | Layout |
| --- | --- | --- |
| iPad mini, portrait | 768 × 1024 | Status bar above the board |
| iPad Air, portrait | 820 × 1180 | Status bar above the board |
| iPad Air, landscape | 1180 × 820 | Status panel beside the board |
| iPad Pro 12.9", landscape | 1366 × 1024 | Status panel beside the board, board at 900px cap |
| Phone | 390 × 844 | Compact status bar |
| Desktop | 1440 × 900 | Status panel beside the board, mouse hover effects |

Turn on touch emulation for the tablet and phone sizes; without it, the `pointer: coarse` styles don't apply. At each size, check:

- **Board:** all 121 holes and every star point are fully inside the board.
- **Scrolling:** the page doesn't scroll sideways.
- **Tap targets:** buttons and color swatches are at least 44px tall on touch devices.
- **Tapping holes:** a tap slightly off-center on a highlighted hole still makes the move.
- **Toasts:** they don't cover the status panel or controls.
- **Winner card:** it fits on screen. In the console, run `showGameOverlay('Player 1')` to show it.

To try it on a real tablet over Wi-Fi, run `npm run host` and open the "Network" URL it prints on the tablet (see §11 for why not the dev server).

---

## 15. Change history

### Tablet-friendly layout

**Problem:** on screens 1024px wide or narrower, CSS shrank the SVG to 350px, but the JS still placed holes for a 600px board. On an iPad in portrait, 36 holes and pieces were cut off. On top of that:

- Buttons were about 30px tall, and the tap target on a hole was only 18px.
- Hover effects stayed on after a tap.
- Toasts covered the status panel.

**Changes:**

- **Board scaling:** the board now uses a fixed `viewBox`, and CSS sizes it with `--board-size`. The JS no longer reads the screen size, which also fixed the board going off-center after a rotation.
- **Layout:** the status bar and board are in normal flow instead of absolutely positioned. Landscape screens get a side panel.
- **Touch:** the touch sizing, toast placement and safe-area padding described in §10.
- **Hover:** hover effects only apply on devices that can hover.
- **Fixes:**
  - the name field spilled past the edge of the setup card
  - the hidden winner card made phones scroll sideways
  - `.selected` was unscoped, so the setup buttons got the selected piece's glow

### Wooden board-game theme

**Problem:** the purple, glassy look didn't feel like a board game.

**Changes:**

- **Look:** the UI was restyled as physical objects: a wooden table and board, glass marbles, plaques, pressable wooden buttons and parchment (table in §10).
- **New rendering:** `renderHomeZones()` and the marble `.piece-shine` overlay (§6).
- **Home triangles (behavior change):** before, a home hole was tinted only while a piece sat in it. Now each player's whole starting triangle stays painted for the entire game, like a real board. The unused `homeZoneMap` was removed.
- **Fonts:** Cinzel and Lora replace Poppins.

### Fix: game resetting on tablets

**Report:** on a tablet with the game hosted locally, the game went back to the setup screen after a few turns, right after a jump over the player's own piece and an End Turn tap.

**Investigation:** a scripted tablet-sized browser played 360 turns against AI opponents, mostly jumps over the player's own piece followed by End Turn taps. There were no JavaScript errors and the game logic never reset. The reset was the **page reloading**, and there are two ways that happens on a tablet:

1. **The dev server.** It was used for hosting, and Vite's dev client reloads the page after any WebSocket drop.
2. **Pull-to-refresh.** The browser's gesture triggers on a downward drag over the board.

**Fixes:**

- **Hosting:** added `npm run host`, which serves the production build with no reload client (§11).
- **Pull-to-refresh:** `overscroll-behavior: none` (§10).
- **Ignored taps (found during testing):** for about 300 ms after an AI's single-step move, taps on the board were ignored, because `isAITurn` was only cleared when the AI's promise resolved. `endTurn()` now owns that flag, and the AI stops once its turn has ended (§7).

**Not fixed by these changes:** the game wasn't saved anywhere, so any other reload still lost it. That's handled by the next change.

### PWA, saved game, and stylus

**Report:** the game reset again on a tablet, played with a stylus. It was hosted with `npm run dev -- --host`, so the dev server's reload-on-reconnect still applied. The request was to make the game a PWA.

**Changes:**

- **Saved game:** the game is saved at every turn and resumes after any reload (§5). This is the fix that works whatever causes the reload.
- **PWA:** manifest, icons and a service worker for offline play (§11). The installed app runs standalone, with no browser pull-to-refresh or toolbar.
- **Stylus:** `touch-action: none` on the board (§10), so pen strokes can't become page gestures.

**Verified:**

- **Resume:** after a reload, the board, current player, names, colors and AI seats came back identically, and New Game cleared the save.
- **Offline:** on the production build, the service worker cached the app on the first visit. With the server stopped, a reload loaded the app from the cache and resumed the game.
