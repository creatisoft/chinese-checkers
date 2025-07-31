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
                
                // Distance to destination improvement
                const currentDist = this.getMinDistanceToDestination(piece, destination);
                const newDist = this.getMinDistanceToDestination(move, destination);
                score += (currentDist - newDist) * 10;
                
                // Bonus for jump moves
                if (this.isJumpMove(piece, move)) {
                    score += 5;
                }
                
                // Bonus for reaching destination
                if (this.isInDestination(move, destination)) {
                    score += 15;
                }
                
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
        const nonDestinationPieces = pieces.filter(p => !this.isInDestination(p, destination));
        
        // Prioritize pieces not in destination
        const piecesToEvaluate = nonDestinationPieces.length > 0 ? nonDestinationPieces : pieces;
        
        for (const piece of piecesToEvaluate) {
            const moves = this.getValidMovesForPiece(piece);
            
            for (const move of moves) {
                let score = 0;
                
                // Distance improvement (heavily weighted)
                const currentDist = this.getMinDistanceToDestination(piece, destination);
                const newDist = this.getMinDistanceToDestination(move, destination);
                score += (currentDist - newDist) * 15;
                
                // Jump chain potential
                if (this.isJumpMove(piece, move)) {
                    score += 8;
                    // Check for additional jump potential
                    const continuingJumps = this.getValidMovesForPiece(move).filter(m => this.isJumpMove(move, m));
                    score += continuingJumps.length * 3;
                }
                
                // Reaching destination bonus
                if (this.isInDestination(move, destination)) {
                    score += 20;
                }
                
                // Avoid getting stuck in corners (penalty for moving away from center)
                const centerDistance = Math.abs(move.q) + Math.abs(move.r) + Math.abs(move.q + move.r);
                if (centerDistance > 6) score -= 2;
                
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
    async executeMoveSequence(move) {
        // First, select the piece
        this.game.selectPiece(move.from.q, move.from.r);
        await this.sleep(300);
        
        // Then make the move
        this.game.movePiece(move.from, move.to);
        await this.sleep(300);
        
        // If it was a jump and AI can continue jumping, decide whether to continue
        if (this.game.turnState === 'jumping' && this.shouldContinueJumping(move.to)) {
            const nextMove = this.findBestContinuationJump(move.to);
            if (nextMove) {
                await this.sleep(500); // Brief pause before continuing
                await this.executeMoveSequence({ from: move.to, to: nextMove });
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
     * Decide if AI should continue jumping
     */
    shouldContinueJumping(position) {
        const jumps = this.getValidMovesForPiece(position).filter(move => 
            this.isJumpMove(position, move)
        );
        
        if (jumps.length === 0) return false;
        
        // Difficulty-based decision making
        switch (this.difficulty) {
            case 'easy': return Math.random() < 0.4; // 40% chance to continue
            case 'medium': return Math.random() < 0.7; // 70% chance to continue
            case 'hard': return jumps.length > 0; // Always continue if possible
            default: return Math.random() < 0.6;
        }
    }

    /**
     * Find best continuation jump from current position
     */
    findBestContinuationJump(position) {
        const currentPlayer = this.game.activePlayers[this.game.currentPlayerIndex];
        const destination = this.game.playerDestinations[currentPlayer];
        const jumps = this.getValidMovesForPiece(position).filter(move => 
            this.isJumpMove(position, move)
        );
        
        if (jumps.length === 0) return null;
        
        // Find the jump that makes most progress toward destination
        let bestJump = null;
        let bestScore = -Infinity;
        
        for (const jump of jumps) {
            const currentDist = this.getMinDistanceToDestination(position, destination);
            const newDist = this.getMinDistanceToDestination(jump, destination);
            const score = currentDist - newDist;
            
            if (score > bestScore) {
                bestScore = score;
                bestJump = jump;
            }
        }
        
        return bestJump;
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
            const currentDist = this.getMinDistanceToDestination(piece, destination);
            const newDist = this.getMinDistanceToDestination(move, destination);
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
     * Calculate minimum distance to any point in destination
     */
    getMinDistanceToDestination(position, destination) {
        let minDist = Infinity;
        for (const dest of destination) {
            const dist = this.hexDistance(position, dest);
            minDist = Math.min(minDist, dist);
        }
        return minDist;
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
        
        showNotification(`${currentPlayerName} (AI) is thinking...`, 'info', this.thinkingTimes[this.difficulty]);
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
