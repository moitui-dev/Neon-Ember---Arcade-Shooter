import * as THREE from 'three';
import { initControls } from './control.js';
import { initVoiceChat } from './voice.js';

let scene, camera, renderer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();
let isScoped = false;

// Game Systems State
let currentWeapon = 'M16'; // 'M16' or 'PISTOL'
let currentMap = 'city';   // 'city', 'forest', 'desert'
let dayCycle = 'day';     // 'day', 'night'
let ammoCount = 30;
let health = 100;

// Arrays for entities
const enemies = [];
const environmentObjects = [];
let dirLight, ambientLight;

const container = document.getElementById('game-canvas-container');
const instructions = document.getElementById('instructions');

// 1. Initialize Core 3D Engine
scene = new THREE.Scene();

camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 10);

renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// 2. Lighting Setup
ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(40, 80, 40);
dirLight.castShadow = true;
scene.add(dirLight);

// 3. Ground & Grid Arena
const floorGeo = new THREE.PlaneGeometry(300, 300, 64, 64);
const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1f242d,
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.DoubleSide
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Ground Grid for Visual Depth
const gridHelper = new THREE.GridHelper(300, 60, 0x00ff88, 0x334155);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// 4. Procedural Map & Environment Builder
function buildEnvironment(mapType) {
    // Clear existing environment objects
    environmentObjects.forEach(obj => scene.remove(obj));
    environmentObjects.length = 0;

    if (mapType === 'city') {
        // Concrete obstacles & ruins
        const boxGeo = new THREE.BoxGeometry(4, 5, 4);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });
        for (let i = 0; i < 25; i++) {
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.set((Math.random() - 0.5) * 140, 2.5, (Math.random() - 0.5) * 140);
            box.castShadow = true;
            box.receiveShadow = true;
            scene.add(box);
            environmentObjects.push(box);
        }
    } else if (mapType === 'forest') {
        // Trees & Vegetation
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 4, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3f2e1e });
        const leavesGeo = new THREE.ConeGeometry(3, 7, 8);
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x15803d });

        for (let i = 0; i < 35; i++) {
            const group = new THREE.Group();
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 2;
            const leaves = new THREE.Mesh(leavesGeo, leavesMat);
            leaves.position.y = 6;
            group.add(trunk, leaves);

            group.position.set((Math.random() - 0.5) * 160, 0, (Math.random() - 0.5) * 160);
            scene.add(group);
            environmentObjects.push(group);
        }
    }
}

// 5. Zombie & Soldier Enemy AI Spawner
function spawnEnemy(type = 'zombie') {
    const group = new THREE.Group();

    if (type === 'zombie') {
        // Zombie Mesh (Greenish Body)
        const bodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x16a34a });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.9;

        const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x4ade80 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 2.0;

        group.add(body, head);
    }

    // Random Spawn Position
    const angle = Math.random() * Math.PI * 2;
    const distance = 20 + Math.random() * 30;
    group.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
    group.userData = { type, health: 100, speed: 2.5 + Math.random() * 1.5 };

    scene.add(group);
    enemies.push(group);
}

// Initial Map Build & Enemy Spawns
buildEnvironment('city');
for (let i = 0; i < 6; i++) spawnEnemy('zombie');

// 6. Day / Night Environment System
function toggleDayNight() {
    if (dayCycle === 'day') {
        dayCycle = 'night';
        scene.background = new THREE.Color(0x05050a);
        scene.fog = new THREE.FogExp2(0x05050a, 0.03);
        ambientLight.intensity = 0.15;
        dirLight.intensity = 0.2;
    } else {
        dayCycle = 'day';
        scene.background = new THREE.Color(0x1e293b);
        scene.fog = new THREE.FogExp2(0x1e293b, 0.015);
        ambientLight.intensity = 0.7;
        dirLight.intensity = 1.2;
    }
}

// 7. Weapon Firing with Visual Flash & Tracers
function shootWeapon() {
    if (ammoCount <= 0) return;
    ammoCount--;
    updateHUD();

    // Muzzle Flash Effect
    const flashLight = new THREE.PointLight(0xffaa00, 5, 10);
    flashLight.position.copy(camera.position);
    scene.add(flashLight);
    setTimeout(() => scene.remove(flashLight), 50);

    // Bullet Raycasting Hit Detection
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        let hitObj = intersects[0].object;
        // Trace up hierarchy to find parent enemy group
        while (hitObj.parent && !hitObj.userData.health && hitObj.parent !== scene) {
            hitObj = hitObj.parent;
        }

        if (hitObj.userData && hitObj.userData.health) {
            const damage = currentWeapon === 'M16' ? 40 : 25;
            hitObj.userData.health -= damage;

            // Visual impact spark
            const sparkGeo = new THREE.SphereGeometry(0.15, 8, 8);
            const sparkMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
            const spark = new THREE.Mesh(sparkGeo, sparkMat);
            spark.position.copy(intersects[0].point);
            scene.add(spark);
            setTimeout(() => scene.remove(spark), 100);

            // Defeat Enemy
            if (hitObj.userData.health <= 0) {
                scene.remove(hitObj);
                const idx = enemies.indexOf(hitObj);
                if (idx > -1) enemies.splice(idx, 1);
                // Respawn enemy after delay
                setTimeout(() => spawnEnemy('zombie'), 3000);
            }
        }
    }
}

// Grenade Physics Trajectory
function throwGrenade() {
    const grenadeGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.3 });
    const grenade = new THREE.Mesh(grenadeGeo, grenadeMat);

    grenade.position.copy(camera.position);
    scene.add(grenade);

    const grenadeVel = new THREE.Vector3();
    camera.getWorldDirection(grenadeVel);
    grenadeVel.multiplyScalar(24);

    let time = 0;
    const interval = setInterval(() => {
        time += 0.016;
        grenade.position.addScaledVector(grenadeVel, 0.016);
        grenade.position.y -= 9.8 * time * 0.016;

        if (grenade.position.y <= 0.2) {
            clearInterval(interval);

            // Explosion visual effect
            const blastGeo = new THREE.SphereGeometry(4, 16, 16);
            const blastMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.7 });
            const blast = new THREE.Mesh(blastGeo, blastMat);
            blast.position.copy(grenade.position);
            scene.add(blast);

            // Area of Effect damage
            enemies.forEach((enemy) => {
                if (enemy.position.distanceTo(grenade.position) < 5) {
                    scene.remove(enemy);
                    const idx = enemies.indexOf(enemy);
                    if (idx > -1) enemies.splice(idx, 1);
                    setTimeout(() => spawnEnemy('zombie'), 3000);
                }
            });

            scene.remove(grenade);
            setTimeout(() => scene.remove(blast), 200);
        }
    }, 16);
}

// 8. HUD & Controls Management
function updateHUD() {
    const ammoElem = document.getElementById('ammo-val');
    if (ammoElem) ammoElem.innerText = `${ammoCount} / 90 (${currentWeapon})`;
    const healthElem = document.getElementById('health-val');
    if (healthElem) healthElem.innerText = health;
}

// Keyboard Action Listeners
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyG') throwGrenade();
    if (e.code === 'KeyN') toggleDayNight(); // Toggle Day/Night
    if (e.code === 'Digit1') { currentWeapon = 'M16'; updateHUD(); }
    if (e.code === 'Digit2') { currentWeapon = 'PISTOL'; updateHUD(); }
    if (e.code === 'KeyM') {
        currentMap = currentMap === 'city' ? 'forest' : 'city';
        buildEnvironment(currentMap);
    }
});

// Pointer Lock & Mouse Listeners
instructions.addEventListener('click', () => {
    document.body.requestPointerLock();
    initVoiceChat();
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
        instructions.classList.add('hidden');
    } else {
        instructions.classList.remove('hidden');
    }
});

initControls(camera, (state) => {
    moveForward = state.moveForward;
    moveBackward = state.moveBackward;
    moveLeft = state.moveLeft;
    moveRight = state.moveRight;
});

// Aim Down Sights & Shoot
document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== document.body) return;
    if (e.button === 2) {
        isScoped = true;
        camera.fov = currentWeapon === 'M16' ? 25 : 45;
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

// 9. Main Game Loop (Player Movement & Zombie AI Pursuit)
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    // Movement dampening
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    if (moveForward || moveBackward) velocity.z -= direction.z * 35.0 * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * 35.0 * delta;

    camera.translateX(-velocity.x * delta);
    camera.translateZ(velocity.z * delta);
    camera.position.y = 1.6; // Lock camera to ground level

    // Update Zombie AI pursuit towards player
    enemies.forEach((enemy) => {
        const enemyPos = enemy.position;
        const playerPos = camera.position;
        const dirToPlayer = new THREE.Vector3().subVectors(playerPos, enemyPos);
        dirToPlayer.y = 0;
        dirToPlayer.normalize();

        enemy.position.addScaledVector(dirToPlayer, enemy.userData.speed * delta);
        enemy.lookAt(playerPos.x, 0, playerPos.z);

        // Player damage on contact
        if (enemy.position.distanceTo(camera.position) < 1.2) {
            health = Math.max(0, health - 0.2);
            updateHUD();
        }
    });

    prevTime = time;
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});