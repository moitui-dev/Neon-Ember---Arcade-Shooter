document.addEventListener('DOMContentLoaded', () => {
    loadGames();
});

let allGames = [];

async function loadGames() {
    try {
        const response = await fetch('games/registry.json');
        allGames = await response.json();
        renderGames(allGames);
    } catch (error) {
        console.error('Failed to load game registry:', error);
        document.getElementById('game-grid').innerHTML = '<p style="color: #ef4444; grid-column: 1/-1; text-align: center;">Failed to load game library.</p>';
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
    // Update active filter chip UI
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