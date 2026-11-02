import * as THREE from 'three';
import { initFirstPersonControls } from './control.js';
import { initVoiceChat } from './voice.js';

let scene, camera, renderer;
let controls;
let isScoped = false;
let gunGroup;
let trafficLightMeshes = [];

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

// Audio Synthesizer
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

    // Atmospheric Night Lighting Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e);
    scene.fog = new THREE.FogExp2(0x07090e, 0.018);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(0x1e293b, 0.35);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0x38bdf8, 0.4); // Moonlight
    dirLight.position.set(50, 90, 40);
    dirLight.castShadow = true;
    scene.add(dirLight);

    initFirstPersonWeapon();
    buildEnvironment(selectedMap);
    controls = initFirstPersonControls(camera, environmentObjects);

    for (let i = 0; i < 6; i++) spawnArticulatedEnemy();

    setupMenuUI();
    initCharacterPreview();
    animate();
}

// First-Person Gun Model
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

// Highly Detailed Articulated Humanoid Enemy Spawner
function spawnArticulatedEnemy() {
    const group = new THREE.Group();

    // Skin & Clothing Materials
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.5 }); // Zombie greenish tint
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 }); // Glowing red eyes
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x18181b }); // Dark hair
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 }); // Tactical jacket
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 }); // Combat trousers
    const limbMat = new THREE.MeshStandardMaterial({ color: 0x334155 });

    // Torso & Neck
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), shirtMat);
    torso.position.y = 1.1;

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.18), skinMat);
    neck.position.y = 1.55;

    // Head with facial structure & glowing eyes
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.4), skinMat);
    head.position.y = 1.8;

    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.42), hairMat);
    hair.position.y = 2.02;

    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), eyeMat);
    eyeL.position.set(-0.1, 1.85, 0.21);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), eyeMat);
    eyeR.position.set(0.1, 1.85, 0.21);

    // Articulated Arms with Fingers
    const leftArmGroup = new THREE.Group();
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), limbMat);
    leftArm.position.y = -0.3;
    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.12), skinMat);
    leftHand.position.set(0, -0.65, 0);
    leftArmGroup.add(leftArm, leftHand);
    leftArmGroup.position.set(-0.38, 1.35, 0);

    const rightArmGroup = new THREE.Group();
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), limbMat);
    rightArm.position.y = -0.3;
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.12), skinMat);
    rightHand.position.set(0, -0.65, 0);
    rightArmGroup.add(rightArm, rightHand);
    rightArmGroup.position.set(0.38, 1.35, 0);

    // Articulated Legs
    const leftLegGroup = new THREE.Group();
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), pantsMat);
    leftLeg.position.y = -0.35;
    leftLegGroup.add(leftLeg);
    leftLegGroup.position.set(-0.16, 0.7, 0);

    const rightLegGroup = new THREE.Group();
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), pantsMat);
    rightLeg.position.y = -0.35;
    rightLegGroup.add(rightLeg);
    rightLegGroup.position.set(0.16, 0.7, 0);

    group.add(torso, neck, head, hair, eyeL, eyeR, leftArmGroup, rightArmGroup, leftLegGroup, rightLegGroup);

    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 30;
    group.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

    group.userData = {
        health: 100,
        speed: 2.1,
        walkCycle: Math.random() * Math.PI * 2,
        leftArmGroup, rightArmGroup, leftLegGroup, rightLegGroup
    };

    scene.add(group);
    enemies.push(group);
}

// Build Night City, Solid Black Tarmac Roads, Glowing Street Lamps, Traffic Lights, Billboards, Water Canals & Bridges
function buildEnvironment(mapType) {
    environmentObjects.forEach(obj => scene.remove(obj));
    environmentObjects.length = 0;
    trafficLightMeshes = [];

    // Solid Earth Base
    const floorGeo = new THREE.PlaneGeometry(320, 320);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // True Black Tarmac Roads & Gabros Footpaths
    const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.8, metalness: 0.1 });
    const gabrosMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });

    for (let pos of [-50, 0, 50]) {
        const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(12, 320), tarmacMat);
        roadNS.rotation.x = -Math.PI / 2;
        roadNS.position.set(pos, 0.01, 0);
        scene.add(roadNS);

        const pathL = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 320), gabrosMat);
        pathL.rotation.x = -Math.PI / 2;
        pathL.position.set(pos - 7.25, 0.02, 0);
        scene.add(pathL);

        const pathR = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 320), gabrosMat);
        pathR.rotation.x = -Math.PI / 2;
        pathR.position.set(pos + 7.25, 0.02, 0);
        scene.add(pathR);

        const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(320, 12), tarmacMat);
        roadEW.rotation.x = -Math.PI / 2;
        roadEW.position.set(0, 0.01, pos);
        scene.add(roadEW);
    }

    // Water Canal & Bridges
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.8 });
    const canal = new THREE.Mesh(new THREE.PlaneGeometry(20, 320), waterMat);
    canal.rotation.x = -Math.PI / 2;
    canal.position.set(-100, 0.015, 0);
    scene.add(canal);

    // Bridge over Canal
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 14), bridgeMat);
    bridge.position.set(-100, 0.4, 0);
    scene.add(bridge);
    environmentObjects.push(bridge);

    // Detailed Buildings with Windows, Doors & Illuminated Billboards
    const wallColors = [0x1e293b, 0x0f172a, 0x334155, 0x18181b];
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, emissive: 0x0284c7, emissiveIntensity: 0.3 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x27272a });
    const billboardMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });

    for (let x = -110; x <= 110; x += 35) {
        for (let z = -110; z <= 110; z += 35) {
            if (Math.abs(x) < 10 || Math.abs(x - 50) < 10 || Math.abs(x + 50) < 10) continue;
            if (Math.abs(z) < 10 || Math.abs(z - 50) < 10 || Math.abs(z + 50) < 10) continue;

            const bGroup = new THREE.Group();
            const width = 12 + Math.random() * 4;
            const height = 12 + Math.random() * 12;
            const depth = 12 + Math.random() * 4;

            const wallMat = new THREE.MeshStandardMaterial({ color: wallColors[Math.floor(Math.random() * wallColors.length)], roughness: 0.7 });
            const mainBox = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat);
            mainBox.position.y = height / 2;
            bGroup.add(mainBox);

            // Door
            const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.2), doorMat);
            door.position.set(0, 1.6, depth / 2 + 0.1);
            bGroup.add(door);

            // Windows
            const winGeo = new THREE.BoxGeometry(1.4, 1.8, 0.15);
            for (let y = 4; y < height - 2; y += 3) {
                for (let wx = -width / 2 + 2; wx <= width / 2 - 2; wx += 3) {
                    const winF = new THREE.Mesh(winGeo, glassMat);
                    winF.position.set(wx, y, depth / 2 + 0.1);
                    bGroup.add(winF);
                }
            }

            // Billboard on selected buildings
            if (Math.random() > 0.6) {
                const board = new THREE.Mesh(new THREE.BoxGeometry(5, 2.5, 0.2), billboardMat);
                board.position.set(0, height - 2, depth / 2 + 0.3);
                bGroup.add(board);
            }

            bGroup.position.set(x, 0, z);
            scene.add(bGroup);
            environmentObjects.push(bGroup);
        }
    }

    // Glowing Street Lamps & Cycling Traffic Lights at Intersections
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const lampGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfef08a }); // Warm yellow glow

    for (let x of [-56, 56]) {
        for (let z of [-56, 0, 56]) {
            const lampGroup = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 8), poleMat);
            pole.position.y = 3;
            const bulb = new THREE.Mesh(lampGeo, lampMat);
            bulb.position.set(0.6, 5.8, 0);

            const pointLight = new THREE.PointLight(0xfef08a, 1.5, 15);
            pointLight.position.set(0.6, 5.5, 0);

            lampGroup.add(pole, bulb, pointLight);
            lampGroup.position.set(x, 0, z);
            scene.add(lampGroup);
        }
    }

    // Traffic Lights at intersections
    for (let x of [-55, 55]) {
        for (let z of [-55, 55]) {
            const tGroup = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), poleMat);
            pole.position.y = 2.5;

            const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.3), poleMat);
            box.position.set(0, 4.5, 0);

            const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
            redLight.position.set(0, 4.9, 0.16);
            const greenLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
            greenLight.position.set(0, 4.1, 0.16);

            tGroup.add(pole, box, redLight, greenLight);
            tGroup.position.set(x + 3, 0, z + 3);
            scene.add(tGroup);
            trafficLightMeshes.push({ red: redLight, green: greenLight, timer: Math.random() * 5 });
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

// Update Circular Compass & Pitch Elevation Angle
function updateCompassAndElevation() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    // Yaw Angle for Compass Needle Rotation
    let angleDeg = Math.atan2(-dir.x, -dir.z) * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    const needle = document.getElementById('compass-needle');
    if (needle) {
        needle.style.transform = `rotate(${angleDeg}deg)`;
    }

    // Pitch Angle for Elevation Readout (-90 to +90 degrees)
    const pitchDeg = Math.asin(dir.y) * (180 / Math.PI);
    const elevationElem = document.getElementById('elevation-readout');
    if (elevationElem) {
        elevationElem.innerText = `PITCH: ${Math.floor(pitchDeg)}°`;
    }
}

// Shooting Weapon
function shootWeapon() {
    if (ammoCount <= 0) return;
    ammoCount--;
    document.getElementById('ammo-val').innerText = `${ammoCount} / 90 (${currentWeapon})`;

    playSound('shot');

    if (gunGroup) {
        gunGroup.position.z += 0.08;
        setTimeout(() => { gunGroup.position.z -= 0.08; }, 60);
    }

    const flash = new THREE.PointLight(0xa855f7, 5, 6);
    flash.position.set(0.2, -0.2, -0.9);
    camera.add(flash);
    setTimeout(() => camera.remove(flash), 50);

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

            hitObj.traverse((child) => {
                if (child.material) {
                    const origColor = child.material.color.getHex();
                    child.material.color.setHex(0xef4444);
                    setTimeout(() => child.material.color.setHex(origColor), 100);
                }
            });

            if (hitObj.userData.health <= 0) {
                scene.remove(hitObj);
                const idx = enemies.indexOf(hitObj);
                if (idx > -1) enemies.splice(idx, 1);
                setTimeout(spawnArticulatedEnemy, 3000);
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

// Render Loop with Anti-Fusion Separation Physics & Traffic Cycles
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls) controls.update(delta);
    updateCompassAndElevation();

    // Cycle Traffic Lights
    trafficLightMeshes.forEach(tl => {
        tl.timer += delta;
        if (tl.timer > 4) {
            tl.timer = 0;
            const isRedActive = tl.red.material.color.getHex() === 0xef4444;
            tl.red.material.color.setHex(isRedActive ? 0x331111 : 0xef4444);
            tl.green.material.color.setHex(isRedActive ? 0x22c55e : 0x113311);
        }
    });

    // Enemy AI & Anti-Fusion Push-Apart Physics
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const distToPlayer = enemy.position.distanceTo(camera.position);

        // Separate from other enemies to prevent fusion/vibration
        for (let j = i + 1; j < enemies.length; j++) {
            const other = enemies[j];
            const distBetween = enemy.position.distanceTo(other.position);
            if (distBetween < 1.2) {
                const pushDir = new THREE.Vector3().subVectors(enemy.position, other.position);
                pushDir.y = 0;
                pushDir.normalize();
                enemy.position.addScaledVector(pushDir, 2.0 * delta);
                other.position.addScaledVector(pushDir, -2.0 * delta);
            }
        }

        if (distToPlayer > 1.4) {
            const dir = new THREE.Vector3().subVectors(camera.position, enemy.position);
            dir.y = 0;
            dir.normalize();
            enemy.position.addScaledVector(dir, enemy.userData.speed * delta);

            enemy.userData.walkCycle += delta * 8;
            const cycle = enemy.userData.walkCycle;

            enemy.userData.leftArmGroup.rotation.x = Math.sin(cycle) * 0.6;
            enemy.userData.rightArmGroup.rotation.x = -Math.sin(cycle) * 0.6;
            enemy.userData.leftLegGroup.rotation.x = -Math.sin(cycle) * 0.6;
            enemy.userData.rightLegGroup.rotation.x = Math.sin(cycle) * 0.6;
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