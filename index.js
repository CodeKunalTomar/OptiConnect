// constants
const WEB_WORKER_URL = 'Connect-4.js';
const BLURBS = {
    'start': {
        header: 'Elite AI Challenge',
        blurb: 'Challenge the AI. Can you be among the 20% who win?'
    },
    'p1-turn': {
        header: 'Your Turn',
        blurb: 'Your move. The clock is ticking...'
    },
    'p2-turn': {
        header: 'AI\'s Turn',
        blurb: 'AI is calculating the optimal counter...'
    },
    'p1-win': {
        header: 'You Win!',
        blurb: 'Incredible! You\'ve defeated the AI! 🏆'
    },
    'p2-win': {
        header: 'AI Wins',
        blurb: 'The AI wins this round. Analyze and try again!'
    },
    'tie': {
        header: 'Draw',
        blurb: 'A draw! You held your ground against the AI.'
    },
    'timeout-player': {
        header: 'Time\'s Up!',
        blurb: 'Time\'s up! The AI wins by timeout.'
    },
    'timeout-ai': {
        header: 'You Win!',
        blurb: 'AI ran out of time! You win! 🏆'
    }
};
const OUTLOOKS = {
    'win-imminent': 'Uh oh, AI is feeling confident!',
    'loss-imminent': 'AI is unsure. Now\'s your chance!'
};

// Timer constants
const INITIAL_TIME = 300; // 5 minutes in seconds
const TIME_INCREMENT = 5; // 5 seconds increment
const WARNING_THRESHOLD = 30; // Show warning below 30 seconds

// global variables
const worker = new Worker(WEB_WORKER_URL);
let playerTime = INITIAL_TIME;
let aiTime = INITIAL_TIME;
let timerInterval = null;
let activeTimer = null; // 'player' or 'ai'
let gameInProgress = false;

// document ready
$(function() {
    $('.start-button').on('click', startGame);
    setBlurb('start');
    setOutlook();
    updateTimerDisplay();

    worker.addEventListener('message', function(e) {
        switch(e.data.messageType) {
            case 'reset-done':
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

// Timer functions
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
    const $playerTimer = $('#player-timer');
    const $aiTimer = $('#ai-timer');
    
    // Update timer values
    $playerTimer.find('.timer-value').text(formatTime(playerTime));
    $aiTimer.find('.timer-value').text(formatTime(aiTime));
    
    // Update active state
    $playerTimer.toggleClass('active', activeTimer === 'player');
    $aiTimer.toggleClass('active', activeTimer === 'ai');
    
    // Update warning state
    $playerTimer.toggleClass('warning', playerTime > 0 && playerTime < WARNING_THRESHOLD);
    $aiTimer.toggleClass('warning', aiTime > 0 && aiTime < WARNING_THRESHOLD);
}

function startTimer(who) {
    stopTimer();
    activeTimer = who;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        if (activeTimer === 'player') {
            playerTime--;
            if (playerTime <= 0) {
                playerTime = 0;
                stopTimer();
                endGame('timeout-player');
            }
        } else if (activeTimer === 'ai') {
            aiTime--;
            if (aiTime <= 0) {
                aiTime = 0;
                stopTimer();
                endGame('timeout-ai');
            }
        }
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    activeTimer = null;
    updateTimerDisplay();
}

function addIncrement(who) {
    if (who === 'player') {
        playerTime += TIME_INCREMENT;
    } else if (who === 'ai') {
        aiTime += TIME_INCREMENT;
    }
    updateTimerDisplay();
}
function setBlurb(key) {
    $('.info h2').text(BLURBS[key].header);
    $('.info .blurb').text(BLURBS[key].blurb);
}

function setOutlook(key) {
    const $outlook = $('.info .outlook');
    if(key) {
        $outlook
            .text(OUTLOOKS[key])
            .show();
    } else {
        $outlook.hide();
    }
}

function startGame() {
    // Reset timers
    playerTime = INITIAL_TIME;
    aiTime = INITIAL_TIME;
    stopTimer();
    updateTimerDisplay();
    
    $('.start-panel').addClass('freeze');
    $('.lit-cells, .chips').empty();
    gameInProgress = true;

    worker.postMessage({
        messageType: 'reset',
    });
}

function startHumanTurn() {
    setBlurb('p1-turn');
    $('.click-columns div').addClass('hover');
    
    // Start player timer
    startTimer('player');

    // if mouse is already over a column, show cursor chip there
    const col = $('.click-columns div:hover').index();
    if(col !== -1) {
        createCursorChip(1, col);
    }

    $('.click-columns')
        .on('mouseenter', function() {
            const col = $('.click-columns div:hover').index();
            createCursorChip(1, col);
        })
        .on('mouseleave', function() {
            destroyCursorChip();
        });

    $('.click-columns div')
        .on('mouseenter', function() {
            const col = $(this).index();
            moveCursorChip(col);
        })
        .on('click', function() {
            $('.click-columns, .click-columns div').off();

            const col = $(this).index();
            worker.postMessage({
                messageType: 'human-move',
                col: col
            });
        });
}

function endHumanTurn(coords, isWin, winningChips, isBoardFull) {
    $('.click-columns div').removeClass('hover');
    if(!coords) {
        // column was full, human goes again
        startHumanTurn();
    } else {
        // Stop player timer and add increment
        stopTimer();
        addIncrement('player');
        
        dropCursorChip(coords.row, function() {
            if(isWin) {
                endGame('p1-win', winningChips);
            } else if(isBoardFull) {
                endGame('tie');
            } else {
                // pass turn to computer
                startComputerTurn();
            }
        });
    }
}

function startComputerTurn() {
    setBlurb('p2-turn');

    // computer's cursor chip starts far left and moves right as it thinks
    createCursorChip(2, 0);
    
    // Start AI timer
    startTimer('ai');

    const maxDepth = 9; // Fixed high depth for elite AI (was user-selectable)
    worker.postMessage({
        messageType: 'computer-move',
        maxDepth: maxDepth
    });
}

function updateComputerTurn(col) {
    moveCursorChip(col);
}

function endComputerTurn(coords, isWin, winningChips, isBoardFull, isWinImminent, isLossImminent) {
    // Stop AI timer and add increment
    stopTimer();
    addIncrement('ai');
    
    moveCursorChip(coords.col, function() {
        dropCursorChip(coords.row, function() {
            if (isWin) {
                endGame('p2-win', winningChips);
            } else if (isBoardFull) {
                endGame('tie');
            } else {
                if(isWinImminent) {
                    setOutlook('win-imminent');
                } else if (isLossImminent) {
                    setOutlook('loss-imminent');
                } else {
                    setOutlook();
                }

                // pass turn to human
                startHumanTurn();
            }
        });
    });
}

function endGame(blurbKey, winningChips) {
    stopTimer();
    gameInProgress = false;
    
    $('.start-panel').removeClass('freeze');
    setBlurb(blurbKey);
    setOutlook();

    if(winningChips) {
        // not a tie, highlight the chips in the winning run
        for(let i = 0; i < winningChips.length; i++) {
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