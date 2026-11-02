// Listen for score updates sent from external or internal game iframes
window.addEventListener('message', (event) => {
    // Optionally verify origin for trusted external domains
    if (event.data && event.data.type === 'GAME_SCORE_SUBMIT') {
        const { gameId, score, stats } = event.data;
        console.log(`Received score ${score} for ${gameId}`);
        // Function to save stats to your Firebase/Supabase backend
        saveUserStats(gameId, score, stats);
    }
});