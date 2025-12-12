// AI Test Suite for Connect-4
const AI_TESTS = [
    // Immediate Win Detection
    {
        name: "AI takes horizontal win",
        setup: [
            { player: 2, col: 2 }, { player: 1, col: 0 },
            { player: 2, col: 3 }, { player: 1, col: 0 },
            { player: 2, col: 4 }, { player: 1, col: 0 },
        ],
        expectedMoves: [1, 5],
        mustWin: true
    },
    {
        name: "AI takes vertical win",
        setup: [
            { player: 2, col: 3 }, { player: 1, col: 0 },
            { player: 2, col: 3 }, { player: 1, col: 0 },
            { player: 2, col: 3 }, { player: 1, col: 0 },
        ],
        expectedMove: 3,
        mustWin: true
    },
    
    // Immediate Block Detection
    {
        name: "AI blocks horizontal threat",
        setup: [
            { player: 1, col: 2 }, { player: 2, col: 3 },
            { player: 1, col: 4 }, { player: 2, col: 3 },
            { player: 1, col: 5 }, { player: 2, col: 3 },
        ],
        expectedMoves: [1, 6],
        mustBlock: true
    },
    {
        name: "AI blocks vertical threat",
        setup: [
            { player: 1, col: 0 }, { player: 2, col: 3 },
            { player: 1, col: 0 }, { player: 2, col: 3 },
            { player: 1, col: 0 }, { player: 2, col: 4 },
        ],
        expectedMove: 0,
        mustBlock: true
    },
    
    // Edge/Corner Threat Detection (THE BUG FIX)
    {
        name: "AI responds to column 0 stacking",
        setup: [
            { player: 1, col: 0 }, { player: 2, col: 3 },
            { player: 1, col: 0 },
        ],
        forbiddenMoves: [3],
        shouldConsider: [0, 1],
        description: "AI was ignoring corner builds"
    },
    {
        name: "AI responds to column 6 stacking",
        setup: [
            { player: 1, col: 6 }, { player: 2, col: 3 },
            { player: 1, col: 6 },
        ],
        forbiddenMoves: [3],
        shouldConsider: [5, 6],
    },
    {
        name: "AI blocks corner 3-stack on column 0",
        setup: [
            { player: 1, col: 0 }, { player: 2, col: 3 },
            { player: 1, col: 0 }, { player: 2, col: 3 },
            { player: 1, col: 0 },
        ],
        expectedMove: 0,
        mustBlock: true
    },
    {
        name: "AI blocks corner 3-stack on column 6",
        setup: [
            { player: 1, col: 6 }, { player: 2, col: 3 },
            { player: 1, col: 6 }, { player: 2, col: 3 },
            { player: 1, col: 6 },
        ],
        expectedMove: 6,
        mustBlock: true
    },
    
    // Double Threat Handling
    {
        name: "AI creates double threat",
        setup: [
            { player: 2, col: 2 }, { player: 1, col: 0 },
            { player: 2, col: 4 }, { player: 1, col: 0 },
        ],
        expectedMove: 3,
        shouldCreateDoubleThreat: true
    },
    {
        name: "AI blocks opponent double threat setup",
        setup: [
            { player: 1, col: 2 }, { player: 2, col: 0 },
            { player: 1, col: 4 }, { player: 2, col: 0 },
        ],
        expectedMove: 3,
        mustBlock: true
    },
    
    // Win vs Block Priority
    {
        name: "AI takes win over block",
        setup: [
            { player: 2, col: 2 }, { player: 1, col: 5 },
            { player: 2, col: 3 }, { player: 1, col: 5 },
            { player: 2, col: 4 }, { player: 1, col: 5 },
        ],
        expectedMoves: [1, 5],
        mustWin: true,
        description: "AI should take the win, not block"
    },
    
    // Strategic Opening
    {
        name: "AI prefers center on empty board",
        setup: [],
        expectedMove: 3,
    },
    {
        name: "AI contests center",
        setup: [{ player: 1, col: 3 }],
        shouldConsider: [2, 3, 4],
    },
    
    // Center Column Vertical Threat Detection (Bug from screenshot)
    {
        name: "AI blocks column 4 (center-adjacent) vertical stack",
        setup: [
            { player: 1, col: 4 }, { player: 2, col: 3 },
            { player: 1, col: 4 }, { player: 2, col: 3 },
            { player: 1, col: 4 },
        ],
        expectedMove: 4,
        mustBlock: true,
        description: "AI must detect and block vertical threat on column 4 (center-adjacent column). This tests the fix for blind spots on non-edge columns."
    },
    {
        name: "AI blocks column 3 (center) vertical stack",
        setup: [
            { player: 1, col: 3 }, { player: 2, col: 2 },
            { player: 1, col: 3 }, { player: 2, col: 2 },
            { player: 1, col: 3 },
        ],
        expectedMove: 3,
        mustBlock: true,
        description: "AI must block vertical threat on center column"
    },
    {
        name: "AI blocks column 2 vertical stack",
        setup: [
            { player: 1, col: 2 }, { player: 2, col: 3 },
            { player: 1, col: 2 }, { player: 2, col: 3 },
            { player: 1, col: 2 },
        ],
        expectedMove: 2,
        mustBlock: true,
        description: "AI must block vertical threat on column 2"
    },
];

// Test runner
function runAITests() {
    console.log("=== AI Test Suite ===\n");
    let passed = 0, failed = 0;
    
    for (const test of AI_TESTS) {
        // Reset and setup
        currentGameState = new GameState();
        transpositionTable.clear();
        clearHeuristics();
        
        for (const move of test.setup || []) {
            currentGameState.makeMove(move.player, move.col);
        }
        
        // Get AI move
        const origin = new GameState(currentGameState);
        const aiMove = think(origin, 2, 10, true, -Infinity, Infinity);
        
        // Validate
        let pass = true;
        let reason = "";
        
        if (test.expectedMove !== undefined && aiMove !== test.expectedMove) {
            pass = false;
            reason = `Expected ${test.expectedMove}, got ${aiMove}`;
        }
        if (test.expectedMoves && !test.expectedMoves.includes(aiMove)) {
            pass = false;
            reason = `Expected one of ${test.expectedMoves}, got ${aiMove}`;
        }
        if (test.forbiddenMoves && test.forbiddenMoves.includes(aiMove)) {
            pass = false;
            reason = `Move ${aiMove} was forbidden`;
        }
        if (test.shouldConsider && !test.shouldConsider.includes(aiMove)) {
            pass = false;
            reason = `Expected to consider ${test.shouldConsider}, got ${aiMove}`;
        }
        
        if (pass) {
            console.log(`✅ ${test.name}`);
            passed++;
        } else {
            console.log(`❌ ${test.name}: ${reason}`);
            failed++;
        }
    }
    
    console.log(`\n=== ${passed}/${passed + failed} passed ===`);
    return { passed, failed, total: passed + failed };
}

// Export for use
if (typeof module !== 'undefined') {
    module.exports = { AI_TESTS, runAITests };
}
