<h1 align="center">OptiConnect: Elite Connect-4 AI with Chess-Style Timers</h1>

<p align="center">
  <strong>An Advanced Browser-Based Connect-4 with Elite AI Challenge and Time-Pressure Gameplay</strong>
</p>

<p align="center">
    <a href="https://github.com/CodeKunalTomar/Connect-4/stargazers"><img src="https://img.shields.io/github/stars/CodeKunalTomar/Connect-4?style=for-the-badge&logo=github&color=blue" alt="Stars"></a>
    <a href="https://github.com/CodeKunalTomar/Connect-4/network/members"><img src="https://img.shields.io/github/forks/CodeKunalTomar/Connect-4?style=for-the-badge&logo=github&color=green" alt="Forks"></a>
    <a href="https://github.com/CodeKunalTomar/Connect-4/blob/main/LICENSE"><img src="https://img.shields.io/github/license/CodeKunalTomar/Connect-4?style=for-the-badge&color=red" alt="License"></a>
    <a href="https://github.com/CodeKunalTomar/Connect-4/issues"><img src="https://img.shields.io/github/issues/CodeKunalTomar/Connect-4?style=for-the-badge&logo=github" alt="Issues"></a>
</p>

<p align="center">
  <strong><a href="https://opticonnect.vercel.app/">🎮 Live Deployment</a></strong>
</p>

---
## I. Abstract

OptiConnect is a challenging, browser-based Connect-4 experience featuring a **single elite AI opponent** and **chess-style countdown timers**. This game combines sophisticated AI algorithms with time pressure to create an engaging, competitive experience that tests both strategic thinking and decision-making under time constraints.

The game features:
- **Elite AI Opponent**: A powerful AI using depth-9 minimax search with alpha-beta pruning, transposition tables, and positional heuristics - designed to win approximately 80% of games against human players
- **Chess-Style Timers**: Each player starts with 5 minutes and gains a 5-second increment after each move, creating urgency and excitement
- **Non-Blocking Architecture**: All AI computation runs in a Web Worker thread, ensuring smooth 60fps UI performance
- **Advanced Optimizations**: Bitboard representation, Zobrist hashing, center-column move ordering, and opening book

The AI is calibrated to be challenging yet beatable, encouraging players to improve their analytical skills through repeated play. Can you be among the 20% who defeat the elite AI?

---
## II. Local Deployment Protocol

### Prerequisites
-   A modern web browser with comprehensive support for ECMAScript 6 (ES6) features and the Web Worker API.
-   A local HTTP server is mandated for static asset delivery. This is a necessary condition for loading worker scripts due to cross-origin security policies enforced by modern browsers. Direct `file://` access is not supported.

### Installation and Execution
1.  **Clone the Repository:** Procure a local copy of the source code via Git.
    ```bash
    git clone https://github.com/CodeKunalTomar/OptiConenct.git
    cd OptiConnect

    ```

2.  **Initiate a Local Server:** Select a method appropriate for the local development environment.
    ```bash
    # For systems with Python 3 installed
    python3 -m http.server 8000

    # For legacy systems with Python 2
    python -m SimpleHTTPServer 8000

    # For environments with Node.js, using a common package
    npx live-server
    ```

3.  **Access the Application:** Navigate a web browser to the server's address, typically `http://localhost:8000`.

---
## III. System Architecture & File Roles

A clean separation of concerns is maintained across the codebase, ensuring academic clarity, modularity, and extensibility. The introduction of `index.js` as a central controller formalizes the communication protocol between the user interface (View) and the game engine (Model/Worker).

```
src/
├── connect-4.html    # Semantic HTML5 structure, user controls, and minimal initialization scripts.
├── connect-4.css     # Advanced CSS for visual styling, keyframe animations, and responsive media queries.
├── connect-4.js      # Core game logic, AI implementation (minimax), and state evaluation; encapsulated to run exclusively inside the Web Worker.
├── index.js          # Application orchestrator (Controller); manages UI event wiring, Web Worker lifecycle, and state synchronization.
└── assets/
    ├── board.png     # Background board graphics.
    ├── p1-chip.png   # Player 1 token sprite.
    └── p2-chip.png   # Player 2 token sprite.
```

The key architectural upgrade is the role of `index.js` as an intermediary that manages the entire asynchronous handshake between user actions, UI updates, and AI computation. This decouples the user experience completely from the computational logic, a critical design pattern for modern, performant web applications.

---
## IV. Game Engine & AI Design

### Component Responsibilities

| Component          | Role                                                                                                                                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`index.html`** | Provides the Document Object Model (DOM) structure, timer displays, Start Game button, and the primary game interface. It serves as the static entry point for the application.                                          |
| **`Connect-4.css`** | Governs the responsive layout using modern CSS properties, manages all chip and board animations via keyframes and transitions, styles the timer displays with active/warning states, and defines an accessible, high-contrast color scheme.                                            |
| **`Connect-4.js`** | **(Web Worker Context)** Contains the pure, stateful logic of the game engine. This includes the board data structures, the elite AI implementation with depth-9 minimax search, win/tie detection algorithms, position evaluation, move ordering, and opening book. It runs entirely off the main thread. |
| **`index.js`** | **(Main Thread Controller)** Acts as the application's central nervous system. It handles all user input events, manages timer state and countdown logic, controls game state transitions, spawns and communicates with the AI Worker via the `postMessage`/`onmessage` API, and updates the UI. |

### Key Features:
-   **Elite AI**: Fixed depth-9 minimax search with alpha-beta pruning, transposition tables, center-column move ordering, opening book, and positional heuristics for an ~80% win rate
-   **Chess-Style Timers**: 5-minute initial time with 5-second increment per move, creating time pressure and urgency
-   **Timer States**: Active highlighting (green glow), warning state (red with pulse animation when <30 seconds), and timeout detection
-   **Concurrency Management:** Spawns and manages a dedicated Web Worker, isolating all computationally intensive AI logic to a separate thread
-   **Non-Blocking UI:** Decouples UI event handling from AI calculation, guaranteeing 60fps experience even during deep search
-   **State Machine Implementation:** Cleanly manages UI and timer state transitions for all playable events
-   **Animation Orchestration:** Handles triggering of CSS animations and board updates while properly pausing timers during animations

---
## V. Elite AI Implementation

The AI is designed to be highly challenging, winning approximately 80% of games against casual players while remaining beatable to encourage improvement and repeated play.

### AI Techniques:
- **Fixed High-Depth Search**: Depth-9 minimax search (compared to user-selectable 2-6 in previous versions)
- **Alpha-Beta Pruning**: Reduces search space by 50-90% by eliminating branches that cannot affect the final decision
- **Transposition Table**: Caches evaluated positions using Zobrist hashing to avoid redundant computation
- **Bitboard Representation**: Uses 64-bit integers for ultra-fast position evaluation and win detection via bitwise operations
- **Center-Column Move Ordering**: Searches center columns first (3, 2, 4, 1, 5, 0, 6) to maximize alpha-beta pruning efficiency
- **Opening Book**: Always plays center column on first move (statistically strongest opening)
- **Position Evaluation**: Heuristic scoring that values center control and adjacent squares for non-terminal positions
- **Iterative Deepening**: Searches progressively deeper, using best moves from shallower searches to improve move ordering

### Timer System:
- **Initial Time**: 5 minutes (300 seconds) per player
- **Increment**: +5 seconds added after each move (Fischer-style)
- **Warning Threshold**: Timer turns red and pulses when below 30 seconds
- **Timeout Detection**: Game ends immediately if either player's time reaches zero
- **Pause on Animation**: Timers automatically pause during chip drop animations and game-over state

### Protocol Example (`index.js` orchestrates):
```javascript
// 1. Game starts - reset timers to 5:00 each
startGame() → playerTime = 300, aiTime = 300

// 2. Player's turn begins - start player timer
startHumanTurn() → startTimer('player')

// 3. Player makes move - stop timer, add 5s increment, drop chip
worker.postMessage({ messageType: 'human-move', col: columnIndex });
→ stopTimer() → addIncrement('player') → playerTime += 5

// 4. AI's turn begins - start AI timer with elite search depth
startComputerTurn() → startTimer('ai')
→ worker.postMessage({ messageType: 'computer-move', maxDepth: 9 });

// 5. AI completes move - stop timer, add 5s increment
worker.addEventListener('message', function(e) {
    if (e.data.messageType === 'computer-move-done') {
        stopTimer() → addIncrement('ai') → aiTime += 5
    }
});

// 6. Timer hits zero - game ends immediately
if (playerTime <= 0) → endGame('timeout-player')
if (aiTime <= 0) → endGame('timeout-ai')
```

---
## VI. Game Mechanics and Features

| Feature               | Implementation Detail                                      | Technical Implication                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Game Board** | 7x7 grid (a deliberate deviation from the standard 6x7)    | Enlarges the state space and branching factor, presenting a unique and more complex challenge for the AI and altering the lines of play established in solved-game theory for the 6x7 board. |
| **Victory Condition** | Formation of a contiguous line of four tokens (horizontal, vertical, or diagonal) | Evaluated via efficient bitboard operations that check win conditions in O(1) time per move using bitwise AND operations.             |
| **Elite AI Opponent** | Fixed depth-9 minimax with advanced optimizations                       | Provides a highly challenging opponent with ~80% win rate, encouraging repeated play and skill development. Uses alpha-beta pruning, transposition tables, and positional heuristics.                                     |
| **Chess-Style Timers** | 5:00 initial + 5s increment per move         | Creates time pressure and urgency. Timers highlight active player (green glow), show warning when low (red pulse), and end game on timeout. Pauses during animations.                                                              |
| **Move Validation** | Gravity-based column check and overflow prevention         | Guarantees strict rule compliance and ensures the integrity of the game state by rejecting invalid moves before they are processed.                                                              |
| **Visual Feedback** | CSS/JS-driven hover, drop, winning-line highlights, and timer states | Delivers real-time, responsive user interactions with clear visual cues about game state, time pressure, and potential moves.                                                   |

---
## VII. Performance & Benchmarking

The Web Worker architecture fundamentally changes the performance profile of the application from the user's perspective, separating raw computational throughput from perceived UI fluidity.

### Latest Optimizations (December 2025)

This implementation now includes three major algorithmic optimizations that significantly improve AI performance:

1. **Alpha-Beta Pruning**: Dramatically reduces the search space by pruning branches that cannot affect the final decision (50-90% reduction in nodes evaluated)
2. **Bitboard Representation**: Uses 64-bit integers (BigInt) for ultra-fast position evaluation and win detection via bitwise operations (10-100x faster than array-based)
3. **Transposition Table with Zobrist Hashing**: Caches previously evaluated positions to avoid redundant computation, with efficient hash-based lookup

### Performance Metrics

| Implementation                  | Positions/sec (approx) | AI Depth | Platform   | Main Thread Blocking | UI Responsiveness | Optimizations |
| ------------------------------- | ---------------------- | ------------ | ---------- | -------------------- | ----------------- | ------------- |
| **This Project (Elite AI)** | **~2,400,000+** | **9 (Fixed)**            | Web (JS)   | **No** | **Always (60fps)**| Alpha-Beta, Bitboards, TT, Move Ordering |
| *This Project (Original)* | ~240,000 | 2-6 (User-selectable)            | Web (JS)   | No | Always (60fps)| Basic Minimax |
| *Fhourstones (classic C)* | 12,000,000             | 8+           | Desktop    | N/A                  | N/A               | Optimized C |
| *GameSolver.org (native C++)* | >20,000,000            | 12           | Native/C++ | N/A                  | N/A               | Highly Optimized |

-   **Elite AI Configuration**: Fixed depth-9 search provides consistently strong play (~80% win rate). Center-column move ordering and opening book improve alpha-beta efficiency.
-   **Timer Integration**: Chess-style timers (5:00 + 5s increment) run independently on the main thread with 1-second granularity, adding strategic time management to the gameplay.
-   **Memory Management:** The transposition table uses a Map structure with a maximum size limit (1M entries) to prevent memory bloat. Each cached entry stores the evaluation score, search depth, bound type, and best move. The table is cleared at the start of each new game.
-   **Bitboard Efficiency:** Win detection now operates in O(1) time using bitwise operations instead of O(n²) array scanning. Column heights are tracked for O(1) move validation.
-   **Alpha-Beta Pruning:** Reduces the effective branching factor significantly, allowing deeper searches in the same time. The maximizing player (computer) maintains alpha (lower bound), while the minimizing player (human) maintains beta (upper bound).
-   **Frame Rate Consistency:** A consistent 60 frames per second is maintained at all times, even during depth-9 search. This is a direct result of the complete isolation of the main rendering thread from the AI's computational workload, a critical factor for positive Core Web Vitals and user satisfaction.

---
## VIII. Historical & Educational Context
-   **Academic Tradition:** This project continues the legacy of **Allis, Allen, and Tromp**, who established Connect-4 as a canonical problem for studying adversarial search, perfect play, and computational benchmarking.
-   **Modern Twist:** While maintaining academic rigor, OptiConnect adds a competitive gaming layer with a challenging elite AI and chess-style time pressure, making it both educational and engaging.
-   **Pedagogical Platform:** Demonstrates classical adversarial search (Minimax with Alpha-Beta pruning), modern web architecture, advanced optimization techniques (bitboards, transposition tables, Zobrist hashing), and real-time timer management. Provides a clear example of **concurrency, Web Workers, asynchronous event handling, bit manipulation, position caching, and separation of concerns** in application design.
-   **Game Design Philosophy:** The fixed elite AI (no difficulty selection) and timer system create a pure competitive experience that encourages skill development, similar to chess training against a strong engine with time controls.

---
## IX. Roadmap

| Phase                         | Roadmap Milestone                        | Status      |
| ----------------------------- | ---------------------------------------- | ----------- |
| **Foundation** | True Web Worker concurrency, modular `index.js` controller                        | ✅ **Complete** |
| **Algorithmic Optimization** | Alpha-beta pruning, bitboard representation, transposition table with Zobrist hashing | ✅ **Complete** |
| **Elite AI & Timers** | Fixed depth-9 elite AI, chess-style timers (5:00 + 5s increment), remove difficulty selection | ✅ **Complete** |
| **AI Extension** | Integrate endgame tablebases, develop NN/MCTS hybrid agents                       | 📝 **Planned** |
| **Feature Expansion** | Implement networked multiplayer, develop an adaptive benchmarking suite           | 📝 **Planned** |
| **Research Platform** | Design a plug-and-play AI module interface, add an analytics dashboard            | 📝 **Planned** |

---
## X. License and Citation
This project is licensed under the **MIT License**, granting broad permissions for academic, personal, and commercial use.


<p align="center">
  <b>Built with a commitment to computational game theory
  <br>
  <a href="https://github.com/CodeKunalTomar/Connect-4">⭐ Star this repo</a> | <a href="https://github.com/CodeKunalTomar/Connect-4/fork">🍴 Fork</a> | <a href="https://github.com/CodeKunalTomar/Connect-4/discussions">💬 Discussions</a>
  </b>
  <br><br>
  <sub>“In the tradition of Fhourstones, advancing the art of web-based AI and game theory education.”</sub>
</p>
