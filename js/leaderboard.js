// Global Leaderboard & Score Handler for Omni Gaming Network

const LEADERBOARD_STORAGE_KEY = 'omni_leaderboard_data';

// Initialize default scores if empty
function initLeaderboard() {
    if (!localStorage.getItem(LEADERBOARD_STORAGE_KEY)) {
        const defaultScores = [
            { gameId: 'neon-ember', username: 'OmniMaster', score: 12500, date: '2026-11-01' },
            { gameId: 'neon-ember', username: 'CyberNinja', score: 9800, date: '2026-11-02' },
            { gameId: 'cyber-grid-arena', username: 'GridRunner', score: 450, date: '2026-11-02' }
        ];
        localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(defaultScores));
    }
}

// Save a new score
function saveScore(gameId, username, score) {
    initLeaderboard();
    let scores = JSON.parse(localStorage.getItem(LEADERBOARD_STORAGE_KEY));

    scores.push({
        gameId: gameId,
        username: username || 'Anonymous Player',
        score: Number(score),
        date: new Date().toISOString().split('T')[0]
    });

    // Sort descending by score
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(scores));
}

// Open Leaderboard Modal & Render Rankings
function openLeaderboardModal() {
    initLeaderboard();
    const scores = JSON.parse(localStorage.getItem(LEADERBOARD_STORAGE_KEY));

    const container = document.getElementById('leaderboard-list-container');
    container.innerHTML = '';

    if (scores.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No high scores recorded yet.</p>`;
    } else {
        scores.forEach((entry, index) => {
            const row = document.createElement('div');
            row.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: var(--bg-slate); padding: 0.75rem 1rem; border-radius: 6px; border: 1px solid var(--border-slate); margin-bottom: 0.5rem;";

            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span style="font-weight: bold; color: ${index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : 'var(--text-muted)'};">#${index + 1}</span>
                    <div>
                        <div style="font-weight: 600;">${entry.username}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Game: ${entry.gameId}</div>
                    </div>
                </div>
                <div style="font-weight: 700; color: var(--burgundy-glow); font-size: 1.1rem;">${entry.score.toLocaleString()} pts</div>
            `;
            container.appendChild(row);
        });
    }

    document.getElementById('leaderboard-modal').classList.add('active');
}

function closeLeaderboardModal() {
    document.getElementById('leaderboard-modal').classList.remove('active');
}