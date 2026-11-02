import * as THREE from 'three';
import { initFirstPersonControls } from './control.js';
import { initVoiceChat } from './voice.js';

let scene, camera, renderer;
let controls;
let isScoped = false;
let gunGroup;
let fountainWaterColumn;

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

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1c23);
    scene.fog = new THREE.FogExp2(0x1a1c23, 0.012);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(0xd4d8f0, 0.7);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xfff8e7, 1.3);
    dirLight.position.set(50, 90, 40);
    dirLight.castShadow = true;
    scene.add(dirLight);

    initFirstPersonWeapon();
    buildEnvironment(selectedMap);
    controls = initFirstPersonControls(camera, environmentObjects);

    for (let i = 0; i < 6; i++) spawnHumanoidEnemy();

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

// Full Humanoid Enemy Spawner with Animated Limbs
function spawnHumanoidEnemy() {
    const group = new THREE.Group();

    const darkPurpleMat = new THREE.MeshStandardMaterial({ color: 0x581c87, roughness: 0.6 });
    const lightPurpleMat = new THREE.MeshStandardMaterial({ color: 0xc084fc, roughness: 0.4 });
    const darkLimbMat = new THREE.MeshStandardMaterial({ color: 0x3b0764 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), darkPurpleMat);
    torso.position.y = 1.1;

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2), darkLimbMat);
    neck.position.y = 1.6;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), lightPurpleMat);
    head.position.y = 1.85;

    const leftArmGroup = new THREE.Group();
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), darkLimbMat);
    leftArm.position.y = -0.35;
    leftArmGroup.add(leftArm);
    leftArmGroup.position.set(-0.4, 1.4, 0);

    const rightArmGroup = new THREE.Group();
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), darkLimbMat);
    rightArm.position.y = -0.35;
    rightArmGroup.add(rightArm);
    rightArmGroup.position.set(0.4, 1.4, 0);

    const leftLegGroup = new THREE.Group();
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), darkPurpleMat);
    leftLeg.position.y = -0.35;
    leftLegGroup.add(leftLeg);
    leftLegGroup.position.set(-0.18, 0.7, 0);

    const rightLegGroup = new THREE.Group();
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), darkPurpleMat);
    rightLeg.position.y = -0.35;
    rightLegGroup.add(rightLeg);
    rightLegGroup.position.set(0.18, 0.7, 0);

    group.add(torso, neck, head, leftArmGroup, rightArmGroup, leftLegGroup, rightLegGroup);

    const angle = Math.random() * Math.PI * 2;
    const dist = 25 + Math.random() * 30;
    group.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

    group.userData = {
        health: 100,
        speed: 2.2,
        walkCycle: Math.random() * Math.PI * 2,
        leftArmGroup, rightArmGroup, leftLegGroup, rightLegGroup
    };

    scene.add(group);
    enemies.push(group);
}

// Solid Ground, Roads, All Detailed Buildings, Palms, Bridges & Fountains
function buildEnvironment(mapType) {
    environmentObjects.forEach(obj => scene.remove(obj));
    environmentObjects.length = 0;

    // 1. Solid Opaque Earth Base (No transparent grid)
    const floorGeo = new THREE.PlaneGeometry(320, 320);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2b332b, roughness: 0.9, metalness: 0.1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 2. City Tarmac Road Grid System with Yellow Centerlines & Gabros Footpaths
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1f2329, roughness: 0.7 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });
    const gabrosMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 }); // Concrete pavers

    // Main Intersecting City Avenues
    for (let pos of [-50, 0, 50]) {
        // North-South Road
        const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(12, 300), roadMat);
        roadNS.rotation.x = -Math.PI / 2;
        roadNS.position.set(pos, 0.01, 0);
        scene.add(roadNS);

        // Gabros Footpaths along Road Sides
        const pathNSLeft = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 300), gabrosMat);
        pathNSLeft.rotation.x = -Math.PI / 2;
        pathNSLeft.position.set(pos - 7.25, 0.02, 0);
        scene.add(pathNSLeft);

        const pathNSRight = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 300), gabrosMat);
        pathNSRight.rotation.x = -Math.PI / 2;
        pathNSRight.position.set(pos + 7.25, 0.02, 0);
        scene.add(pathNSRight);

        // Center Yellow Line
        const lineNS = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 300), lineMat);
        lineNS.rotation.x = -Math.PI / 2;
        lineNS.position.set(pos, 0.02, 0);
        scene.add(lineNS);

        // East-West Road
        const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(300, 12), roadMat);
        roadEW.rotation.x = -Math.PI / 2;
        roadEW.position.set(0, 0.01, pos);
        scene.add(roadEW);

        const lineEW = new THREE.Mesh(new THREE.PlaneGeometry(300, 0.3), lineMat);
        lineEW.rotation.x = -Math.PI / 2;
        lineEW.position.set(0, 0.02, pos);
        scene.add(lineEW);
    }

    // 3. Detailed Buildings with Doors, Windows & Balconies (Applied to ALL Buildings)
    const wallColors = [0x334155, 0x475569, 0x1e293b, 0x3f3f46, 0x52525b];
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.8 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });

    for (let x = -110; x <= 110; x += 35) {
        for (let z = -110; z <= 110; z += 35) {
            // Keep roads clear
            if (Math.abs(x) < 10 || Math.abs(x - 50) < 10 || Math.abs(x + 50) < 10) continue;
            if (Math.abs(z) < 10 || Math.abs(z - 50) < 10 || Math.abs(z + 50) < 10) continue;

            const bGroup = new THREE.Group();
            const width = 12 + Math.random() * 4;
            const height = 10 + Math.random() * 14;
            const depth = 12 + Math.random() * 4;

            const colorHex = wallColors[Math.floor(Math.random() * wallColors.length)];
            const wallMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 });

            // Main Building Block
            const mainBox = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat);
            mainBox.position.y = height / 2;
            mainBox.castShadow = true;
            mainBox.receiveShadow = true;
            bGroup.add(mainBox);

            // Roof Border Ledge
            const ledge = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.5, depth + 0.4), frameMat);
            ledge.position.y = height + 0.25;
            bGroup.add(ledge);

            // Ground Floor Front Door
            const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.2), doorMat);
            door.position.set(0, 1.6, depth / 2 + 0.1);
            bGroup.add(door);

            // Windows Grid on Front & Back Facades
            const winGeo = new THREE.BoxGeometry(1.4, 1.8, 0.15);
            for (let y = 4; y < height - 2; y += 3) {
                for (let wx = -width / 2 + 2; wx <= width / 2 - 2; wx += 3) {
                    // Front Window
                    const winF = new THREE.Mesh(winGeo, glassMat);
                    winF.position.set(wx, y, depth / 2 + 0.1);
                    bGroup.add(winF);

                    // Back Window
                    const winB = new THREE.Mesh(winGeo, glassMat);
                    winB.position.set(wx, y, -depth / 2 - 0.1);
                    bGroup.add(winB);
                }
            }

            bGroup.position.set(x, 0, z);
            scene.add(bGroup);
            environmentObjects.push(bGroup);
        }
    }

    // 4. City Plaza Center: Fountain & Water Columns
    const fountainGroup = new THREE.Group();
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 1.2, 24), gabrosMat);
    basin.position.y = 0.6;

    const waterBaseMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1 });
    const waterBase = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 0.8, 24), waterBaseMat);
    waterBase.position.y = 0.8;

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 3.5, 16), gabrosMat);
    pillar.position.y = 1.75;

    // Animated Fountain Spout
    fountainWaterColumn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 1.2, 4.5, 16),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
    );
    fountainWaterColumn.position.y = 4.2;

    fountainGroup.add(basin, waterBase, pillar, fountainWaterColumn);
    fountainGroup.position.set(25, 0, 25); // Placed at plaza road intersection
    scene.add(fountainGroup);
    environmentObjects.push(fountainGroup);

    // 5. Realistic Vegetation: Palm Trees & Branching Oak Trees
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3f2e1e, roughness: 0.9 });
    const oakLeafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4 });

    for (let i = 0; i < 35; i++) {
        const treeGroup = new THREE.Group();
        const isPalm = Math.random() > 0.5;

        if (isPalm) {
            // Palm Tree with Curved Trunk & Fronds
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 8), trunkMat);
            trunk.position.y = 3.5;
            trunk.rotation.z = (Math.random() - 0.5) * 0.2;
            treeGroup.add(trunk);

            // Palm Fronds
            for (let f = 0; f < 7; f++) {
                const frond = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 3.5), palmLeafMat);
                frond.position.set(0, 7, 0);
                frond.rotation.y = (f / 7) * Math.PI * 2;
                frond.rotation.x = 0.4;
                treeGroup.add(frond);
            }
        } else {
            // Oak Tree with Distinguishable Branches
            const mainTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 5, 8), trunkMat);
            mainTrunk.position.y = 2.5;
            treeGroup.add(mainTrunk);

            // 3 Sub-Branches
            for (let b = 0; b < 3; b++) {
                const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 2.5, 8), trunkMat);
                branch.position.set((b - 1) * 0.8, 4.5, (b - 1) * 0.4);
                branch.rotation.z = (b - 1) * 0.5;
                treeGroup.add(branch);

                // Leaf Clusters on Branches
                const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8, 1), oakLeafMat);
                leaves.position.set((b - 1) * 1.5, 5.8, (b - 1) * 0.8);
                treeGroup.add(leaves);
            }
        }

        const tx = (Math.random() - 0.5) * 220;
        const tz = (Math.random() - 0.5) * 220;
        if (Math.abs(tx % 50) > 8 && Math.abs(tz % 50) > 8) {
            treeGroup.position.set(tx, 0, tz);
            scene.add(treeGroup);
            environmentObjects.push(treeGroup);
        }
    }

    // 6. Parked Cars along Roadsides
    const carMat = new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.4 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    for (let i = 0; i < 14; i++) {
        const carGroup = new THREE.Group();
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 4.2), carMat);
        chassis.position.y = 0.6;

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2), glassMat);
        cabin.position.set(0, 1.25, -0.2);

        const wGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16);
        wGeo.rotateZ(Math.PI / 2);

        const w1 = new THREE.Mesh(wGeo, wheelMat); w1.position.set(-1.1, 0.35, 1.2);
        const w2 = new THREE.Mesh(wGeo, wheelMat); w2.position.set(1.1, 0.35, 1.2);
        const w3 = new THREE.Mesh(wGeo, wheelMat); w3.position.set(-1.1, 0.35, -1.2);
        const w4 = new THREE.Mesh(wGeo, wheelMat); w4.position.set(1.1, 0.35, -1.2);

        carGroup.add(chassis, cabin, w1, w2, w3, w4);

        const cx = [-57, 57, -7, 7][i % 4];
        const cz = (i * 18) - 120;
        carGroup.position.set(cx, 0, cz);

        scene.add(carGroup);
        environmentObjects.push(carGroup);
    }
}

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

// Update Real-Time HUD Compass (N, NE, E, SE, S, SW, W, NW)
function updateHUDCompass() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    let angleDeg = Math.atan2(-dir.x, -dir.z) * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    const cardinalDirections = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
    const index = Math.round(angleDeg / 45);
    const compassStr = cardinalDirections[index];

    const compassElem = document.getElementById('compass-display');
    if (compassElem) {
        compassElem.innerText = `COMPASS: ${compassStr} (${Math.floor(angleDeg)}°)`;
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
                setTimeout(spawnHumanoidEnemy, 3000);
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

// Render Loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls) controls.update(delta);
    updateHUDCompass();

    // Pulse fountain water column
    if (fountainWaterColumn) {
        fountainWaterColumn.scale.y = 1 + Math.sin(time * 0.005) * 0.15;
    }

    enemies.forEach((enemy) => {
        const dist = enemy.position.distanceTo(camera.position);

        if (dist > 1.4) {
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

        if (dist < 1.6) {
            health = Math.max(0, health - 0.3);
            document.getElementById('health-val').innerText = Math.floor(health);
            playSound('damage');
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