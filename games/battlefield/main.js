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

    // 1. Vivid Night Sky & Atmospheric Lighting
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Deep moonlight navy
    scene.fog = new THREE.FogExp2(0x0f172a, 0.008);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Balanced Ambient Light (Prevents pitch black areas)
    ambientLight = new THREE.AmbientLight(0x38bdf8, 0.55);
    scene.add(ambientLight);

    // Moonlight & Shadow Directional Light
    dirLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
    dirLight.position.set(80, 120, -60);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 300;
    dirLight.shadow.camera.left = -150;
    dirLight.shadow.camera.right = 150;
    dirLight.shadow.camera.top = 150;
    dirLight.shadow.camera.bottom = -150;
    scene.add(dirLight);

    // Create Sky Moon & Starfield Backdrop
    initSkyAndMoon();

    initFirstPersonWeapon();
    buildEnvironment(selectedMap);
    controls = initFirstPersonControls(camera, environmentObjects);

    for (let i = 0; i < 6; i++) spawnRealisticZombie();

    setupMenuUI();
    initCharacterPreview();
    animate();
}

// Moon Sphere and Starfield Generation
function initSkyAndMoon() {
    // Glowing Moon Mesh
    const moonGeo = new THREE.SphereGeometry(6, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(80, 120, -60);
    scene.add(moon);

    // Starfield Particles
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1200;
    const posArray = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 600;
        posArray[i + 1] = 40 + Math.random() * 200;
        posArray[i + 2] = (Math.random() - 0.5) * 600;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.8 });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);
}

// First-Person Weapon Model
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

// Organic Humanoid Zombie Spawner (Smooth geometries, grime, human proportions)
function spawnRealisticZombie() {
    const group = new THREE.Group();

    // Natural dirty human skin tones
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x5a6351, roughness: 0.7 }); // Grimy pale olive skin
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
    const clothesMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 }); // Tattered shirt
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

    // Smooth Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.75, 16), clothesMat);
    torso.position.y = 1.1;

    // Curved Neck & Smooth Head
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 12), skinMat);
    neck.position.y = 1.55;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), skinMat);
    head.position.y = 1.78;
    head.scale.set(1, 1.15, 1); // Natural oval head shape

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
    hair.position.y = 1.8;

    // Organic Curved Arms with Joints
    const leftArmGroup = new THREE.Group();
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.65, 12), clothesMat);
    leftArm.position.y = -0.3;
    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), skinMat);
    leftHand.position.set(0, -0.65, 0);
    leftArmGroup.add(leftArm, leftHand);
    leftArmGroup.position.set(-0.32, 1.38, 0);

    const rightArmGroup = new THREE.Group();
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.65, 12), clothesMat);
    rightArm.position.y = -0.3;
    const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), skinMat);
    rightHand.position.set(0, -0.65, 0);
    rightArmGroup.add(rightArm, rightHand);
    rightArmGroup.position.set(0.32, 1.38, 0);

    // Organic Legs
    const leftLegGroup = new THREE.Group();
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.7, 12), pantsMat);
    leftLeg.position.y = -0.35;
    leftLegGroup.add(leftLeg);
    leftLegGroup.position.set(-0.14, 0.7, 0);

    const rightLegGroup = new THREE.Group();
    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.7, 12), pantsMat);
    rightLeg.position.y = -0.35;
    rightLegGroup.add(rightLeg);
    rightLegGroup.position.set(0.14, 0.7, 0);

    group.add(torso, neck, head, hair, leftArmGroup, rightArmGroup, leftLegGroup, rightLegGroup);

    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 30;
    group.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

    group.userData = {
        health: 100,
        speed: 2.1,
        walkCycle: Math.random() * Math.PI * 2,
        torso, head, leftArmGroup, rightArmGroup, leftLegGroup, rightLegGroup
    };

    scene.add(group);
    enemies.push(group);
}

// World Environment with Church, Temple, Graveyard, Illuminating Street Lamps & Tarmac
function buildEnvironment(mapType) {
    environmentObjects.forEach(obj => scene.remove(obj));
    environmentObjects.length = 0;
    trafficLightMeshes = [];

    // Solid Earth Floor
    const floorGeo = new THREE.PlaneGeometry(320, 320);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Matte Black Tarmac & Footpaths
    const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });

    for (let pos of [-50, 0, 50]) {
        const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(12, 320), tarmacMat);
        roadNS.rotation.x = -Math.PI / 2;
        roadNS.position.set(pos, 0.01, 0);
        roadNS.receiveShadow = true;
        scene.add(roadNS);

        const pathL = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 320), pathMat);
        pathL.rotation.x = -Math.PI / 2;
        pathL.position.set(pos - 7.25, 0.02, 0);
        scene.add(pathL);

        const pathR = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 320), pathMat);
        pathR.rotation.x = -Math.PI / 2;
        pathR.position.set(pos + 7.25, 0.02, 0);
        scene.add(pathR);

        const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(320, 12), tarmacMat);
        roadEW.rotation.x = -Math.PI / 2;
        roadEW.position.set(0, 0.01, pos);
        roadEW.receiveShadow = true;
        scene.add(roadEW);
    }

    // 1. Gothic Church Landmark
    const churchGroup = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const stainGlassMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const nave = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 28), stoneMat);
    nave.position.y = 6;
    nave.castShadow = true;
    nave.receiveShadow = true;

    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.5, 14, 4), roofMat);
    spire.position.set(0, 19, -10);
    spire.castShadow = true;

    const windowF = new THREE.Mesh(new THREE.CircleGeometry(2.2, 16), stainGlassMat);
    windowF.position.set(0, 8, 14.1);

    churchGroup.add(nave, spire, windowF);
    churchGroup.position.set(-80, 0, 80);
    scene.add(churchGroup);
    environmentObjects.push(churchGroup);

    // 2. Ancient Temple Landmark
    const templeGroup = new THREE.Group();
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(22, 2, 22), marbleMat);
    base.position.y = 1;
    base.castShadow = true;
    base.receiveShadow = true;
    templeGroup.add(base);

    // Pillars
    const colGeo = new THREE.CylinderGeometry(0.6, 0.7, 8, 12);
    for (let px = -8; px <= 8; px += 5.3) {
        for (let pz = -8; pz <= 8; pz += 5.3) {
            if (Math.abs(px) < 6 && Math.abs(pz) < 6) continue;
            const col = new THREE.Mesh(colGeo, marbleMat);
            col.position.set(px, 6, pz);
            col.castShadow = true;
            templeGroup.add(col);
        }
    }

    const roof = new THREE.Mesh(new THREE.BoxGeometry(23, 2, 23), marbleMat);
    roof.position.y = 11;
    roof.castShadow = true;
    templeGroup.add(roof);

    templeGroup.position.set(80, 0, -80);
    scene.add(templeGroup);
    environmentObjects.push(templeGroup);

    // 3. City Graveyard Landmark
    const cemeteryGroup = new THREE.Group();
    const graveMat = new THREE.MeshStandardMaterial({ color: 0x475569 });

    for (let gx = -12; gx <= 12; gx += 4) {
        for (let gz = -12; gz <= 12; gz += 6) {
            const headstone = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.2), graveMat);
            headstone.position.set(gx, 0.7, gz);
            headstone.rotation.y = (Math.random() - 0.5) * 0.3;
            headstone.castShadow = true;
            cemeteryGroup.add(headstone);
        }
    }
    cemeteryGroup.position.set(80, 0, 80);
    scene.add(cemeteryGroup);

    // 4. City Buildings
    const wallColors = [0x1e293b, 0x0f172a, 0x334155, 0x18181b];
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, emissive: 0x0284c7, emissiveIntensity: 0.3 });

    for (let x = -110; x <= 110; x += 35) {
        for (let z = -110; z <= 110; z += 35) {
            if (Math.abs(x) < 10 || Math.abs(x - 50) < 10 || Math.abs(x + 50) < 10) continue;
            if (Math.abs(z) < 10 || Math.abs(z - 50) < 10 || Math.abs(z + 50) < 10) continue;
            if (Math.abs(x) > 60 && Math.abs(z) > 60) continue; // Keep space for landmarks

            const bGroup = new THREE.Group();
            const width = 12 + Math.random() * 4;
            const height = 12 + Math.random() * 12;
            const depth = 12 + Math.random() * 4;

            const bWallMat = new THREE.MeshStandardMaterial({ color: wallColors[Math.floor(Math.random() * wallColors.length)], roughness: 0.7 });
            const mainBox = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bWallMat);
            mainBox.position.y = height / 2;
            mainBox.castShadow = true;
            mainBox.receiveShadow = true;
            bGroup.add(mainBox);

            // Windows
            const winGeo = new THREE.BoxGeometry(1.4, 1.8, 0.15);
            for (let y = 4; y < height - 2; y += 3) {
                for (let wx = -width / 2 + 2; wx <= width / 2 - 2; wx += 3) {
                    const winF = new THREE.Mesh(winGeo, glassMat);
                    winF.position.set(wx, y, depth / 2 + 0.1);
                    bGroup.add(winF);
                }
            }

            bGroup.position.set(x, 0, z);
            scene.add(bGroup);
            environmentObjects.push(bGroup);
        }
    }

    // 5. Illuminating Street Lamps (Casts Warm Yellow Spot/Point Lights)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const lampGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    for (let x of [-56, 56]) {
        for (let z of [-80, -40, 0, 40, 80]) {
            const lampGroup = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 8), poleMat);
            pole.position.y = 3;
            pole.castShadow = true;

            const bulb = new THREE.Mesh(lampGeo, lampMat);
            bulb.position.set(0.6, 5.8, 0);

            // Bright Illumination Light Source
            const streetLight = new THREE.PointLight(0xfef08a, 3.5, 25);
            streetLight.position.set(0.6, 5.5, 0);
            streetLight.castShadow = true;

            lampGroup.add(pole, bulb, streetLight);
            lampGroup.position.set(x, 0, z);
            scene.add(lampGroup);
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

function updateCompassAndElevation() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    let angleDeg = Math.atan2(-dir.x, -dir.z) * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    const needle = document.getElementById('compass-needle');
    if (needle) {
        needle.style.transform = `rotate(${angleDeg}deg)`;
    }

    const pitchDeg = Math.asin(dir.y) * (180 / Math.PI);
    const elevationElem = document.getElementById('elevation-readout');
    if (elevationElem) {
        elevationElem.innerText = `PITCH: ${Math.floor(pitchDeg)}°`;
    }
}

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

// Render Loop with Organic Humanoid Walk Cycles & Smooth Bobbing
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls) controls.update(delta);
    updateCompassAndElevation();

    // Enemy Pursuit, Separation Physics & Organic Gait Animation
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const distToPlayer = enemy.position.distanceTo(camera.position);

        // Anti-fusion separation
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

            // Organic Walk Cycle: Smooth limb swinging & subtle torso bobbing
            enemy.userData.walkCycle += delta * 7;
            const cycle = enemy.userData.walkCycle;

            enemy.userData.leftArmGroup.rotation.x = Math.sin(cycle) * 0.5;
            enemy.userData.rightArmGroup.rotation.x = -Math.sin(cycle) * 0.5;
            enemy.userData.leftLegGroup.rotation.x = -Math.sin(cycle) * 0.5;
            enemy.userData.rightLegGroup.rotation.x = Math.sin(cycle) * 0.5;

            // Torso & head natural stride bobbing
            if (enemy.userData.torso) {
                enemy.userData.torso.position.y = 1.1 + Math.abs(Math.sin(cycle * 2)) * 0.05;
            }
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