document.addEventListener('DOMContentLoaded', () => {
    loadGames();
});

let allGames = [];

async function loadGames() {
    try {
        // Primary fetch for root-level HTML deployment structure
        const response = await fetch('games/registry.json');
        if (!response.ok) throw new Error('Registry not found');
        allGames = await response.json();
        renderGames(allGames);
    } catch (error) {
        console.error('Trying alternative registry path...', error);
        try {
            // Fallback path if hosted from a subdirectory
            const fallbackResponse = await fetch('../games/registry.json');
            allGames = await fallbackResponse.json();
            renderGames(allGames);
        } catch (err) {
            console.error('All registry fetch attempts failed:', err);
            document.getElementById('game-grid').innerHTML = '<p style="color: #ef4444; grid-column: 1/-1; text-align: center;">Failed to load game library. Check console.</p>';
        }
    }
}

function renderGames(games) {
    const grid = document.getElementById('game-grid');
    grid.innerHTML = '';

    games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.category = game.category;

        card.innerHTML = `
            <div class="game-thumb">
                <span style="font-size: 3rem;">🎮</span>
                <span class="game-badge">${game.badge}</span>
            </div>
            <div class="game-info">
                <div class="game-title">${game.title}</div>
                <div class="game-author">By ${game.author}</div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">${game.description}</p>
                <button class="play-btn" onclick="launchGame('${game.path}', '${game.title}')">Play Game</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterGames(category) {
    document.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    if (category === 'all') {
        renderGames(allGames);
    } else {
        const filtered = allGames.filter(g => g.category === category);
        renderGames(filtered);
    }
}

function launchGame(path, title) {
    document.getElementById('modal-game-title').innerText = title;
    const container = document.getElementById('modal-iframe-container');
    container.innerHTML = `<iframe src="${path}"></iframe>`;
    document.getElementById('game-modal').classList.add('active');
}

function closeGameModal() {
    document.getElementById('modal-iframe-container').innerHTML = '';
    document.getElementById('game-modal').classList.remove('active');
}

window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GAME_SCORE_SUBMIT') {
        const { gameId, score } = event.data;
        const currentUser = JSON.parse(localStorage.getItem('omni_current_user'));
        const username = currentUser ? currentUser.username : 'Guest Player';

        saveScore(gameId, username, score);
        console.log(`Leaderboard updated: ${username} scored ${score} in ${gameId}`);
    }
});