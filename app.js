document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');

  // Score tracking: keeps running totals for the session
  const score = { X: 0, O: 0, draws: 0 };

  // ----------------------
  // UI elements (created dynamically)
  // ----------------------
  // Scoreboard: shows X / Draws / O counts
  const scoreboard = document.createElement('div');
  scoreboard.className = 'scoreboard';
  scoreboard.innerHTML = `
    <div class="scoreboard__item">
      <span class="scoreboard__label">Player X</span>
      <span class="scoreboard__value" id="score-x">0</span>
    </div>
    <div class="scoreboard__item">
      <span class="scoreboard__label">Draws</span>
      <span class="scoreboard__value" id="score-draws">0</span>
    </div>
    <div class="scoreboard__item">
      <span class="scoreboard__label">Player O</span>
      <span class="scoreboard__value" id="score-o">0</span>
    </div>
  `;

  // Result banner: prominent announcement area (wins/draws)
  const resultBanner = document.createElement('div');
  resultBanner.className = 'result-banner';
  resultBanner.setAttribute('aria-live', 'assertive');
  resultBanner.style.display = 'none';

  // Status element: small text showing who moves next (polite for screen readers)
  const statusEl = document.createElement('div');
  statusEl.className = 'status';
  statusEl.setAttribute('aria-live', 'polite');

  // Board container (cells are appended here)
  const board = document.createElement('div');
  board.className = 'board';

  // ----------------------
  // Game state
  // ----------------------
  // `cells` is the authoritative model of the board: null / 'X' / 'O'
  const cells = Array(9).fill(null);
  let currentPlayer = 'X';           // who's turn it is
  let finished = false;             // whether the game has ended
  let isProcessing = false;         // prevents rapid/concurrent moves

  // Predefined winning combinations (indices into `cells`)
  const wins = [
    [0,1,2],[3,4,5],[6,7,8], // rows
    [0,3,6],[1,4,7],[2,5,8], // cols
    [0,4,8],[2,4,6]          // diagonals
  ];

  /**
   * checkWin()
   * - Reads `cells` and returns a result object when the game is over:
   *   - { winner: 'X'|'O', combo: [i,j,k] } when a player has won
   *   - { draw: true } when the board is full with no winner
   *   - null when the game should continue
   */
  function checkWin() {
    for (const combo of wins) {
      const [a,b,c] = combo;
      if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
        return { winner: cells[a], combo };
      }
    }
    if (cells.every(Boolean)) return { draw: true };
    return null;
  }

  /**
   * setCellsDisabled(disabled)
   * - Utility to enable/disable all board buttons. Used when the game ends.
   */
  function setCellsDisabled(disabled) {
    const all = board.querySelectorAll('.cell');
    all.forEach(el => { el.disabled = disabled; });
  }

  /**
   * updateScore()
   * - Pushes the `score` object values into the scoreboard DOM.
   */
  function updateScore() {
    document.getElementById('score-x').textContent = score.X;
    document.getElementById('score-o').textContent = score.O;
    document.getElementById('score-draws').textContent = score.draws;
  }

  /**
   * updateStatus()
   * - Updates the small status text while a game is active. If the game
   *   finished, this function is intentionally a no-op (banner shows result).
   */
  function updateStatus() {
    if (finished) return;
    statusEl.textContent = `Player ${currentPlayer} to move`;
  }

  /**
   * showResult(message, type)
   * - Shows the large result banner and hides the small `statusEl` to avoid
   *   duplicate messages. `type` controls banner styling (win/draw).
   */
  function showResult(message, type = 'win') {
    resultBanner.textContent = message;
    resultBanner.className = `result-banner result-banner--${type}`;
    resultBanner.style.display = 'block';
    // Hide the smaller status text to avoid duplicate messages
    if (statusEl) statusEl.style.display = 'none';
  }

  /**
   * hideResult()
   * - Hides the banner and restores the status element (used on Reset).
   */
  function hideResult() {
    resultBanner.style.display = 'none';
    if (statusEl) {
      statusEl.style.display = '';
      updateStatus();
    }
  }

  /**
   * showInvalidFeedback(cell, reason)
   * - Brief visual + console feedback for invalid move attempts (occupied
   *   cell, game finished, or concurrent click). The visual feedback uses
   *   `.cell--invalid` which triggers a CSS shake animation.
   */
  function showInvalidFeedback(cell, reason) {
    cell.classList.add('cell--invalid');
    setTimeout(() => cell.classList.remove('cell--invalid'), 300);
    console.warn(`Invalid move: ${reason} — Cell ${cell.getAttribute('data-index')} (attempted by ${currentPlayer})`);
  }

  /**
   * validateMove(idx)
   * - Centralizes checks prior to applying a move:
   *   - prevents rapid double-clicks using `isProcessing`
   *   - rejects moves when `finished` is true
   *   - rejects moves to occupied cells
   * - Returns true when it's safe to proceed.
   */
  function validateMove(idx) {
    const cell = board.querySelector(`[data-index='${idx}']`);
    if (isProcessing) {
      showInvalidFeedback(cell, 'move already processing');
      return false;
    }
    if (finished) {
      showInvalidFeedback(cell, 'game finished');
      console.log('Game finished — click Reset to play again');
      return false;
    }
    if (cells[idx] !== null) {
      showInvalidFeedback(cell, `cell already occupied by ${cells[idx]}`);
      return false;
    }
    return true;
  }

  // ----------------------
  // Build the 3x3 board and attach click handlers
  // ----------------------
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('button');
    cell.className = 'cell';
    cell.type = 'button';
    cell.setAttribute('data-index', i);

    /* Cell click handler:
       - validateMove ensures this click is allowed
       - update `cells` model and UI
       - run win/draw detection
       - update score/banner/status or switch player
    */
    cell.addEventListener('click', () => {
      if (!validateMove(Number(cell.getAttribute('data-index')))) return;

      isProcessing = true; // block concurrent moves
      const idx = Number(cell.getAttribute('data-index'));

      // Update model + UI
      cells[idx] = currentPlayer;
      cell.textContent = currentPlayer;
      console.log(`Cell ${idx} clicked — player ${currentPlayer}`);

      // Evaluate game state
      const result = checkWin();
      if (result) {
        if (result.winner) {
          // Winner: highlight winning cells and show banner
          console.log(`Player ${result.winner} wins! Winning cells: ${result.combo.join(', ')}`);
          result.combo.forEach(i => {
            const el = board.querySelector(`[data-index='${i}']`);
            if (el) el.classList.add('cell--win');
          });
          showResult(`🎉 Player ${result.winner} wins!`, 'win');
          score[result.winner]++;
        } else if (result.draw) {
          // Draw
          console.log('Game is a draw');
          showResult('It\'s a draw!', 'draw');
          score.draws++;
        }
        // End game state
        finished = true;
        setCellsDisabled(true);
        updateScore();
      } else {
        // Continue: toggle player and update status
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        console.log(`Next player: ${currentPlayer}`);
        updateStatus();
      }

      isProcessing = false; // allow next interaction
    });

    board.appendChild(cell);
  }

  // ----------------------
  // Reset controls
  // ----------------------
  const controls = document.createElement('div');
  controls.className = 'controls';
  const resetBtn = document.createElement('button');
  resetBtn.className = 'reset-btn';
  resetBtn.textContent = 'Reset';

  // Reset handler: clears board but preserves session scores
  resetBtn.addEventListener('click', () => {
    for (let i = 0; i < 9; i++) {
      cells[i] = null;
      const el = board.querySelector(`[data-index='${i}']`);
      if (el) {
        el.textContent = '';
        el.classList.remove('cell--win', 'cell--invalid');
      }
    }
    finished = false;
    isProcessing = false;
    currentPlayer = 'X';
    setCellsDisabled(false);
    hideResult();
    updateStatus();
    console.log('Game reset — player X starts');
  });
  controls.appendChild(resetBtn);

  // ----------------------
  // Mount UI and initialize
  // ----------------------
  app.innerHTML = '';
  app.appendChild(scoreboard);
  app.appendChild(resultBanner);
  app.appendChild(statusEl);
  app.appendChild(board);
  app.appendChild(controls);

  setCellsDisabled(false);
  updateStatus();
  updateScore();

  console.log('Tic-Tac-Toe ready — win detection and score tracking enabled');
  console.log('Score:', score);
});
