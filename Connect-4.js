// constants
const TOTAL_COLUMNS = 7;
const TOTAL_ROWS = 7;
const HUMAN_WIN_SCORE = -4;
const COMPUTER_WIN_SCORE = 4;
const NO_WIN_SCORE = 0;

// game state object
const GameState = function (cloneGameState) {
    this.board = Array.from({ length: TOTAL_COLUMNS }, () => []);
    this.score = NO_WIN_SCORE;
    this.winningChips = undefined;

    if (cloneGameState) {
        this.board = cloneGameState.board.map(col => col.slice());
        this.score = cloneGameState.score;
    }
};

GameState.prototype.makeMove = function (player, col) {
    let coords = undefined;
    const row = this.board[col].length;
    if (row < TOTAL_ROWS) {
        this.board[col][row] = player;
        this.setScore(player, col, row);
        coords = { col, row };
    }
    return coords;
};

GameState.prototype.isBoardFull = function () {
    return this.board.every(col => col.length >= TOTAL_ROWS);
};

GameState.prototype.setScore = function (player, col, row) {
    const isWin =
        this.checkRuns(player, col, row, 0, 1) ||
        this.checkRuns(player, col, row, 1, 0) ||
        this.checkRuns(player, col, row, 1, 1) ||
        this.checkRuns(player, col, row, 1, -1);

    this.score = isWin ? (player === 1 ? HUMAN_WIN_SCORE : COMPUTER_WIN_SCORE) : NO_WIN_SCORE;
};

GameState.prototype.checkRuns = function (player, col, row, colStep, rowStep) {
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

GameState.prototype.getPlayerForChipAt = function (col, row) {
    let player = undefined;
    if (this.board[col] !== undefined && this.board[col][row] !== undefined) {
        player = this.board[col][row];
    }
    return player;
}
GameState.prototype.isWin = function () {
    return (this.score === HUMAN_WIN_SCORE || this.score === COMPUTER_WIN_SCORE);
}

// listen for messages from the main thread
self.addEventListener('message', function (e) {
    switch (e.data.messageType) {
        case 'reset':
            resetGame();
            break;
        case 'human-move':
            makeHumanMove(e.data.col, e.data.player || 1);
            break;
        case 'computer-move':
            makeComputerMove(e.data.maxDepth);
            break;
    }
}, false);

function resetGame() {
    currentGameState = new GameState();

    self.postMessage({
        messageType: 'reset-done'
    });
}

function makeHumanMove(col, player) {
    // coords is undefined if the move is invalid (column is full)
    const coords = currentGameState.makeMove(player, col);
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

        // fun recursive AI stuff kicks off here
        const tentativeCol = think(origin, 2, depth, isTopLevel);
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

function think(node, player, recursionsRemaining, isTopLevel) {
    let col;
    let scoreSet = false;
    const childNodes = [];

    // consider each column as a potential move
    for (col = 0; col < TOTAL_COLUMNS; col++) {
        if (isTopLevel) {
            self.postMessage({
                messageType: 'progress',
                col: col
            });
        }

        // make sure column isn't already full
        const row = node.board[col].length;
        if (row < TOTAL_ROWS) {
            // create new child node to represent this potential move
            const childNode = new GameState(node);
            childNode.makeMove(player, col);
            childNodes[col] = childNode;

            if (!childNode.isWin() && recursionsRemaining > 0) {
                // no game stopping win and there are still recursions to make, think deeper
                const nextPlayer = (player === 1) ? 2 : 1;
                think(childNode, nextPlayer, recursionsRemaining - 1);
            }

            if (!scoreSet) {
                // no best score yet, just go with this one for now
                node.score = childNode.score;
                scoreSet = true;
            } else if (player === 1 && childNode.score < node.score) {
                // assume human will always pick the lowest scoring move (least favorable to computer)
                node.score = childNode.score;
            } else if (player === 2 && childNode.score > node.score) {
                // computer should always pick the highest scoring move (most favorable to computer)
                node.score = childNode.score;
            }
        }
    }

    // collect all moves tied for best move and randomly pick one
    const candidates = [];
    for (col = 0; col < TOTAL_COLUMNS; col++) {
        if (childNodes[col] !== undefined && childNodes[col].score === node.score) {
            candidates.push(col);
        }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}