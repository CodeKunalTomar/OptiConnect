# AI Testing Guide

## Overview
This guide explains how to test the AI improvements for the edge/corner blind spot fix.

## Quick Start

### Browser-Based Testing (Recommended)
1. Start a local web server:
   ```bash
   python3 -m http.server 8000
   # OR
   npx live-server
   ```

2. Open your browser to:
   ```
   http://localhost:8000/test-ai.html
   ```

3. Click "Run Tests" to execute all 13 test cases

4. Review results:
   - ✅ Green = Test passed
   - ❌ Red = Test failed

## Test Categories

### 1. Immediate Win Detection
- Tests that AI takes winning moves when available
- Covers horizontal and vertical wins
- Validates win priority over other moves

### 2. Immediate Block Detection
- Tests that AI blocks opponent's winning moves
- Covers horizontal and vertical blocks
- Validates blocking priority is high

### 3. Edge/Corner Threat Response (THE BUG FIX)
- Tests AI response to column 0 stacking
- Tests AI response to column 6 stacking
- Tests AI blocks 3-stacks on edges
- Validates the fix for the reported vulnerability

### 4. Double Threat Handling
- Tests AI creates double threats when possible
- Tests AI blocks opponent double threat setups
- Validates advanced tactical awareness

### 5. Win vs Block Priority
- Tests AI takes wins over blocks
- Validates priority ordering is correct

### 6. Strategic Opening
- Tests AI prefers center on empty board
- Tests AI contests center appropriately

## Manual Testing

You can also test manually by playing the game:

1. Open `index.html` in your browser
2. Select "VS AI" mode
3. Try to build a vertical stack on column 0 or 6
4. The AI should now contest these edges instead of ignoring them

### Test Scenario 1: Column 0 Stack
```
Turn 1: You play column 0
Turn 2: AI plays column 3 (center)
Turn 3: You play column 0 again
Turn 4: AI should now play column 0 or 1 (not just column 3!)
```

### Test Scenario 2: Column 6 Stack
```
Turn 1: You play column 6
Turn 2: AI plays column 3 (center)
Turn 3: You play column 6 again
Turn 4: AI should now play column 5 or 6 (not just column 3!)
```

## Expected Results

All 13 tests should pass:
- ✅ AI takes horizontal win
- ✅ AI takes vertical win
- ✅ AI blocks horizontal threat
- ✅ AI blocks vertical threat
- ✅ AI responds to column 0 stacking
- ✅ AI responds to column 6 stacking
- ✅ AI blocks corner 3-stack on column 0
- ✅ AI blocks corner 3-stack on column 6
- ✅ AI creates double threat
- ✅ AI blocks opponent double threat setup
- ✅ AI takes win over block
- ✅ AI prefers center on empty board
- ✅ AI contests center

## Troubleshooting

### Tests Don't Run
- Ensure you're using a local web server (not file://)
- Check browser console for errors
- Verify Connect-4.js and ai-tests.js are loaded

### Some Tests Fail
- This may indicate the AI needs deeper search
- Try increasing the depth parameter in the test (currently 10)
- Check that all code changes were applied correctly

### Manual Tests Show Different Behavior
- AI uses randomness when multiple moves have equal scores
- Try multiple games to see consistent patterns
- The AI should generally contest edges, not always the exact same column

## Performance Notes

- Each test runs a depth-10 search
- Full test suite takes 10-30 seconds
- Browser may appear frozen during testing (this is normal)
- Results are logged to console for debugging

## Validation

To verify all changes were applied correctly:
```bash
node validate-changes.js
```

This checks:
- Move ordering priorities
- Threat prevention function
- Edge threat detection
- Opening book expansion
- Test file existence
- Documentation updates
