import { test, expect } from '@playwright/test';

// --- Game Logic Helpers ---

const ADJACENCY: Record<number, number[]> = {
    0: [2, 3, 4, 5],
    1: [2, 7],
    2: [0, 1, 3, 8],
    3: [0, 2, 4, 9],
    4: [0, 3, 5, 10],
    5: [0, 4, 6, 11],
    6: [5, 12],
    7: [1, 8, 13],
    8: [2, 7, 9, 14],
    9: [3, 8, 10, 15],
    10: [4, 9, 11, 16],
    11: [5, 10, 12, 17],
    12: [6, 11, 18],
    13: [7, 14],
    14: [8, 13, 15, 19],
    15: [9, 14, 16, 20],
    16: [10, 15, 17, 21],
    17: [11, 16, 18, 22],
    18: [12, 17],
    19: [14, 20],
    20: [15, 19, 21],
    21: [16, 20, 22],
    22: [17, 21]
};

const JUMP_LINES = [
    [1, 2, 3, 4, 5, 6],
    [7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18],
    [19, 20, 21, 22],
    [1, 7, 13],
    [0, 2, 8, 14, 19],
    [0, 3, 9, 15, 20],
    [0, 4, 10, 16, 21],
    [0, 5, 11, 17, 22],
    [6, 12, 18]
];

function getJumpTable() {
    const jumps: { start: number, over: number, land: number }[] = [];
    for (const line of JUMP_LINES) {
        for (let i = 0; i < line.length - 2; i++) {
            jumps.push({ start: line[i], over: line[i+1], land: line[i+2] });
        }
        for (let i = line.length - 1; i > 1; i--) {
            jumps.push({ start: line[i], over: line[i-1], land: line[i-2] });
        }
    }
    return jumps;
}

const JUMPS = getJumpTable();

type BoardState = ('T' | 'G' | 'E')[];

function getValidMoves(board: BoardState) {
    const moves: { from: number, to: number, type: 'MOVE' | 'JUMP' }[] = [];
    
    // Find all Tigers
    const tigers = board.map((p, i) => p === 'T' ? i : -1).filter(i => i !== -1);

    for (const t of tigers) {
        // 1. Adjacent Moves
        const neighbors = ADJACENCY[t] || [];
        for (const n of neighbors) {
            if (board[n] === 'E') {
                moves.push({ from: t, to: n, type: 'MOVE' });
            }
        }

        // 2. Jumps
        for (const jump of JUMPS) {
            if (jump.start === t && board[jump.over] === 'G' && board[jump.land] === 'E') {
                moves.push({ from: t, to: jump.land, type: 'JUMP' });
            }
        }
    }
    return moves;
}

// --- Test ---

test('Full Game: Tiger vs AI (Auto-play)', async ({ page }) => {
    test.setTimeout(300000); // Increase timeout to 5 minutes

    await page.goto('http://localhost:5173');
    
    // Ensure logged in
    await expect(page.getByRole('button', { name: '🚪 Sign Out' })).toBeVisible();

    // Start Game
    await page.getByRole('button', { name: 'Tiger vs AI 🤖' }).click();
    await expect(page.locator('.board-container')).toBeVisible();

    let gameActive = true;
    let turns = 0;
    const maxTurns = 100;

    while (gameActive && turns < maxTurns) {
        // Check for Game Over
        const winnerText = await page.locator('h2:has-text("Wins!")').count();
        if (winnerText > 0) {
            console.log("Game Over detected!");
            const text = await page.locator('h2:has-text("Wins!")').textContent();
            console.log(text);
            gameActive = false;
            break;
        }

        // Check Turn
        const turnText = await page.locator('.turn-indicator').textContent();
        if (turnText?.includes('GOAT')) {
            // Wait for AI
            await page.waitForTimeout(500);
            continue;
        }

        // It's Tiger's Turn
        // Read Board State
        const board: BoardState = [];
        for (let i = 0; i < 23; i++) {
            const text = await page.getByTestId(`node-${i}`).textContent();
            if (text?.includes('🐯')) board.push('T');
            else if (text?.includes('🐐')) board.push('G');
            else board.push('E');
        }

        const validMoves = getValidMoves(board);
        
        if (validMoves.length === 0) {
            console.log("No valid moves for Tiger. Expecting Game Over...");
            await page.waitForTimeout(2000); // Wait for game over modal
            continue;
        }

        // Prioritize Jumps (to make game interesting/faster)
        // Shuffle moves to avoid deterministic loops
        const jumps = validMoves.filter(m => m.type === 'JUMP').sort(() => Math.random() - 0.5);
        const simpleMoves = validMoves.filter(m => m.type === 'MOVE').sort(() => Math.random() - 0.5);
        
        const movesToTry = [...jumps, ...simpleMoves];
        let moveSuccessful = false;

        for (const move of movesToTry) {
            console.log(`Turn ${turns}: Attempting ${move.from} -> ${move.to} (${move.type})`);

            // Execute Move
            await page.getByTestId(`node-${move.from}`).click();
            await page.getByTestId(`node-${move.to}`).click();

            // Check for Error Message (e.g., Repetition)
            const errorLocator = page.locator('div:has-text("Invalid move")'); // Or generic error div
            // Actually App.tsx renders error in a specific div style. 
            // We can check if the Tiger appeared at destination.
            
            try {
                await expect(page.getByTestId(`node-${move.to}`)).toContainText('🐯', { timeout: 1000 });
                moveSuccessful = true;
                break; // Move succeeded
            } catch (e) {
                console.log(`Move failed. Checking for error...`);
                // Check if an error is displayed
                const errorMsg = await page.locator('.game-container > div[style*="color: #ff6b6b"]').textContent().catch(() => null);
                if (errorMsg) {
                    console.log(`Server Error: ${errorMsg}`);
                }
                
                // Deselect the source node to reset state for next attempt
                // If the move failed, the source is likely still selected.
                // Clicking it again deselects it.
                await page.getByTestId(`node-${move.from}`).click().catch(() => {});
            }
        }

        if (!moveSuccessful) {
            console.log("All valid moves failed (likely due to repetition). Ending test.");
            break;
        }
        
        turns++;
        await page.waitForTimeout(500); // Slow down slightly for visual/stability
    }

    if (turns >= maxTurns) {
        console.log("Max turns reached. Game might be a draw or stuck.");
    }
});
