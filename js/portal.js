async function loadGames() {
    try {
        // Try fetching from absolute root or relative path
        const response = await fetch('./games/registry.json');
        if (!response.ok) throw new Error('Registry not found');
        allGames = await response.json();
        renderGames(allGames);
    } catch (error) {
        console.error('Failed to load game registry, trying alternative path...', error);
        try {
            // Fallback path for local server roots
            const fallbackResponse = await fetch('/games/registry.json');
            allGames = await fallbackResponse.json();
            renderGames(allGames);
        } catch (err) {
            console.error('All registry fetch attempts failed:', err);
            document.getElementById('game-grid').innerHTML = '<p style="color: #ef4444; grid-column: 1/-1; text-align: center;">Failed to load game library. Check console.</p>';
        }
    }
}