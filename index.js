// constants
const WEB_WORKER_URL = 'Connect-4.js';
const MOVE_TIME_LIMIT = 10; // seconds per move

// Game mode: 'ai' or '2p'
let gameMode = 'ai';
let currentPlayer = 1;
let timerInterval = null;
let timeRemaining = MOVE_TIME_LIMIT;

const BLURBS = {
    'start': {
        header: 'Get Ready',
        blurb: 'Select your Mode and Start the Game.'
    },
    'p1-turn': {
        header: 'Player 1\'s Turn',
        blurb: 'Click on the Board to drop your chip.'
    },
    'p2-turn-ai': {
        header: 'Computer\'s Turn',
        blurb: 'The Computer is trying to find the best way to make you Lose.'
    },
    'p2-turn': {
        header: 'Player 2\'s Turn',
        blurb: 'Click on the Board to drop your chip.'
    },
    'p1-win': {
        header: 'Player 1 Wins!',
        blurb: 'Amazing victory! Player 1 is the champion!'
    },
    'p2-win-ai': {
        header: 'Computer Wins',
        blurb: 'Try again and NEVER GIVE UP, remember that.'
    },
    'p2-win': {
        header: 'Player 2 Wins!',
        blurb: 'Congratulations! Player 2 claims victory!'
    },
    'tie': {
        header: 'Tie',
        blurb: 'Everyone\'s a winner! Or loser. Depends on how you look at it.'
    }
};
const OUTLOOKS = {
    'win-imminent': 'Uh oh, computer is feeling saucy!',
    'loss-imminent': 'Computer is unsure. Now\'s your chance!'
};

// global variables
const worker = new Worker(WEB_WORKER_URL);

// document ready
$(function () {
    $('.start button').on('click', startGame);
    setBlurb('start');
    setOutlook();

    // Mode toggle handler
    $('input[name=mode-options]').on('change', function () {
        gameMode = $(this).val();
        if (gameMode === '2p') {
            $('.dif').addClass('hidden');
        } else {
            $('.dif').removeClass('hidden');
        }
    });

    worker.addEventListener('message', function (e) {
        switch (e.data.messageType) {
            case 'reset-done':
                currentPlayer = 1;
                startHumanTurn();
                break;
            case 'human-move-done':
                endHumanTurn(e.data.coords, e.data.isWin, e.data.winningChips, e.data.isBoardFull);
                break;
            case 'progress':
                updateComputerTurn(e.data.col);
                break;
            case 'computer-move-done':
                endComputerTurn(e.data.coords, e.data.isWin, e.data.winningChips, e.data.isBoardFull,
                    e.data.isWinImminent, e.data.isLossImminent);
                break;
        }
    }, false);
});
function setBlurb(key) {
    $('.info h2').text(BLURBS[key].header);
    $('.info .blurb').text(BLURBS[key].blurb);
}

function setOutlook(key) {
    const $outlook = $('.info .outlook');
    if (key) {
        $outlook
            .text(OUTLOOKS[key])
            .show();
    } else {
        $outlook.hide();
    }
}

// Timer functions
function startTimer() {
    timeRemaining = MOVE_TIME_LIMIT;
    updateTimerDisplay();
    $('.timer-container').addClass('active');

    timerInterval = setInterval(function () {
        timeRemaining -= 0.1;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            stopTimer();
            handleTimeout();
        }
    }, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    $('.timer-container').removeClass('active');
}

function updateTimerDisplay() {
    const displayTime = Math.ceil(timeRemaining);
    const percentage = (timeRemaining / MOVE_TIME_LIMIT) * 100;

    $('.timer-display').text(displayTime);
    $('.timer-fill').css('width', percentage + '%');

    // Warning state when 3 seconds or less
    if (timeRemaining <= 3) {
        $('.timer-display').addClass('warning');
        $('.timer-fill').addClass('warning');
    } else {
        $('.timer-display').removeClass('warning');
        $('.timer-fill').removeClass('warning');
    }
}

function handleTimeout() {
    // Remove click handlers to prevent conflicts
    $('.click-columns, .click-columns div').off();
    $('.click-columns div').removeClass('hover');
    destroyCursorChip();

    // Find first available column and make a random move
    const availableCols = [];
    for (let i = 0; i < 7; i++) {
        // Check if column is available by checking the board visually
        availableCols.push(i);
    }

    // Pick a random available column
    const randomCol = availableCols[Math.floor(Math.random() * availableCols.length)];

    // Show chip and make the move
    createCursorChip(currentPlayer, randomCol);

    worker.postMessage({
        messageType: 'human-move',
        col: randomCol,
        player: currentPlayer
    });
}

function startGame() {
    gameMode = $('input[name=mode-options]:checked').val();
    currentPlayer = 1;
    $('.sidebar').addClass('freeze');
    $('.mode input, .dif input').prop('disabled', true);
    $('.lit-cells, .chips').empty();

    worker.postMessage({
        messageType: 'reset',
    });
}

function startHumanTurn() {
    if (currentPlayer === 1) {
        setBlurb('p1-turn');
    } else {
        setBlurb('p2-turn');
    }

    // Start the move timer
    startTimer();

    $('.click-columns div').addClass('hover');

    // if mouse is already over a column, show cursor chip there
    const col = $('.click-columns div:hover').index();
    if (col !== -1) {
        createCursorChip(currentPlayer, col);
    }

    $('.click-columns')
        .on('mouseenter', function () {
            const col = $('.click-columns div:hover').index();
            createCursorChip(currentPlayer, col);
        })
        .on('mouseleave', function () {
            destroyCursorChip();
        });

    $('.click-columns div')
        .on('mouseenter', function () {
            const col = $(this).index();
            moveCursorChip(col);
        })
        .on('click', function () {
            stopTimer();
            $('.click-columns, .click-columns div').off();

            const col = $(this).index();
            worker.postMessage({
                messageType: 'human-move',
                col: col,
                player: currentPlayer
            });
        });
}

function endHumanTurn(coords, isWin, winningChips, isBoardFull) {
    $('.click-columns div').removeClass('hover');
    if (!coords) {
        // column was full, human goes again
        startHumanTurn();
    } else {
        dropCursorChip(coords.row, function () {
            if (isWin) {
                const winBlurb = currentPlayer === 1 ? 'p1-win' : 'p2-win';
                endGame(winBlurb, winningChips);
            } else if (isBoardFull) {
                endGame('tie');
            } else {
                // Switch turns
                if (gameMode === '2p') {
                    // Two-player mode: switch to other player
                    currentPlayer = currentPlayer === 1 ? 2 : 1;
                    startHumanTurn();
                } else {
                    // AI mode: pass turn to computer
                    startComputerTurn();
                }
            }
        });
    }
}

function startComputerTurn() {
    setBlurb('p2-turn-ai');

    // computer's cursor chip starts far left and moves right as it thinks
    createCursorChip(2, 0);

    const maxDepth = parseInt($('input[name=dif-options]:checked').val(), 10) + 1;
    worker.postMessage({
        messageType: 'computer-move',
        maxDepth: maxDepth
    });
}

function updateComputerTurn(col) {
    moveCursorChip(col);
}

function endComputerTurn(coords, isWin, winningChips, isBoardFull, isWinImminent, isLossImminent) {
    moveCursorChip(coords.col, function () {
        dropCursorChip(coords.row, function () {
            if (isWin) {
                endGame('p2-win-ai', winningChips);
            } else if (isBoardFull) {
                endGame('tie');
            } else {
                if (isWinImminent) {
                    setOutlook('win-imminent');
                } else if (isLossImminent) {
                    setOutlook('loss-imminent');
                } else {
                    setOutlook();
                }

                // pass turn to human
                currentPlayer = 1;
                startHumanTurn();
            }
        });
    });
}

function endGame(blurbKey, winningChips) {
    $('.sidebar').removeClass('freeze');
    $('.mode input, .dif input').prop('disabled', false);
    setBlurb(blurbKey);
    setOutlook();

    if (winningChips) {
        // not a tie, highlight the chips in the winning run
        for (let i = 0; i < winningChips.length; i++) {
            createLitCell(winningChips[i].col, winningChips[i].row);
        }
    }
}

function createLitCell(col, row) {
    $('<div>')
        .css({
            'left': indexToPixels(col),
            'bottom': indexToPixels(row)
        })
        .appendTo('.lit-cells');
}

function createCursorChip(player, col) {
    const playerClass = 'p' + player;
    $('<div>', { 'class': 'cursor ' + playerClass })
        .css('left', indexToPixels(col))
        .appendTo('.chips');

    // also highlight column
    $('.lit-columns div').eq(col).addClass('lit');
}

function destroyCursorChip() {
    $('.chips .cursor').remove();
    $('.lit-columns .lit').removeClass('lit');
}

function moveCursorChip(col, callback) {
    $('.chips .cursor').css('left', indexToPixels(col));
    $('.lit-columns .lit').removeClass('lit');
    $('.lit-columns div').eq(col).addClass('lit');

    // callback is only used when the computer is about to drop a chip
    // give it a slight delay for visual interest
    setTimeout(callback, 300);
}

function dropCursorChip(row, callback) {
    // speed of animation depends on how far the chip has to drop
    const ms = (7 - row) * 40;
    const duration = (ms / 1000) + 's';

    $('.chips .cursor')
        .removeClass('cursor')
        .css({
            'bottom': indexToPixels(row),
            'transition-duration': duration,
            'animation-delay': duration
        })
        .addClass('dropped');

    $('.lit-columns .lit').removeClass('lit');
    setTimeout(callback, ms);
}

function indexToPixels(index) {
    return (index * 61 + 1) + 'px';
}