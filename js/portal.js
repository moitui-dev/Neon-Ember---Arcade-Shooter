// Listen for postMessage score submissions from internal/external game iframes
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GAME_SCORE_SUBMIT') {
        const { gameId, score } = event.data;
        const currentUser = JSON.parse(localStorage.getItem('omni_current_user'));
        const username = currentUser ? currentUser.username : 'Guest Player';

        saveScore(gameId, username, score);
        console.log(`Leaderboard updated: ${username} scored ${score} in ${gameId}`);
    }
});