// constants
const WEB_WORKER_URL = 'Connect-4.js';
const BLURBS = {
    'start-ai': {
        header: 'Ultimate AI Challenge',
        blurb: 'Face the ultimate challenge. Only 2-3% of players ever win.'
    },
    'start-2player': {
        header: 'Two Player Mode',
        blurb: 'Two minds, one board. May the best strategist win!'
    },
    'p1-turn': {
        header: 'Your Turn',
        blurb: 'Choose wisely. The AI sees 20 moves ahead.'
    },
    'p1-turn-2player': {
        header: 'Player 1\'s Turn',
        blurb: 'Your move. Clock is ticking...'
    },
    'p2-turn': {
        header: 'AI\'s Turn',
        blurb: 'Analyzing millions of positions...'
    },
    'p2-turn-2player': {
        header: 'Player 2\'s Turn',
        blurb: 'Your move. Clock is ticking...'
    },
    'p1-win': {
        header: 'You Win!',
        blurb: '🏆 LEGENDARY! You\'ve achieved the near-impossible! You\'re in the elite 2-3%!'
    },
    'p1-win-2player': {
        header: 'Player 1 Wins!',
        blurb: '🏆 Player 1 wins!'
    },
    'p2-win': {
        header: 'AI Wins',
        blurb: 'The AI wins. Study the game, find the patterns, try again.'
    },
    'p2-win-2player': {
        header: 'Player 2 Wins!',
        blurb: '🏆 Player 2 wins!'
    },
    'tie': {
        header: 'Draw',
        blurb: 'A draw against this AI is a remarkable achievement!'
    },
    'timeout-p1-ai': {
        header: 'Time\'s Up!',
        blurb: '⏱️ Time\'s up! The pressure was too much.'
    },
    'timeout-p2-ai': {
        header: 'Time\'s Up!',
        blurb: '⏱️ Time\'s up! AI ran out of time. You win!'
    },
    'timeout-p1-2player': {
        header: 'Time\'s Up!',
        blurb: '⏱️ Time\'s up! Player 1 ran out of time.'
    },
    'timeout-p2-2player': {
        header: 'Time\'s Up!',
        blurb: '⏱️ Time\'s up! Player 2 ran out of time.'
    }
};
const OUTLOOKS = {
    'win-imminent': 'Uh oh, AI is feeling confident!',
    'loss-imminent': 'AI is unsure. Now\'s your chance!'
};

// Timer constants
const TOTAL_TIME = 15; // 15 seconds per move
const WARNING_TIME = 8; // Yellow/orange warning
const CRITICAL_TIME = 5; // Red critical warning

// global variables
const worker = new Worker(WEB_WORKER_URL);
let player1Time = TOTAL_TIME;
let player2Time = TOTAL_TIME;
let timerInterval = null;
let activeTimer = null; // 1, 2, or null
let gameInProgress = false;
let gameMode = 'ai'; // 'ai' or '2player'

// document ready
$(function() {
    // Initialize theme first
    initTheme();
    
    // Theme toggle handler
    $('.theme-toggle').on('click', toggleTheme);
    
    // How to Play modal handlers
    $('.how-to-play-btn').on('click', function() {
        openModal('how-to-play-modal');
    });
    
    $('.modal-close, .modal-overlay').on('click', function(e) {
        if (e.target === this) {
            closeModal('how-to-play-modal');
        }
    });
    
    // Mode selection handlers
    $('.mode-btn').on('click', function() {
        $('.mode-btn').removeClass('selected');
        $(this).addClass('selected');
        gameMode = $(this).data('mode');
        updateStartBlurb();
    });
    
    $('.start-button').on('click', startGame);
    updateStartBlurb();
    updateTimerDisplay();

    worker.addEventListener('message', function(e) {
        switch(e.data.messageType) {
            case 'reset-done':
                startHumanTurn();
                break;
            case 'human-move-done':
                endHumanTurn(e.data.coords, e.data.isWin, e.data.winningChips, e.data.isBoardFull);
                break;
            case 'player2-move-done':
                endPlayer2Turn(e.data.coords, e.data.isWin, e.data.winningChips, e.data.isBoardFull);
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

function updateStartBlurb() {
    if (gameMode === 'ai') {
        setBlurb('start-ai');
    } else {
        setBlurb('start-2player');
    }
}

// Timer functions
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
    const $player1Timer = $('.timer-p1');
    const $player2Timer = $('.timer-p2');
    
    // Update labels based on game mode
    if (gameMode === 'ai') {
        $player1Timer.find('.timer-label').text('YOU');
        $player2Timer.find('.timer-label').text('AI');
    } else {
        $player1Timer.find('.timer-label').text('PLAYER 1');
        $player2Timer.find('.timer-label').text('PLAYER 2');
    }
    
    // Update timer values
    $player1Timer.find('.timer-value').text(formatTime(player1Time));
    $player2Timer.find('.timer-value').text(formatTime(player2Time));
    
    // Update active state
    $player1Timer.toggleClass('active', activeTimer === 1);
    $player2Timer.toggleClass('active', activeTimer === 2);
    
    // Update warning and critical states for Player 1
    $player1Timer.removeClass('warning critical');
    if (player1Time > 0 && player1Time <= CRITICAL_TIME) {
        $player1Timer.addClass('critical');
    } else if (player1Time > 0 && player1Time <= WARNING_TIME) {
        $player1Timer.addClass('warning');
    }
    
    // Update warning and critical states for Player 2
    $player2Timer.removeClass('warning critical');
    if (player2Time > 0 && player2Time <= CRITICAL_TIME) {
        $player2Timer.addClass('critical');
    } else if (player2Time > 0 && player2Time <= WARNING_TIME) {
        $player2Timer.addClass('warning');
    }
}

function startTimer(player) {
    stopTimer();
    activeTimer = player;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        if (activeTimer === 1) {
            player1Time--;
            if (player1Time <= 0) {
                player1Time = 0;
                stopTimer();
                const timeoutKey = gameMode === 'ai' ? 'timeout-p1-ai' : 'timeout-p1-2player';
                endGame(timeoutKey);
                return;
            }
        } else if (activeTimer === 2) {
            player2Time--;
            if (player2Time <= 0) {
                player2Time = 0;
                stopTimer();
                const timeoutKey = gameMode === 'ai' ? 'timeout-p2-ai' : 'timeout-p2-2player';
                endGame(timeoutKey);
                return;
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

function resetTimers() {
    stopTimer();
    player1Time = TOTAL_TIME;
    player2Time = TOTAL_TIME;
    activeTimer = null;
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
    resetTimers();
    
    // Show timer panel, hide setup panel
    $('.timer-panel').show();
    $('.setup-panel').hide();
    
    $('.start-panel').addClass('freeze');
    $('.lit-cells, .chips').empty();
    gameInProgress = true;

    worker.postMessage({
        messageType: 'reset',
    });
}

function startHumanTurn() {
    if (gameMode === 'ai') {
        setBlurb('p1-turn');
    } else {
        setBlurb('p1-turn-2player');
    }
    $('.click-columns div').addClass('hover');
    
    // Start player 1 timer
    startTimer(1);

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
        // Stop player 1 timer (no increment in cumulative timer mode)
        stopTimer();
        
        dropCursorChip(coords.row, function() {
            if(isWin) {
                if (gameMode === 'ai') {
                    endGame('p1-win', winningChips);
                } else {
                    endGame('p1-win-2player', winningChips);
                }
            } else if(isBoardFull) {
                endGame('tie');
            } else {
                // pass turn to player 2 or computer
                if (gameMode === 'ai') {
                    startComputerTurn();
                } else {
                    startPlayer2Turn();
                }
            }
        });
    }
}

function startComputerTurn() {
    setBlurb('p2-turn');

    // computer's cursor chip starts far left and moves right as it thinks
    createCursorChip(2, 0);
    
    // Start AI timer
    startTimer(2);

    const maxDepth = 15; // Increased depth for near-perfect AI (was 9)
    worker.postMessage({
        messageType: 'computer-move',
        maxDepth: maxDepth
    });
}

function updateComputerTurn(col) {
    moveCursorChip(col);
}

function endComputerTurn(coords, isWin, winningChips, isBoardFull, isWinImminent, isLossImminent) {
    // Stop AI timer (no increment in cumulative timer mode)
    stopTimer();
    
    moveCursorChip(coords.col, function() {
        dropCursorChip(coords.row, function() {
            if (isWin) {
                // In Two-Player mode, use two-player win message; in AI mode, use AI win message
                const winKey = gameMode === '2player' ? 'p2-win-2player' : 'p2-win';
                endGame(winKey, winningChips);
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

function startPlayer2Turn() {
    setBlurb('p2-turn-2player');
    $('.click-columns div').addClass('hover');
    
    // Start player 2 timer
    startTimer(2);

    // if mouse is already over a column, show cursor chip there
    const col = $('.click-columns div:hover').index();
    if(col !== -1) {
        createCursorChip(2, col);
    }

    $('.click-columns')
        .on('mouseenter', function() {
            const col = $('.click-columns div:hover').index();
            createCursorChip(2, col);
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
                messageType: 'player2-move',
                col: col
            });
        });
}

function endPlayer2Turn(coords, isWin, winningChips, isBoardFull) {
    $('.click-columns div').removeClass('hover');
    if(!coords) {
        // column was full, player 2 goes again
        startPlayer2Turn();
    } else {
        // Stop player 2 timer (no increment in cumulative timer mode)
        stopTimer();
        
        dropCursorChip(coords.row, function() {
            if(isWin) {
                endGame('p2-win-2player', winningChips);
            } else if(isBoardFull) {
                endGame('tie');
            } else {
                // pass turn back to player 1
                startHumanTurn();
            }
        });
    }
}

function endGame(blurbKey, winningChips) {
    stopTimer();
    gameInProgress = false;
    
    // Show setup panel again, hide timer panel
    $('.timer-panel').hide();
    $('.setup-panel').show();
    
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

// Theme functions
function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeButton(theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeButton(next);
}

function updateThemeButton(theme) {
    const button = $('.theme-toggle');
    if (button.length) {
        button.text(theme === 'dark' ? '☀️' : '🌙');
    }
}

// Modal functions
function openModal(modalId) {
    $('#' + modalId).css('display', 'flex').hide().fadeIn(300);
}

function closeModal(modalId) {
    $('#' + modalId).fadeOut(300);
}