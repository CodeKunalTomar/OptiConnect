// constants
const TOTAL_COLUMNS = 7;
const TOTAL_ROWS = 7;
const HUMAN_WIN_SCORE = -1000000;
const COMPUTER_WIN_SCORE = 1000000;
const NO_WIN_SCORE = 0;

// Transposition Table constants
const TT_EXACT = 0;
const TT_LOWERBOUND = 1;
const TT_UPPERBOUND = 2;
const MAX_TT_SIZE = 1000000; // Max entries in transposition table

// Bitboard constants
const BOARD_HEIGHT = TOTAL_ROWS + 1; // Extra row for overflow detection
const BOARD_WIDTH = TOTAL_COLUMNS;

// ============================================================================
// OPENING BOOK - Pre-computed optimal moves for first 10-15 ply
// ============================================================================
// Opening book - maps board state to optimal move (center column is always best first move)
const OPENING_BOOK = {
    // Empty board - always play center (column 3)
    '': 3,
    
    // Human plays first - AI responds with center
    '01': 3, '11': 3, '21': 3, '31': 3, '41': 3, '51': 3, '61': 3,
    
    // Human center (31), AI center (32) - human's second move responses
    '3132': 3, '0132': 3, '1132': 2, '2132': 2, '4132': 4, '5132': 4, '6132': 3,
    
    // Human off-center, AI center - continue strong center control
    '0132': 3, '1132': 3, '2132': 3, '4132': 3, '5132': 3, '6132': 3,
    
    // Two-move sequences - prioritize adjacent to center
    '313241': 2, '313251': 4, '313211': 2, '313221': 2, '313261': 4,
    
    // Defensive patterns - block threats
    '313241': 2, '313211': 2, '313251': 4, '313261': 4,
    
    // Column 3 double stack scenarios
    '313231': 3, // Continue center dominance
    
    // Early game center control patterns
    '3132113122': 2, '3132413242': 4, '3132513252': 4, '3132213222': 2,
    
    // Edge defense - Human opens on column 0
    '0131': 0,       // Contest the edge!
    '013101': 0,     // Continue contesting
    
    // Edge defense - Human opens on column 6  
    '6131': 6,       // Contest the edge!
    '613161': 6,     // Continue contesting
    
    // Block 3-stacks on edges
    '010111': 0,     // Block left edge 3-stack
    '616161': 6,     // Block right edge 3-stack
    
    // Vertical stacking defense (any column)
    '4142': 4,       // Block column 4 stack
    '414241': 4,     // Continue blocking column 4
    '2122': 2,       // Block column 2 stack
    '5152': 5,       // Block column 5 stack
    
    // Human stacks center - AI must contest by stacking on same column
    '3132': 3,       // AI contests center column (not cooperating, competing for control)
    '313231': 3,     // Continue center control
    '31323132': 3,   // Keep stacking center
};
const MAX_OPENING_MOVES = 15; // Use opening book for first 15 moves (7-8 ply per side)

// Column ordering for move ordering (center columns first for better alpha-beta pruning)
const COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6];

// Position evaluation weights
const CENTER_COLUMN_WEIGHT = 3;
const CENTER_ADJACENT_WEIGHT = 2;

// ============================================================================
// AI CONFIGURATION - Near-perfect play settings
// ============================================================================
const AI_CONFIG = {
    MAX_DEPTH: 20,                  // Maximum search depth (20 ply)
    MIN_DEPTH: 12,                  // Minimum search depth (12 ply)
    MAX_TIME: 5000,                 // Max 5 seconds per move
    TT_SIZE: MAX_TT_SIZE,           // Transposition table size
    USE_OPENING_BOOK: true,
    USE_PVS: true,                  // Principal Variation Search
    USE_LMR: true,                  // Late Move Reductions
    USE_KILLER_MOVES: true,
    USE_HISTORY: true,
    USE_ASPIRATION: true,
    USE_THREAT_SEARCH: true,
    
    // Evaluation weights for near-perfect play
    DOUBLE_THREAT_WEIGHT: 50000,
    THREAT_WEIGHT: 5000,
    POTENTIAL_THREAT_WEIGHT: 500,
    CENTER_WEIGHT: 200,
    ODD_EVEN_WEIGHT: 600,
    MOBILITY_WEIGHT: 20,
    VERTICAL_THREAT_WEIGHT: 1500,
};

// ============================================================================
// KILLER MOVES & HISTORY HEURISTIC
// ============================================================================
// Killer moves - tracks moves that caused beta cutoffs (2 per depth level)
const killerMoves = Array(AI_CONFIG.MAX_DEPTH).fill(null).map(() => [null, null]);

// History heuristic - tracks historically successful moves
const historyTable = {};

function storeKillerMove(depth, move) {
    if (killerMoves[depth][0] !== move) {
        killerMoves[depth][1] = killerMoves[depth][0];
        killerMoves[depth][0] = move;
    }
}

function updateHistory(move, depth) {
    const key = move;
    historyTable[key] = (historyTable[key] || 0) + depth * depth;
}

function clearHeuristics() {
    // Clear killer moves
    for (let i = 0; i < killerMoves.length; i++) {
        killerMoves[i] = [null, null];
    }
    // Clear history table
    for (const key in historyTable) {
        delete historyTable[key];
    }
}

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

// Helper function to check if a score indicates a win, accounting for depth bonus
function isWinScore(score) {
    return score >= COMPUTER_WIN_SCORE - AI_CONFIG.MAX_DEPTH || 
           score <= HUMAN_WIN_SCORE + AI_CONFIG.MAX_DEPTH;
}

function isComputerWinScore(score) {
    return score >= COMPUTER_WIN_SCORE - AI_CONFIG.MAX_DEPTH;
}

function isHumanWinScore(score) {
    return score <= HUMAN_WIN_SCORE + AI_CONFIG.MAX_DEPTH;
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

// Evaluate position heuristically for non-terminal positions
GameState.prototype.evaluatePosition = function(player) {
    let score = 0;
    
    // Center control - pieces in center columns are more valuable
    for (let row = 0; row < this.bitboard.heights[3]; row++) {
        if (this.board[3][row] === player) {
            score += CENTER_COLUMN_WEIGHT;
        } else if (this.board[3][row] !== undefined) {
            score -= CENTER_COLUMN_WEIGHT;
        }
    }
    
    // Adjacent to center also valuable
    for (let col of [2, 4]) {
        for (let row = 0; row < this.bitboard.heights[col]; row++) {
            if (this.board[col][row] === player) {
                score += CENTER_ADJACENT_WEIGHT;
            } else if (this.board[col][row] !== undefined) {
                score -= CENTER_ADJACENT_WEIGHT;
            }
        }
    }
    
    // Normalize score to be within minimax range
    return score * 0.1;
}

// ============================================================================
// ADVANCED EVALUATION FUNCTIONS
// ============================================================================

// Count threats (N-in-a-row with at least one open end)
GameState.prototype.countThreats = function(player, targetLength) {
    let threats = 0;
    const directions = [
        { dc: 1, dr: 0 },   // Horizontal
        { dc: 0, dr: 1 },   // Vertical
        { dc: 1, dr: 1 },   // Diagonal /
        { dc: 1, dr: -1 }   // Diagonal \
    ];
    
    const checked = new Set();
    
    for (let col = 0; col < TOTAL_COLUMNS; col++) {
        for (let row = 0; row < this.bitboard.heights[col]; row++) {
            if (this.board[col][row] !== player) continue;
            
            for (const dir of directions) {
                const key = `${col},${row},${dir.dc},${dir.dr}`;
                if (checked.has(key)) continue;
                
                let count = 0;
                let hasOpenEnd = false;
                
                // Count in positive direction
                let c = col, r = row;
                while (c >= 0 && c < TOTAL_COLUMNS && r >= 0 && r < TOTAL_ROWS && 
                       this.board[c] && this.board[c][r] === player) {
                    count++;
                    checked.add(`${c},${r},${dir.dc},${dir.dr}`);
                    c += dir.dc;
                    r += dir.dr;
                }
                
                // Check if there's space after
                if (c >= 0 && c < TOTAL_COLUMNS && r >= 0 && r < TOTAL_ROWS) {
                    if ((dir.dr <= 0 && this.bitboard.heights[c] === r) || 
                        (dir.dr > 0 && (!this.board[c] || this.board[c][r] === undefined))) {
                        hasOpenEnd = true;
                    }
                }
                
                // Check before the starting position
                c = col - dir.dc;
                r = row - dir.dr;
                if (c >= 0 && c < TOTAL_COLUMNS && r >= 0 && r < TOTAL_ROWS) {
                    if ((dir.dr <= 0 && this.bitboard.heights[c] === r) || 
                        (dir.dr > 0 && (!this.board[c] || this.board[c][r] === undefined))) {
                        hasOpenEnd = true;
                    }
                }
                
                if (count === targetLength && hasOpenEnd) {
                    threats++;
                }
            }
        }
    }
    
    return threats;
}

// Count double threats (two simultaneous threats that can't both be blocked)
GameState.prototype.countDoubleThreats = function(player) {
    const opponent = player === 1 ? 2 : 1;
    let doubleThreats = 0;
    
    // Find all immediate winning moves for player
    const winningMoves = [];
    for (let col = 0; col < TOTAL_COLUMNS; col++) {
        if (this.bitboard.heights[col] < TOTAL_ROWS) {
            const testState = new GameState(this);
            testState.makeMove(player, col);
            if (testState.isWin()) {
                winningMoves.push(col);
            }
        }
    }
    
    // If there are 2+ winning moves, it's a double threat
    if (winningMoves.length >= 2) {
        doubleThreats = Math.floor(winningMoves.length / 2);
    }
    
    return doubleThreats;
}

// Evaluate odd-even threats (Connect-4 specific zugzwang)
GameState.prototype.evaluateOddEvenThreats = function(player) {
    let score = 0;
    
    // Count threats on odd rows (0, 2, 4, 6 from bottom)
    // Count threats on even rows (1, 3, 5)
    const oddRows = [0, 2, 4, 6];
    const evenRows = [1, 3, 5];
    
    let oddThreats = 0, evenThreats = 0;
    
    for (let col = 0; col < TOTAL_COLUMNS; col++) {
        for (let row = 0; row < TOTAL_ROWS; row++) {
            if (!this.board[col] || this.board[col][row] !== player) continue;
            
            // Check if this position is part of a threat
            const directions = [
                { dc: 1, dr: 0 },   // Horizontal
                { dc: 0, dr: 1 },   // Vertical
                { dc: 1, dr: 1 },   // Diagonal /
                { dc: 1, dr: -1 }   // Diagonal \
            ];
            
            for (const dir of directions) {
                let count = 0;
                for (let step = -3; step <= 0; step++) {
                    const c = col + step * dir.dc;
                    const r = row + step * dir.dr;
                    if (c >= 0 && c < TOTAL_COLUMNS && r >= 0 && r < TOTAL_ROWS && 
                        this.board[c] && this.board[c][r] === player) {
                        count++;
                    } else {
                        count = 0;
                    }
                }
                
                if (count >= 3) {
                    if (oddRows.includes(row)) {
                        oddThreats++;
                    } else {
                        evenThreats++;
                    }
                }
            }
        }
    }
    
    // First player (1) benefits from odd threats in later game
    // Second player (2) benefits from even threats
    if (player === 1) {
        score += evenThreats * AI_CONFIG.ODD_EVEN_WEIGHT;
        score -= oddThreats * AI_CONFIG.ODD_EVEN_WEIGHT;
    } else {
        score += oddThreats * AI_CONFIG.ODD_EVEN_WEIGHT;
        score -= evenThreats * AI_CONFIG.ODD_EVEN_WEIGHT;
    }
    
    return score;
}

// Count potential winning lines (mobility)
GameState.prototype.countPotentialLines = function(player) {
    let lines = 0;
    const opponent = player === 1 ? 2 : 1;
    
    const directions = [
        { dc: 1, dr: 0 },   // Horizontal
        { dc: 0, dr: 1 },   // Vertical
        { dc: 1, dr: 1 },   // Diagonal /
        { dc: 1, dr: -1 }   // Diagonal \
    ];
    
    // Check all possible 4-in-a-row positions
    for (let col = 0; col < TOTAL_COLUMNS; col++) {
        for (let row = 0; row < TOTAL_ROWS; row++) {
            for (const dir of directions) {
                let canWin = true;
                let hasPlayer = false;
                
                for (let step = 0; step < 4; step++) {
                    const c = col + step * dir.dc;
                    const r = row + step * dir.dr;
                    
                    if (c >= TOTAL_COLUMNS || r >= TOTAL_ROWS || r < 0) {
                        canWin = false;
                        break;
                    }
                    
                    if (this.board[c] && this.board[c][r] === opponent) {
                        canWin = false;
                        break;
                    }
                    
                    if (this.board[c] && this.board[c][r] === player) {
                        hasPlayer = true;
                    }
                }
                
                if (canWin && hasPlayer) {
                    lines++;
                }
            }
        }
    }
    
    return lines;
}

// Detect vertical stacking threats on ANY column
GameState.prototype.detectVerticalThreats = function(player) {
    let threats = 0;
    
    for (let col = 0; col < TOTAL_COLUMNS; col++) {
        const height = this.bitboard.heights[col];
        if (height < 2 || height >= TOTAL_ROWS) continue;
        
        // Count consecutive pieces from top of stack
        let consecutive = 0;
        for (let row = height - 1; row >= 0; row--) {
            if (this.board[col][row] === player) {
                consecutive++;
            } else {
                break; // Stop at first non-player piece
            }
        }
        
        // Threat if 2+ consecutive at top with room to grow
        if (consecutive >= 2) {
            threats++;
            // Extra threat for 3 in a row (one move from winning)
            if (consecutive >= 3) {
                threats += 2;
            }
        }
    }
    
    return threats;
};

// Comprehensive evaluation for near-perfect play
GameState.prototype.advancedEvaluate = function(player) {
    const opponent = player === 1 ? 2 : 1;
    
    // Terminal states
    if (this.score === COMPUTER_WIN_SCORE) return COMPUTER_WIN_SCORE;
    if (this.score === HUMAN_WIN_SCORE) return HUMAN_WIN_SCORE;
    if (this.isBoardFull()) return 0;
    
    let score = 0;
    
    // 1. Double threat detection (almost always wins)
    const aiDoubleThreats = this.countDoubleThreats(2);
    const humanDoubleThreats = this.countDoubleThreats(1);
    score += aiDoubleThreats * AI_CONFIG.DOUBLE_THREAT_WEIGHT;
    score -= humanDoubleThreats * AI_CONFIG.DOUBLE_THREAT_WEIGHT;
    
    // 2. Open-ended 3-in-a-row threats
    const aiThreats = this.countThreats(2, 3);
    const humanThreats = this.countThreats(1, 3);
    score += aiThreats * AI_CONFIG.THREAT_WEIGHT;
    score -= humanThreats * AI_CONFIG.THREAT_WEIGHT;
    
    // 3. Center column control
    for (let row = 0; row < this.bitboard.heights[3]; row++) {
        if (this.board[3][row] === 2) {
            score += AI_CONFIG.CENTER_WEIGHT;
        } else if (this.board[3][row] === 1) {
            score -= AI_CONFIG.CENTER_WEIGHT;
        }
    }
    
    // 4. Odd-Even threat analysis
    score += this.evaluateOddEvenThreats(2);
    score -= this.evaluateOddEvenThreats(1);
    
    // 5. Open-ended 2-in-a-row (potential threats)
    const aiPotential = this.countThreats(2, 2);
    const humanPotential = this.countThreats(1, 2);
    score += aiPotential * AI_CONFIG.POTENTIAL_THREAT_WEIGHT;
    score -= humanPotential * AI_CONFIG.POTENTIAL_THREAT_WEIGHT;
    
    // 6. Winning lines available (mobility)
    score += this.countPotentialLines(2) * AI_CONFIG.MOBILITY_WEIGHT;
    score -= this.countPotentialLines(1) * AI_CONFIG.MOBILITY_WEIGHT;
    
    // 7. Vertical threat detection (ALL columns, not just edges)
    const aiVerticalThreats = this.detectVerticalThreats(2);
    const humanVerticalThreats = this.detectVerticalThreats(1);
    score += aiVerticalThreats * AI_CONFIG.VERTICAL_THREAT_WEIGHT;
    score -= humanVerticalThreats * (AI_CONFIG.VERTICAL_THREAT_WEIGHT * 1.5); // Weight human threats higher (defensive priority)
    
    return score;
}

// Get a simple board state hash for opening book lookup
function getBoardStateKey(gameState) {
    let key = '';
    let moveCount = 0;
    for (let col = 0; col < TOTAL_COLUMNS; col++) {
        moveCount += gameState.board[col].length;
    }
    
    // Only use opening book for first few moves
    if (moveCount > MAX_OPENING_MOVES) return null;
    
    for (let col = 0; col < TOTAL_COLUMNS; col++) {
        for (let row = 0; row < gameState.board[col].length; row++) {
            key += col + '' + gameState.board[col][row];
        }
    }
    return key;
}

// ============================================================================
// ADVANCED MOVE ORDERING
// ============================================================================
function orderMoves(node, depth, ttBestMove) {
    const moves = [];
    
    // Collect valid moves
    for (let col = 0; col < TOTAL_COLUMNS; col++) {
        if (node.bitboard.heights[col] < TOTAL_ROWS) {
            moves.push(col);
        }
    }
    
    // Score each move for ordering
    const moveScores = moves.map(col => {
        let score = 0;
        
        // 1. Immediate win detection (HIGHEST PRIORITY - always try winning moves first)
        const testState = new GameState(node);
        testState.makeMove(2, col);
        if (testState.isWin() && testState.score === COMPUTER_WIN_SCORE) {
            score += 100000;
        }
        
        // 2. Block opponent's immediate win (CRITICAL - must block threats)
        const blockState = new GameState(node);
        blockState.makeMove(1, col);
        if (blockState.isWin() && blockState.score === HUMAN_WIN_SCORE) {
            score += 90000;
        }
        
        // 3. TT move (good move from previous search)
        if (col === ttBestMove) {
            score += 5000;
        }
        
        // 4. Killer moves (900 and 800)
        if (depth < killerMoves.length) {
            if (col === killerMoves[depth][0]) score += 900;
            if (col === killerMoves[depth][1]) score += 800;
        }
        
        // 5. History heuristic
        score += historyTable[col] || 0;
        
        // 6. Center preference (reduced bonus to avoid over-prioritization)
        const centerBonus = [5, 10, 15, 20, 15, 10, 5];
        score += centerBonus[col];
        
        // 7. Threat prevention evaluation (reuse states to optimize performance)
        score += evaluateThreatPrevention(node, col, blockState, testState);
        
        return { col, score };
    });
    
    // Sort by score (descending)
    moveScores.sort((a, b) => b.score - a.score);
    
    return moveScores.map(m => m.col);
}

// ============================================================================
// THREAT PREVENTION EVALUATION
// ============================================================================
// Evaluate how important it is to play in this column to prevent opponent threats
// This is a lighter-weight version that reuses states already created in orderMoves
function evaluateThreatPrevention(node, col, blockState, testState) {
    let score = 0;
    const row = node.bitboard.heights[col];
    if (row >= TOTAL_ROWS) return 0;
    
    // Reuse blockState if provided, otherwise create it
    if (!blockState) {
        blockState = new GameState(node);
        blockState.makeMove(1, col); // Human moves here
    }
    
    // Check if this creates a 3-in-a-row threat for opponent
    const threatsAfter = blockState.countThreats(1, 3);
    if (threatsAfter > 0) {
        score += 3000 * threatsAfter;
    }
    
    // Check for potential double-threat setup
    const doubleThreatsAfter = blockState.countDoubleThreats(1);
    if (doubleThreatsAfter > 0) {
        score += 7000;
    }
    
    // Reuse testState if provided, otherwise create it
    if (!testState) {
        testState = new GameState(node);
        testState.makeMove(2, col);
    }
    
    // Also reward moves that create threats for AI
    const aiThreats = testState.countThreats(2, 3);
    if (aiThreats > 0) {
        score += 2000 * aiThreats;
    }
    
    return score;
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
        case 'player2-move':
            makePlayer2Move(e.data.col);
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
    
    // Clear killer moves and history heuristic
    clearHeuristics();
    
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

function makePlayer2Move(col) {
    // coords is undefined if the move is invalid (column is full)
    const coords = currentGameState.makeMove(2, col);
    const isWin = currentGameState.isWin();
    const winningChips = currentGameState.winningChips;
    const isBoardFull = currentGameState.isBoardFull();
    self.postMessage({
        messageType: 'player2-move-done',
        coords: coords,
        isWin: isWin,
        winningChips: winningChips,
        isBoardFull: isBoardFull
    });
}

// Check for forced moves (instant wins or required blocks)
function getForcedMove(gameState) {
    const validMoves = [];
    const winningMoves = [];
    const blockingMoves = [];
    
    for (let col = 0; col < TOTAL_COLUMNS; col++) {
        if (gameState.bitboard.heights[col] >= TOTAL_ROWS) continue;
        validMoves.push(col);
        
        // Check if AI can win immediately
        const winTest = new GameState(gameState);
        winTest.makeMove(2, col);
        if (winTest.isWin()) {
            winningMoves.push(col);
        }
        
        // Check if human would win if they play here
        const blockTest = new GameState(gameState);
        blockTest.makeMove(1, col);
        if (blockTest.isWin()) {
            blockingMoves.push(col);
        }
    }
    
    // Priority 1: Take immediate win
    if (winningMoves.length > 0) {
        return { col: winningMoves[0], type: 'win' };
    }
    
    // Priority 2: Block immediate threat (if only one blocking move)
    if (blockingMoves.length === 1) {
        return { col: blockingMoves[0], type: 'block' };
    }
    
    // Priority 3: Multiple threats = losing position, but still must block one
    if (blockingMoves.length > 1) {
        return { col: blockingMoves[0], type: 'desperate-block' };
    }
    
    // Priority 4: Only one valid move
    if (validMoves.length === 1) {
        return { col: validMoves[0], type: 'only-move' };
    }
    
    return null; // No forced move, use search
}

function makeComputerMove(maxDepth) {
    let col;
    let isWinImminent = false;
    let isLossImminent = false;
    
    // Check for forced moves FIRST (before opening book)
    const forcedMove = getForcedMove(currentGameState);
    if (forcedMove) {
        col = forcedMove.col;
        if (forcedMove.type === 'win') {
            isWinImminent = true;
        } else if (forcedMove.type === 'desperate-block') {
            isLossImminent = true;
        }
    }
    
    // Then check opening book (only if no forced move)
    if (col === undefined) {
        const boardKey = getBoardStateKey(currentGameState);
        if (AI_CONFIG.USE_OPENING_BOOK && boardKey !== null && boardKey in OPENING_BOOK) {
            const openingCol = OPENING_BOOK[boardKey];
            // Verify move is valid
            if (currentGameState.bitboard.heights[openingCol] < TOTAL_ROWS) {
                col = openingCol;
            }
        }
    }
    
    if (col === undefined) {
        // Use iterative deepening with aspiration windows and time management
        const startTime = Date.now();
        const maxTime = AI_CONFIG.MAX_TIME;
        const actualMaxDepth = Math.max(AI_CONFIG.MIN_DEPTH, Math.min(maxDepth, AI_CONFIG.MAX_DEPTH));
        
        let bestMove = 3; // Center as default
        let bestScore = 0;
        
        for (let depth = 1; depth <= actualMaxDepth; depth++) {
            // Check if we're running out of time
            if (Date.now() - startTime > maxTime * 0.9) {
                break; // Use best move from previous iteration
            }
            
            const origin = new GameState(currentGameState);
            const isTopLevel = true;
            
            let alpha, beta;
            
            if (AI_CONFIG.USE_ASPIRATION && depth > 1) {
                // Use aspiration window around previous score
                const window = 50;
                alpha = bestScore - window;
                beta = bestScore + window;
            } else {
                // Full window for first iteration or if aspiration disabled
                alpha = -Infinity;
                beta = Infinity;
            }
            
            // Try search with aspiration window
            const tentativeCol = think(origin, 2, depth, isTopLevel, alpha, beta);
            
            // If we fell outside the aspiration window, re-search with full window
            if (AI_CONFIG.USE_ASPIRATION && depth > 1 && 
                (origin.score <= alpha || origin.score >= beta)) {
                think(origin, 2, depth, isTopLevel, -Infinity, Infinity);
            }
            
            bestScore = origin.score;
            
            // Check for win/loss using helper functions that account for depth bonuses
            if (isHumanWinScore(origin.score)) {
                // AI realizes it can lose
                isLossImminent = true;
                // Keep the best move from previous depth
                break;
            } else if (isComputerWinScore(origin.score)) {
                // AI knows how to win
                col = tentativeCol;
                isWinImminent = true;
                break;
            } else {
                // Update best move
                col = tentativeCol;
                bestMove = tentativeCol;
            }
            
            // Early exit if time is almost up
            if (Date.now() - startTime > maxTime * 0.85) {
                break;
            }
            
            // Early exit if we have a very strong position
            if (Math.abs(bestScore) > 50000) {
                break;
            }
        }
        
        // Ensure we have a valid move
        if (col === undefined || currentGameState.bitboard.heights[col] >= TOTAL_ROWS) {
            col = bestMove;
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

// ============================================================================
// PRINCIPAL VARIATION SEARCH (PVS) WITH ENHANCEMENTS
// ============================================================================
function think(node, player, recursionsRemaining, isTopLevel, alpha, beta) {
    // Store original bounds for transposition table flag determination
    const origAlpha = alpha;
    const origBeta = beta;
    
    // Check transposition table
    const hash = node.bitboard.hash;
    const ttEntry = transpositionTable.get(hash);
    let ttBestMove = null;
    
    if (ttEntry && ttEntry.depth >= recursionsRemaining && !isTopLevel) {
        ttBestMove = ttEntry.bestMove;
        
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
    } else if (ttEntry) {
        ttBestMove = ttEntry.bestMove;
    }
    
    // Terminal node or depth limit reached
    if (recursionsRemaining === 0 || node.isWin() || node.isBoardFull()) {
        if (node.isWin()) {
            node.score = node.score;
        } else if (node.isBoardFull()) {
            node.score = 0;
        } else {
            // Use advanced evaluation at leaf nodes
            node.score = node.advancedEvaluate(player);
        }
        return -1;
    }
    
    let scoreSet = false;
    const childNodes = [];
    let bestMove = -1;
    let bestScore = -Infinity;
    
    // Get ordered moves using advanced move ordering
    const orderedMoves = orderMoves(node, recursionsRemaining, ttBestMove);
    
    let isFirstMove = true;
    let moveIndex = 0;
    
    for (const col of orderedMoves) {
        if (isTopLevel) {
            self.postMessage({
                messageType: 'progress',
                col: col
            });
        }

        // Make sure column isn't already full
        const row = node.bitboard.heights[col];
        if (row >= TOTAL_ROWS) continue;
        
        // Create new child node to represent this potential move
        const childNode = new GameState(node);
        childNode.makeMove(player, col);
        childNodes[col] = childNode;

        let score;
        
        if (childNode.isWin()) {
            // Terminal win node
            // Properly handle win scores relative to current player
            score = childNode.score;
            // Add depth bonus - prefer faster wins, delay losses
            if (score === COMPUTER_WIN_SCORE) {
                score = score - recursionsRemaining; // Prefer faster AI wins
            } else if (score === HUMAN_WIN_SCORE) {
                score = score + recursionsRemaining; // Prefer slower human wins (delay loss)
            }
        } else if (childNode.isBoardFull()) {
            // Terminal draw node
            score = 0;
        } else if (recursionsRemaining > 0) {
            const nextPlayer = (player === 1) ? 2 : 1;
            let reduction = 0;
            
            // Apply Late Move Reductions (LMR) for unlikely moves
            if (AI_CONFIG.USE_LMR && !isFirstMove && moveIndex >= 3 && recursionsRemaining >= 3) {
                reduction = 1;
                if (moveIndex >= 6) reduction = 2;
            }
            
            const searchDepth = recursionsRemaining - 1 - reduction;
            
            if (AI_CONFIG.USE_PVS && isFirstMove) {
                // PV node: search with full window
                think(childNode, nextPlayer, searchDepth, false, -beta, -alpha);
                score = -childNode.score;
                isFirstMove = false;
            } else if (AI_CONFIG.USE_PVS) {
                // Non-PV node: search with null window
                think(childNode, nextPlayer, searchDepth, false, -alpha - 1, -alpha);
                score = -childNode.score;
                
                // If score is better than alpha, re-search with full window
                if (score > alpha && score < beta) {
                    think(childNode, nextPlayer, recursionsRemaining - 1, false, -beta, -alpha);
                    score = -childNode.score;
                } else if (reduction > 0 && score > alpha) {
                    // Re-search at full depth if reduced search looks promising
                    think(childNode, nextPlayer, recursionsRemaining - 1, false, -beta, -alpha);
                    score = -childNode.score;
                }
            } else {
                // Standard alpha-beta without PVS
                think(childNode, nextPlayer, searchDepth, false, -beta, -alpha);
                score = -childNode.score;
                
                // Re-search if we used reduction and found good move
                if (reduction > 0 && score > alpha) {
                    think(childNode, nextPlayer, recursionsRemaining - 1, false, -beta, -alpha);
                    score = -childNode.score;
                }
            }
        } else {
            // Leaf node - use advanced evaluation
            score = childNode.advancedEvaluate(player);
        }

        if (!scoreSet) {
            // No best score yet, just go with this one for now
            node.score = score;
            bestMove = col;
            bestScore = score;
            scoreSet = true;
            
            // Update alpha or beta
            if (player === 2) {
                alpha = Math.max(alpha, node.score);
            } else {
                beta = Math.min(beta, node.score);
            }
        } else if (player === 1 && score < node.score) {
            // Assume human will always pick the lowest scoring move (least favorable to computer)
            node.score = score;
            bestMove = col;
            bestScore = score;
            beta = Math.min(beta, node.score);
        } else if (player === 2 && score > node.score) {
            // Computer should always pick the highest scoring move (most favorable to computer)
            node.score = score;
            bestMove = col;
            bestScore = score;
            alpha = Math.max(alpha, node.score);
        }
        
        // Alpha-beta pruning
        if (beta <= alpha) {
            // Store killer move and update history
            if (AI_CONFIG.USE_KILLER_MOVES && recursionsRemaining < killerMoves.length) {
                storeKillerMove(recursionsRemaining, col);
            }
            if (AI_CONFIG.USE_HISTORY) {
                updateHistory(col, recursionsRemaining);
            }
            break; // Prune remaining branches
        }
        
        moveIndex++;
    }
    
    // Store in transposition table (with size limit)
    if (transpositionTable.size < MAX_TT_SIZE) {
        let flag;
        // Use original bounds to determine flag type
        if (bestScore <= origAlpha) {
            flag = TT_UPPERBOUND;
        } else if (bestScore >= origBeta) {
            flag = TT_LOWERBOUND;
        } else {
            flag = TT_EXACT;
        }
        
        transpositionTable.set(hash, {
            score: bestScore,
            depth: recursionsRemaining,
            flag: flag,
            bestMove: bestMove
        });
    }

    // For top level, collect all moves tied for best move and use deterministic tie-breaking
    if (isTopLevel) {
        const candidates = [];
        for (let col = 0; col < TOTAL_COLUMNS; col++) {
            if (childNodes[col] !== undefined && 
                ((player === 2 && childNodes[col].score === node.score) ||
                 (player === 1 && childNodes[col].score === node.score))) {
                candidates.push(col);
            }
        }
        // Deterministic tie-breaking - prefer center columns
        if (candidates.length > 0) {
            const preference = [3, 2, 4, 1, 5, 0, 6];
            for (const col of preference) {
                if (candidates.includes(col)) return col;
            }
        }
        return bestMove;
    }
    
    return bestMove;
}