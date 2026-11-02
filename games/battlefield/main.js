// Configuration state chosen from menu
let selectedMap = 'city';
let selectedMode = 'solo';
let graphicsPreset = 'high';

// Menu UI Interactivity
document.querySelectorAll('#map-selector .option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#map-selector .option-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedMap = e.target.dataset.map;
    });
});

document.querySelectorAll('#mode-selector .option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#mode-selector .option-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedMode = e.target.dataset.mode;
    });
});

document.querySelectorAll('#graphics-selector .option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#graphics-selector .option-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        graphicsPreset = e.target.dataset.gfx;
    });
});

// Launch Deployment Button
document.getElementById('start-deployment-btn').addEventListener('click', () => {
    document.getElementById('lobby-menu').classList.add('hidden');
    document.getElementById('ui-overlay').classList.remove('hidden');
    document.getElementById('crosshair').classList.remove('hidden');
    document.getElementById('hud-mode').innerText = `MODE: ${selectedMode.toUpperCase()}`;

    // Apply graphics settings
    if (graphicsPreset === 'performance') {
        renderer.shadowMap.enabled = false;
        renderer.setPixelRatio(1);
    } else {
        renderer.shadowMap.enabled = true;
        renderer.setPixelRatio(window.devicePixelRatio);
    }

    // Build chosen map environment
    buildEnvironment(selectedMap);

    // Request Pointer Lock securely inside user click action
    document.body.requestPointerLock();
    initVoiceChat();
});