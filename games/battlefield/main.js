import * as THREE from 'three';
import { initFirstPersonControls } from './control.js';
import { initVoiceChat } from './voice.js';

let scene, camera, renderer;
let controls;
let isScoped = false;
let gunGroup;

let currentWeapon = 'M16'; // Can be 'M16' or 'Bat'
let selectedMap = 'city';
let selectedMode = 'solo';
let graphicsPreset = 'high';

let ammoInMag = 30;
let reserveAmmo = 90;
let isReloading = false;
let health = 100;

const enemies = [];
const lootCakes = [];
const environmentObjects = [];
let dirLight, ambientLight;
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
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.08);
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
    scene.background = new THREE.Color(0x0a0e1a);
    scene.fog = new THREE.FogExp2(0x0a0e1a, 0.007);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(0x38bdf8, 0.45);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0x93c5fd, 1.0);
    dirLight.position.set(80, 120, -60);
    dirLight.castShadow = true;
    scene.add(dirLight);

    initSkyAndMoon();
    updateWeaponMesh();
    buildEnvironment(selectedMap);
    controls = initFirstPersonControls(camera, environmentObjects);

    for (let i = 0; i < 6; i++) spawnCombatSoldier();

    setupMenuUI();
    initCharacterPreview();
    animate();
}

function initSkyAndMoon() {
    const moonGeo = new THREE.SphereGeometry(6, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(80, 120, -60);
    scene.add(moon);
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
    }

    camera.add(gunGroup);
    scene.add(camera);
}

function spawnCombatSoldier() {
    const group = new THREE.Group();
    const isFemale = Math.random() > 0.5;

    const suitMat = new THREE.MeshStandardMaterial({ color: isFemale ? 0x3b2f2f : 0x1c2430, roughness: 0.7 });
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

    // Enemy Rifle held in hands
    const rifleMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 });
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.7), rifleMat);
    rifle.position.set(torsoWidth + 0.1, 1.1, -0.3);

    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.65, 8), suitMat);
    leftArm.position.set(-(torsoWidth + 0.08), 1.35, 0);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.65, 8), suitMat);
    rightArm.position.set(torsoWidth + 0.08, 1.35, 0);

    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.7, 8), suitMat);
    leftLeg.position.set(-0.12, 0.7, 0);

    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.7, 8), suitMat);
    rightLeg.position.set(0.12, 0.7, 0);

    group.add(torso, vest, head, helmet, rifle, leftArm, rightArm, leftLeg, rightLeg);

    const angle = Math.random() * Math.PI * 2;
    const dist = 35 + Math.random() * 40;
    group.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

    group.userData = {
        health: 100,
        speed: isFemale ? 3.2 : 2.6,
        lastShotTime: 0
    };

    scene.add(group);
    enemies.push(group);
}

function spawnLootCrate(pos) {
    const crateGeo = new THREE.BoxGeometry(0.6, 0.4, 0.6);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.5 });
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(pos.x, 0.2, pos.z);
    crate.castShadow = true;

    crate.userData = { isLoot: true };
    scene.add(crate);
    lootCakes.push(crate);
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

function buildEnvironment(mapType) {
    environmentObjects.forEach(obj => scene.remove(obj));
    environmentObjects.length = 0;

    const floorGeo = new THREE.PlaneGeometry(360, 360);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    for (let pos of [-50, 0, 50]) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 360), tarmacMat);
        road.rotation.x = -Math.PI / 2;
        road.position.set(pos, 0.01, 0);
        scene.add(road);

        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 360), stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(pos, 0.02, 0);
        scene.add(stripe);
    }

    const bWallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xca8a04, emissiveIntensity: 0.4 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });

    for (let x = -120; x <= 120; x += 40) {
        for (let z = -120; z <= 120; z += 40) {
            if (Math.abs(x) < 18 || Math.abs(z) < 18) continue;

            const bGroup = new THREE.Group();
            const height = 16 + Math.random() * 8;
            const mainBox = new THREE.Mesh(new THREE.BoxGeometry(14, height, 14), bWallMat);
            mainBox.position.y = height / 2;
            bGroup.add(mainBox);

            const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.5, 0.4), doorMat);
            door.position.set(0, 1.75, 7.05);
            bGroup.add(door);

            bGroup.position.set(x, 0, z);
            scene.add(bGroup);
            environmentObjects.push(bGroup);
        }
    }
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

function setupMenuUI() {
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
    if (currentWeapon === 'M16') {
        if (isReloading || ammoInMag <= 0) return;
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
            if (currentWeapon === 'Bat' && dist > 3.5) return;

            hitObj.userData.health -= (currentWeapon === 'Bat' ? 60 : 35);
            playSound('hit');

            if (hitObj.userData.health <= 0) {
                spawnLootCrate(hitObj.position);
                scene.remove(hitObj);
                const idx = enemies.indexOf(hitObj);
                if (idx > -1) enemies.splice(idx, 1);
                setTimeout(spawnCombatSoldier, 3500);
            }
        }
    }
}

// Keybindings for Reload ('R') and Weapons ('1', '2')
document.addEventListener('keydown', (e) => {
    if (document.pointerLockElement !== document.body) return;
    if (e.code === 'KeyR') {
        reloadWeapon();
    } else if (e.key === '1') {
        currentWeapon = 'M16';
        updateWeaponMesh();
        document.getElementById('ammo-val').innerText = `${ammoInMag} / ${reserveAmmo} (M16)`;
    } else if (e.key === '2') {
        currentWeapon = 'Bat';
        updateWeaponMesh();
        document.getElementById('ammo-val').innerText = `Melee Ready (Bat)`;
    }
});

document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== document.body) return;
    if (e.button === 0) performAction();
});

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls) controls.update(delta);
    updateCompassAndElevation();

    // Check Loot pickups
    for (let i = lootCakes.length - 1; i >= 0; i--) {
        const crate = lootCakes[i];
        if (camera.position.distanceTo(crate.position) < 2.0) {
            reserveAmmo += 30;
            playSound('loot');
            scene.remove(crate);
            lootCakes.splice(i, 1);
            const ammoDisplay = document.getElementById('ammo-val');
            if (ammoDisplay && !isReloading) {
                ammoDisplay.innerText = `${ammoInMag} / ${reserveAmmo} (M16)`;
            }
        }
    }

    // Update Enemy Combat Team AI
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const distToPlayer = enemy.position.distanceTo(camera.position);

        if (distToPlayer > 8.0) {
            const dir = new THREE.Vector3().subVectors(camera.position, enemy.position);
            dir.y = 0;
            dir.normalize();
            enemy.position.addScaledVector(dir, enemy.userData.speed * delta);
        } else {
            // Combat shooting back at player
            if (time - enemy.userData.lastShotTime > 1800) {
                enemy.userData.lastShotTime = time;
                playSound('enemy_shot');
                health = Math.max(0, health - 12);
                document.getElementById('health-val').innerText = Math.floor(health);
                playSound('damage');
            }
        }

        enemy.lookAt(camera.position.x, 0, camera.position.z);
    }

    prevTime = time;
    renderer.render(scene, camera);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}