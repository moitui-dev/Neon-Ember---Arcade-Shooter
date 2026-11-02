import * as THREE from 'three';
import { initFirstPersonControls } from './control.js';
import { initVoiceChat } from './voice.js';

let scene, camera, renderer;
let controls;
let isScoped = false;

// Game State
let currentWeapon = 'M16';
let selectedMap = 'city';
let selectedMode = 'solo';
let graphicsPreset = 'high';
let ammoCount = 30;
let health = 100;

const enemies = [];
const environmentObjects = [];
let dirLight, ambientLight;
let prevTime = performance.now();

function initGame() {
    const container = document.getElementById('game-canvas-container');
    if (!container) return;

    // 1. Scene & Camera Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x120d16);
    scene.fog = new THREE.FogExp2(0x120d16, 0.015);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting
    ambientLight = new THREE.AmbientLight(0xd8b4fe, 0.6);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xf3e8ff, 1.2);
    dirLight.position.set(40, 80, 40);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Floor & Grid
    const floorGeo = new THREE.PlaneGeometry(300, 300, 64, 64);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x181020, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(300, 60, 0x9333ea, 0x3b204e);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Initialize Environment & Controls
    buildEnvironment(selectedMap);
    controls = initFirstPersonControls(camera, environmentObjects);

    for (let i = 0; i < 5; i++) spawnEnemy();

    setupMenuUI();
    initCharacterPreview();
    animate();
}

// Menu Preview Render
function initCharacterPreview() {
    const previewContainer = document.getElementById('character-preview-container');
    if (!previewContainer) return;

    const width = previewContainer.clientWidth || 350;
    const height = previewContainer.clientHeight || 180;

    const pScene = new THREE.Scene();
    pScene.background = new THREE.Color(0x0b070f);
    const pCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 50);
    pCamera.position.set(0, 1.2, 3.5);

    const pRenderer = new THREE.WebGLRenderer({ antialias: true });
    pRenderer.setSize(width, height);
    previewContainer.appendChild(pRenderer.domElement);

    pScene.add(new THREE.DirectionalLight(0xffffff, 1.5), new THREE.AmbientLight(0xffffff, 0.5));

    const charGroup = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 1.2, 16), new THREE.MeshStandardMaterial({ color: 0x581c87 }));
    torso.position.y = 0.6;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf3e8ff }));
    head.position.y = 1.35;
    charGroup.add(torso, head);
    pScene.add(charGroup);

    function animPrev() {
        requestAnimationFrame(animPrev);
        charGroup.rotation.y += 0.015;
        pRenderer.render(pScene, pCamera);
    }
    animPrev();
}

// UI Setup & Deployment
function setupMenuUI() {
    document.querySelectorAll('#map-selector .option-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('#map-selector .option-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            selectedMap = e.currentTarget.dataset.map;
            buildEnvironment(selectedMap);
        };
    });

    document.querySelectorAll('#mode-selector .option-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('#mode-selector .option-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            selectedMode = e.currentTarget.dataset.mode;
        };
    });

    document.querySelectorAll('#graphics-selector .option-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('#graphics-selector .option-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            graphicsPreset = e.currentTarget.dataset.gfx;
        };
    });

    const deployBtn = document.getElementById('start-deployment-btn');
    if (deployBtn) {
        deployBtn.onclick = () => {
            document.getElementById('lobby-menu').classList.add('hidden');
            document.getElementById('ui-overlay').classList.remove('hidden');
            document.getElementById('crosshair').classList.remove('hidden');
            document.getElementById('hud-mode').innerText = `MODE: ${selectedMode.toUpperCase()}`;

            if (graphicsPreset === 'performance') {
                renderer.shadowMap.enabled = false;
                renderer.setPixelRatio(1);
            } else {
                renderer.shadowMap.enabled = true;
                renderer.setPixelRatio(window.devicePixelRatio);
            }

            // Request Pointer Lock securely on deployment click
            document.body.requestPointerLock();
            initVoiceChat();
        };
    }
}

// Map Environment Builder with Collisions
function buildEnvironment(mapType) {
    environmentObjects.forEach(obj => scene.remove(obj));
    environmentObjects.length = 0;

    if (mapType === 'city' || mapType === 'bunker') {
        const boxGeo = new THREE.BoxGeometry(4, 6, 4);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x2e1a47, roughness: 0.5 });
        for (let i = 0; i < 25; i++) {
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.set((Math.random() - 0.5) * 120, 3, (Math.random() - 0.5) * 120);
            box.castShadow = true;
            box.receiveShadow = true;
            scene.add(box);
            environmentObjects.push(box);
        }
    } else if (mapType === 'forest') {
        const trunkGeo = new THREE.CylinderGeometry(0.6, 0.8, 5, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3f2e1e });
        const leavesGeo = new THREE.ConeGeometry(3, 7, 8);
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

        for (let i = 0; i < 30; i++) {
            const group = new THREE.Group();
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 2.5;
            const leaves = new THREE.Mesh(leavesGeo, leavesMat);
            leaves.position.y = 6.5;
            group.add(trunk, leaves);

            group.position.set((Math.random() - 0.5) * 120, 0, (Math.random() - 0.5) * 120);
            scene.add(group);
            environmentObjects.push(group); // Adds tree to collision bounds!
        }
    }
}

// Enemy AI
function spawnEnemy() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6), new THREE.MeshStandardMaterial({ color: 0x7e22ce }));
    body.position.y = 0.8;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshStandardMaterial({ color: 0xc084fc }));
    head.position.y = 1.8;
    group.add(body, head);

    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 30;
    group.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    group.userData = { health: 100, speed: 2.0 };

    scene.add(group);
    enemies.push(group);
}

// Weapon Firing & Scope Mechanics
function shootWeapon() {
    if (ammoCount <= 0) return;
    ammoCount--;
    document.getElementById('ammo-val').innerText = `${ammoCount} / 90 (${currentWeapon})`;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        let hitObj = intersects[0].object;
        while (hitObj.parent && !hitObj.userData.health && hitObj.parent !== scene) {
            hitObj = hitObj.parent;
        }
        if (hitObj.userData && hitObj.userData.health) {
            hitObj.userData.health -= 40;
            if (hitObj.userData.health <= 0) {
                scene.remove(hitObj);
                const idx = enemies.indexOf(hitObj);
                if (idx > -1) enemies.splice(idx, 1);
                setTimeout(spawnEnemy, 3000);
            }
        }
    }
}

// Mouse Controls for Firing and Scope (ADS)
document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== document.body) return;
    if (e.button === 2) { // Right Click Scope Zoom
        isScoped = true;
        camera.fov = 25;
        camera.updateProjectionMatrix();
        document.getElementById('scope-overlay')?.classList.remove('hidden');
        document.getElementById('crosshair')?.classList.add('hidden');
    } else if (e.button === 0) { // Left Click Shoot
        shootWeapon();
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
        isScoped = false;
        camera.fov = 75;
        camera.updateProjectionMatrix();
        document.getElementById('scope-overlay')?.classList.add('hidden');
        document.getElementById('crosshair')?.classList.remove('hidden');
    }
});

// Main Loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls) controls.update(delta);

    enemies.forEach((enemy) => {
        const dir = new THREE.Vector3().subVectors(camera.position, enemy.position);
        dir.y = 0;
        dir.normalize();
        enemy.position.addScaledVector(dir, enemy.userData.speed * delta);
        enemy.lookAt(camera.position.x, 0, camera.position.z);

        if (enemy.position.distanceTo(camera.position) < 1.2) {
            health = Math.max(0, health - 0.2);
            document.getElementById('health-val').innerText = Math.floor(health);
        }
    });

    prevTime = time;
    renderer.render(scene, camera);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}