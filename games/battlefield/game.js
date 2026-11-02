import * as THREE from 'three';

let scene, camera, renderer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();
let isScoped = false;

const container = document.getElementById('game-canvas-container');
const instructions = document.getElementById('instructions');

// 1. Initialize Scene & Fog
scene = new THREE.Scene();
scene.background = new THREE.Color(0x15151b);
scene.fog = new THREE.FogExp2(0x15151b, 0.02);

camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);

// 2. Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 30, 10);
scene.add(dirLight);

// 3. WebGL Renderer
renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// 4. Ground / Arena Floor
const floorGeo = new THREE.PlaneGeometry(200, 200, 32, 32);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.8 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Obstacles & Cover Boxes
const boxGeo = new THREE.BoxGeometry(3, 3, 3);
const boxMat = new THREE.MeshStandardMaterial({ color: 0x444455 });
for (let i = 0; i < 20; i++) {
    const obstacle = new THREE.Mesh(boxGeo, boxMat);
    obstacle.position.x = (Math.random() - 0.5) * 80;
    obstacle.position.y = 1.5;
    obstacle.position.z = (Math.random() - 0.5) * 80;
    scene.add(obstacle);
}

// 5. Pointer Lock API Controls
instructions.addEventListener('click', () => {
    document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
        instructions.classList.add('hidden');
    } else {
        instructions.classList.remove('hidden');
    }
});

document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== document.body) return;
    const movementX = event.movementX || event.mozMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || 0;

    camera.rotation.y -= movementX * 0.002;
    camera.rotation.x -= movementY * 0.002;
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
});

// Key Listeners for Movement
document.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'KeyG': throwGrenade(); break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
    }
});

// M16 Aim Down Sights (ADS) & Firing Mechanics
document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== document.body) return;
    if (e.button === 2) { // Right Click Scope Zoom
        isScoped = true;
        camera.fov = 25;
        camera.updateProjectionMatrix();
        document.getElementById('scope-overlay').classList.remove('hidden');
        document.getElementById('crosshair').classList.add('hidden');
    } else if (e.button === 0) { // Left Click Shoot
        shootM16();
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 2) { // Release Scope
        isScoped = false;
        camera.fov = 75;
        camera.updateProjectionMatrix();
        document.getElementById('scope-overlay').classList.add('hidden');
        document.getElementById('crosshair').classList.remove('hidden');
    }
});

function shootM16() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
        console.log("M16 Hit target:", intersects[0].object);
    }
}

function throwGrenade() {
    const grenadeGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x113311 });
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
        grenade.position.y -= 4.9 * time * time; // Gravity curve

        if (grenade.position.y <= 0) {
            clearInterval(interval);
            scene.remove(grenade);
            console.log("Grenade detonated!");
        }
    }, 16);
}

// 6. Main Render Loop
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

    prevTime = time;
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});