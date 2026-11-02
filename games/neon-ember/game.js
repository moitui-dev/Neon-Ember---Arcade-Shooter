function gameOver() {
    // ... existing game over UI logic ...

    // Dispatch final score to Omni Gaming Network Portal
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'GAME_SCORE_SUBMIT',
            gameId: 'neon-ember',
            score: score // passes final player score variable
        }, '*');
    }
}