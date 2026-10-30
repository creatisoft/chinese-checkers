# 🌟 Chinese Checkers Game 🌟

![Chinese Checkers Logo](/public/chinesecheckers-logo.png)

## 🎮 Play the Game!

A modern, responsive implementation of the classic Chinese Checkers board game that works on all devices! Challenge friends or test your skills against the AI.

## ✨ Features

- 🎲 Play with 2, 3, 4, or 6 players
- 🤖 AI opponents with three difficulty levels:
  - 🟢 Easy - for casual players
  - 🟡 Medium - for a good challenge
  - 🔴 Hard - for experienced players
- 🎨 Customizable player colors and names
- 📱 Fully responsive design - works on desktops, tablets, and phones
- 🪵 Classic wooden board-game look - oak board, glass marbles, painted home triangles
- 🔍 Highlight valid moves feature
- 🎉 Winner certificate when someone wins
- 📲 Installable app (PWA) that works offline
- 💾 Games are saved after every turn and resume if the page reloads

## 🕹️ How to Play

Chinese Checkers is a strategy board game where each player tries to move all their pieces across the board to the opposite star point.

1. Select the number of players
2. Customize each player (human or AI, name, color)
3. Take turns moving your pieces
4. Win by moving all your pieces to the opposite star point

### 📏 Rules

- Move one space forward or sideways to an empty spot (house rule: no moving backward)
- Jump over one adjacent piece into the empty spot directly beyond it
- Keep jumping in the same turn, one hop at a time, or end your turn
- If you have no legal move, your turn is passed
- First player to fill their destination wins. Opponent pieces stuck there count as filled, as long as you have at least one piece there

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/creatisoft/chinese-checkers.git

# Navigate to the project directory
cd chinese-checkers

# Install dependencies
npm install

# Start the development server
npm run dev

# Play on a tablet/phone on the same Wi-Fi (production build; don't use the dev server for real games)
npm run host
```

To install it as an app (offline play), serve it over HTTPS. See [docs/c-checkers.md](docs/c-checkers.md#pwa-install-to-home-screen-offline-play).

## 🛠️ Technologies Used

- HTML5, CSS3, JavaScript
- SVG for the game board
- Vite for fast development and optimized builds

## 📱 Mobile Support

The game is fully optimized for mobile devices with:
- Touch-friendly controls (44px+ tap targets, generous tap areas around each hole)
- A board that scales to fill the screen, with the status panel above it in portrait and beside it in landscape
- Performance optimizations for smooth gameplay on all devices

## 📚 Documentation

See [docs/c-checkers.md](docs/c-checkers.md) for how the game is built, including the board model, AI, styling and theme, and how to check UI changes.

## 🌐 Browser Compatibility

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## 🧩 Project Structure

- `index.html` - Main HTML file
- `script.js` - Core game logic
- `ai-player.js` - AI opponent implementation
- `style.css` - Game styling
- `public/` - Static assets


## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎮 Enjoy the Game!

Thanks for checking out Chinese Checkers! Have fun playing! 🎲
