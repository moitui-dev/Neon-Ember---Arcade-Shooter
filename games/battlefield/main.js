import * as THREE from 'three';
import { initControls } from './control.js';
import { initVoiceChat } from './voice.js';

let scene, camera, renderer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();
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

function initGame() {
    const container = document.getElementById('game-canvas-container');
    if (!container) return;

    // 1. Core 3D Engine Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x120d16);
    scene.fog = new THREE.FogExp2(0x120d16, 0.015);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 15);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting
    ambientLight = new THREE.AmbientLight(0xd8b4fe, 0.6);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xf3e8ff, 1.0);
    dirLight.position.set(40, 80, 40);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Ground Grid Arena
    const floorGeo = new THREE.PlaneGeometry(300, 300, 64, 64);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x181020,
        roughness: 0.8,
        metalness: 0.2,
        side: THREE.DoubleSide
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(300, 60, 0x9333ea, 0x3b204e);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Build initial background environment & preview characters immediately
    buildEnvironment(selectedMap);
    for (let i = 0; i < 4; i++) spawnEnemy('zombie');

    // 2. Loadout Preview Box Rendering (with safe timeout for container sizing)
    setTimeout(initCharacterPreview, 100);

    // 3. Attach Menu Button Listeners
    setupMenuUI();

    // 4. Controls & Animation Loop
    initControls(camera, (state) => {
        moveForward = state.moveForward;
        moveBackward = state.moveBackward;
        moveLeft = state.moveLeft;
        moveRight = state.moveRight;
    });

    animate();
}

// Sidebar Character Preview Setup
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

    const pLight = new THREE.DirectionalLight(0xffffff, 1.5);
    pLight.position.set(2, 4, 2);
    pScene.add(pLight, new THREE.AmbientLight(0xffffff, 0.5));

    const charGroup = new THREE.Group();
    const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.3, 1.2, 16),
        new THREE.MeshStandardMaterial({ color: 0x581c87, roughness: 0.5 })
    );
    torso.position.y = 0.6;
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xf3e8ff, roughness: 0.4 })
    );
    head.position.y = 1.35;

    const rifle = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
    );
    rifle.position.set(0.2, 0.7, 0.5);

    charGroup.add(torso, head, rifle);
    pScene.add(charGroup);

    function animatePreview() {
        requestAnimationFrame(animatePreview);
        charGroup.rotation.y += 0.015;
        pRenderer.render(pScene, pCamera);
    }
    animatePreview();
}

// Menu UI Interactivity & Deployment Trigger
function setupMenuUI() {
    document.querySelectorAll('#map-selector .option-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('#map-selector .option-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            selectedMap = e.currentTarget.dataset.map;
            buildEnvironment(selectedMap); // Update background map live!
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

            document.body.requestPointerLock();
            initVoiceChat();
        };
    }
}

// Build Selected Map Environment
function buildEnvironment(mapType) {
    environmentObjects.forEach(obj => scene.remove(obj));
    environmentObjects.length = 0;

    if (mapType === 'city' || mapType === 'bunker') {
        const boxGeo = new THREE.BoxGeometry(4, 6, 4);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x2e1a47, roughness: 0.5 });
        for (let i = 0; i < 25; i++) {
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.set((Math.random() - 0.5) * 140, 3, (Math.random() - 0.5) * 140);
            box.castShadow = true;
            box.receiveShadow = true;
            scene.add(box);
            environmentObjects.push(box);
        }
    } else if (mapType === 'forest') {
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 4, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3f2e1e });
        const leavesGeo = new THREE.ConeGeometry(3, 7, 8);
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

        for (let i = 0; i < 30; i++) {
            const group = new THREE.Group();
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 2;
            const leaves = new THREE.Mesh(leavesGeo, leavesMat);
            leaves.position.y = 6;
            group.add(trunk, leaves);
            group.position.set((Math.random() - 0.5) * 140, 0, (Math.random() - 0.5) * 140);
            scene.add(group);
            environmentObjects.push(group);
        }
    }
}

// Enemy Spawner
function spawnEnemy(type = 'zombie') {
    const group = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7e22ce });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.8;

    const headGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xc084fc });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.8;

    group.add(body, head);

    const angle = Math.random() * Math.PI * 2;
    const distance = 25 + Math.random() * 25;
    group.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
    group.userData = { health: 100, speed: 2 + Math.random() * 1.5 };

    scene.add(group);
    enemies.push(group);
}

// Controls & Combat Mechanics
document.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') { currentWeapon = 'M16'; updateHUD(); }
    if (e.code === 'Digit2') { currentWeapon = 'PISTOL'; updateHUD(); }
    if (e.code === 'KeyG') throwGrenade();
});

function updateHUD() {
    const ammoElem = document.getElementById('ammo-val');
    if (ammoElem) ammoElem.innerText = `${ammoCount} / 90 (${currentWeapon})`;
    const healthElem = document.getElementById('health-val');
    if (healthElem) healthElem.innerText = health;
}

function shootWeapon() {
    if (ammoCount <= 0) return;
    ammoCount--;
    updateHUD();

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
                setTimeout(() => spawnEnemy('zombie'), 3000);
            }
        }
    }
}

function throwGrenade() {
    const grenadeGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x9333ea });
    const grenade = new THREE.Mesh(grenadeGeo, grenadeMat);
    grenade.position.copy(camera.position);
    scene.add(grenade);

    const grenadeVel = new THREE.Vector3();
    camera.getWorldDirection(grenadeVel);
    grenadeVel.multiplyScalar(22);

    let time = 0;
    const interval = setInterval(() => {
        time += 0.016;
        grenade.position.addScaledVector(grenadeVel, 0.016);
        grenade.position.y -= 9.8 * time * 0.016;

        if (grenade.position.y <= 0.2) {
            clearInterval(interval);
            enemies.forEach((enemy) => {
                if (enemy.position.distanceTo(grenade.position) < 5) {
                    scene.remove(enemy);
                    const idx = enemies.indexOf(enemy);
                    if (idx > -1) enemies.splice(idx, 1);
                    setTimeout(() => spawnEnemy('zombie'), 3000);
                }
            });
            scene.remove(grenade);
        }
    }, 16);
}

document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== document.body) return;
    if (e.button === 2) {
        isScoped = true;
        camera.fov = 25;
        camera.updateProjectionMatrix();
        document.getElementById('scope-overlay')?.classList.remove('hidden');
        document.getElementById('crosshair')?.classList.add('hidden');
    } else if (e.button === 0) {
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

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    if (moveForward || moveBackward) velocity.z -= direction.z * 35.0 * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * 35.0 * delta;

    camera.translateX(-velocity.x * delta);
    camera.translateZ(velocity.z * delta);
    camera.position.y = 1.6;

    enemies.forEach((enemy) => {
        const playerPos = camera.position;
        const dirToPlayer = new THREE.Vector3().subVectors(playerPos, enemy.position);
        dirToPlayer.y = 0;
        dirToPlayer.normalize();

        enemy.position.addScaledVector(dirToPlayer, enemy.userData.speed * delta);
        enemy.lookAt(playerPos.x, 0, playerPos.z);

        if (enemy.position.distanceTo(camera.position) < 1.2) {
            health = Math.max(0, health - 0.2);
            updateHUD();
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

window.addEventListener('resize', () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});