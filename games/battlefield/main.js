import * as THREE from 'three';
import { initFirstPersonControls } from './control.js';
import { initVoiceChat } from './voice.js';

let scene, camera, renderer;
let controls;
let isScoped = false;
let gunGroup;

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

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'shot') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(500, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
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
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.008);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(0x38bdf8, 0.55);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
    dirLight.position.set(80, 120, -60);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    initSkyAndMoon();
    initFirstPersonWeapon();
    buildEnvironment(selectedMap);
    controls = initFirstPersonControls(camera, environmentObjects);

    for (let i = 0; i < 6; i++) spawnRealisticZombie();

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

    const starGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const posArray = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 600;
        posArray[i + 1] = 40 + Math.random() * 200;
        posArray[i + 2] = (Math.random() - 0.5) * 600;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8 });
    scene.add(new THREE.Points(starGeo, starMat));
}

function initFirstPersonWeapon() {
    gunGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e1b2e, metalness: 0.8, roughness: 0.3 });
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.6), bodyMat);
    receiver.position.set(0.2, -0.22, -0.5);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 }));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.2, -0.21, -0.85);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x332244 }));
    mag.position.set(0.2, -0.35, -0.45);

    gunGroup.add(receiver, barrel, mag);
    camera.add(gunGroup);
    scene.add(camera);
}

function spawnRealisticZombie() {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x5a6351, roughness: 0.7 });
    const clothesMat = new THREE.MeshStandardMaterial({ color: 0x27272a });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.75, 12), clothesMat);
    torso.position.y = 1.1;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), skinMat);
    head.position.y = 1.78;

    const leftArmGroup = new THREE.Group();
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.65, 8), clothesMat);
    leftArm.position.y = -0.3;
    leftArmGroup.add(leftArm);
    leftArmGroup.position.set(-0.32, 1.38, 0);

    const rightArmGroup = new THREE.Group();
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.65, 8), clothesMat);
    rightArm.position.y = -0.3;
    rightArmGroup.add(rightArm);
    rightArmGroup.position.set(0.32, 1.38, 0);

    const leftLegGroup = new THREE.Group();
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.7, 8), clothesMat);
    leftLeg.position.y = -0.35;
    leftLegGroup.add(leftLeg);
    leftLegGroup.position.set(-0.14, 0.7, 0);

    const rightLegGroup = new THREE.Group();
    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.7, 8), clothesMat);
    rightLeg.position.y = -0.35;
    rightLegGroup.add(rightLeg);
    rightLegGroup.position.set(0.14, 0.7, 0);

    group.add(torso, head, leftArmGroup, rightArmGroup, leftLegGroup, rightLegGroup);

    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 30;
    group.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

    group.userData = {
        health: 100,
        speed: 2.1,
        walkCycle: Math.random() * Math.PI * 2,
        torso, leftArmGroup, rightArmGroup, leftLegGroup, rightLegGroup
    };

    scene.add(group);
    enemies.push(group);
}

function buildEnvironment(mapType) {
    environmentObjects.forEach(obj => scene.remove(obj));
    environmentObjects.length = 0;

    const floorGeo = new THREE.PlaneGeometry(320, 320);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    for (let pos of [-50, 0, 50]) {
        const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(12, 320), tarmacMat);
        roadNS.rotation.x = -Math.PI / 2;
        roadNS.position.set(pos, 0.01, 0);
        scene.add(roadNS);
    }

    const bWallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    for (let x = -100; x <= 100; x += 40) {
        for (let z = -100; z <= 100; z += 40) {
            if (Math.abs(x) < 15 || Math.abs(z) < 15) continue;

            const bGroup = new THREE.Group();
            const mainBox = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 14), bWallMat);
            mainBox.position.y = 7;
            mainBox.castShadow = true;
            mainBox.receiveShadow = true;
            bGroup.add(mainBox);

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

    const pitchDeg = Math.asin(dir.y) * (180 / Math.PI);
    const elevationElem = document.getElementById('elevation-readout');
    if (elevationElem) elevationElem.innerText = `PITCH: ${Math.floor(pitchDeg)}°`;
}

function shootWeapon() {
    if (ammoCount <= 0) return;
    ammoCount--;
    document.getElementById('ammo-val').innerText = `${ammoCount} / 90 (${currentWeapon})`;

    playSound('shot');

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        let hitObj = intersects[0].object;
        while (hitObj.parent && !hitObj.userData.health && hitObj.parent !== scene) {
            hitObj = hitObj.parent;
        }

        if (hitObj.userData && hitObj.userData.health) {
            playSound('hit');
            hitObj.userData.health -= 40;

            if (hitObj.userData.health <= 0) {
                scene.remove(hitObj);
                const idx = enemies.indexOf(hitObj);
                if (idx > -1) enemies.splice(idx, 1);
                setTimeout(spawnRealisticZombie, 3000);
            }
        }
    }
}

document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== document.body) return;
    if (e.button === 2) {
        isScoped = true;
        camera.fov = 25;
        camera.updateProjectionMatrix();
        document.getElementById('scope-overlay')?.classList.remove('hidden');
        document.getElementById('crosshair')?.classList.add('hidden');
        if (gunGroup) gunGroup.visible = false;
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
        if (gunGroup) gunGroup.visible = true;
    }
});

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls) controls.update(delta);
    updateCompassAndElevation();

    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const distToPlayer = enemy.position.distanceTo(camera.position);

        if (distToPlayer > 1.4) {
            const dir = new THREE.Vector3().subVectors(camera.position, enemy.position);
            dir.y = 0;
            dir.normalize();
            enemy.position.addScaledVector(dir, enemy.userData.speed * delta);

            enemy.userData.walkCycle += delta * 7;
            const cycle = enemy.userData.walkCycle;

            enemy.userData.leftArmGroup.rotation.x = Math.sin(cycle) * 0.5;
            enemy.userData.rightArmGroup.rotation.x = -Math.sin(cycle) * 0.5;
            enemy.userData.leftLegGroup.rotation.x = -Math.sin(cycle) * 0.5;
            enemy.userData.rightLegGroup.rotation.x = Math.sin(cycle) * 0.5;
        }

        enemy.lookAt(camera.position.x, 0, camera.position.z);

        if (distToPlayer < 1.6) {
            health = Math.max(0, health - 0.3);
            document.getElementById('health-val').innerText = Math.floor(health);
            playSound('damage');
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