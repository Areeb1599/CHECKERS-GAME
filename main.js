 // Game state
 const gameState = {
    board: [],
    currentPlayer: 'white', // 'white' or 'black'
    selectedPiece: null,
    legalMoves: [],
    mustJump: false,
    jumpPossibilities: [],
    pieceCount: { white: 12, black: 12 },
    gameMode: 'local', // 'local', 'ai', or 'multiplayer'
    aiDifficulty: 'medium', // 'easy', 'medium', or 'hard'
    aiPlayer: 'black', // AI is typically black
    aiThinking: false,
    roomId: null,
    isHost: false,
    playerColor: 'white',
    opponentConnected: false,
    connection: null,
    consecutiveJumps: {
        active: false,
        piece: null
    }
};

// Game mode buttons
document.getElementById('local-btn').addEventListener('click', () => {
    setGameMode('local');
});

document.getElementById('ai-btn').addEventListener('click', () => {
    document.getElementById('difficulty-selector').classList.add('visible');
});

document.getElementById('multiplayer-btn').addEventListener('click', () => {
    document.getElementById('multiplayer-controls').classList.add('visible');
});

// AI difficulty buttons
document.getElementById('easy-btn').addEventListener('click', () => {
    gameState.aiDifficulty = 'easy';
    setGameMode('ai');
});

document.getElementById('medium-btn').addEventListener('click', () => {
    gameState.aiDifficulty = 'medium';
    setGameMode('ai');
});

document.getElementById('hard-btn').addEventListener('click', () => {
    gameState.aiDifficulty = 'hard';
    setGameMode('ai');
});

// Multiplayer buttons
document.getElementById('create-room-btn').addEventListener('click', () => {
    document.getElementById('room-details').style.display = 'block';
    document.getElementById('join-form').style.display = 'none';
    
    // Generate random room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    document.getElementById('room-code').textContent = roomCode;
    
    gameState.roomId = roomCode;
    gameState.isHost = true;
    gameState.playerColor = 'white';
    
    // In a real implementation, this is where you'd set up the WebRTC connection
    setupMultiplayerConnection();
});

document.getElementById('join-room-btn').addEventListener('click', () => {
    document.getElementById('join-form').style.display = 'block';
    document.getElementById('room-details').style.display = 'none';
});

document.getElementById('connect-btn').addEventListener('click', () => {
    const roomCode = document.getElementById('join-code').value.trim().toUpperCase();
    
    if (roomCode.length < 4) {
        document.getElementById('join-status').textContent = 'Please enter a valid room code';
        return;
    }
    
    gameState.roomId = roomCode;
    gameState.isHost = false;
    gameState.playerColor = 'black';
    
    document.getElementById('join-status').textContent = 'Connecting...';
    
    // In a real implementation, this is where you'd connect to the host
    setupMultiplayerConnection();
});

document.getElementById('copy-code-btn').addEventListener('click', () => {
    const roomCode = document.getElementById('room-code').textContent;
    navigator.clipboard.writeText(roomCode).then(() => {
        const copyBtn = document.getElementById('copy-code-btn');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Copy';
        }, 2000);
    });
});

// Reset button
document.getElementById('reset-btn').addEventListener('click', () => {
    // If in multiplayer, notify the other player
    if (gameState.gameMode === 'multiplayer' && gameState.opponentConnected) {
        sendResetRequest();
    }
    
    initializeBoard();
});

// Back button
document.getElementById('back-btn').addEventListener('click', () => {
    // Reset game mode selection
    document.querySelector('.mode-selector').style.display = 'block';
    document.getElementById('difficulty-selector').classList.remove('visible');
    document.getElementById('multiplayer-controls').classList.remove('visible');
    document.getElementById('room-details').style.display = 'none';
    document.getElementById('join-form').style.display = 'none';
    document.getElementById('back-btn').style.display = 'none';
    
    // If in multiplayer mode, disconnect
    if (gameState.gameMode === 'multiplayer' && gameState.connection) {
        // In a real implementation, close the connection
        gameState.connection = null;
        gameState.opponentConnected = false;
    }
    
    gameState.gameMode = 'local';
    
    // Reset and start a new local game
    initializeBoard();
});

// Set game mode and start
function setGameMode(mode) {
    gameState.gameMode = mode;
    
    // Hide mode selector
    document.querySelector('.mode-selector').style.display = 'none';
    document.getElementById('back-btn').style.display = 'inline-block';
    
    initializeBoard();
}

// Initialize the board
function initializeBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    gameState.board = [];
    gameState.pieceCount = { white: 12, black: 12 };
    gameState.selectedPiece = null;
    gameState.legalMoves = [];
    gameState.mustJump = false;
    gameState.jumpPossibilities = [];
    gameState.consecutiveJumps.active = false;
    gameState.consecutiveJumps.piece = null;
    
    // Create the 8x8 board
    for (let row = 0; row < 8; row++) {
        gameState.board[row] = [];
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
            square.dataset.row = row;
            square.dataset.col = col;
            
            // Add pieces
            if ((row + col) % 2 === 1) {
                if (row < 3) {
                    // Black pieces at the top
                    const piece = createPiece('black-piece', row, col);
                    square.appendChild(piece);
                    gameState.board[row][col] = { player: 'black', isKing: false };
                } else if (row > 4) {
                    // White pieces at the bottom
                    const piece = createPiece('white-piece', row, col);
                    square.appendChild(piece);
                    gameState.board[row][col] = { player: 'white', isKing: false };
                } else {
                    // Empty square
                    gameState.board[row][col] = null;
                }
            } else {
                // White squares are always empty
                gameState.board[row][col] = null;
            }
            
            square.addEventListener('click', handleSquareClick);
            board.appendChild(square);
        }
    }
    
    // Set the initial player turn
    gameState.currentPlayer = 'white';
    updateTurnIndicator();
    
    // Check for mandatory jumps
    checkForMandatoryJumps();
    
    // Add animation to pieces
    const pieces = document.querySelectorAll('.piece');
    pieces.forEach((piece, index) => {
        setTimeout(() => {
            piece.classList.add('fade-in');
        }, index * 30);
    });
    
    // If AI mode and AI goes first (though typically white goes first)
    if (gameState.gameMode === 'ai' && gameState.currentPlayer === gameState.aiPlayer) {
        setTimeout(makeAIMove, 1000);
    }
}

// Create a piece element
function createPiece(pieceClass, row, col) {
    const piece = document.createElement('div');
    piece.className = `piece ${pieceClass}`;
    piece.dataset.row = row;
    piece.dataset.col = col;
    
    piece.addEventListener('click', handlePieceClick);
    return piece;
}

// Update turn indicator
function updateTurnIndicator() {
    const turnText = document.getElementById('current-turn');
    const turnDot = document.getElementById('turn-dot');
    const thinkingIndicator = document.getElementById('thinking-indicator');
    
    let turnLabel = gameState.currentPlayer.charAt(0).toUpperCase() + gameState.currentPlayer.slice(1);
    
    // Add AI indicator if it's AI's turn
    if (gameState.gameMode === 'ai' && gameState.currentPlayer === gameState.aiPlayer) {
        turnLabel += ' (AI)';
        if (gameState.aiThinking) {
            thinkingIndicator.classList.add('visible');
        } else {
            thinkingIndicator.classList.remove('visible');
        }
    } else {
        thinkingIndicator.classList.remove('visible');
    }
    
    // Add player indicator in multiplayer
    if (gameState.gameMode === 'multiplayer') {
        if (gameState.currentPlayer === gameState.playerColor) {
            turnLabel += ' (You)';
        } else {
            turnLabel += ' (Opponent)';
        }
    }
    
    turnText.textContent = turnLabel;
    
    if (gameState.currentPlayer === 'white') {
        turnDot.className = 'turn-dot white-turn';
    } else {
        turnDot.className = 'turn-dot black-turn';
    }
}

// Handle piece click event
function handlePieceClick(event) {
    event.stopPropagation();
    
    // In multiplayer, only allow clicking your own color
    if (gameState.gameMode === 'multiplayer' && 
        gameState.currentPlayer !== gameState.playerColor) {
        return;
    }
    
    // In AI mode, don't allow clicking AI's pieces
    if (gameState.gameMode === 'ai' && 
        gameState.currentPlayer === gameState.aiPlayer) {
        return;
    }
    
    const row = parseInt(event.target.dataset.row);
    const col = parseInt(event.target.dataset.col);
    
    // If consecutive jumps are active, only allow selecting the same piece
    if (gameState.consecutiveJumps.active) {
        if (row !== gameState.consecutiveJumps.piece.row || 
            col !== gameState.consecutiveJumps.piece.col) {
            // Shake animation for wrong piece selection
            event.target.classList.add('shake');
            setTimeout(() => {
                event.target.classList.remove('shake');
            }, 500);
            return;
        }
    }
    
    // Make sure the player clicks their own pieces
    if (!gameState.board[row][col] || gameState.board[row][col].player !== gameState.currentPlayer) {
        // Shake animation for wrong piece selection
        event.target.classList.add('shake');
        setTimeout(() => {
            event.target.classList.remove('shake');
        }, 500);
        return;
    }
    
    // If there's a mandatory jump, only allow selecting pieces that can jump
    if (gameState.mustJump && !gameState.consecutiveJumps.active) {
        const canJump = gameState.jumpPossibilities.some(
            pos => pos.row === row && pos.col === col
        );
        
        if (!canJump) {
            // Shake animation for invalid selection
            event.target.classList.add('shake');
            setTimeout(() => {
                event.target.classList.remove('shake');
            }, 500);
            return;
        }
    }
    
    // Clear previous selection and legal moves
    clearSelection();
    
    // Select the piece with bounce animation
    gameState.selectedPiece = { row, col };
    event.target.classList.add('selected');
    event.target.classList.add('bounce');
    
    // Remove bounce animation after it completes
    setTimeout(() => {
        event.target.classList.remove('bounce');
    }, 500);
    
    // Show legal moves
    showLegalMoves(row, col);
}

// Handle square click event
function handleSquareClick(event) {
    // In multiplayer, only allow moves on your turn
    if (gameState.gameMode === 'multiplayer' && 
        gameState.currentPlayer !== gameState.playerColor) {
        return;
    }
    
    // In AI mode, only allow moves on player's turn
    if (gameState.gameMode === 'ai' && 
        gameState.currentPlayer === gameState.aiPlayer) {
        return;
    }
    
    if (!gameState.selectedPiece) {
        return;
    }
    
    const row = parseInt(event.target.dataset.row);
    const col = parseInt(event.target.dataset.col);
    
    // Check if the clicked square is a legal move
    const isLegalMove = gameState.legalMoves.some(
        move => move.row === row && move.col === col
    );
    
    if (isLegalMove) {
        const move = gameState.legalMoves.find(m => m.row === row && m.col === col);
        
        // In multiplayer mode, send move to opponent
        if (gameState.gameMode === 'multiplayer' && gameState.opponentConnected) {
            sendMoveToOpponent(gameState.selectedPiece.row, gameState.selectedPiece.col, row, col, move.isJump);
        }
        
        movePiece(row, col);
    }
}

// Show legal moves for a selected piece
function showLegalMoves(row, col) {
    gameState.legalMoves = [];
    const piece = gameState.board[row][col];
    
    if (gameState.mustJump) {
        // Only show jump moves
        getJumpMoves(row, col, piece).forEach(move => {
            gameState.legalMoves.push(move);
            highlightLegalMove(move.row, move.col);
        });
    } else {
        // Show all possible moves
        getRegularMoves(row, col, piece).forEach(move => {
            gameState.legalMoves.push(move);
            highlightLegalMove(move.row, move.col);
        });
        
        getJumpMoves(row, col, piece).forEach(move => {
            gameState.legalMoves.push(move);
            highlightLegalMove(move.row, move.col);
        });
    }
}

// Highlight a legal move
function highlightLegalMove(row, col) {
    const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
    const legalMove = document.createElement('div');
    legalMove.className = 'legal-move';
    legalMove.addEventListener('click', function() {
        // In multiplayer, only allow moves on your turn
        if (gameState.gameMode === 'multiplayer' && 
            gameState.currentPlayer !== gameState.playerColor) {
            return;
        }
        
        // In AI mode, only allow moves on player's turn
        if (gameState.gameMode === 'ai' && 
            gameState.currentPlayer === gameState.aiPlayer) {
            return;
        }
        
        const move = gameState.legalMoves.find(m => m.row === row && m.col === col);
        
        // In multiplayer mode, send move to opponent
        if (gameState.gameMode === 'multiplayer' && gameState.opponentConnected) {
            sendMoveToOpponent(gameState.selectedPiece.row, gameState.selectedPiece.col, row, col, move.isJump);
        }
        
        movePiece(row, col);
    });
    square.appendChild(legalMove);
}

// Get regular (non-jump) moves
function getRegularMoves(row, col, piece) {
    const moves = [];
    const direction = piece.player === 'white' ? -1 : 1;
    
    // Forward moves
    const forwardDirections = [
        { row: row + direction, col: col - 1 },
        { row: row + direction, col: col + 1 }
    ];
    
    if (piece.isKing) {
            forwardDirections.push(
                { row: row - direction, col: col - 1 },
                { row: row - direction, col: col + 1 }
            );
        }
    
        // Check each potential move
        forwardDirections.forEach(dir => {
            if (isValidPosition(dir.row, dir.col) && !gameState.board[dir.row][dir.col]) {
                moves.push({ row: dir.row, col: dir.col, isJump: false });
            }
        });
    
        return moves;
    }

    // Get jump moves
    function getJumpMoves(row, col, piece) {
        const moves = [];
        const direction = piece.player === 'white' ? -1 : 1;
        const opponent = piece.player === 'white' ? 'black' : 'white';
    
        // Forward jump directions
        const jumpDirections = [
            { 
                over: { row: row + direction, col: col - 1 },
                land: { row: row + (2 * direction), col: col - 2 }
            },
            { 
                over: { row: row + direction, col: col + 1 },
                land: { row: row + (2 * direction), col: col + 2 }
            }
        ];
    
        // If the piece is a king, add backward jumps
        if (piece.isKing) {
            jumpDirections.push(
                { 
                    over: { row: row - direction, col: col - 1 },
                    land: { row: row - (2 * direction), col: col - 2 }
                },
                { 
                    over: { row: row - direction, col: col + 1 },
                    land: { row: row - (2 * direction), col: col + 2 }
                }
            );
        }
    
        // Check each potential jump
        jumpDirections.forEach(dir => {
            // Check if the position to jump over is valid and has an opponent's piece
            if (isValidPosition(dir.over.row, dir.over.col) && 
                gameState.board[dir.over.row][dir.over.col] && 
                gameState.board[dir.over.row][dir.over.col].player === opponent) {
        
                // Check if the landing position is valid and empty
                if (isValidPosition(dir.land.row, dir.land.col) && 
                    !gameState.board[dir.land.row][dir.land.col]) {
                    moves.push({ 
                        row: dir.land.row, 
                        col: dir.land.col, 
                        isJump: true,
                        jumpedRow: dir.over.row,
                        jumpedCol: dir.over.col
                    });
                }
            }
        });
    
        return moves;
    }

    // Check if a position is on the board
    function isValidPosition(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    // Clear selection and legal moves
    function clearSelection() {
        // Remove selected class from any piece
        const selectedPieces = document.querySelectorAll('.piece.selected');
        selectedPieces.forEach(piece => {
            piece.classList.remove('selected');
        });
    
        // Remove legal move indicators
        const legalMoves = document.querySelectorAll('.legal-move');
        legalMoves.forEach(move => {
            move.remove();
        });
    
        gameState.selectedPiece = null;
        gameState.legalMoves = [];
    }

    // Move a piece
    function movePiece(toRow, toCol) {
        const fromRow = gameState.selectedPiece.row;
        const fromCol = gameState.selectedPiece.col;
        const piece = gameState.board[fromRow][fromCol];
        
        // Find the move object
        const move = gameState.legalMoves.find(m => m.row === toRow && m.col === toCol);
        
        // Move the piece in the game state
        gameState.board[toRow][toCol] = { ...piece };
        gameState.board[fromRow][fromCol] = null;
        
        // Check if the piece should become a king
        if ((piece.player === 'white' && toRow === 0) || 
            (piece.player === 'black' && toRow === 7)) {
            gameState.board[toRow][toCol].isKing = true;
        }
        
        // Move the piece on the board
        const pieceElement = document.querySelector(`.piece[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toSquare = document.querySelector(`.square[data-row="${toRow}"][data-col="${toCol}"]`);
        
        pieceElement.dataset.row = toRow;
        pieceElement.dataset.col = toCol;
        
        // Update king status if needed
        if (gameState.board[toRow][toCol].isKing && !pieceElement.classList.contains('king')) {
            pieceElement.classList.add('king');
            
            // Add crown animation
            pieceElement.classList.add('bounce');
            setTimeout(() => {
                pieceElement.classList.remove('bounce');
            }, 500);
        }
        
        // Move the piece element to the new square
        toSquare.appendChild(pieceElement);
        
        // If it was a jump, remove the jumped piece
        let canJumpAgain = false;
        if (move.isJump) {
            // Remove the jumped piece from the board state
            gameState.board[move.jumpedRow][move.jumpedCol] = null;
            
            // Remove the jumped piece from the DOM with animation
            const jumpedPiece = document.querySelector(`.piece[data-row="${move.jumpedRow}"][data-col="${move.jumpedCol}"]`);
            jumpedPiece.classList.add('capture-animation');
            
            // Decrease piece count
            const jumpedPlayer = piece.player === 'white' ? 'black' : 'white';
            gameState.pieceCount[jumpedPlayer]--;
            
            // After animation completes, remove the piece
            setTimeout(() => {
                jumpedPiece.remove();
            }, 500);
            
            // Check if the piece can jump again
            const additionalJumps = getJumpMoves(toRow, toCol, gameState.board[toRow][toCol]);
            if (additionalJumps.length > 0) {
                canJumpAgain = true;
            }
        }
        
        // Clear current selection
        clearSelection();
        
        // Handle consecutive jumps if possible
        if (canJumpAgain) {
            gameState.consecutiveJumps.active = true;
            gameState.consecutiveJumps.piece = { row: toRow, col: toCol };
            
            // Highlight the piece that can jump again
            const pieceElement = document.querySelector(`.piece[data-row="${toRow}"][data-col="${toCol}"]`);
            pieceElement.classList.add('selected');
            pieceElement.classList.add('bounce');
            
            // Show legal jumps
            showLegalMoves(toRow, toCol);
            
            // Don't switch turns yet
            return;
        }
        
        // Reset consecutive jumps
        gameState.consecutiveJumps.active = false;
        gameState.consecutiveJumps.piece = null;
        
        // Switch turns
        gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';
        updateTurnIndicator();
        
        // Check if the game is over
        checkGameOver();
        
        // Check for mandatory jumps for the next player
        checkForMandatoryJumps();
        
        // If it's AI's turn, make the AI move
        if (gameState.gameMode === 'ai' && gameState.currentPlayer === gameState.aiPlayer) {
            setTimeout(makeAIMove, 1000);
        }
    }

    // Check for mandatory jumps
    function checkForMandatoryJumps() {
        gameState.mustJump = false;
        gameState.jumpPossibilities = [];
        
        // Check every piece of the current player for possible jumps
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (gameState.board[row][col] && gameState.board[row][col].player === gameState.currentPlayer) {
                    const jumps = getJumpMoves(row, col, gameState.board[row][col]);
                    if (jumps.length > 0) {
                        gameState.mustJump = true;
                        gameState.jumpPossibilities.push({ row, col });
                    }
                }
            }
        }
    }

    // Check if the game is over
    function checkGameOver() {
        // Check piece count
        if (gameState.pieceCount.white === 0) {
            showGameMessage('Black wins!');
            return true;
        }
        
        if (gameState.pieceCount.black === 0) {
            showGameMessage('White wins!');
            return true;
        }
        
        // Check if current player can move
        let canMove = false;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (gameState.board[row][col] && gameState.board[row][col].player === gameState.currentPlayer) {
                    const regularMoves = getRegularMoves(row, col, gameState.board[row][col]);
                    const jumpMoves = getJumpMoves(row, col, gameState.board[row][col]);
                    
                    if (regularMoves.length > 0 || jumpMoves.length > 0) {
                        canMove = true;
                        break;
                    }
                }
            }
            if (canMove) break;
        }
        
        if (!canMove) {
            const winner = gameState.currentPlayer === 'white' ? 'Black' : 'White';
            showGameMessage(`${winner} wins! No moves available.`);
            return true;
        }
        
        return false;
    }

    // Show game message
    function showGameMessage(message) {
        const messageElement = document.getElementById('game-message');
        messageElement.textContent = message;
        messageElement.style.display = 'block';
        
        // Hide after 3 seconds
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 3000);
    }

    // AI logic
    function makeAIMove() {
        gameState.aiThinking = true;
        updateTurnIndicator();
        
        // Add a small delay to simulate thinking
        setTimeout(() => {
            const move = calculateAIMove();
            
            if (move) {
                // Select the piece
                const pieceElement = document.querySelector(`.piece[data-row="${move.fromRow}"][data-col="${move.fromCol}"]`);
                
                // Simulate click
                gameState.selectedPiece = { row: move.fromRow, col: move.fromCol };
                pieceElement.classList.add('selected');
                showLegalMoves(move.fromRow, move.fromCol);
                
                // Add a small delay before moving
                setTimeout(() => {
                    movePiece(move.toRow, move.toCol);
                }, 500);
            }
            
            gameState.aiThinking = false;
            updateTurnIndicator();
        }, 1000);
    }

    function calculateAIMove() {
        let possibleMoves = [];
        
        // If we must jump, only consider jump moves
        if (gameState.mustJump) {
            for (const pos of gameState.jumpPossibilities) {
                const jumps = getJumpMoves(pos.row, pos.col, gameState.board[pos.row][pos.col]);
                jumps.forEach(jump => {
                    possibleMoves.push({
                        fromRow: pos.row,
                        fromCol: pos.col,
                        toRow: jump.row,
                        toCol: jump.col,
                        isJump: true,
                        value: evaluateMove(pos.row, pos.col, jump.row, jump.col, true)
                    });
                });
            }
        } else {
            // Consider all possible moves
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    if (gameState.board[row][col] && gameState.board[row][col].player === gameState.aiPlayer) {
                        // Regular moves
                        const regularMoves = getRegularMoves(row, col, gameState.board[row][col]);
                        regularMoves.forEach(move => {
                            possibleMoves.push({
                                fromRow: row,
                                fromCol: col,
                                toRow: move.row,
                                toCol: move.col,
                                isJump: false,
                                value: evaluateMove(row, col, move.row, move.col, false)
                            });
                        });
                        
                        // Jump moves - AI should prefer jumps even when not mandatory
                        const jumpMoves = getJumpMoves(row, col, gameState.board[row][col]);
                        jumpMoves.forEach(move => {
                            possibleMoves.push({
                                fromRow: row,
                                fromCol: col,
                                toRow: move.row,
                                toCol: move.col,
                                isJump: true,
                                value: evaluateMove(row, col, move.row, move.col, true)
                            });
                        });
                    }
                }
            }
        }
        
        if (possibleMoves.length === 0) {
            return null;
        }
        
        // Sort moves by value (higher is better)
        possibleMoves.sort((a, b) => b.value - a.value);
        
        // Based on difficulty, choose from the top moves or randomly
        if (gameState.aiDifficulty === 'easy') {
            // Easy: 50% chance of making a suboptimal move
            if (Math.random() < 0.5 && possibleMoves.length > 1) {
                // Pick a random move, excluding the best one
                const randomIndex = Math.floor(Math.random() * (possibleMoves.length - 1)) + 1;
                return possibleMoves[randomIndex];
            }
        } else if (gameState.aiDifficulty === 'medium') {
            // Medium: 80% chance of making an optimal move
            if (Math.random() < 0.2 && possibleMoves.length > 1) {
                // Pick a random move from the top 3 (or fewer if there aren't that many)
                const randomIndex = Math.floor(Math.random() * Math.min(3, possibleMoves.length));
                return possibleMoves[randomIndex];
            }
        }
        // Hard: Always make the best move (default)
        
        return possibleMoves[0];
    }

    function evaluateMove(fromRow, fromCol, toRow, toCol, isJump) {
        let value = 0;
        const piece = gameState.board[fromRow][fromCol];
        
        // Jumps are good
        if (isJump) {
            value += 10;
        }
        
        // Kings are valuable
        if (piece.isKing) {
            value += 5;
        }
        
        // Getting a king is good
        if (!piece.isKing && 
            ((piece.player === 'black' && toRow === 7) || 
             (piece.player === 'white' && toRow === 0))) {
            value += 8;
        }
        
        // Moving forward is good for non-kings
        if (!piece.isKing && piece.player === 'black' && toRow > fromRow) {
            value += 1;
        }
        
        if (!piece.isKing && piece.player === 'white' && toRow < fromRow) {
            value += 1;
        }
        
        // Edge pieces are safer
        if (toCol === 0 || toCol === 7) {
            value += 2;
        }
        
        // Very basic positional evaluation
        // For black, moving towards the bottom rows is good
        if (piece.player === 'black') {
            value += toRow * 0.5;
        } else {
            // For white, moving towards the top rows is good
            value += (7 - toRow) * 0.5;
        }
        
        // Add a small random factor
        value += Math.random() * 0.5;
        
        return value;
    }

    // Multiplayer connection functions (simulated for this demo)
    function setupMultiplayerConnection() {
        // In a real implementation, this would use WebRTC or WebSockets
        
        // Simulate a successful connection
        setTimeout(() => {
            gameState.opponentConnected = true;
            
            if (gameState.isHost) {
                document.getElementById('room-status').textContent = 'Opponent connected! Game starting...';
            } else {
                document.getElementById('join-status').textContent = 'Connected! Game starting...';
            }
            
            // Start the multiplayer game
            setGameMode('multiplayer');
        }, 1500);
    }

    function sendMoveToOpponent(fromRow, fromCol, toRow, toCol, isJump) {
        // In a real implementation, this would send the move via WebRTC or WebSockets
        console.log(`Sent move: (${fromRow},${fromCol}) to (${toRow},${toCol})`);
        
        // Simulate receiving the move from the opponent for this demo
        if (gameState.gameMode === 'multiplayer') {
            // In a real implementation, this would happen when receiving a message
        }
    }

    function sendResetRequest() {
        // In a real implementation, this would notify the opponent
        console.log('Sent reset request');
    }

    // Initialize the board when the page loads
    document.addEventListener('DOMContentLoaded', () => {
        // Don't create the board yet, wait for game mode selection
    });