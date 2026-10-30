/**
 * AI Player for Chinese Checkers
 * Implements three difficulty levels: Easy, Medium, Hard
 */
class ChineseCheckersAI {
    constructor(game, difficulty = 'medium') {
        this.game = game;
        this.difficulty = difficulty;
        this.isThinking = false;
        
        // Thinking times for different difficulties (in milliseconds)
        this.thinkingTimes = {
            'easy': 800,
            'medium': 1200,
            'hard': 1800
        };
    }

    /**
     * Main method to execute an AI turn
     * @returns {Promise} Resolves when the AI turn is complete
     */
    async executeAITurn() {
        if (this.isThinking) return;
        
        this.isThinking = true;
        
        // Show thinking indicator
        this.showThinkingStatus();
        
        // Wait for thinking time
        await this.sleep(this.thinkingTimes[this.difficulty]);
        
        // Find and execute the best move
        const move = this.findBestMove();
        
        if (move) {
            await this.executeMoveSequence(move);
        } else {
            console.log('AI: No valid moves found, ending turn');
            this.game.endTurn();
        }
        
        this.isThinking = false;
    }

    /**
     * Find the best move based on difficulty level
     * @returns {Object|null} Move object with from/to coordinates
     */
    findBestMove() {
        const currentPlayer = this.game.activePlayers[this.game.currentPlayerIndex];
        const playerPieces = this.getPlayerPieces(currentPlayer);
        
        if (playerPieces.length === 0) return null;

        switch (this.difficulty) {
            case 'easy':
                return this.findEasyMove(playerPieces, currentPlayer);
            case 'medium':
                return this.findMediumMove(playerPieces, currentPlayer);
            case 'hard':
                return this.findHardMove(playerPieces, currentPlayer);
            default:
                return this.findMediumMove(playerPieces, currentPlayer);
        }
    }

    /**
     * Easy AI: Random moves with slight preference for forward progress
     */
    findEasyMove(pieces, playerIndex) {
        const shuffledPieces = this.shuffleArray([...pieces]);
        
        for (const piece of shuffledPieces) {
            const moves = this.getValidMovesForPiece(piece);
            if (moves.length === 0) continue;
            
            // 60% chance to prefer forward moves, 40% completely random
            if (Math.random() < 0.6) {
                const forwardMoves = this.filterForwardMoves(moves, piece, playerIndex);
                if (forwardMoves.length > 0) {
                    return {
                        from: piece,
                        to: forwardMoves[Math.floor(Math.random() * forwardMoves.length)]
                    };
                }
            }
            
            // Random move
            return {
                from: piece,
                to: moves[Math.floor(Math.random() * moves.length)]
            };
        }
        
        return null;
    }

    /**
     * Medium AI: Strategic moves toward destination with some lookahead
     */
    findMediumMove(pieces, playerIndex) {
        let bestMove = null;
        let bestScore = -Infinity;
        
        const destination = this.game.playerDestinations[playerIndex];
        
        for (const piece of pieces) {
            const moves = this.getValidMovesForPiece(piece);
            
            for (const move of moves) {
                let score = 0;
                
                // Progress toward the destination's far tip
                const currentDist = this.getDistanceToGoal(piece, destination);
                const newDist = this.getDistanceToGoal(move, destination);
                score += (currentDist - newDist) * 10;

                score += this.openHoleScore(piece, move, destination, 10);

                // Bonus for jump moves that progress, plus the chain they open up
                if (this.isJumpMove(piece, move)) {
                    const chain = this.chainGain(move, destination, this.chainVisited(piece, move));
                    if (currentDist - newDist + chain > 0) score += 5;
                    score += chain * 10;
                }

                score += this.destinationEntryScore(piece, move, destination, 15);
                
                // Small random factor
                score += Math.random() * 2;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { from: piece, to: move };
                }
            }
        }
        
        return bestMove;
    }

    /**
     * Hard AI: Advanced strategy with multiple factors
     */
    findHardMove(pieces, playerIndex) {
        let bestMove = null;
        let bestScore = -Infinity;
        
        const destination = this.game.playerDestinations[playerIndex];

        // All pieces are considered, including ones already in the destination:
        // moving those deeper is what makes room for the last pieces to get in.
        for (const piece of pieces) {
            const moves = this.getValidMovesForPiece(piece);

            for (const move of moves) {
                let score = 0;

                // Progress toward the destination's far tip (heavily weighted)
                const currentDist = this.getDistanceToGoal(piece, destination);
                const newDist = this.getDistanceToGoal(move, destination);
                score += (currentDist - newDist) * 15;
                
                score += this.openHoleScore(piece, move, destination, 15);

                // Jump chain potential
                if (this.isJumpMove(piece, move)) {
                    // Chains are played a hop at a time, so count where this hop can lead
                    const chain = this.chainGain(move, destination, this.chainVisited(piece, move));
                    if (currentDist - newDist + chain > 0) score += 8;
                    score += chain * 15;
                }
                
                score += this.destinationEntryScore(piece, move, destination, 20);

                // Avoid getting stuck in other players' corners (penalty for moving away from center)
                const centerDistance = Math.abs(move.q) + Math.abs(move.r) + Math.abs(move.q + move.r);
                if (centerDistance > 6 && !this.isInDestination(move, destination)) score -= 2;
                
                // Small random factor for variety
                score += Math.random() * 1;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { from: piece, to: move };
                }
            }
        }
        
        return bestMove;
    }

    /**
     * Execute a move sequence (including potential multiple jumps)
     */
    async executeMoveSequence(move, jumpCount = 0) {
        // Prevent infinite loops by limiting jump chains
        const MAX_JUMPS = 10;
        if (jumpCount >= MAX_JUMPS) {
            console.log('AI: Maximum jump chain reached, ending turn');
            this.game.endTurn();
            return;
        }
        
        const seat = this.game.currentPlayerIndex;

        // First, select the piece
        this.game.selectPiece(move.from.q, move.from.r);
        await this.sleep(300);

        // Then make the move
        this.game.movePiece(move.from, move.to);
        await this.sleep(300);

        // A single step ends the turn inside movePiece(). Stop here so we never act
        // on the next player's turn (they may already be jumping).
        if (this.game.currentPlayerIndex !== seat || this.game.gameOver) return;

        // If it was a jump and AI can continue jumping, decide whether to continue
        if (this.game.turnState === 'jumping' && this.shouldContinueJumping(move.to)) {
            const nextMove = this.findBestContinuationJump(move.to);
            if (nextMove) {
                await this.sleep(500); // Brief pause before continuing
                await this.executeMoveSequence({ from: move.to, to: nextMove }, jumpCount + 1);
                return;
            }
        }
        
        // End the turn
        if (this.game.turnState === 'jumping' || this.game.turnState === 'moved') {
            await this.sleep(800);
            this.game.endTurn();
        }
    }

    /**
     * Decide if AI should continue jumping. It only ever continues along a chain
     * that gets it closer to the goal, never just because a jump is available.
     */
    shouldContinueJumping(position) {
        if (this.getProgressingJumps(position).length === 0) return false;

        switch (this.difficulty) {
            case 'easy': return Math.random() < 0.4; // 40% chance to continue
            case 'medium': return Math.random() < 0.7; // 70% chance to continue
            case 'hard': return true;
            default: return Math.random() < 0.6;
        }
    }

    /**
     * Find best continuation jump from current position
     */
    findBestContinuationJump(position) {
        let bestJump = null;
        let bestScore = -Infinity;

        for (const { jump, gain } of this.getProgressingJumps(position)) {
            if (gain > bestScore) {
                bestScore = gain;
                bestJump = jump;
            }
        }

        return bestJump;
    }

    /**
     * Jumps available from the current position whose chain ends closer to the goal
     */
    getProgressingJumps(position) {
        const currentPlayer = this.game.activePlayers[this.game.currentPlayerIndex];
        const destination = this.game.playerDestinations[currentPlayer];
        const currentDist = this.getDistanceToGoal(position, destination);

        return this.getValidMovesForPiece(position)
            .filter(jump => this.isJumpMove(position, jump))
            .map(jump => {
                const hopGain = currentDist - this.getDistanceToGoal(jump, destination);
                const visited = this.chainVisited(position, jump);
                return { jump, gain: hopGain + this.chainGain(jump, destination, visited) };
            })
            .filter(({ gain }) => gain > 0);
    }

    /**
     * Holes a chain may not land on after hopping from one hole to the next
     */
    chainVisited(from, to) {
        const coords = [from, to].map(c => this.game.coordToString(c));
        return new Set([...this.game.turnVisited, ...coords]);
    }

    /**
     * Most progress toward the goal available by continuing to hop from a position.
     * Holes stay in `visited` once tried, which keeps the search small on crowded boards.
     */
    chainGain(position, destination, visited) {
        let best = 0;
        for (const landing of this.game.getJumpTargets(position.q, position.r, visited)) {
            visited.add(this.game.coordToString(landing));
            const hopGain = this.getDistanceToGoal(position, destination) - this.getDistanceToGoal(landing, destination);
            best = Math.max(best, hopGain + this.chainGain(landing, destination, visited));
        }
        return best;
    }

    /**
     * Get all valid moves for a specific piece
     */
    getValidMovesForPiece(piece) {
        this.game.calculateValidMoves(piece.q, piece.r);
        return [...this.game.validMoves];
    }

    /**
     * Get all pieces belonging to a player
     */
    getPlayerPieces(playerIndex) {
        const pieces = [];
        this.game.board.forEach((piece, coordStr) => {
            if (piece.player === playerIndex) {
                pieces.push(this.game.stringToCoord(coordStr));
            }
        });
        return pieces;
    }

    /**
     * Filter moves that make forward progress
     */
    filterForwardMoves(moves, piece, playerIndex) {
        const destination = this.game.playerDestinations[playerIndex];
        return moves.filter(move => {
            const currentDist = this.getDistanceToGoal(piece, destination);
            const newDist = this.getDistanceToGoal(move, destination);
            return newDist < currentDist;
        });
    }

    /**
     * Check if a move is a jump (distance > 1)
     */
    isJumpMove(from, to) {
        const dx = Math.abs(to.q - from.q);
        const dy = Math.abs(to.r - from.r);
        const dz = Math.abs((to.q + to.r) - (from.q + from.r));
        return Math.max(dx, dy, dz) > 1;
    }

    /**
     * Check if a position is in the destination zone
     */
    isInDestination(position, destination) {
        return destination.some(dest => 
            dest.q === position.q && dest.r === position.r
        );
    }

    /**
     * Distance to the destination's far tip (the hole farthest from the board center).
     * Measuring to the nearest destination hole instead made every hole in the
     * triangle count the same, so pieces stopped at its edge and the back never filled.
     */
    getDistanceToGoal(position, destination) {
        if (!this._goalTips) this._goalTips = new Map();
        let tip = this._goalTips.get(destination);
        if (!tip) {
            const fromCenter = c => this.hexDistance(c, { q: 0, r: 0 });
            tip = destination.reduce((far, c) => (fromCenter(c) > fromCenter(far) ? c : far));
            this._goalTips.set(destination, tip);
        }
        return this.hexDistance(position, tip);
    }

    /**
     * Bonus for entering the destination, penalty for leaving it.
     * Moves that stay inside the triangle score only on progress.
     */
    destinationEntryScore(from, to, destination, bonus) {
        const wasIn = this.isInDestination(from, destination);
        const isIn = this.isInDestination(to, destination);
        if (!wasIn && isIn) return bonus;
        if (wasIn && !isIn) return -bonus * 2;
        return 0;
    }

    /**
     * Reward a piece outside the destination for closing on a hole it can still fill.
     * Sliding along the row in front of the triangle gains nothing toward the far tip,
     * so without this the last piece could sit next to the triangle and never go in.
     */
    openHoleScore(from, to, destination, weight) {
        if (this.isInDestination(from, destination)) return 0;
        const openHoles = destination.filter(hole => !this.game.board.has(this.game.coordToString(hole)));
        if (openHoles.length === 0) return 0;
        const nearest = position => Math.min(...openHoles.map(hole => this.hexDistance(position, hole)));
        return (nearest(from) - nearest(to)) * weight;
    }

    /**
     * Calculate hex grid distance
     */
    hexDistance(a, b) {
        return Math.max(
            Math.abs(a.q - b.q),
            Math.abs(a.r - b.r),
            Math.abs((a.q + a.r) - (b.q + b.r))
        );
    }

    /**
     * Shuffle array using Fisher-Yates algorithm
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Show thinking status in UI
     */
    showThinkingStatus() {
        const currentPlayerName = this.game.playerNames && this.game.playerNames[this.game.currentPlayerIndex] 
            ? this.game.playerNames[this.game.currentPlayerIndex] 
            : this.game.PLAYER_NAMES[this.game.currentPlayerIndex];
        
        if (this.game.statusTextEl) {
            this.game.statusTextEl.textContent = `${currentPlayerName} is thinking...`;
        }
        
        // Use globally available showNotification function
        if (window.showNotification) {
            window.showNotification(`${currentPlayerName} (AI) is thinking...`, 'info', this.thinkingTimes[this.difficulty]);
        }
    }

    /**
     * Simple sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Make AI available globally
window.ChineseCheckersAI = ChineseCheckersAI;
