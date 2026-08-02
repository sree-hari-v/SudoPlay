/**
 * Sudoku Engine - Pure JavaScript Algorithm
 * Includes Instant Board Generator (Randomized Candidate Backtracking in <1ms),
 * Fast MRV Backtracking Solver, Visualizer Generator, and Smart Hint System.
 */

class SudokuEngine {
    // Check if placing `num` at `row, col` in `board` (array of length 81) is valid
    static isValid(board, row, col, num) {
        for (let i = 0; i < 9; i++) {
            // Check row
            if (i !== col && board[row * 9 + i] === num) return false;
            // Check column
            if (i !== row && board[i * 9 + col] === num) return false;
            // Check 3x3 box
            const boxRow = 3 * Math.floor(row / 3) + Math.floor(i / 3);
            const boxCol = 3 * Math.floor(col / 3) + (i % 3);
            if ((boxRow !== row || boxCol !== col) && board[boxRow * 9 + boxCol] === num) return false;
        }
        return true;
    }

    // Get list of valid numbers for a given empty cell
    static getCandidates(board, row, col) {
        if (board[row * 9 + col] !== 0) return [];
        const candidates = [];
        for (let num = 1; num <= 9; num++) {
            if (this.isValid(board, row, col, num)) {
                candidates.push(num);
            }
        }
        return candidates;
    }

    // Fast Solver using Backtracking with Minimum Remaining Values (MRV) Heuristic
    static solve(board) {
        const boardCopy = [...board];
        let stepsCount = 0;
        
        const solveInternal = () => {
            stepsCount++;
            let minCandidates = 10;
            let targetRow = -1;
            let targetCol = -1;
            let targetCandidates = [];

            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (boardCopy[r * 9 + c] === 0) {
                        const candidates = this.getCandidates(boardCopy, r, c);
                        if (candidates.length === 0) return false;
                        if (candidates.length < minCandidates) {
                            minCandidates = candidates.length;
                            targetRow = r;
                            targetCol = c;
                            targetCandidates = candidates;
                        }
                    }
                }
            }

            if (targetRow === -1) return true;

            for (const num of targetCandidates) {
                boardCopy[targetRow * 9 + targetCol] = num;
                if (solveInternal()) return true;
                boardCopy[targetRow * 9 + targetCol] = 0;
            }

            return false;
        };

        const startTime = performance.now();
        const success = solveInternal();
        const endTime = performance.now();

        return {
            success,
            solution: success ? boardCopy : null,
            steps: stepsCount,
            timeMs: Math.round((endTime - startTime) * 100) / 100
        };
    }

    // Count solutions up to maxCount
    static countSolutions(board, maxCount = 2) {
        const boardCopy = [...board];
        let count = 0;

        const solveInternal = () => {
            let minCandidates = 10;
            let targetRow = -1;
            let targetCol = -1;
            let targetCandidates = [];

            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (boardCopy[r * 9 + c] === 0) {
                        const candidates = this.getCandidates(boardCopy, r, c);
                        if (candidates.length === 0) return;
                        if (candidates.length < minCandidates) {
                            minCandidates = candidates.length;
                            targetRow = r;
                            targetCol = c;
                            targetCandidates = candidates;
                        }
                    }
                }
            }

            if (targetRow === -1) {
                count++;
                return;
            }

            for (const num of targetCandidates) {
                boardCopy[targetRow * 9 + targetCol] = num;
                solveInternal();
                if (count >= maxCount) return;
                boardCopy[targetRow * 9 + targetCol] = 0;
            }
        };

        solveInternal();
        return count;
    }

    // Generate a 100% valid solved Sudoku board instantly in < 1ms
    static generateCompleteBoard() {
        const board = new Array(81).fill(0);
        
        const solveRandom = () => {
            let minCandidates = 10;
            let targetRow = -1;
            let targetCol = -1;
            let targetCandidates = [];

            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (board[r * 9 + c] === 0) {
                        const candidates = this.getCandidates(board, r, c);
                        if (candidates.length === 0) return false;
                        if (candidates.length < minCandidates) {
                            minCandidates = candidates.length;
                            targetRow = r;
                            targetCol = c;
                            targetCandidates = candidates;
                        }
                    }
                }
            }

            if (targetRow === -1) return true;

            // Randomize candidate numbers for variation
            targetCandidates.sort(() => Math.random() - 0.5);

            for (const num of targetCandidates) {
                board[targetRow * 9 + targetCol] = num;
                if (solveRandom()) return true;
                board[targetRow * 9 + targetCol] = 0;
            }

            return false;
        };

        solveRandom();
        return board;
    }

    // Generate a new Sudoku puzzle with guaranteed unique solution instantly
    static generate(difficulty = 'medium') {
        const clueTargets = {
            easy: 42,
            medium: 34,
            hard: 28,
            expert: 24
        };
        const targetClues = clueTargets[difficulty] || 34;

        // Generate complete solved board instantly in < 1ms
        const completeBoard = this.generateCompleteBoard();
        const puzzleBoard = [...completeBoard];

        // Randomize removal order
        const positions = Array.from({ length: 81 }, (_, i) => i).sort(() => Math.random() - 0.5);

        let currentClues = 81;
        for (const pos of positions) {
            if (currentClues <= targetClues) break;
            
            const row = Math.floor(pos / 9);
            const col = pos % 9;
            const symPos = (8 - row) * 9 + (8 - col);

            const tempVal = puzzleBoard[pos];
            const tempSymVal = puzzleBoard[symPos];

            puzzleBoard[pos] = 0;
            let removedCount = 1;

            if (pos !== symPos && puzzleBoard[symPos] !== 0) {
                puzzleBoard[symPos] = 0;
                removedCount = 2;
            }

            if (this.countSolutions(puzzleBoard) !== 1) {
                puzzleBoard[pos] = tempVal;
                if (pos !== symPos) puzzleBoard[symPos] = tempSymVal;
            } else {
                currentClues -= removedCount;
            }
        }

        return {
            puzzle: puzzleBoard,
            solution: completeBoard,
            difficulty: difficulty,
            clueCount: currentClues
        };
    }

    // Generator function for real-time visual step-by-step auto solving
    static *solveVisualizerGenerator(board) {
        const boardCopy = [...board];
        
        function* solveInternal() {
            let minCandidates = 10;
            let targetRow = -1;
            let targetCol = -1;
            let targetCandidates = [];

            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (boardCopy[r * 9 + c] === 0) {
                        const candidates = SudokuEngine.getCandidates(boardCopy, r, c);
                        if (candidates.length === 0) return false;
                        if (candidates.length < minCandidates) {
                            minCandidates = candidates.length;
                            targetRow = r;
                            targetCol = c;
                            targetCandidates = candidates;
                        }
                    }
                }
            }

            if (targetRow === -1) return true;

            for (const num of targetCandidates) {
                boardCopy[targetRow * 9 + targetCol] = num;
                yield {
                    board: [...boardCopy],
                    row: targetRow,
                    col: targetCol,
                    val: num,
                    type: 'try'
                };

                const subResult = yield* solveInternal();
                if (subResult) return true;

                boardCopy[targetRow * 9 + targetCol] = 0;
                yield {
                    board: [...boardCopy],
                    row: targetRow,
                    col: targetCol,
                    val: 0,
                    type: 'backtrack'
                };
            }

            return false;
        }

        const success = yield* solveInternal();
        yield {
            board: [...boardCopy],
            success: success,
            type: success ? 'complete' : 'failed'
        };
    }

    // Smart Hint System with Randomization and Targeted Selection
    static getHint(currentBoard, solutionBoard, selectedCellIdx = null) {
        const possibleHints = [];

        if (selectedCellIdx !== null && currentBoard[selectedCellIdx] === 0) {
            const r = Math.floor(selectedCellIdx / 9);
            const c = selectedCellIdx % 9;
            const val = solutionBoard[selectedCellIdx];
            const candidates = this.getCandidates(currentBoard, r, c);
            
            let type = 'Deduction Hint';
            let explanation = `Placing <strong>${val}</strong> at Row ${r + 1}, Column ${c + 1} unlocks the grid.`;

            if (candidates.length === 1) {
                type = 'Naked Single';
                explanation = `Selected cell Row ${r + 1}, Column ${c + 1} has only one valid candidate: <strong>${val}</strong>.`;
            }

            return {
                row: r,
                col: c,
                val: val,
                type: type,
                explanation: explanation
            };
        }

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const idx = r * 9 + c;
                if (currentBoard[idx] === 0) {
                    const candidates = this.getCandidates(currentBoard, r, c);
                    const val = solutionBoard[idx];

                    if (candidates.length === 1) {
                        possibleHints.push({
                            row: r,
                            col: c,
                            val: val,
                            priority: 1,
                            type: 'Naked Single',
                            explanation: `Row ${r + 1}, Column ${c + 1} has only one possible number left: <strong>${val}</strong>.`
                        });
                    } else {
                        possibleHints.push({
                            row: r,
                            col: c,
                            val: val,
                            priority: 2,
                            type: 'Grid Deduction',
                            explanation: `Placing <strong>${val}</strong> at Row ${r + 1}, Column ${c + 1} progresses the puzzle.`
                        });
                    }
                }
            }
        }

        if (possibleHints.length === 0) return null;

        const nakedSingles = possibleHints.filter(h => h.priority === 1);
        if (nakedSingles.length > 0) {
            return nakedSingles[Math.floor(Math.random() * nakedSingles.length)];
        }

        return possibleHints[Math.floor(Math.random() * possibleHints.length)];
    }
}
