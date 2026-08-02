/**
 * SudoPlay - Main Application Controller
 * All state variables declared at top to prevent ReferenceErrors.
 */

document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // ALL STATE VARIABLES - declared first to prevent ReferenceErrors
    // =========================================================================
    let gameActive = false;
    let isTimerPaused = false;
    let initialBoard = [];
    let currentBoard = [];
    let solutionBoard = [];
    let selectedCellIdx = null;
    let isPencilMode = false;
    let currentDifficulty = 'medium';
    let notesData = Array.from({ length: 81 }, () => new Set());
    let historyStack = [];
    let redoStack = [];
    let mistakesCount = 0;
    let maxMistakes = 3;
    let correctMoves = 0;
    let hintsRemaining = 3;
    let timerInterval = null;
    let secondsElapsed = 0;
    let audioEnabled = true;
    let heroBoard = [];
    let currentFactIdx = 0;
    let factTimer = null;
    let visualizerTimer = null;
    let autoBoard = new Array(81).fill(0);

    // =========================================================================
    // 1. PRELOADER (4-second duration)
    // =========================================================================
    const preloader = document.getElementById('preloader');
    setTimeout(() => {
        if (preloader) {
            preloader.classList.add('fade-out');
            setTimeout(() => { preloader.style.display = 'none'; }, 600);
        }
    }, 4000);

    // =========================================================================
    // 2. AUDIO SYNTHESIZER (WEB AUDIO API)
    // =========================================================================
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = AudioContextClass ? new AudioContextClass() : null;

    function playSound(type) {
        if (!audioEnabled || !audioCtx) return;
        try {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            const now = audioCtx.currentTime;

            if (type === 'click') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.start(now); osc.stop(now + 0.05);
            } else if (type === 'fill') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(520, now);
                osc.frequency.exponentialRampToValueAtTime(660, now + 0.08);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now); osc.stop(now + 0.1);
            } else if (type === 'error') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, now);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now); osc.stop(now + 0.2);
            } else if (type === 'hint') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(880, now + 0.1);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now); osc.stop(now + 0.25);
            } else if (type === 'victory') {
                osc.stop(); // won't be used
                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, idx) => {
                    const o2 = audioCtx.createOscillator();
                    const g2 = audioCtx.createGain();
                    o2.connect(g2); g2.connect(audioCtx.destination);
                    o2.type = 'sine';
                    o2.frequency.setValueAtTime(freq, now + idx * 0.08);
                    g2.gain.setValueAtTime(0.1, now + idx * 0.08);
                    g2.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
                    o2.start(now + idx * 0.08); o2.stop(now + idx * 0.08 + 0.4);
                });
                return;
            }
        } catch (e) { /* audio failures are non-critical */ }
    }

    // =========================================================================
    // 3. TOAST NOTIFICATION SYSTEM
    // =========================================================================
    const toastContainer = document.getElementById('toast-container');

    function showToast(message, type = 'info') {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast-item';
        const iconMap = { info: 'ℹ️', success: '✅', error: '⚠️', hint: '💡' };
        toast.innerHTML = `<span>${iconMap[type] || 'ℹ️'}</span> <span>${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
    }

    // =========================================================================
    // 4. SPA VIEW ROUTING
    // =========================================================================
    const viewSections = document.querySelectorAll('.view-section');

    function switchView(targetViewId) {
        if (targetViewId !== 'solver-view' && gameActive && !isTimerPaused) {
            pauseGame();
        }
        viewSections.forEach(section => {
            section.classList.toggle('active', section.id === targetViewId);
        });
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-view') === targetViewId);
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.querySelectorAll('.nav-link, [data-view]').forEach(link => {
        link.addEventListener('click', (e) => {
            const targetView = link.getAttribute('data-view');
            if (targetView) { e.preventDefault(); switchView(targetView); }
        });
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && gameActive && !isTimerPaused) {
            pauseGame();
            showToast('Game paused — tab hidden', 'info');
        }
    });

    // =========================================================================
    // 5. THEME & SOUND TOGGLES
    // =========================================================================
    function toggleSound() {
        audioEnabled = !audioEnabled;
        const btn = document.getElementById('sound-toggle-btn');
        if (btn) btn.textContent = audioEnabled ? '🔊' : '🔇';
        showToast(`Sound ${audioEnabled ? 'Enabled' : 'Muted'}`, 'info');
    }

    function toggleTheme() {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('sudoku_theme', isLight ? 'light' : 'dark');
        showToast(`${isLight ? 'Light' : 'Dark'} Theme`, 'info');
    }

    const soundBtn = document.getElementById('sound-toggle-btn');
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (soundBtn) soundBtn.addEventListener('click', toggleSound);
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    if (localStorage.getItem('sudoku_theme') === 'light') {
        document.body.classList.add('light-theme');
        if (themeBtn) themeBtn.textContent = '☀️';
    }

    // =========================================================================
    // 6. HERO 3D ANIMATED SUDOKU BOARD
    // =========================================================================
    const hero3dScene = document.getElementById('hero-3d-scene');
    const hero3dGridEl = document.getElementById('hero-3d-grid');

    if (hero3dScene && hero3dGridEl) {
        hero3dScene.addEventListener('mousemove', (e) => {
            const rect = hero3dScene.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            hero3dGridEl.style.transform = `rotateX(${-y * 0.12}deg) rotateY(${x * 0.12}deg)`;
        });
        hero3dScene.addEventListener('mouseleave', () => {
            hero3dGridEl.style.transform = 'rotateX(0deg) rotateY(0deg)';
        });
    }

    function initHero3DGrid(delayStart = false) {
        if (!hero3dGridEl) return;
        hero3dGridEl.innerHTML = '';
        const gen = SudokuEngine.generate('easy');
        heroBoard = [...gen.puzzle];
        for (let i = 0; i < 81; i++) {
            const cell = document.createElement('div');
            cell.className = 'mini-3d-cell';
            cell.textContent = heroBoard[i] !== 0 ? heroBoard[i] : '';
            hero3dGridEl.appendChild(cell);
        }
        if (delayStart) {
            setTimeout(runHero3DSolveLoop, 1000);
        } else {
            runHero3DSolveLoop();
        }
    }

    function runHero3DSolveLoop() {
        const solved = SudokuEngine.solve(heroBoard);
        if (!solved.success || !solved.solution) return;
        const solution = solved.solution;
        const empties = [];
        for (let i = 0; i < 81; i++) { if (heroBoard[i] === 0) empties.push(i); }
        let step = 0;
        const interval = setInterval(() => {
            if (step >= empties.length) {
                clearInterval(interval);
                hero3dGridEl.classList.add('completed-glow');
                
                setTimeout(() => {
                    hero3dGridEl.classList.add('spin-out');
                    
                    setTimeout(() => {
                        hero3dGridEl.classList.remove('spin-out', 'completed-glow');
                        hero3dGridEl.classList.add('spin-in');
                        
                        initHero3DGrid(true);
                        
                        setTimeout(() => {
                            hero3dGridEl.classList.remove('spin-in');
                        }, 500);
                    }, 500);
                }, 1000);
                return;
            }
            const idx = empties[step];
            const cells = hero3dGridEl.children;
            if (cells[idx]) {
                for (const c of cells) c.classList.remove('active-fill');
                cells[idx].textContent = solution[idx];
                cells[idx].classList.add('active-fill');
            }
            step++;
        }, 50);
    }

    // =========================================================================
    // 7. FUN FACTS ENGINE (26 FACTS)
    // =========================================================================
    const sudokuFacts = [
        "There are 6,670,903,752,021,072,936,960 (6.67 sextillion) valid 9x9 Sudoku grids!",
        "The minimum number of clues needed to create a unique valid Sudoku puzzle is exactly 17.",
        "The name 'Sudoku' is short for Japanese 'Su-ji wa dokushin ni kariru' meaning 'numbers must remain single'.",
        "Modern Sudoku was invented in Indianapolis in 1979 by Howard Garns under the name 'Number Place'.",
        "Playing Sudoku regularly improves memory, sharpens spatial thinking, and slows brain aging.",
        "Sudoku is not a math puzzle! You could replace numbers 1-9 with letters, colors, or symbols.",
        "The world record for solving a Sudoku puzzle is 1 minute 23 seconds by Thomas Snyder.",
        "Sudoku became a global sensation in 2004 when Wayne Gould published his generator in The Times.",
        "A 16x16 variant of Sudoku is called 'Monster Sudoku' using numbers 1-9 and letters A-G.",
        "There are 5,472,730,538 essentially different Sudoku grids when symmetries are removed.",
        "The World Sudoku Championship has been held annually since 2006.",
        "Solving Sudoku stimulates both the left analytical and right pattern-recognition brain hemispheres.",
        "The hardest Sudoku ever designed is 'AI Escargot' by Finnish mathematician Arto Inkala.",
        "Over 500 million people worldwide play Sudoku regularly.",
        "There are 3,359,200 valid ways to arrange the top 3 rows of a Sudoku puzzle.",
        "Techniques like 'X-Wing', 'Swordfish', and 'Jellyfish' eliminate candidates across multiple lines.",
        "In 2012, researchers proved no valid 16-clue Sudoku puzzle can have a unique solution.",
        "Sudoku puzzles boost dopamine levels in the brain upon deducing difficult numbers.",
        "The first World Sudoku Champion was Jana Tylova from the Czech Republic in 2006.",
        "Sudoku relies on graph coloring algorithms in computer science theory.",
        "3D Sudoku cubes project numbers across 6 intersecting outer faces.",
        "Hyper Sudoku adds four extra 3x3 shaded regions that must also contain unique numbers 1-9.",
        "Sudoku generates zero language barrier — anyone of any culture can play seamlessly.",
        "The fastest AI solver computed 10,000 Sudoku puzzles in under 1 second using bitwise logic.",
        "Naked Singles and Hidden Singles resolve over 70% of beginner Sudoku puzzles.",
        "Sudoku is recommended by neurologists to keep cognitive neural pathways active during aging.",
        "Blank Sudoku grids are technically a special case of Latin squares.",
        "Sudoku variations include Jigsaw Sudoku, where regions are irregular shapes.",
        "The first computerized Sudoku game was created in 1989 for the Commodore 64.",
        "Sudoku was introduced in the UK in 2004 and quickly became a national obsession.",
        "A popular variant, Killer Sudoku, combines elements of Sudoku and Kakuro.",
        "The longest Sudoku marathon lasted over 30 hours, setting a Guinness World Record.",
        "Some Sudoku grids have clues that form symmetrical patterns or pictures.",
        "A properly designed Sudoku has only one unique solution, no guessing required.",
        "Samurai Sudoku consists of five overlapping 9x9 grids.",
        "Sudoku is a NP-complete problem when generalized to an N x N grid.",
        "Sudoku has been used as a tool to teach logic and deduction in elementary schools.",
        "In 2008, a 9-year-old became one of the youngest to compete in the World Sudoku Championship.",
        "The first Sudoku app for the iPhone was released within weeks of the App Store's launch in 2008.",
        "Sudoku has inspired variations played with musical notes and geometric shapes.",
        "Mathematical analysis of Sudoku is an active field in discrete mathematics and combinatorics.",
        "Many newspapers experienced a bump in circulation just by adding daily Sudoku puzzles.",
        "Some researchers believe solving Sudokus can delay the onset of Alzheimer's disease."
    ];

    const factTextEl = document.getElementById('fact-text');
    const factProgressBar = document.getElementById('fact-progress-bar');
    const nextFactBtn = document.getElementById('next-fact-btn');

    let isFactPaused = false;
    const factsCardWrapper = document.querySelector('.facts-card');
    if (factsCardWrapper) {
        factsCardWrapper.addEventListener('mouseenter', () => { isFactPaused = true; });
        factsCardWrapper.addEventListener('mouseleave', () => { isFactPaused = false; });
    }

    function updateFunFact() {
        if (!factTextEl) return;
        if (isFactPaused) return;
        if (factProgressBar) {
            factProgressBar.style.transition = 'none';
            factProgressBar.style.width = '0%';
            setTimeout(() => {
                factProgressBar.style.transition = 'width 6s linear';
                factProgressBar.style.width = '100%';
            }, 50);
        }
        factTextEl.style.opacity = '0';
        factTextEl.style.transform = 'translateY(8px)';
        setTimeout(() => {
            factTextEl.textContent = sudokuFacts[currentFactIdx];
            factTextEl.style.opacity = '1';
            factTextEl.style.transform = 'translateY(0)';
            currentFactIdx = (currentFactIdx + 1) % sudokuFacts.length;
        }, 300);
    }

    if (nextFactBtn) {
        nextFactBtn.addEventListener('click', () => {
            clearInterval(factTimer);
            updateFunFact();
            factTimer = setInterval(updateFunFact, 6000);
            playSound('click');
        });
    }

    factTimer = setInterval(updateFunFact, 6000);
    updateFunFact();

    // =========================================================================
    // 8. GAME ENGINE - DOM REFERENCES
    // =========================================================================
    const interactiveGridEl = document.getElementById('interactive-grid');
    const pausedOverlayEl = document.getElementById('paused-overlay');
    const gameStartOverlayEl = document.getElementById('game-start-overlay');
    const timerDisplay = document.getElementById('timer-display');
    const mistakesDisplay = document.getElementById('mistakes-display');
    const accuracyDisplay = document.getElementById('accuracy-display');
    const pencilBtn = document.getElementById('pencil-btn');
    const hintsCountEl = document.getElementById('hints-count');
    const hintBannerBox = document.getElementById('hint-banner-box');
    const pauseTimerBtn = document.getElementById('pause-timer-btn');
    const resumeGameBtn = document.getElementById('resume-game-btn');
    const startGameBtn = document.getElementById('start-game-btn');
    const numpadHelperLbl = document.getElementById('numpad-helper-lbl');

    // =========================================================================
    // 9. TIMER CONTROLS
    // =========================================================================
    function startTimer() {
        clearInterval(timerInterval);
        isTimerPaused = false;
        if (pausedOverlayEl) pausedOverlayEl.classList.remove('active');
        if (gameStartOverlayEl) gameStartOverlayEl.classList.remove('active');
        if (interactiveGridEl) interactiveGridEl.classList.remove('paused');
        if (pauseTimerBtn) pauseTimerBtn.textContent = '⏸️';

        timerInterval = setInterval(() => {
            if (gameActive && !isTimerPaused) {
                secondsElapsed++;
                const mins = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
                const secs = (secondsElapsed % 60).toString().padStart(2, '0');
                if (timerDisplay) timerDisplay.textContent = `${mins}:${secs}`;
            }
        }, 1000);
    }

    function pauseGame() {
        if (!gameActive) return;
        isTimerPaused = true;
        if (pausedOverlayEl) pausedOverlayEl.classList.add('active');
        if (interactiveGridEl) interactiveGridEl.classList.add('paused');
        if (pauseTimerBtn) pauseTimerBtn.textContent = '▶️';
    }

    function resumeGame() {
        if (!gameActive) return;
        isTimerPaused = false;
        if (pausedOverlayEl) pausedOverlayEl.classList.remove('active');
        if (interactiveGridEl) interactiveGridEl.classList.remove('paused');
        if (pauseTimerBtn) pauseTimerBtn.textContent = '⏸️';
    }

    if (pauseTimerBtn) pauseTimerBtn.addEventListener('click', () => { isTimerPaused ? resumeGame() : pauseGame(); });
    if (resumeGameBtn) resumeGameBtn.addEventListener('click', resumeGame);

    // =========================================================================
    // 10. GRID INITIALIZATION & RENDERING
    // =========================================================================
    function initInteractiveGrid() {
        if (!interactiveGridEl) return;
        interactiveGridEl.innerHTML = '';
        for (let i = 0; i < 81; i++) {
            const cell = document.createElement('div');
            cell.className = 'sudoku-cell';
            cell.dataset.index = i;
            cell.addEventListener('click', () => selectCell(i));
            interactiveGridEl.appendChild(cell);
        }
    }

    function prepareGameSetup() {
        clearInterval(timerInterval);
        gameActive = false;
        isTimerPaused = false;
        secondsElapsed = 0;
        if (timerDisplay) timerDisplay.textContent = '00:00';

        const genDiff = currentDifficulty === 'beginner' ? 'easy' : currentDifficulty;
        const generated = SudokuEngine.generate(genDiff);

        initialBoard = [...generated.puzzle];
        currentBoard = [...generated.puzzle];
        solutionBoard = [...generated.solution];
        notesData = Array.from({ length: 81 }, () => new Set());
        historyStack = [];
        redoStack = [];
        selectedCellIdx = null;
        mistakesCount = 0;
        correctMoves = 0;

        if (currentDifficulty === 'beginner') {
            maxMistakes = Infinity;
            hintsRemaining = Infinity;
            if (mistakesDisplay) mistakesDisplay.textContent = '0 / ∞';
            if (hintsCountEl) hintsCountEl.textContent = '∞';
        } else {
            maxMistakes = 3;
            hintsRemaining = 3;
            if (mistakesDisplay) mistakesDisplay.textContent = `0 / 3`;
            if (hintsCountEl) hintsCountEl.textContent = '3';
        }

        if (accuracyDisplay) accuracyDisplay.textContent = '100%';
        if (hintBannerBox) hintBannerBox.classList.remove('active');

        renderInteractiveGrid();
        if (gameStartOverlayEl) gameStartOverlayEl.classList.add('active');
        if (pausedOverlayEl) pausedOverlayEl.classList.remove('active');
    }

    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            gameActive = true;
            if (gameStartOverlayEl) gameStartOverlayEl.classList.remove('active');
            startTimer();
            playSound('click');
            showToast(`Game Started — ${currentDifficulty.toUpperCase()}`, 'success');
        });
    }

    function selectCell(index) {
        if (isTimerPaused || !gameActive) return;
        selectedCellIdx = index;
        renderInteractiveGrid();
        playSound('click');
    }

    function updateNumpadState() {
        const isHelperMode = ['beginner', 'easy', 'medium'].includes(currentDifficulty);
        if (numpadHelperLbl) numpadHelperLbl.style.display = isHelperMode ? 'inline-block' : 'none';

        for (let num = 1; num <= 9; num++) {
            const btn = document.querySelector(`.num-btn[data-num="${num}"]`);
            if (!btn) continue;
            const remSpan = btn.querySelector('.num-remaining');
            if (isHelperMode) {
                let placed = 0;
                for (let i = 0; i < 81; i++) {
                    if (currentBoard[i] === num && solutionBoard[i] === num) placed++;
                }
                const remaining = Math.max(0, 9 - placed);
                if (remSpan) { remSpan.textContent = remaining; remSpan.style.display = 'inline'; }
                btn.classList.toggle('completed', remaining === 0);
            } else {
                btn.classList.remove('completed');
                if (remSpan) remSpan.style.display = 'none';
            }
        }
    }

    function renderInteractiveGrid() {
        if (!interactiveGridEl) return;
        const cells = interactiveGridEl.children;
        if (!cells || cells.length !== 81) return;

        const selectedVal = selectedCellIdx !== null ? currentBoard[selectedCellIdx] : null;
        const selRow = selectedCellIdx !== null ? Math.floor(selectedCellIdx / 9) : -1;
        const selCol = selectedCellIdx !== null ? selectedCellIdx % 9 : -1;
        const selBox = selRow >= 0 ? Math.floor(selRow / 3) * 3 + Math.floor(selCol / 3) : -1;

        for (let i = 0; i < 81; i++) {
            const cell = cells[i];
            const val = currentBoard[i];
            const isGiven = initialBoard[i] !== 0;

            cell.className = 'sudoku-cell';
            cell.innerHTML = '';

            if (isGiven) {
                cell.classList.add('given');
                cell.textContent = val;
            } else if (val !== 0) {
                cell.classList.add('user-filled');
                cell.textContent = val;
                if (val !== solutionBoard[i]) cell.classList.add('error');
            } else if (notesData[i].size > 0) {
                const ng = document.createElement('div');
                ng.className = 'notes-grid';
                for (let n = 1; n <= 9; n++) {
                    const ne = document.createElement('div');
                    ne.className = 'note-num';
                    ne.textContent = notesData[i].has(n) ? n : '';
                    ng.appendChild(ne);
                }
                cell.appendChild(ng);
            }

            const r = Math.floor(i / 9), c = i % 9;
            const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);

            if (i === selectedCellIdx) {
                cell.classList.add('selected');
            } else if (selectedCellIdx !== null) {
                if (r === selRow || c === selCol || b === selBox) cell.classList.add('highlighted');
                if (val !== 0 && val === selectedVal) cell.classList.add('same-number');
            }
        }
        updateNumpadState();
    }

    function inputNumber(num) {
        if (selectedCellIdx === null || !gameActive || isTimerPaused) return;
        if (initialBoard[selectedCellIdx] !== 0) return;

        saveStateHistory();

        if (isPencilMode) {
            if (num === 0) { notesData[selectedCellIdx].clear(); }
            else {
                if (notesData[selectedCellIdx].has(num)) notesData[selectedCellIdx].delete(num);
                else notesData[selectedCellIdx].add(num);
            }
            playSound('click');
        } else {
            if (num === 0) {
                currentBoard[selectedCellIdx] = 0;
                playSound('click');
            } else {
                currentBoard[selectedCellIdx] = num;
                const correct = solutionBoard[selectedCellIdx];
                if (num === correct) {
                    correctMoves++;
                    playSound('fill');
                    clearCandidateNotes(selectedCellIdx, num);
                } else {
                    mistakesCount++;
                    if (mistakesDisplay) {
                        mistakesDisplay.textContent = currentDifficulty === 'beginner'
                            ? `${mistakesCount} / ∞`
                            : `${mistakesCount} / ${maxMistakes}`;
                    }
                    playSound('error');
                    if (currentDifficulty !== 'beginner' && mistakesCount >= maxMistakes) {
                        gameActive = false;
                        clearInterval(timerInterval);
                        recordGameHistory(false);
                        showGameModal(false);
                    }
                }
                const total = correctMoves + mistakesCount;
                const accuracy = total > 0 ? Math.round((correctMoves / total) * 100) : 100;
                if (accuracyDisplay) accuracyDisplay.textContent = `${accuracy}%`;
            }
        }

        renderInteractiveGrid();
        checkVictory();
    }

    function clearCandidateNotes(cellIdx, val) {
        const row = Math.floor(cellIdx / 9), col = cellIdx % 9;
        const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
        for (let i = 0; i < 81; i++) {
            const r = Math.floor(i / 9), c = i % 9;
            const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
            if (r === row || c === col || b === box) notesData[i].delete(val);
        }
    }

    function saveStateHistory() {
        historyStack.push({ board: [...currentBoard], notes: notesData.map(s => new Set(s)) });
        redoStack = [];
    }

    function undoMove() {
        if (!historyStack.length || !gameActive || isTimerPaused) return;
        redoStack.push({ board: [...currentBoard], notes: notesData.map(s => new Set(s)) });
        const prev = historyStack.pop();
        currentBoard = [...prev.board];
        notesData = prev.notes;
        renderInteractiveGrid();
        playSound('click');
    }

    function checkVictory() {
        if (!gameActive) return;
        if (currentBoard.every((v, i) => v === solutionBoard[i])) {
            gameActive = false;
            clearInterval(timerInterval);
            playSound('victory');
            recordGameHistory(true);
            showGameModal(true);
        }
    }

    function resetBoard() {
        if (!gameActive) return;
        currentBoard = [...initialBoard];
        notesData = Array.from({ length: 81 }, () => new Set());
        historyStack = []; redoStack = [];
        selectedCellIdx = null;
        renderInteractiveGrid();
        playSound('click');
        showToast('Board reset to original clues', 'info');
    }

    function showGameModal(isWin) {
        const modal = document.getElementById('game-modal');
        if (!modal) return;
        document.getElementById('modal-icon').textContent = isWin ? '🎉' : '💔';
        document.getElementById('modal-title').textContent = isWin ? 'Puzzle Completed!' : 'Game Over';
        document.getElementById('modal-desc').textContent = isWin
            ? 'Outstanding! You solved the Sudoku cleanly.'
            : 'You made 3 mistakes. Practice makes perfect!';
        document.getElementById('modal-time-val').textContent = timerDisplay ? timerDisplay.textContent : '--';
        document.getElementById('modal-accuracy-val').textContent = accuracyDisplay ? accuracyDisplay.textContent : '--';
        modal.classList.add('active');
    }

    const modalActionBtn = document.getElementById('modal-action-btn');
    if (modalActionBtn) modalActionBtn.addEventListener('click', () => {
        document.getElementById('game-modal').classList.remove('active');
        prepareGameSetup();
    });

    const newGameBtn = document.getElementById('new-game-btn');
    const resetBtn = document.getElementById('reset-board-btn');
    const eraseBtn = document.getElementById('erase-btn');
    const undoBtn = document.getElementById('undo-btn');
    const solveNowBtn = document.getElementById('solve-now-btn');
    const getHintBtn = document.getElementById('get-hint-btn');

    if (newGameBtn) newGameBtn.addEventListener('click', prepareGameSetup);
    if (resetBtn) resetBtn.addEventListener('click', resetBoard);
    if (eraseBtn) eraseBtn.addEventListener('click', () => inputNumber(0));
    if (undoBtn) undoBtn.addEventListener('click', undoMove);
    if (pencilBtn) pencilBtn.addEventListener('click', () => {
        isPencilMode = !isPencilMode;
        pencilBtn.classList.toggle('active', isPencilMode);
        showToast(`Notes ${isPencilMode ? 'ON' : 'OFF'}`, 'info');
    });

    if (solveNowBtn) solveNowBtn.addEventListener('click', () => {
        if (!gameActive) return;
        currentBoard = [...solutionBoard];
        renderInteractiveGrid();
        checkVictory();
    });

    if (getHintBtn) getHintBtn.addEventListener('click', () => {
        if (!gameActive || isTimerPaused) return;
        if (currentDifficulty !== 'beginner' && hintsRemaining <= 0) {
            showToast('No hints remaining!', 'error'); return;
        }
        const hint = SudokuEngine.getHint(currentBoard, solutionBoard, selectedCellIdx);
        if (hint) {
            if (currentDifficulty !== 'beginner') {
                hintsRemaining--;
                if (hintsCountEl) hintsCountEl.textContent = hintsRemaining;
            }
            selectedCellIdx = hint.row * 9 + hint.col;
            if (hintBannerBox) {
                hintBannerBox.innerHTML = `<strong>${hint.type}:</strong> ${hint.explanation}`;
                hintBannerBox.classList.add('active');
            }
            renderInteractiveGrid();
            playSound('hint');
            showToast('Hint provided!', 'hint');
        }
    });

    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', () => inputNumber(parseInt(btn.dataset.num, 10)));
    });

    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDifficulty = btn.dataset.diff;
            prepareGameSetup();
        });
    });

    document.addEventListener('keydown', (e) => {
        if (!gameActive || selectedCellIdx === null || isTimerPaused) return;
        if (e.key >= '1' && e.key <= '9') inputNumber(parseInt(e.key));
        else if (e.key === 'Backspace' || e.key === 'Delete') inputNumber(0);
        else if (e.key === 'ArrowUp' && selectedCellIdx >= 9) selectCell(selectedCellIdx - 9);
        else if (e.key === 'ArrowDown' && selectedCellIdx < 72) selectCell(selectedCellIdx + 9);
        else if (e.key === 'ArrowLeft' && selectedCellIdx % 9 > 0) selectCell(selectedCellIdx - 1);
        else if (e.key === 'ArrowRight' && selectedCellIdx % 9 < 8) selectCell(selectedCellIdx + 1);
    });

    // =========================================================================
    // 11. AUTO SOLVER CONTROLLER
    // =========================================================================
    const autoGridEl = document.getElementById('auto-grid');

    function initAutoGrid() {
        if (!autoGridEl) return;
        autoGridEl.innerHTML = '';
        for (let i = 0; i < 81; i++) {
            const cell = document.createElement('div');
            cell.className = 'sudoku-cell';
            cell.contentEditable = 'true';
            cell.dataset.index = i;
            cell.addEventListener('input', () => {
                const val = parseInt(cell.textContent.trim(), 10);
                autoBoard[i] = (val >= 1 && val <= 9) ? val : 0;
                renderAutoGrid();
            });
            autoGridEl.appendChild(cell);
        }
    }

    function renderAutoGrid(highlightIdx = null, highlightType = null) {
        if (!autoGridEl) return;
        const cells = autoGridEl.children;
        for (let i = 0; i < 81; i++) {
            const cell = cells[i];
            if (!cell) continue;
            const val = autoBoard[i];
            cell.className = 'sudoku-cell';
            cell.textContent = val !== 0 ? val : '';
            if (val !== 0) cell.classList.add('user-filled');
            if (i === highlightIdx) {
                cell.classList.add(highlightType === 'try' ? 'selected' : 'error');
            }
        }
    }

    const presets = {
        easy: "530070000600195000098000060800060003400803001700020006060000280000419000000080079",
        hard: "000000085000210009960080100500800016000000000890006007009070052300054000480000000",
        evil: "800000000003600000070090200050007000000045700000100030001000068008500010090000400"
    };

    function loadStringGrid(str) {
        const clean = str.replace(/[^0-9.]/g, '');
        for (let i = 0; i < 81; i++) {
            const ch = clean[i] || '0';
            autoBoard[i] = (ch >= '1' && ch <= '9') ? parseInt(ch) : 0;
        }
        renderAutoGrid();
        showToast('Grid Loaded!', 'success');
    }

    const loadPresetEasy = document.getElementById('load-preset-easy');
    const loadPresetHard = document.getElementById('load-preset-hard');
    const loadPresetEvil = document.getElementById('load-preset-evil');

    if (loadPresetEasy) loadPresetEasy.addEventListener('click', () => loadStringGrid(presets.easy));
    if (loadPresetHard) loadPresetHard.addEventListener('click', () => loadStringGrid(presets.hard));
    if (loadPresetEvil) loadPresetEvil.addEventListener('click', () => loadStringGrid(presets.evil));

    const autoInstantBtn = document.getElementById('auto-instant-btn');
    const autoVisualBtn = document.getElementById('auto-visual-btn');
    const autoStopBtn = document.getElementById('auto-stop-btn');
    const autoClearBtn = document.getElementById('auto-clear-btn');
    const speedSlider = document.getElementById('speed-slider');
    const speedValEl = document.getElementById('speed-val');

    if (speedSlider && speedValEl) {
        speedSlider.addEventListener('input', () => { speedValEl.textContent = `${speedSlider.value}ms`; });
    }

    if (autoInstantBtn) autoInstantBtn.addEventListener('click', () => {
        const result = SudokuEngine.solve(autoBoard);
        if (result.success && result.solution) {
            autoBoard = result.solution;
            renderAutoGrid();
            const tv = document.getElementById('auto-time-val');
            const sv = document.getElementById('auto-steps-val');
            if (tv) tv.textContent = `${result.timeMs} ms`;
            if (sv) sv.textContent = result.steps;
            playSound('victory');
            showToast(`Solved in ${result.timeMs} ms!`, 'success');
        } else {
            showToast('No valid solution for this grid.', 'error');
        }
    });

    if (autoVisualBtn) autoVisualBtn.addEventListener('click', () => {
        clearInterval(visualizerTimer);
        const gen = SudokuEngine.solveVisualizerGenerator(autoBoard);
        if (autoVisualBtn) autoVisualBtn.style.display = 'none';
        if (autoStopBtn) autoStopBtn.style.display = 'inline-flex';
        let stepCount = 0;
        const startTime = performance.now();
        const sv = document.getElementById('auto-steps-val');
        const tv = document.getElementById('auto-time-val');
        const speed = speedSlider ? parseInt(speedSlider.value) : 30;
        visualizerTimer = setInterval(() => {
            const next = gen.next();
            if (next.done || !next.value) {
                clearInterval(visualizerTimer);
                if (autoVisualBtn) autoVisualBtn.style.display = 'inline-flex';
                if (autoStopBtn) autoStopBtn.style.display = 'none';
                playSound('victory');
                showToast('Visualization Complete!', 'success');
                return;
            }
            stepCount++;
            const step = next.value;
            autoBoard = step.board;
            const hlIdx = step.row !== undefined ? step.row * 9 + step.col : null;
            renderAutoGrid(hlIdx, step.type);
            if (sv) sv.textContent = stepCount;
            if (tv) tv.textContent = `${Math.round(performance.now() - startTime)} ms`;
        }, speed);
    });

    if (autoStopBtn) autoStopBtn.addEventListener('click', () => {
        clearInterval(visualizerTimer);
        if (autoVisualBtn) autoVisualBtn.style.display = 'inline-flex';
        if (autoStopBtn) autoStopBtn.style.display = 'none';
        showToast('Visualizer Stopped', 'info');
    });

    if (autoClearBtn) autoClearBtn.addEventListener('click', () => {
        clearInterval(visualizerTimer);
        autoBoard = new Array(81).fill(0);
        renderAutoGrid();
        showToast('Grid Cleared', 'info');
    });

    // =========================================================================
    // 12. HISTORY & STATS MANAGER
    // =========================================================================
    function getHistory() {
        try { return JSON.parse(localStorage.getItem('sudoku_history') || '[]'); }
        catch (e) { return []; }
    }

    function recordGameHistory(solved) {
        const history = getHistory();
        history.unshift({
            date: new Date().toLocaleString(),
            difficulty: currentDifficulty,
            time: timerDisplay ? timerDisplay.textContent : '--',
            mistakes: mistakesCount,
            accuracy: accuracyDisplay ? accuracyDisplay.textContent : '--',
            solved
        });
        try { localStorage.setItem('sudoku_history', JSON.stringify(history)); } catch (e) {}
        renderHistoryTable();
    }

    function renderHistoryTable() {
        const history = getHistory();
        const tbody = document.getElementById('history-table-body');
        if (!tbody) return;

        const totalPlayed = history.length;
        const totalSolved = history.filter(h => h.solved).length;
        const winRate = totalPlayed > 0 ? Math.round((totalSolved / totalPlayed) * 100) : 0;

        const stp = document.getElementById('stat-total-played');
        const sts = document.getElementById('stat-total-solved');
        const stw = document.getElementById('stat-win-rate');
        const stb = document.getElementById('stat-best-time');

        if (stp) stp.textContent = totalPlayed;
        if (sts) sts.textContent = totalSolved;
        if (stw) stw.textContent = `${winRate}%`;

        const solved = history.filter(h => h.solved && h.difficulty === 'medium');
        if (stb && solved.length > 0) {
            stb.textContent = solved.sort((a, b) => a.time.localeCompare(b.time))[0].time;
        }

        tbody.innerHTML = '';
        if (!history.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No games yet. Play a game to see stats!</td></tr>`;
            return;
        }

        history.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.date}</td>
                <td><span style="text-transform:capitalize;font-weight:700;color:var(--accent-cyan)">${item.difficulty}</span></td>
                <td>${item.time}</td>
                <td>${item.mistakes} / 3</td>
                <td>${item.accuracy}</td>
                <td><span style="color:${item.solved ? 'var(--accent-green)' : 'var(--accent-rose)'};font-weight:700">${item.solved ? 'WIN' : 'LOST'}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => {
        try { localStorage.removeItem('sudoku_history'); } catch (e) {}
        renderHistoryTable();
        showToast('History Cleared', 'info');
    });

    // =========================================================================
    // =========================================================================
    // 12.5. RULES DEMO VISUALIZER
    // =========================================================================
    const demoBoardWrong = document.getElementById('demo-board-wrong');
    const demoBoardCorrect = document.getElementById('demo-board-correct');
    const demoTextEl = document.getElementById('demo-text');
    const rulesContainer = document.getElementById('rules-demo-container');
    
    let demoTimer = null;
    let isDemoPaused = false;
    let demoStep = 0; // 0: Row, 1: Col, 2: Box

    const baseDemoPuzzle = [
        5, 3, 0, 0, 7, 0, 0, 0, 0,
        6, 0, 0, 1, 9, 5, 0, 0, 0,
        0, 9, 8, 0, 0, 0, 0, 6, 0,
        8, 0, 0, 0, 6, 0, 0, 0, 3,
        4, 0, 0, 8, 0, 3, 0, 0, 1,
        7, 0, 0, 0, 2, 0, 0, 0, 6,
        0, 6, 0, 0, 0, 0, 2, 8, 0,
        0, 0, 0, 4, 1, 9, 0, 0, 5,
        0, 0, 0, 0, 8, 0, 0, 7, 9
    ];

    if (demoBoardWrong && demoBoardCorrect) {
        for (let i = 0; i < 81; i++) {
            const cellW = document.createElement('div');
            cellW.className = 'demo-cell';
            demoBoardWrong.appendChild(cellW);

            const cellC = document.createElement('div');
            cellC.className = 'demo-cell';
            demoBoardCorrect.appendChild(cellC);
        }

        if (rulesContainer) {
            rulesContainer.addEventListener('mouseenter', () => { isDemoPaused = true; });
            rulesContainer.addEventListener('mouseleave', () => { 
                isDemoPaused = false; 
                clearInterval(demoTimer);
                runDemoStep();
                demoTimer = setInterval(runDemoStep, 5000);
            });
        }

        const nextRuleBtn = document.getElementById('next-rule-btn');
        if (nextRuleBtn) {
            nextRuleBtn.addEventListener('click', () => {
                clearInterval(demoTimer);
                runDemoStep();
                demoTimer = setInterval(runDemoStep, 5000);
            });
        }

        function drawDemoBoard(boardEl, highlights, styledCells, isWrong) {
            const cells = boardEl.children;
            for (let i = 0; i < 81; i++) {
                cells[i].className = 'demo-cell';
                if (baseDemoPuzzle[i] !== 0) {
                    cells[i].textContent = baseDemoPuzzle[i];
                    cells[i].style.color = 'var(--text-secondary)';
                } else {
                    cells[i].textContent = '';
                }
                
                if (highlights.includes(i)) cells[i].classList.add('highlight-area');
                if (styledCells[i]) {
                    cells[i].textContent = styledCells[i];
                    cells[i].classList.add(isWrong ? 'wrong' : 'correct');
                }
            }
        }

        function runDemoStep() {
            if (isDemoPaused) return;
            
            const rowHighlights = [0,1,2,3,4,5,6,7,8];
            const colHighlights = [1,10,19,28,37,46,55,64,73];
            const boxHighlights = [0,1,2,9,10,11,18,19,20];

            switch(demoStep) {
                case 0:
                    if (demoTextEl) demoTextEl.innerHTML = "Rule 1: Every digit in a <strong>Row</strong> must be unique 1-9.";
                    drawDemoBoard(demoBoardWrong, rowHighlights, {0: 5, 8: 5}, true);
                    drawDemoBoard(demoBoardCorrect, rowHighlights, {8: 2}, false);
                    break;
                case 1:
                    if (demoTextEl) demoTextEl.innerHTML = "Rule 2: Every digit in a <strong>Column</strong> must be unique 1-9.";
                    drawDemoBoard(demoBoardWrong, colHighlights, {19: 9, 37: 9}, true);
                    drawDemoBoard(demoBoardCorrect, colHighlights, {37: 1}, false);
                    break;
                case 2:
                    if (demoTextEl) demoTextEl.innerHTML = "Rule 3: Every digit in a <strong>3x3 Box</strong> must be unique 1-9.";
                    drawDemoBoard(demoBoardWrong, boxHighlights, {0: 5, 11: 5}, true);
                    drawDemoBoard(demoBoardCorrect, boxHighlights, {11: 4}, false);
                    break;
            }
            
            demoStep = (demoStep + 1) % 3;
        }

        runDemoStep();
        demoTimer = setInterval(runDemoStep, 5000);
    }

    // =========================================================================
    // 13. INITIALIZE EVERYTHING
    // =========================================================================
    initHero3DGrid();
    initInteractiveGrid();
    initAutoGrid();
    prepareGameSetup();
    loadStringGrid(presets.easy);
    renderHistoryTable();
});