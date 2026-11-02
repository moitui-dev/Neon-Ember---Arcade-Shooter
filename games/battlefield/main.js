import * as THREE from 'three';
import { initControls } from './control.js';
import { shootM16, throwGrenade } from './weapon.js';
import { initVoiceChat } from './voice.js';

let scene, camera, renderer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();
let isScoped = false;

const container = document.getElementById('game-canvas-container');
const instructions = document.getElementById('instructions');

// Initialize Scene
scene = new THREE.Scene();
scene.background = new THREE.Color(0x15151b);
scene.fog = new THREE.FogExp2(0x15151b, 0.02);

camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 30, 10);
scene.add(dirLight);

// Renderer
renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Floor & Obstacles
const floorGeo = new THREE.PlaneGeometry(200, 200, 32, 32);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.8 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const boxGeo = new THREE.BoxGeometry(3, 3, 3);
const boxMat = new THREE.MeshStandardMaterial({ color: 0x444455 });
for (let i = 0; i < 20; i++) {
    const obstacle = new THREE.Mesh(boxGeo, boxMat);
    obstacle.position.x = (Math.random() - 0.5) * 80;
    obstacle.position.y = 1.5;
    obstacle.position.z = (Math.random() - 0.5) * 80;
    scene.add(obstacle);
}

// Pointer Lock
instructions.addEventListener('click', () => {
    document.body.requestPointerLock();
    initVoiceChat(); // Initialize mic on game start
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
        instructions.classList.add('hidden');
    } else {
        instructions.classList.remove('hidden');
    }
});

// Setup controls module
initControls(camera, (state) => {
    moveForward = state.moveForward;
    moveBackward = state.moveBackward;
    moveLeft = state.moveLeft;
    moveRight = state.moveRight;
});

// Grenade & Actions
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyG') throwGrenade(scene, camera);
});

// Mouse Clicks (ADS & Shooting)
document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== document.body) return;
    if (e.button === 2) {
        isScoped = true;
        camera.fov = 25;
        camera.updateProjectionMatrix();
        document.getElementById('scope-overlay').classList.remove('hidden');
        document.getElementById('crosshair').classList.add('hidden');
    } else if (e.button === 0) {
        shootM16(scene, camera);
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
        isScoped = false;
        camera.fov = 75;
        camera.updateProjectionMatrix();
        document.getElementById('scope-overlay').classList.add('hidden');
        document.getElementById('crosshair').classList.remove('hidden');
    }
});

// Render Loop
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