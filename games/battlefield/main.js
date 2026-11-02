import * as THREE from 'three';
import { initFirstPersonControls } from './control.js';
import { initVoiceChat } from './voice.js';

let scene, camera, renderer;
let controls;
let isScoped = false;
let gunGroup;

let currentWeapon = 'M16';
let selectedMap = 'city'; // 'city', 'forest', 'desert'
let timeMode = 'day';     // 'day', 'night', 'auto'
let graphicsQuality = 'high';

let ammoInMag = 30;
let reserveAmmo = 90;
let isReloading = false;
let health = 100;
let shieldEnergy = 0;
let isShieldActive = false;
let isGameOver = false;

let stats = {
    kills: 0,
    headshots: 0,
    shotsFired: 0,
    shotsHit: 0,
    rank: 'Private'
};

const enemies = [];
const lootCrates = [];
const floatingTexts = [];
const debrisObjects = [];
const environmentObjects = [];
let dirLight, ambientLight, cloudsGroup;
let miniMapCtx, miniMapCanvas;
let prevTime = performance.now();

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'shot') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'enemy_shot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(240, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    } else if (type === 'reload') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.setValueAtTime(300, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'shield') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'loot') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'damage') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    }
}

function initGame() {
    const container = document.getElementById('game-canvas-container');
    if (!container) return;

    scene = new THREE.Scene();
    updateLightingAndSky();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 10);

    renderer = new THREE.WebGLRenderer({ antialias: graphicsQuality === 'high', powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, graphicsQuality === 'high' ? 1.5 : 1.0));
    renderer.shadowMap.enabled = (graphicsQuality === 'high');
    container.appendChild(renderer.domElement);

    updateWeaponMesh();
    buildEnvironment(selectedMap);
    controls = initFirstPersonControls(camera, environmentObjects);

    for (let i = 0; i < 7; i++) spawnTacticalSoldier();

    setupLobbyUI();
    initCharacterPreview();
    createHUDOverlays();
    animate();
}

function updateLightingAndSky() {
    if (timeMode === 'day') {
        scene.background = new THREE.Color(0x38bdf8);
        scene.fog = new THREE.FogExp2(0x38bdf8, 0.003);
        if (ambientLight) ambientLight.intensity = 0.8;
        if (dirLight) dirLight.intensity = 1.2;
    } else if (timeMode === 'night') {
        scene.background = new THREE.Color(0x0a0e1a);
        scene.fog = new THREE.FogExp2(0x0a0e1a, 0.007);
        if (ambientLight) ambientLight.intensity = 0.3;
        if (dirLight) dirLight.intensity = 0.4;
    } else {
        const hour = new Date().getHours();
        const isDay = hour >= 6 && hour < 18;
        scene.background = new THREE.Color(isDay ? 0x38bdf8 : 0x0a0e1a);
        scene.fog = new THREE.FogExp2(isDay ? 0x38bdf8 : 0x0a0e1a, isDay ? 0.003 : 0.007);
    }

    if (!ambientLight) {
        ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
    }
    if (!dirLight) {
        dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
        dirLight.position.set(100, 150, 50);
        dirLight.castShadow = true;
        scene.add(dirLight);
    }
}

function initDebris() {
    debrisObjects.forEach(d => scene.remove(d));
    debrisObjects.length = 0;

    const canMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8 });
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });

    for (let i = 0; i < 40; i++) {
        let mesh = Math.random() > 0.5 ?
            new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.25, 8), canMat) :
            new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), paperMat);

        if (mesh.geometry.type === 'PlaneGeometry') mesh.rotation.x = -Math.PI / 2;

        mesh.position.set((Math.random() - 0.5) * 180, 0.1, (Math.random() - 0.5) * 180);
        mesh.userData = {
            velocity: new THREE.Vector2((2.0 + Math.random() * 1.5), (Math.random() - 0.5) * 0.5),
            rotSpeed: Math.random() * 2
        };
        scene.add(mesh);
        debrisObjects.push(mesh);
    }
}

function updateWeaponMesh() {
    if (gunGroup) camera.remove(gunGroup);
    gunGroup = new THREE.Group();

    if (currentWeapon === 'M16') {
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e1b2e, metalness: 0.8, roughness: 0.3 });
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.6), bodyMat);
        receiver.position.set(0.2, -0.22, -0.5);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 }));
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.2, -0.21, -0.85);

        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x332244 }));
        mag.position.set(0.2, -0.35, -0.45);

        gunGroup.add(receiver, barrel, mag);
    } else if (currentWeapon === 'Bat') {
        const batMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.6 });
        const batMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.8, 12), batMat);
        batMesh.rotation.x = Math.PI / 3;
        batMesh.position.set(0.25, -0.25, -0.45);
        gunGroup.add(batMesh);
    } else if (currentWeapon === 'Sword') {
        const hiltMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9 });
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
        const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.2), hiltMat);
        hilt.position.set(0.25, -0.3, -0.35);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.9), bladeMat);
        blade.position.set(0.25, -0.28, -0.8);
        gunGroup.add(hilt, blade);
    }

    camera.add(gunGroup);
    scene.add(camera);
}

function spawnTacticalSoldier() {
    const group = new THREE.Group();
    const isFemale = Math.random() > 0.5;

    const suitMat = new THREE.MeshStandardMaterial({ color: isFemale ? 0x472d42 : 0x1e293b, roughness: 0.7 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6 });

    const torsoWidth = isFemale ? 0.22 : 0.28;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoWidth + 0.03, torsoWidth, 0.75, 12), suitMat);
    torso.position.y = 1.1;

    const vest = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth * 2 + 0.05, 0.5, 0.3), armorMat);
    vest.position.set(0, 1.15, 0);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshStandardMaterial({ color: 0xd4a373 }));
    head.position.y = 1.72;

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), armorMat);
    helmet.position.y = 1.78;

    const rifleGroup = new THREE.Group();
    const rifleBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 1.1), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 }));
    const rifleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9 }));
    rifleBarrel.rotation.x = Math.PI / 2;
    rifleBarrel.position.set(0, 0, -0.8);
    rifleGroup.add(rifleBody, rifleBarrel);
    rifleGroup.position.set(0.2, 1.15, -0.4);
    group.add(rifleGroup);

    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.65, 8), suitMat);
    leftArm.position.set(-(torsoWidth + 0.08), 1.35, 0);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.65, 8), suitMat);
    rightArm.position.set(torsoWidth + 0.08, 1.35, 0);

    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.7, 8), suitMat);
    leftLeg.position.set(-0.12, 0.7, 0);

    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.7, 8), suitMat);
    rightLeg.position.set(0.12, 0.7, 0);

    group.add(torso, vest, head, helmet, leftArm, rightArm, leftLeg, rightLeg);

    const angle = Math.random() * Math.PI * 2;
    const dist = 35 + Math.random() * 45;
    group.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

    group.userData = {
        health: 100,
        speed: isFemale ? 3.8 : 3.2,
        lastShotTime: 0,
        idealRange: 16 + Math.random() * 8
    };

    scene.add(group);
    enemies.push(group);
}

function spawnFloatingText(pos, text, color = '#ef4444') {
    const div = document.createElement('div');
    div.innerText = text;
    div.style.position = 'absolute';
    div.style.color = color;
    div.style.fontWeight = 'bold';
    div.style.fontSize = '20px';
    div.style.textShadow = '0 0 4px #000';
    div.style.pointerEvents = 'none';
    document.body.appendChild(div);

    floatingTexts.push({ element: div, position: pos.clone().add(new THREE.Vector3(0, 2.2, 0)), life: 1.0 });
}

function spawnHitEffect(pos) {
    const sparkGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const spark = new THREE.Mesh(sparkGeo, sparkMat);
    spark.position.copy(pos);
    scene.add(spark);
    setTimeout(() => scene.remove(spark), 120);
}

function spawnLootCrate(pos) {
    const crateGroup = new THREE.Group();
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5, metalness: 0.3 });
    const latchMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 });

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), boxMat);
    box.castShadow = true;

    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), latchMat);
    latch.position.set(0, 0.05, 0.2);

    crateGroup.add(box, latch);
    crateGroup.position.set(pos.x, 0.18, pos.z);

    scene.add(crateGroup);
    lootCrates.push(crateGroup);
}

function reloadWeapon() {
    if (isReloading || reserveAmmo <= 0 || ammoInMag >= 30) return;
    isReloading = true;
    playSound('reload');

    const ammoDisplay = document.getElementById('ammo-val');
    if (ammoDisplay) ammoDisplay.innerText = `RELOADING...`;

    setTimeout(() => {
        const needed = 30 - ammoInMag;
        const reloadAmount = Math.min(needed, reserveAmmo);
        ammoInMag += reloadAmount;
        reserveAmmo -= reloadAmount;
        isReloading = false;
        if (ammoDisplay) ammoDisplay.innerText = `${ammoInMag} / ${reserveAmmo} (M16)`;
    }, 1500);
}

function activateShield() {
    if (shieldEnergy < 100 || isShieldActive) return;
    isShieldActive = true;
    shieldEnergy = 0;
    playSound('shield');

    const shieldIndicator = document.getElementById('shield-status');
    if (shieldIndicator) shieldIndicator.innerText = `SHIELD ACTIVE (5s)`;
    document.getElementById('shield-bar').style.width = `0%`;

    setTimeout(() => {
        isShieldActive = false;
        if (shieldIndicator) shieldIndicator.innerText = `SHIELD READY (Press Q)`;
    }, 5000);
}

function buildEnvironment(mapType) {
    environmentObjects.forEach(obj => scene.remove(obj));
    environmentObjects.length = 0;

    if (mapType === 'city') {
        const floorGeo = new THREE.PlaneGeometry(360, 360);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);
        environmentObjects.push(floor);

        const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
        for (let pos of [-50, 0, 50]) {
            const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 360), tarmacMat);
            road.rotation.x = -Math.PI / 2;
            road.position.set(pos, 0.01, 0);
            scene.add(road);
            environmentObjects.push(road);
        }

        const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 1, 16), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
        fountainBase.position.set(20, 0.5, 20);
        const statue = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 8), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8 }));
        statue.position.set(20, 3, 20);
        scene.add(fountainBase, statue);
        environmentObjects.push(fountainBase, statue);

        const bWallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 });
        for (let x = -120; x <= 120; x += 40) {
            for (let z = -120; z <= 120; z += 40) {
                if (Math.abs(x) < 18 || Math.abs(z) < 18) continue;
                const height = 16 + Math.random() * 8;
                const mainBox = new THREE.Mesh(new THREE.BoxGeometry(14, height, 14), bWallMat);
                mainBox.position.set(x, height / 2, z);
                scene.add(mainBox);
                environmentObjects.push(mainBox);
            }
        }
    } else if (mapType === 'forest') {
        const terrainGeo = new THREE.PlaneGeometry(360, 360, 32, 32);
        const posAttr = terrainGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            posAttr.setZ(i, Math.sin(vx * 0.03) * Math.cos(vy * 0.03) * 6);
        }
        terrainGeo.computeVertexNormals();

        const terrainMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
        const terrain = new THREE.Mesh(terrainGeo, terrainMat);
        terrain.rotation.x = -Math.PI / 2;
        scene.add(terrain);
        environmentObjects.push(terrain);

        const waterGeo = new THREE.PlaneGeometry(20, 360);
        const waterMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.2, transparent: true, opacity: 0.8 });
        const waterStream = new THREE.Mesh(waterGeo, waterMat);
        waterStream.rotation.x = -Math.PI / 2;
        waterStream.position.set(0, 0.2, 0);
        scene.add(waterStream);
        environmentObjects.push(waterStream);
    } else if (mapType === 'desert') {
        const sandMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 });
        const desertFloor = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), sandMat);
        desertFloor.rotation.x = -Math.PI / 2;
        scene.add(desertFloor);
        environmentObjects.push(desertFloor);
    }

    if (timeMode !== 'night') initDebris();
}

function initCharacterPreview() {
    const previewContainer = document.getElementById('character-preview-container');
    if (!previewContainer) return;
    const width = previewContainer.clientWidth || 350;
    const height = previewContainer.clientHeight || 180;

    const pScene = new THREE.Scene();
    pScene.background = new THREE.Color(0x05070a);
    const pCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 50);
    pCamera.position.set(0, 1.2, 3.5);

    const pRenderer = new THREE.WebGLRenderer({ antialias: true });
    pRenderer.setSize(width, height);
    previewContainer.appendChild(pRenderer.domElement);
    pScene.add(new THREE.DirectionalLight(0xffffff, 1.5), new THREE.AmbientLight(0xffffff, 0.5));

    const charGroup = new THREE.Group();
    const previewTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 1.2, 16), new THREE.MeshStandardMaterial({ color: 0x581c87 }));
    previewTorso.position.y = 0.6;
    charGroup.add(previewTorso);
    pScene.add(charGroup);

    function animPrev() {
        requestAnimationFrame(animPrev);
        charGroup.rotation.y += 0.015;
        pRenderer.render(pScene, pCamera);
    }
    animPrev();
}

function createHUDOverlays() {
    // Mini-map on bottom-left
    const mapDiv = document.createElement('div');
    mapDiv.id = 'minimap-container';
    mapDiv.style.position = 'fixed';
    mapDiv.style.left = '20px';
    mapDiv.style.bottom = '110px';
    mapDiv.style.width = '160px';
    mapDiv.style.height = '160px';
    mapDiv.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
    mapDiv.style.border = '2px solid #38bdf8';
    mapDiv.style.borderRadius = '12px';
    mapDiv.style.overflow = 'hidden';
    mapDiv.style.zIndex = '100';

    miniMapCanvas = document.createElement('canvas');
    miniMapCanvas.width = 160;
    miniMapCanvas.height = 160;
    miniMapCanvas.style.width = '100%';
    miniMapCanvas.style.height = '100%';
    mapDiv.appendChild(miniMapCanvas);
    document.body.appendChild(mapDiv);
    miniMapCtx = miniMapCanvas.getContext('2d');

    // Combat Stats HUD
    const hudInfo = document.createElement('div');
    hudInfo.id = 'combat-hud-stats';
    hudInfo.style.position = 'fixed';
    hudInfo.style.left = '20px';
    hudInfo.style.top = '105px';
    hudInfo.style.color = '#f8fafc';
    hudInfo.style.fontFamily = 'sans-serif';
    hudInfo.style.fontSize = '14px';
    hudInfo.style.textShadow = '0 0 3px #000';
    hudInfo.style.zIndex = '100';
    hudInfo.innerHTML = `
        <div>Rank: <span id="rank-val" style="color: #facc15; font-weight: bold;">Private</span></div>
        <div>Kills: <span id="kills-val">0</span> | Headshots: <span id="headshots-val">0</span></div>
        <div style="margin-top: 4px;">Shield: <span id="shield-status" style="color: #38bdf8; font-weight: bold;">Charging...</span></div>
        <div style="width: 140px; height: 8px; background: #334155; border-radius: 4px; overflow: hidden; margin-top: 3px;">
            <div id="shield-bar" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.2s;"></div>
        </div>
    `;
    document.body.appendChild(hudInfo);

    // Game Over Overlay (Starts Hidden)
    const overlay = document.createElement('div');
    overlay.id = 'game-over-screen';
    overlay.className = 'hidden';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(10, 14, 26, 0.85)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '9999';

    overlay.innerHTML = `
        <h1 style="color: #ef4444; font-size: 3rem; font-family: sans-serif; letter-spacing: 2px; margin-bottom: 10px;">MISSION FAILED</h1>
        <p style="color: #cbd5e1; font-size: 1.2rem; margin-bottom: 30px;">You were eliminated in the tactical sector.</p>
        <button id="redeploy-btn" style="background-color: #9333ea; color: white; border: none; padding: 14px 28px; font-size: 1.1rem; font-weight: bold; border-radius: 8px; cursor: pointer;">DEPLOY AGAIN</button>
    `;
    document.body.appendChild(overlay);

    document.getElementById('redeploy-btn').onclick = () => {
        health = 100;
        ammoInMag = 30;
        reserveAmmo = 90;
        shieldEnergy = 0;
        isGameOver = false;
        document.getElementById('health-val').innerText = '100';
        document.getElementById('ammo-val').innerText = `${ammoInMag} / ${reserveAmmo} (M16)`;
        overlay.classList.add('hidden');
        document.body.requestPointerLock();
    };
}

function setupLobbyUI() {
    const deployBtn = document.getElementById('start-deployment-btn');
    if (deployBtn) {
        deployBtn.onclick = () => {
            document.getElementById('lobby-menu').classList.add('hidden');
            document.getElementById('ui-overlay').classList.remove('hidden');
            document.getElementById('crosshair').classList.remove('hidden');
            document.getElementById('compass-container').classList.remove('hidden');

            document.body.requestPointerLock();
            initVoiceChat();
        };
    }

    // Cleanly structure story briefing and settings gear without overlapping elements
    const lobbyMenu = document.getElementById('lobby-menu');
    if (lobbyMenu && !document.getElementById('story-desc')) {
        lobbyMenu.style.overflowY = 'auto';
        lobbyMenu.style.paddingTop = '40px';

        const storyDiv = document.createElement('div');
        storyDiv.id = 'story-desc';
        storyDiv.style.padding = '10px 0';
        storyDiv.style.color = '#94a3b8';
        storyDiv.style.fontSize = '0.85rem';
        storyDiv.style.lineHeight = '1.4';
        storyDiv.style.maxWidth = '320px';
        storyDiv.innerHTML = `<strong>Mission Briefing:</strong> Deploy into hostile sectors armed with assault rifles and tactical melee gear. Eliminate opposing combat squads in last-man-standing gunfights, collect ammo crates from fallen foes, and climb the military ranks!`;

        // Insert right beneath the title heading nicely
        const titleEl = lobbyMenu.querySelector('h1') || lobbyMenu.children[0];
        if (titleEl) titleEl.insertAdjacentElement('afterend', storyDiv);

        // Settings Gear Button
        const gearBtn = document.createElement('button');
        gearBtn.innerHTML = '⚙️ Settings';
        gearBtn.style.position = 'absolute';
        gearBtn.style.top = '20px';
        gearBtn.style.right = '20px';
        gearBtn.style.background = '#1e293b';
        gearBtn.style.color = '#fff';
        gearBtn.style.border = '1px solid #334155';
        gearBtn.style.padding = '8px 14px';
        gearBtn.style.borderRadius = '6px';
        gearBtn.style.cursor = 'pointer';
        gearBtn.style.zIndex = '1000';

        // Settings Modal
        const settingsModal = document.createElement('div');
        settingsModal.id = 'settings-modal';
        settingsModal.className = 'hidden';
        settingsModal.style.position = 'fixed';
        settingsModal.style.top = '0';
        settingsModal.style.left = '0';
        settingsModal.style.width = '100vw';
        settingsModal.style.height = '100vh';
        settingsModal.style.backgroundColor = 'rgba(10, 14, 26, 0.9)';
        settingsModal.style.display = 'flex';
        settingsModal.style.flexDirection = 'column';
        settingsModal.style.justifyContent = 'center';
        settingsModal.style.alignItems = 'center';
        settingsModal.style.zIndex = '2000';

        settingsModal.innerHTML = `
            <div style="background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155; width: 350px;">
                <h2 style="color: #f8fafc; margin-bottom: 20px;">Game Settings</h2>
                <label style="color: #cbd5e1; display: block; margin-bottom: 8px;">Time of Day:</label>
                <select id="setting-time" style="width: 100%; padding: 8px; margin-bottom: 15px; background: #0f172a; color: #fff; border-radius: 6px;">
                    <option value="day">Day</option>
                    <option value="night">Night</option>
                    <option value="auto">Auto (System Time)</option>
                </select>

                <label style="color: #cbd5e1; display: block; margin-bottom: 8px;">Combat Sector:</label>
                <select id="setting-map" style="width: 100%; padding: 8px; margin-bottom: 15px; background: #0f172a; color: #fff; border-radius: 6px;">
                    <option value="city">City Ruins</option>
                    <option value="forest">Green Forest & Hills</option>
                    <option value="desert">Arid Desert</option>
                </select>

                <label style="color: #cbd5e1; display: block; margin-bottom: 8px;">Graphics Quality:</label>
                <select id="setting-gfx" style="width: 100%; padding: 8px; margin-bottom: 20px; background: #0f172a; color: #fff; border-radius: 6px;">
                    <option value="high">High (Shadows & Antialias)</option>
                    <option value="maxfps">Max FPS (Performance)</option>
                </select>

                <button id="close-settings" style="width: 100%; background: #9333ea; color: white; border: none; padding: 10px; font-weight: bold; border-radius: 6px; cursor: pointer;">Save & Close</button>
            </div>
        `;
        document.body.appendChild(settingsModal);
        document.body.appendChild(gearBtn);

        gearBtn.onclick = () => settingsModal.classList.remove('hidden');
        document.getElementById('close-settings').onclick = () => {
            timeMode = document.getElementById('setting-time').value;
            selectedMap = document.getElementById('setting-map').value;
            graphicsQuality = document.getElementById('setting-gfx').value;
            settingsModal.classList.add('hidden');
            updateLightingAndSky();
            buildEnvironment(selectedMap);
        };
    }
}

function updateMiniMap() {
    if (!miniMapCtx) return;
    miniMapCtx.clearRect(0, 0, 160, 160);

    miniMapCtx.fillStyle = '#0f172a';
    miniMapCtx.fillRect(0, 0, 160, 160);

    const px = 80;
    const py = 80;

    for (let enemy of enemies) {
        const dx = (enemy.position.x - camera.position.x) * 2.0;
        const dz = (enemy.position.z - camera.position.z) * 2.0;
        if (Math.abs(dx) < 80 && Math.abs(dz) < 80) {
            miniMapCtx.fillStyle = '#ef4444';
            miniMapCtx.beginPath();
            miniMapCtx.arc(px + dx, py + dz, 3, 0, Math.PI * 2);
            miniMapCtx.fill();
        }
    }

    miniMapCtx.fillStyle = '#38bdf8';
    miniMapCtx.beginPath();
    miniMapCtx.arc(px, py, 4, 0, Math.PI * 2);
    miniMapCtx.fill();
}

function updateCompassAndElevation() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    let angleDeg = Math.atan2(-dir.x, -dir.z) * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    const needle = document.getElementById('compass-needle');
    if (needle) needle.style.transform = `rotate(${angleDeg}deg)`;
}

function performAction() {
    if (isGameOver) return;
    stats.shotsFired++;

    if (currentWeapon === 'M16') {
        if (isReloading) return;
        if (ammoInMag <= 0) {
            reloadWeapon();
            return;
        }
        ammoInMag--;
        document.getElementById('ammo-val').innerText = `${ammoInMag} / ${reserveAmmo} (M16)`;
        playSound('shot');
    } else {
        playSound('swing');
    }

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        let hitObj = intersects[0].object;
        while (hitObj.parent && !hitObj.userData.health && hitObj.parent !== scene) {
            hitObj = hitObj.parent;
        }

        if (hitObj.userData && hitObj.userData.health) {
            const dist = camera.position.distanceTo(hitObj.position);
            if ((currentWeapon === 'Bat' || currentWeapon === 'Sword') && dist > 3.5) return;

            stats.shotsHit++;
            const isHeadshot = intersects[0].point.y > hitObj.position.y + 1.5;
            if (isHeadshot) stats.headshots++;

            const damageVal = currentWeapon === 'M16' ? (isHeadshot ? 70 : 35) : (currentWeapon === 'Sword' ? 85 : 55);
            hitObj.userData.health -= damageVal;
            playSound('hit');
            spawnHitEffect(intersects[0].point);
            spawnFloatingText(hitObj.position, isHeadshot ? `HEADSHOT -${damageVal}` : `-${damageVal}`, isHeadshot ? '#facc15' : '#ef4444');

            if (hitObj.userData.health <= 0) {
                stats.kills++;
                shieldEnergy = Math.min(100, shieldEnergy + 35);
                document.getElementById('shield-bar').style.width = `${shieldEnergy}%`;
                if (shieldEnergy >= 100) {
                    document.getElementById('shield-status').innerText = `SHIELD READY (Press Q)`;
                }

                if (stats.kills >= 10) stats.rank = 'General';
                else if (stats.kills >= 6) stats.rank = 'Sergeant';
                else if (stats.kills >= 3) stats.rank = 'Corporal';
                document.getElementById('rank-val').innerText = stats.rank;
                document.getElementById('kills-val').innerText = stats.kills;
                document.getElementById('headshots-val').innerText = stats.headshots;

                spawnLootCrate(hitObj.position);
                scene.remove(hitObj);
                const idx = enemies.indexOf(hitObj);
                if (idx > -1) enemies.splice(idx, 1);
                setTimeout(spawnTacticalSoldier, 4000);
            }
        }
    }
}

document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== document.body || isGameOver) return;
    if (e.button === 0) performAction();
    else if (e.button === 2) {
        isScoped = !isScoped;
        camera.fov = isScoped ? 35 : 75;
        camera.updateProjectionMatrix();
    }
});

document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', (e) => {
    if (document.pointerLockElement !== document.body || isGameOver) return;
    if (e.code === 'KeyR') reloadWeapon();
    else if (e.code === 'KeyQ') activateShield();
    else if (e.key === '1') {
        currentWeapon = 'M16';
        updateWeaponMesh();
        document.getElementById('ammo-val').innerText = `${ammoInMag} / ${reserveAmmo} (M16)`;
    } else if (e.key === '2') {
        currentWeapon = 'Bat';
        updateWeaponMesh();
        document.getElementById('ammo-val').innerText = `Melee Ready (Bat)`;
    } else if (e.key === '3') {
        currentWeapon = 'Sword';
        updateWeaponMesh();
        document.getElementById('ammo-val').innerText = `Melee Ready (Sword)`;
    }
});

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (!isGameOver && controls) controls.update(delta);
    updateCompassAndElevation();
    updateMiniMap();

    for (let debris of debrisObjects) {
        debris.position.x += debris.userData.velocity.x * delta;
        debris.position.z += debris.userData.velocity.y * delta;
        debris.rotation.z += debris.userData.rotSpeed * delta;
        if (debris.position.x > 180) debris.position.x = -180;
        if (debris.position.z > 180) debris.position.z = -180;
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.life -= delta;
        ft.position.y += delta * 1.2;

        const vector = ft.position.clone();
        vector.project(camera);

        const x = (vector.x * .5 + .5) * window.innerWidth;
        const y = (-(vector.y * .5) + .5) * window.innerHeight;

        ft.element.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;
        ft.element.style.opacity = ft.life;

        if (ft.life <= 0) {
            ft.element.remove();
            floatingTexts.splice(i, 1);
        }
    }

    for (let i = lootCrates.length - 1; i >= 0; i--) {
        const crate = lootCrates[i];
        if (camera.position.distanceTo(crate.position) < 2.0) {
            reserveAmmo += 30;
            playSound('loot');
            scene.remove(crate);
            lootCrates.splice(i, 1);
            const ammoDisplay = document.getElementById('ammo-val');
            if (ammoDisplay && !isReloading) {
                ammoDisplay.innerText = `${ammoInMag} / ${reserveAmmo} (M16)`;
            }
        }
    }

    if (!isGameOver) {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            const distToPlayer = enemy.position.distanceTo(camera.position);

            enemy.lookAt(camera.position.x, enemy.position.y, camera.position.z);

            if (distToPlayer > enemy.userData.idealRange + 3) {
                const dir = new THREE.Vector3().subVectors(camera.position, enemy.position);
                dir.y = 0;
                dir.normalize();
                enemy.position.addScaledVector(dir, enemy.userData.speed * delta);
            } else if (distToPlayer < enemy.userData.idealRange - 3) {
                const dir = new THREE.Vector3().subVectors(enemy.position, camera.position);
                dir.y = 0;
                dir.normalize();
                enemy.position.addScaledVector(dir, enemy.userData.speed * 0.7 * delta);
            }

            if (distToPlayer <= 25) {
                if (time - enemy.userData.lastShotTime > 2200) {
                    enemy.userData.lastShotTime = time;
                    playSound('enemy_shot');

                    if (!isShieldActive) {
                        health = Math.max(0, health - 8);
                        document.getElementById('health-val').innerText = Math.floor(health);
                        playSound('damage');
                    }

                    if (health <= 0) {
                        isGameOver = true;
                        document.exitPointerLock();
                        document.getElementById('game-over-screen').classList.remove('hidden');
                    }
                }
            }
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}