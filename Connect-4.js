// constants
const TOTAL_COLUMNS = 7;
const TOTAL_ROWS = 7;
const HUMAN_WIN_SCORE = -4;
const COMPUTER_WIN_SCORE = 4;
const NO_WIN_SCORE = 0;

// Transposition Table constants
const TT_EXACT = 0;
const TT_LOWERBOUND = 1;
const TT_UPPERBOUND = 2;
const MAX_TT_SIZE = 1000000; // Max entries in transposition table

// Bitboard constants
const BOARD_HEIGHT = TOTAL_ROWS + 1; // Extra row for overflow detection
const BOARD_WIDTH = TOTAL_COLUMNS;

// Initialize Zobrist hashing table (random 64-bit values for each position and player)
const zobristTable = [];
function initZobrist() {
    zobristTable.length = 0;
    // Use a simple seeded random number generator for better distribution
    let seed = 12345n;
    const next = () => {
        seed = (seed * 48271n) % 2147483647n;
        return seed;
    };
    
    for (let col = 0; col < TOTAL_COLUMNS; col++) {
        zobristTable[col] = [];
        for (let row = 0; row < TOTAL_ROWS; row++) {
            zobristTable[col][row] = [];
            // Generate pseudo-random 64-bit values for each player
            zobristTable[col][row][1] = (next() << 32n) | next();
            zobristTable[col][row][2] = (next() << 32n) | next();
        }
    }
}
initZobrist();

// Transposition table
let transpositionTable = new Map();

// Bitboard utility functions
function createBitboard() {
    return {
        player1: 0n, // Bitboard for player 1
        player2: 0n, // Bitboard for player 2
        heights: Array(TOTAL_COLUMNS).fill(0), // Height of each column
        hash: 0n // Zobrist hash
    };
}

function copyBitboard(bb) {
    return {
        player1: bb.player1,
        player2: bb.player2,
        heights: bb.heights.slice(),
        hash: bb.hash
    };
}

// Convert column and row to bit position
function positionToBit(col, row) {
    return BigInt(col * BOARD_HEIGHT + row);
}

// Make a move on bitboard
function bitboardMakeMove(bb, player, col) {
    const row = bb.heights[col];
    if (row >= TOTAL_ROWS) {
        return null; // Column full
    }
    
    const pos = positionToBit(col, row);
    const mask = 1n << pos;
    
    if (player === 1) {
        bb.player1 |= mask;
    } else {
        bb.player2 |= mask;
    }
    
    // Update Zobrist hash
    bb.hash ^= zobristTable[col][row][player];
    
    bb.heights[col]++;
    return { col, row };
}

// Check if a bitboard position has 4 in a row
function bitboardCheckWin(bitboard) {
    // Horizontal check
    let m = bitboard & (bitboard >> BigInt(BOARD_HEIGHT));
    if (m & (m >> BigInt(BOARD_HEIGHT * 2))) {
        return true;
    }
    
    // Vertical check
    m = bitboard & (bitboard >> 1n);
    if (m & (m >> 2n)) {
        return true;
    }
    
    // Diagonal / check
    m = bitboard & (bitboard >> BigInt(BOARD_HEIGHT - 1));
    if (m & (m >> BigInt((BOARD_HEIGHT - 1) * 2))) {
        return true;
    }
    
    // Diagonal \ check
    m = bitboard & (bitboard >> BigInt(BOARD_HEIGHT + 1));
    if (m & (m >> BigInt((BOARD_HEIGHT + 1) * 2))) {
        return true;
    }
    
    return false;
}

// Find winning chips for highlighting
function findWinningChips(bitboard, lastCol, lastRow) {
    const directions = [
        { dc: 0, dr: 1 },   // Vertical
        { dc: 1, dr: 0 },   // Horizontal
        { dc: 1, dr: 1 },   // Diagonal /
        { dc: 1, dr: -1 }   // Diagonal \
    ];
    
    for (const dir of directions) {
        const chips = [];
        
        // Check in both directions from last move
        for (let step = -3; step <= 3; step++) {
            const c = lastCol + step * dir.dc;
            const r = lastRow + step * dir.dr;
            
            if (c >= 0 && c < TOTAL_COLUMNS && r >= 0 && r < TOTAL_ROWS) {
                const pos = positionToBit(c, r);
                const mask = 1n << pos;
                
                if (bitboard & mask) {
                    chips.push({ col: c, row: r });
                    if (chips.length === 4) {
                        return chips;
                    }
                } else {
                    chips.length = 0;
                    if (step === 0) break;
                }
            } else {
                chips.length = 0;
                if (step === 0) break;
            }
        }
    }
    
    return null;
}

// game state object
const GameState = function (cloneGameState) {
    this.board = Array.from({ length: TOTAL_COLUMNS }, () => []);
    this.bitboard = createBitboard();
    this.score = NO_WIN_SCORE;
    this.winningChips = undefined;

    if (cloneGameState) {
        this.board = cloneGameState.board.map(col => col.slice());
        this.bitboard = copyBitboard(cloneGameState.bitboard);
        this.score = cloneGameState.score;
    }
};

GameState.prototype.makeMove = function(player, col) {
    let coords = undefined;
    const row = this.board[col].length;
    if (row < TOTAL_ROWS) {
        this.board[col][row] = player;
        
        // Also make move on bitboard
        coords = bitboardMakeMove(this.bitboard, player, col);
        
        this.setScore(player, col, row);
    }
    return coords;
};

GameState.prototype.isBoardFull = function() {
    return this.bitboard.heights.every(h => h >= TOTAL_ROWS);
};

GameState.prototype.setScore = function(player, col, row) {
    // Use fast bitboard win detection
    const playerBitboard = player === 1 ? this.bitboard.player1 : this.bitboard.player2;
    const isWin = bitboardCheckWin(playerBitboard);
    
    if (isWin) {
        this.score = player === 1 ? HUMAN_WIN_SCORE : COMPUTER_WIN_SCORE;
        this.winningChips = findWinningChips(playerBitboard, col, row);
    } else {
        this.score = NO_WIN_SCORE;
    }
};

GameState.prototype.isWin = function() {
    return (this.score === HUMAN_WIN_SCORE || this.score === COMPUTER_WIN_SCORE);
}

// Keep legacy methods for backward compatibility if needed
GameState.prototype.checkRuns = function(player, col, row, colStep, rowStep) {
    let runCount = 0;

    for (let step = -3; step <= 3; step++) {
        if (this.getPlayerForChipAt(col + step * colStep, row + step * rowStep) === player) {
            runCount++;
            if (runCount === 4) {
                this.winningChips = Array.from({ length: 4 }, (__, i) => ({
                    col: col + (step - i) * colStep,
                    row: row + (step - i) * rowStep
                }));
                return true;
            }
        } else {
            runCount = 0;
            if (step === 0) {
                break;
            }
        }
    }

    return false;
};

GameState.prototype.getPlayerForChipAt = function(col, row) {
    let player = undefined;
    if (this.board[col] !== undefined && this.board[col][row] !== undefined) {
        player = this.board[col][row];
    }
    return player;
}

// listen for messages from the main thread
self.addEventListener('message', function(e) {
    switch(e.data.messageType) {
        case 'reset':
            resetGame();
            break;
        case 'human-move':
            makeHumanMove(e.data.col);
            break;
        case 'computer-move':
            makeComputerMove(e.data.maxDepth);
            break;
    }
}, false);

function resetGame() {
    currentGameState = new GameState();
    
    // Clear transposition table on game reset
    transpositionTable.clear();
    
    self.postMessage({
        messageType: 'reset-done'
    });
}

function makeHumanMove(col) {
    // coords is undefined if the move is invalid (column is full)
    const coords = currentGameState.makeMove(1, col);
    const isWin = currentGameState.isWin();
    const winningChips = currentGameState.winningChips;
    const isBoardFull = currentGameState.isBoardFull();
    self.postMessage({
        messageType: 'human-move-done',
        coords: coords,
        isWin: isWin,
        winningChips: winningChips,
        isBoardFull: isBoardFull
    });
}

function makeComputerMove(maxDepth) {
    let col;
    let isWinImminent = false;
    let isLossImminent = false;
    
    for (let depth = 0; depth <= maxDepth; depth++) {
        const origin = new GameState(currentGameState);
        const isTopLevel = (depth === maxDepth);

        // Alpha-beta search with initial bounds
        const tentativeCol = think(origin, 2, depth, isTopLevel, -Infinity, Infinity);
        
        if (origin.score === HUMAN_WIN_SCORE) {
            // AI realizes it can lose, thinks all moves suck now, keep move picked at previous depth
            // this solves the "apathy" problem
            isLossImminent = true;
            break;
        } else if (origin.score === COMPUTER_WIN_SCORE) {
            // AI knows how to win, no need to think deeper, use this move
            // this solves the "cocky" problem
            col = tentativeCol;
            isWinImminent = true;
            break;
        } else {
            // go with this move, for now at least
            col = tentativeCol;
        }
    }

    const coords = currentGameState.makeMove(2, col);
    const isWin = currentGameState.isWin();
    const winningChips = currentGameState.winningChips;
    const isBoardFull = currentGameState.isBoardFull();
    self.postMessage({
        messageType: 'computer-move-done',
        coords: coords,
        isWin: isWin,
        winningChips: winningChips,
        isBoardFull: isBoardFull,
        isWinImminent: isWinImminent,
        isLossImminent: isLossImminent
    });
}

function think(node, player, recursionsRemaining, isTopLevel, alpha, beta) {
    // Store original bounds for transposition table flag determination
    const origAlpha = alpha;
    const origBeta = beta;
    
    // Check transposition table
    const hash = node.bitboard.hash;
    const ttEntry = transpositionTable.get(hash);
    
    if (ttEntry && ttEntry.depth >= recursionsRemaining && !isTopLevel) {
        // Use cached result if depth is sufficient
        if (ttEntry.flag === TT_EXACT) {
            node.score = ttEntry.score;
            return ttEntry.bestMove;
        } else if (ttEntry.flag === TT_LOWERBOUND) {
            alpha = Math.max(alpha, ttEntry.score);
        } else if (ttEntry.flag === TT_UPPERBOUND) {
            beta = Math.min(beta, ttEntry.score);
        }
        
        if (alpha >= beta) {
            node.score = ttEntry.score;
            return ttEntry.bestMove;
        }
    }
    
    let col;
    let scoreSet = false;
    const childNodes = [];
    let bestMove = -1;

    // consider each column as a potential move
    for (col = 0; col < TOTAL_COLUMNS; col++) {
        if(isTopLevel) {
            self.postMessage({
                messageType: 'progress',
                col: col
            });
        }

        // make sure column isn't already full
        const row = node.bitboard.heights[col];
        if (row < TOTAL_ROWS) {
            // create new child node to represent this potential move
            const childNode = new GameState(node);
            childNode.makeMove(player, col);
            childNodes[col] = childNode;

            if(!childNode.isWin() && recursionsRemaining > 0) {
                // no game stopping win and there are still recursions to make, think deeper
                const nextPlayer = (player === 1) ? 2 : 1;
                think(childNode, nextPlayer, recursionsRemaining - 1, false, alpha, beta);
            }

            if (!scoreSet) {
                // no best score yet, just go with this one for now
                node.score = childNode.score;
                bestMove = col;
                scoreSet = true;
                
                // Update alpha or beta
                if (player === 2) {
                    alpha = Math.max(alpha, node.score);
                } else {
                    beta = Math.min(beta, node.score);
                }
            } else if (player === 1 && childNode.score < node.score) {
                // assume human will always pick the lowest scoring move (least favorable to computer)
                node.score = childNode.score;
                bestMove = col;
                beta = Math.min(beta, node.score);
            } else if (player === 2 && childNode.score > node.score) {
                // computer should always pick the highest scoring move (most favorable to computer)
                node.score = childNode.score;
                bestMove = col;
                alpha = Math.max(alpha, node.score);
            }
            
            // Alpha-beta pruning
            if (beta <= alpha) {
                break; // Prune remaining branches
            }
        }
    }
    
    // Store in transposition table (with size limit)
    if (transpositionTable.size < MAX_TT_SIZE) {
        let flag;
        // Use original bounds to determine flag type
        if (node.score <= origAlpha) {
            flag = TT_UPPERBOUND;
        } else if (node.score >= origBeta) {
            flag = TT_LOWERBOUND;
        } else {
            flag = TT_EXACT;
        }
        
        transpositionTable.set(hash, {
            score: node.score,
            depth: recursionsRemaining,
            flag: flag,
            bestMove: bestMove
        });
    }

    // For top level, collect all moves tied for best move and randomly pick one
    // For non-top level, just return the best move (may have been pruned)
    if (isTopLevel) {
        const candidates = [];
        for (col = 0; col < TOTAL_COLUMNS; col++) {
            if (childNodes[col] !== undefined && childNodes[col].score === node.score) {
                candidates.push(col);
            }
        }
        return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : bestMove;
    }
    
    return bestMove;
}