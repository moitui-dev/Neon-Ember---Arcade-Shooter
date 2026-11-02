import * as THREE from 'three';

export function initFirstPersonControls(camera, collisionObjects = []) {
    const moveState = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        jump: false
    };

    let velocity = new THREE.Vector3();
    let direction = new THREE.Vector3();
    let canJump = false;
    let pitch = 0;
    let yaw = 0;

    const normalSpeed = 6.0;
    const sprintSpeed = 12.0;
    const gravity = 30.0;

    const docBody = document.body;

    document.addEventListener('keydown', (e) => {
        if (document.pointerLockElement !== docBody) return;
        switch (e.code) {
            case 'KeyW': moveState.forward = true; break;
            case 'KeyS': moveState.backward = true; break;
            case 'KeyA': moveState.left = true; break;
            case 'KeyD': moveState.right = true; break;
            case 'ShiftLeft':
            case 'ShiftRight': moveState.sprint = true; break;
            case 'Space':
                if (canJump) {
                    velocity.y += 10;
                    canJump = false;
                }
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW': moveState.forward = false; break;
            case 'KeyS': moveState.backward = false; break;
            case 'KeyA': moveState.left = false; break;
            case 'KeyD': moveState.right = false; break;
            case 'ShiftLeft':
            case 'ShiftRight': moveState.sprint = false; break;
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement !== docBody) return;
        const sensitivity = 0.002;
        yaw -= e.movementX * sensitivity;
        pitch -= e.movementY * sensitivity;

        const maxPitch = Math.PI / 2 - 0.01;
        pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));

        camera.rotation.set(0, 0, 0);
        camera.rotateY(yaw);
        camera.rotateX(pitch);
    });

    function update(delta) {
        const currentSpeed = moveState.sprint ? sprintSpeed : normalSpeed;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= gravity * delta;

        direction.z = Number(moveState.forward) - Number(moveState.backward);
        direction.x = Number(moveState.right) - Number(moveState.left);
        direction.normalize();

        if (moveState.forward || moveState.backward) velocity.z -= direction.z * currentSpeed * 10.0 * delta;
        if (moveState.left || moveState.right) velocity.x -= direction.x * currentSpeed * 10.0 * delta;

        camera.translateX(-velocity.x * delta);
        camera.translateZ(velocity.z * delta);

        camera.position.y += velocity.y * delta;

        if (camera.position.y < 1.6) {
            velocity.y = 0;
            camera.position.y = 1.6;
            canJump = true;
        }

        const staminaBar = document.getElementById('stamina-bar');
        if (staminaBar) {
            if (moveState.sprint && (moveState.forward || moveState.backward)) {
                staminaBar.style.width = Math.max(10, parseInt(staminaBar.style.width || 100) - 0.5) + '%';
            } else {
                staminaBar.style.width = Math.min(100, parseInt(staminaBar.style.width || 100) + 0.8) + '%';
            }
        }
    }

    return { update };
}