class ChineseCheckersGame {
    // --- Constants & Config ---
    SVG_NS = "http://www.w3.org/2000/svg";
    BOARD_RADIUS = 8;
    STAR_TIP_SIZE = 4;
    HEX_SIZE = 20; // Reduced from 30 to 20 for smaller board that fits in viewport
    PLAYER_NAMES = ["Blue", "White", "Green", "Yellow", "Black", "Red"];
    PLAYER_COLORS = [
        "var(--player0-color)", "var(--player1-color)", "var(--player2-color)",
        "var(--player3-color)", "var(--player4-color)", "var(--player5-color)"
    ];
    AXIAL_DIRECTIONS = [
        { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
        { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];
    PLAYER_ROTATIONS = [1, 2, 3, 4, 5, 0]; // Blue, White, Green, Yellow, Black, Red

    constructor(svgElement, numPlayers, playerTypes, playerDifficulties) {
        this.svgBoard = svgElement;
        this.numPlayers = numPlayers;
        this.playerTypes = playerTypes; // Array of 'human' or 'ai' for each player
        this.playerDifficulties = playerDifficulties; // Array of difficulty levels for AI players

        this.statusTextEl = document.getElementById('status-text');
        this.turnIndicatorEl = document.getElementById('turn-indicator');
        this.endTurnBtn = document.getElementById('end-turn-btn');

        this.board = new Map();
        this.validBoardCoords = new Set();
        this.playerHomes = [];
        this.playerDestinations = [];
        this.homeZoneMap = new Map();
        this.activePlayers = [];
        this.currentPlayerIndex = 0;
        this.selectedPiece = null;
        this.validMoves = [];
        this.turnState = 'select';
        this.turnMovedPiece = null;
        this.gameOver = false;
        this.aiPlayers = new Map(); // Map of player index to AI instance
        this.isAITurn = false;
        // Add these for custom names/colors
        this.playerNames = window.playerNames ? window.playerNames.slice() : ["Player 1", "Player 2"];
        this.playerColors = window.selectedColorIndices ? window.selectedColorIndices.slice() : [0, 3];
        this.showValidMoves = true;
    }

    init() {
        this.setupPlayerConfig();
        this.createBoardLayout();
        this.populateInitialPieces();
        this.bindEvents();
        this.updateUI();
        this.render();
        
        // Initialize AI players for each AI player type
        if (window.ChineseCheckersAI) {
            for (let i = 0; i < this.numPlayers; i++) {
                if (this.playerTypes[i] === 'ai') {
                    const difficulty = this.playerDifficulties[i] || 'medium';
                    this.aiPlayers.set(i, new ChineseCheckersAI(this, difficulty));
                }
            }
        }
        
        // Check if first player is AI
        this.checkForAITurn();
    }

    setupPlayerConfig() {
        // For multiple players, use positions 0, 1, 2, etc. sequentially  
        this.activePlayers = [];
        for (let i = 0; i < this.numPlayers; i++) {
            this.activePlayers.push(i);
        }
        this.currentPlayerIndex = 0; // Human player always starts
    }

    createBoardLayout() {
        this.validBoardCoords.clear();
        for (let q = -this.STAR_TIP_SIZE; q <= this.STAR_TIP_SIZE; q++) {
            for (let r = -this.STAR_TIP_SIZE; r <= this.STAR_TIP_SIZE; r++) {
                if (-q - r >= -this.STAR_TIP_SIZE && -q - r <= this.STAR_TIP_SIZE) {
                    this.validBoardCoords.add(this.coordToString({ q, r }));
                }
            }
        }

        // Map board positions based on number of players
        const playerPositions = this.getPlayerBoardPositions();
        
        for (let i = 0; i < 6; i++) {
            const tipCoords = this.getStartingPieces(i);
            tipCoords.forEach(coord => this.validBoardCoords.add(this.coordToString(coord)));
        }

        this.homeZoneMap.clear();
        for (let i = 0; i < this.numPlayers; i++) {
            const boardPosition = playerPositions[i];
            this.playerHomes[i] = this.getStartingPieces(boardPosition);
            this.playerDestinations[i] = this.getStartingPieces((boardPosition + 3) % 6);
            this.playerHomes[i].forEach(coord => {
                this.homeZoneMap.set(this.coordToString(coord), i);
            });
        }
    }

    getPlayerBoardPositions() {
        // Return board positions (0-5) for each player based on game setup
        switch (this.numPlayers) {
            case 2:
                return [0, 3]; // Opposite corners
            case 3:
                return [0, 2, 4]; // Every other corner
            case 4:
                return [0, 1, 3, 4]; // Adjacent pairs
            case 6:
                return [0, 1, 2, 3, 4, 5]; // All positions
            default:
                return [0, 3]; // Default to 2-player
        }
    }

    populateInitialPieces() {
        this.board.clear();
        // Use playerColors for piece color assignment
        this.activePlayers.forEach((playerIndex, i) => {
            const colorIndex = this.playerColors[i] !== undefined ? this.playerColors[i] : playerIndex;
            const pieces = this.playerHomes[playerIndex];
            pieces.forEach(coord => {
                this.board.set(this.coordToString(coord), { player: i, colorIndex });
            });
        });
    }
    
    bindEvents() {
        this.endTurnBtn.onclick = () => this.endTurn();
    }

    axialToPixel(q, r) {
        const svgSize = this.svgBoard.getBoundingClientRect();
        const x = this.HEX_SIZE * (3 / 2 * q) + svgSize.width / 2;
        const y = this.HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r) + svgSize.height / 2;
        return { x, y };
    }
    coordToString(coord) { return `${coord.q},${coord.r}`; }
    stringToCoord(str) { const [q, r] = str.split(',').map(Number); return { q, r }; }
    getNeighbor(q, r, direction) {
        const dir = this.AXIAL_DIRECTIONS[direction];
        return { q: q + dir.q, r: r + dir.r };
    }

    getStartingPieces(playerIndex) {
        let base_coords = [];
        for (let i = 1; i <= this.STAR_TIP_SIZE; i++) {
            for (let j = 0; j < i; j++) {
                base_coords.push({ q: -this.STAR_TIP_SIZE + j, r: -i });
            }
        }
        const rotation = this.PLAYER_ROTATIONS[playerIndex];
        return base_coords.map(c => this.rotateCoord(c, rotation));
    }

    rotateCoord(coord, rotations) {
        let { q, r } = coord;
        for (let i = 0; i < rotations; i++) {
            const temp_q = q;
            q = -r;
            r = temp_q + r;
        }
        return { q, r };
    }

    render() {
        this.svgBoard.innerHTML = '';
        this.renderBoardHoles();
        this.renderPieces();
        this.renderHighlights();
    }

    renderBoardHoles() {
        this.validBoardCoords.forEach(coordStr => {
            const { q, r } = this.stringToCoord(coordStr);
            const { x, y } = this.axialToPixel(q, r);
            const hole = document.createElementNS(this.SVG_NS, 'circle');
            hole.setAttribute('cx', x);
            hole.setAttribute('cy', y);
            hole.setAttribute('r', this.HEX_SIZE * 0.45); // Properly scaled: 0.9 * 0.5 = 0.45
            hole.classList.add('hole');

            // Only color home zone holes that still have pieces in them
            // When a piece moves away, the hole stays black
            if (this.homeZoneMap.has(coordStr) && this.board.has(coordStr)) {
                const playerOwner = this.homeZoneMap.get(coordStr);
                const colorIndex = this.playerColors && this.playerColors[playerOwner] !== undefined ? this.playerColors[playerOwner] : playerOwner;
                hole.classList.add('home-zone-hole', `player${colorIndex}-home`);
            }

            // Keep all holes black - no destination zone coloring
            hole.onclick = () => this.handleHoleClick(q, r);
            this.svgBoard.appendChild(hole);
        });
    }

    renderPieces() {
        this.board.forEach((piece, coordStr) => {
            const { q, r } = this.stringToCoord(coordStr);
            const { x, y } = this.axialToPixel(q, r);
            const pieceEl = document.createElementNS(this.SVG_NS, 'circle');
            pieceEl.setAttribute('cx', x);
            pieceEl.setAttribute('cy', y);
            pieceEl.setAttribute('r', this.HEX_SIZE * 0.8); // Adjusted for better proportion with smaller hex size
            // Use colorIndex for piece color
            pieceEl.classList.add('piece', `player${piece.colorIndex}`);
            if (this.selectedPiece && this.selectedPiece.q === q && this.selectedPiece.r === r) {
                pieceEl.classList.add('selected');
            }
            pieceEl.onclick = () => this.handlePieceClick(q, r, piece.player);
            this.svgBoard.appendChild(pieceEl);
        });
    }

    renderHighlights() {
        if (!this.showValidMoves) return;
        this.validMoves.forEach(move => {
            const { x, y } = this.axialToPixel(move.q, move.r);
            const moveEl = document.createElementNS(this.SVG_NS, 'circle');
            moveEl.setAttribute('cx', x);
            moveEl.setAttribute('cy', y);
            moveEl.setAttribute('r', this.HEX_SIZE * 0.2); // Properly scaled: 0.4 * 0.5 = 0.2
            moveEl.classList.add('valid-move');
            moveEl.onclick = () => this.handleHoleClick(move.q, move.r);
            this.svgBoard.appendChild(moveEl);
        });
    }

    updateUI() {
        const name = this.playerNames && this.playerNames[this.currentPlayerIndex] ? this.playerNames[this.currentPlayerIndex] : this.PLAYER_NAMES[this.currentPlayerIndex];
        const colorIndex = this.playerColors && this.playerColors[this.currentPlayerIndex] !== undefined ? this.playerColors[this.currentPlayerIndex] : this.currentPlayerIndex;
        if (this.gameOver) {
            const winnerIdx = (this.currentPlayerIndex + this.activePlayers.length - 1) % this.activePlayers.length;
            const winnerName = this.playerNames && this.playerNames[winnerIdx] ? this.playerNames[winnerIdx] : this.PLAYER_NAMES[winnerIdx];
            this.statusTextEl.textContent = `${winnerName} wins!`;
            const winnerColorIndex = this.playerColors && this.playerColors[winnerIdx] !== undefined ? this.playerColors[winnerIdx] : winnerIdx;
            this.turnIndicatorEl.style.backgroundColor = this.PLAYER_COLORS[winnerColorIndex];
            this.endTurnBtn.style.visibility = 'hidden';
        } else {
            // Show AI indicator if it's AI's turn
            const isAIPlayer = this.playerTypes[this.currentPlayerIndex] === 'ai';
            const difficultyText = isAIPlayer ? ` (AI-${this.playerDifficulties[this.currentPlayerIndex] || 'medium'})` : '';
            this.statusTextEl.textContent = `${name}'s Turn${difficultyText}`;
            this.turnIndicatorEl.style.backgroundColor = this.PLAYER_COLORS[colorIndex];
            
            // Hide end turn button during AI turns
            if (this.isAITurn) {
                this.endTurnBtn.style.visibility = 'hidden';
            } else {
                this.endTurnBtn.style.visibility = (this.turnState === 'moved' || this.turnState === 'jumping') ? 'visible' : 'hidden';
            }
        }
    }

    handlePieceClick(q, r, player) {
        if (this.gameOver || this.isAITurn) return;
        // Use currentPlayerIndex for comparison
        if (player === this.currentPlayerIndex) {
            // Allow selecting a piece at start of turn
            if (this.turnState === 'select') {
                this.selectPiece(q, r);
            }
            // If in jumping state, allow player to continue jumping with the same piece
            else if (this.turnState === 'jumping' && this.selectedPiece && this.selectedPiece.q === q && this.selectedPiece.r === r) {
                this.selectPiece(q, r);
            }
        }
    }

    handleHoleClick(q, r) {
        if (this.gameOver || this.isAITurn || !this.selectedPiece) return;
        const targetMove = this.validMoves.find(move => move.q === q && move.r === r);
        if (targetMove) {
            this.movePiece(this.selectedPiece, { q, r });
        }
    }

    selectPiece(q, r) {
        this.selectedPiece = { q, r };
        this.calculateValidMoves(q, r);
        this.render();
    }

    calculateValidMoves(q, r) {
        this.validMoves = [];
        const visited = new Set([this.coordToString({ q, r })]);

        if (this.turnState === 'select') {
            for (let i = 0; i < 6; i++) {
                const neighbor = this.getNeighbor(q, r, i);
                if (this.validBoardCoords.has(this.coordToString(neighbor)) && !this.board.has(this.coordToString(neighbor))) {
                    this.validMoves.push(neighbor);
                }
            }
        }
        this.findJumps(q, r, visited);
    }

    findJumps(q, r, visited) {
        for (let i = 0; i < 6; i++) {
            const neighbor = this.getNeighbor(q, r, i);
            const jumpTo = this.getNeighbor(neighbor.q, neighbor.r, i);
            const jumpToStr = this.coordToString(jumpTo);

            if (this.validBoardCoords.has(jumpToStr) && this.board.has(this.coordToString(neighbor)) && !this.board.has(jumpToStr) && !visited.has(jumpToStr)) {
                this.validMoves.push(jumpTo);
                visited.add(jumpToStr);
                this.findJumps(jumpTo.q, jumpTo.r, visited);
            }
        }
    }

    movePiece(from, to) {
        const piece = this.board.get(this.coordToString(from));
        this.board.delete(this.coordToString(from));
        this.board.set(this.coordToString(to), piece);

        const dx = to.q - from.q;
        const dy = to.r - from.r;
        const isJump = Math.abs(dx) > 1 || Math.abs(dy) > 1 || Math.abs(dx + dy) > 1;

        this.selectedPiece = null;
        this.validMoves = [];
        this.turnMovedPiece = to;

        if (isJump) {
            this.turnState = 'jumping';
            showNotification('🦘 Great jump! Continue or end turn.', 'success', 2000);
            // After a jump, allow player to continue jumping or end turn
            this.selectPiece(to.q, to.r);
            // End Turn button is visible, player can choose to end turn
        } else {
            this.turnState = 'moved';
            showNotification('✨ Nice move!', 'info', 1500);
            // Automatically end the turn after a single step
            this.endTurn();
        }

        this.render();
        this.updateUI();
    }

    endTurn() {
        if (this.checkWin(this.currentPlayerIndex)) {
            this.gameOver = true;
            const winnerName = this.playerNames && this.playerNames[this.currentPlayerIndex] 
                ? this.playerNames[this.currentPlayerIndex] 
                : this.PLAYER_NAMES[this.currentPlayerIndex];
            showNotification(`🎉 ${winnerName} wins!`, 'success', 5000);
            setTimeout(() => {
                showGameOverlay(winnerName);
            }, 500);
        } else {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.activePlayers.length;
            const newPlayerName = this.playerNames && this.playerNames[this.currentPlayerIndex] 
                ? this.playerNames[this.currentPlayerIndex] 
                : this.PLAYER_NAMES[this.currentPlayerIndex];
            showNotification(`${newPlayerName}'s turn`, 'info', 2000);
            
            // Check if it's now an AI player's turn
            this.checkForAITurn();
        }
        this.selectedPiece = null;
        this.validMoves = [];
        this.turnState = 'select';
        this.turnMovedPiece = null;
        this.updateUI();
        this.render();
    }

    /**
     * Check if current player is AI and trigger AI turn if needed
     */
    checkForAITurn() {
        if (this.gameOver) {
            return;
        }

        // Check if current player is AI
        if (this.playerTypes[this.currentPlayerIndex] === 'ai') {
            const aiPlayer = this.aiPlayers.get(this.currentPlayerIndex);
            if (aiPlayer) {
                this.isAITurn = true;
                
                // Disable user input during AI turn
                this.endTurnBtn.disabled = true;
                
                // Trigger AI turn after a brief delay
                setTimeout(() => {
                    aiPlayer.executeAITurn().then(() => {
                        this.isAITurn = false;
                        this.endTurnBtn.disabled = false;
                    });
                }, 500);
            }
        }
    }

    checkWin(playerIndex) {
        return this.playerDestinations[playerIndex].every(coord => {
            const piece = this.board.get(this.coordToString(coord));
            return piece && piece.player === playerIndex;
        });
    }
}

// --- Notification System ---
function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out forwards';
        setTimeout(() => {
            if (container.contains(notification)) {
                container.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// --- Game State Overlay ---
function showGameOverlay(winnerName) {
    const overlay = document.getElementById('game-state-overlay');
    const winnerText = document.getElementById('winner-text');
    const winnerSubtitle = document.getElementById('winner-subtitle');
    
    winnerText.textContent = `🎉 ${winnerName} Wins! 🎉`;
    winnerSubtitle.textContent = 'Congratulations on your victory!';
    
    overlay.classList.add('visible');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        overlay.classList.remove('visible');
    }, 5000);
}

function hideGameOverlay() {
    const overlay = document.getElementById('game-state-overlay');
    overlay.classList.remove('visible');
}

// --- Enhanced Button Interactions ---
document.addEventListener('DOMContentLoaded', () => {
    // Add interactive effects to all buttons
    document.querySelectorAll('.setup-btn, .game-button').forEach(button => {
        if (!button.classList.contains('interactive-element')) {
            button.classList.add('interactive-element');
        }
    });

    // Add sound effects (visual feedback)
    document.addEventListener('click', (e) => {
        if (e.target.matches('.setup-btn, .game-button, .color-swatch')) {
            // Create ripple effect
            const ripple = document.createElement('div');
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255,255,255,0.5);
                pointer-events: none;
                transform: scale(0);
                animation: ripple 0.6s ease-out;
                width: 40px;
                height: 40px;
                left: ${e.offsetX - 20}px;
                top: ${e.offsetY - 20}px;
            `;
            
            if (e.target.style.position !== 'relative') {
                e.target.style.position = 'relative';
            }
            
            e.target.appendChild(ripple);
            
            setTimeout(() => {
                if (e.target.contains(ripple)) {
                    e.target.removeChild(ripple);
                }
            }, 600);
        }
    });
});

// --- Main Application Setup ---
document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.getElementById('setup-screen');
    const playerCountSelection = document.getElementById('player-count-selection');
    const colorSelectionContainer = document.getElementById('color-selection-container');
    const colorSwatches = document.getElementById('color-swatches');
    const aiDifficultySelection = document.getElementById('ai-difficulty-selection');
    const startGameBtn = document.getElementById('start-game-btn');
    const backToPlayersBtn = document.getElementById('back-to-players-btn');
    const gameScreen = document.getElementById('game-screen');
    const restartBtn = document.getElementById('restart-btn');
    const svgBoard = document.getElementById('game-board');
    
    let game = null;
    let selectedPlayerCount = 0;
    let selectedColorIndices = [];
    let playerNames = [];
    let playerTypes = []; // Array to store 'human' or 'ai' for each player
    let playerDifficulties = []; // Array to store difficulty for each AI player
    let currentSetupPlayer = 0;

    const showColorSelection = (numPlayers) => {
        selectedPlayerCount = numPlayers;
        colorSwatches.innerHTML = '';
        selectedColorIndices = new Array(numPlayers).fill(-1);
        playerNames = new Array(numPlayers).fill("");
        playerTypes = new Array(numPlayers).fill('human'); // Default to human
        playerDifficulties = new Array(numPlayers).fill('medium'); // Default difficulty
        currentSetupPlayer = 0;
        
        startGameBtn.style.display = 'none';
        let nextBtn = document.getElementById('next-player-btn');
        if (!nextBtn) {
            nextBtn = document.createElement('button');
            nextBtn.id = 'next-player-btn';
            nextBtn.className = 'setup-btn';
            nextBtn.textContent = 'Next';
            nextBtn.style.marginLeft = '1rem';
            colorSelectionContainer.querySelector('#color-selection-controls').appendChild(nextBtn);
        }
        nextBtn.style.display = 'inline-block';
        nextBtn.disabled = true;

        // Remove any previous name inputs
        const oldInputs = document.getElementById('player-name-inputs');
        if (oldInputs) oldInputs.remove();
        
        // Setup player type selection handlers
        setupPlayerTypeSelection();
        
        // Setup AI difficulty selection handlers  
        setupAIDifficultySelection();
        
        // Add player name input
        updatePlayerSetup();
        
        playerCountSelection.style.display = 'none';
        colorSelectionContainer.style.display = 'block';

        // Next button event
        nextBtn.onclick = () => {
            if (currentSetupPlayer < selectedPlayerCount - 1) {
                currentSetupPlayer++;
                selectedColorIndices[currentSetupPlayer] = -1;
                updatePlayerSetup();
                
                // Show start game button only on the last player
                if (currentSetupPlayer === selectedPlayerCount - 1) {
                    nextBtn.style.display = 'none';
                    startGameBtn.style.display = 'inline-block';
                    startGameBtn.disabled = true;
                }
            }
        };
    };

    function setupPlayerTypeSelection() {
        const playerTypeButtons = document.querySelectorAll('.player-type-btn');
        playerTypeButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove selected class from all buttons
                playerTypeButtons.forEach(btn => btn.classList.remove('selected'));
                // Add selected class to clicked button
                button.classList.add('selected');
                
                const selectedType = button.dataset.type;
                playerTypes[currentSetupPlayer] = selectedType;
                
                // Show/hide AI difficulty based on selection
                const aiDifficultySelection = document.getElementById('ai-difficulty-selection');
                if (selectedType === 'ai') {
                    aiDifficultySelection.style.display = 'block';
                } else {
                    aiDifficultySelection.style.display = 'none';
                }
                
                // Update player name suggestion based on type
                updatePlayerNameSuggestion();
                validateSetup();
            });
        });
    }

    function setupAIDifficultySelection() {
        const difficultyButtons = document.querySelectorAll('.difficulty-btn');
        difficultyButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove selected class from all difficulty buttons
                difficultyButtons.forEach(btn => btn.classList.remove('selected'));
                // Add selected class to clicked button
                button.classList.add('selected');
                
                const difficulty = button.dataset.difficulty;
                playerDifficulties[currentSetupPlayer] = difficulty;
                showNotification(`AI difficulty set to ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`, 'info', 1500);
                validateSetup();
            });
        });
    }

    function updatePlayerSetup() {
        // Update player title
        const playerTitle = document.getElementById('current-player-title');
        playerTitle.textContent = `Player ${currentSetupPlayer + 1} Setup`;
        
        // Reset player type selection to human
        const playerTypeButtons = document.querySelectorAll('.player-type-btn');
        playerTypeButtons.forEach(btn => btn.classList.remove('selected'));
        document.querySelector('.player-type-btn[data-type="human"]').classList.add('selected');
        playerTypes[currentSetupPlayer] = 'human';
        
        // Hide AI difficulty selection initially
        document.getElementById('ai-difficulty-selection').style.display = 'none';
        
        // Reset difficulty selection to medium
        const difficultyButtons = document.querySelectorAll('.difficulty-btn');
        difficultyButtons.forEach(btn => btn.classList.remove('selected'));
        document.querySelector('.difficulty-btn[data-difficulty="medium"]').classList.add('selected');
        playerDifficulties[currentSetupPlayer] = 'medium';
        
        // Add/update player name input
        updatePlayerNameInput();
        
        // Clear and re-render color swatches
        colorSwatches.innerHTML = '';
        renderColorSwatches();
        
        validateSetup();
    }

    function updatePlayerNameInput() {
        // Remove any existing name input
        const oldInputs = document.getElementById('player-name-inputs');
        if (oldInputs) oldInputs.remove();
        
        // Create new name input
        const playerNameInputs = document.createElement('div');
        playerNameInputs.id = 'player-name-inputs';
        
        const defaultName = `Player ${currentSetupPlayer + 1}`;
        playerNameInputs.innerHTML = `
            <label>Player Name: <input type="text" id="player-name-input" placeholder="${defaultName}" value=""></label>
        `;
        
        // Insert before color swatches
        colorSelectionContainer.insertBefore(playerNameInputs, colorSwatches);
        
        // Add event listener for name input
        document.getElementById('player-name-input').addEventListener('input', (e) => {
            playerNames[currentSetupPlayer] = e.target.value;
            validateSetup();
        });
    }

    function updatePlayerNameSuggestion() {
        const nameInput = document.getElementById('player-name-input');
        const playerType = playerTypes[currentSetupPlayer];
        
        if (playerType === 'ai') {
            const defaultAIName = `AI Player ${currentSetupPlayer + 1}`;
            nameInput.placeholder = defaultAIName;
            // Only pre-fill if current value is empty
            if (!nameInput.value.trim()) {
                nameInput.value = defaultAIName;
                playerNames[currentSetupPlayer] = defaultAIName;
            }
        } else {
            const defaultHumanName = `Player ${currentSetupPlayer + 1}`;
            nameInput.placeholder = defaultHumanName;
            // Clear AI name if switching from AI to human
            if (nameInput.value.includes('AI Player')) {
                nameInput.value = '';
                playerNames[currentSetupPlayer] = '';
            }
        }
    }

    function renderColorSwatches() {
        const tempGame = new ChineseCheckersGame(svgBoard, 2, ['human', 'human'], ['medium', 'medium']); 
        const PLAYER_NAMES = tempGame.PLAYER_NAMES;
        const PLAYER_COLORS = tempGame.PLAYER_COLORS;
        for (let playerIndex = 0; playerIndex < 6; playerIndex++) {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.dataset.playerIndex = playerIndex;
            swatch.style.backgroundColor = PLAYER_COLORS[playerIndex];
            swatch.title = PLAYER_NAMES[playerIndex];
            if (playerIndex === 1) swatch.style.border = '2px solid #616161';
            if (playerIndex === 4) swatch.style.border = '2px solid #f5f5f5';
            // Disable swatch if already chosen by other player
            if (selectedColorIndices.includes(playerIndex)) {
                swatch.style.opacity = '0.5';
                swatch.style.pointerEvents = 'none';
            }
            swatch.addEventListener('click', () => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                selectedColorIndices[currentSetupPlayer] = playerIndex;
                validateSetup();
            });
            colorSwatches.appendChild(swatch);
        }
    }

    function validateSetup() {
        let nextBtn = document.getElementById('next-player-btn');
        if (currentSetupPlayer < selectedPlayerCount - 1) {
            nextBtn.disabled = !(playerNames[currentSetupPlayer].trim() && selectedColorIndices[currentSetupPlayer] !== -1);
        } else {
            startGameBtn.disabled = !(playerNames[currentSetupPlayer].trim() && selectedColorIndices[currentSetupPlayer] !== -1);
        }
    }

    document.querySelectorAll('#player-selection .setup-btn').forEach(button => {
        button.addEventListener('click', () => {
            const numPlayers = parseInt(button.dataset.players, 10);
            showNotification(`🎲 Setting up ${numPlayers} player game...`, 'info', 1500);
            showColorSelection(numPlayers);
        });
    });

    backToPlayersBtn.addEventListener('click', () => {
        colorSelectionContainer.style.display = 'none';
        playerCountSelection.style.display = 'block';
    });
    
    startGameBtn.addEventListener('click', () => {
        // Check that all players have selected colors and names
        for (let i = 0; i < selectedPlayerCount; i++) {
            if (selectedColorIndices[i] === -1 || !playerNames[i].trim()) {
                showNotification('❌ Please complete setup for all players', 'warning', 2000);
                return;
            }
        }
        
        showNotification('🎮 Starting new game...', 'info', 2000);
        setupScreen.style.display = 'none';
        gameScreen.style.display = 'flex';
        
        // Create game with new per-player AI system
        game = new ChineseCheckersGame(svgBoard, selectedPlayerCount, playerTypes.slice(), playerDifficulties.slice());
        game.playerNames = playerNames.slice(); // Save names for later use
        game.playerColors = selectedColorIndices.slice(); // Save colors for later use
        game.init();
        hideGameOverlay();
    });

    restartBtn.addEventListener('click', () => {
        showNotification('🔄 Restarting game...', 'info', 1500);
        gameScreen.style.display = 'none';
        colorSelectionContainer.style.display = 'none';
        playerCountSelection.style.display = 'block';
        setupScreen.style.display = 'block';
        game = null;
        svgBoard.innerHTML = '';
        hideGameOverlay();
    });

    document.getElementById('toggle-valid-moves').addEventListener('change', function() {
        if (game) {
            game.showValidMoves = this.checked;
            game.render();
            const message = this.checked ? 'Valid moves shown ✅' : 'Valid moves hidden 👁️';
            showNotification(message, 'info', 1500);
        }
    });
});
