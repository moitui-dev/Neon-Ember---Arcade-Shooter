import * as THREE from 'three';

export function initFirstPersonControls(camera, environmentObjects) {
    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;

    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();

    // Use Euler YXZ to eliminate Roll and prevent upside-down view flips
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');

    document.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement !== document.body) return;

        const movementX = event.movementX || event.mozMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || 0;

        euler.setFromQuaternion(camera.quaternion);

        // Sensitivity scaling
        euler.y -= movementX * 0.002;
        euler.x -= movementY * 0.002;

        // Clamp pitch so camera cannot tilt past top/bottom look angles (-85 to +85 deg)
        euler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, euler.x));
        euler.z = 0; // Lock roll axis completely

        camera.quaternion.setFromEuler(euler);
    });

    document.addEventListener('keydown', (e) => {
        switch (e.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyD': moveRight = true; break;
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

    function update(delta) {
        velocity.x -= velocity.x * 12.0 * delta;
        velocity.z -= velocity.z * 12.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 38.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 38.0 * delta;

        const moveX = -velocity.x * delta;
        const moveZ = velocity.z * delta;

        // Test X movement with colliders
        camera.translateX(moveX);
        camera.position.y = 1.6;
        if (checkCollision(camera, environmentObjects) || isOutOfBounds(camera.position)) {
            camera.translateX(-moveX);
        }

        // Test Z movement with colliders
        camera.translateZ(moveZ);
        camera.position.y = 1.6;
        if (checkCollision(camera, environmentObjects) || isOutOfBounds(camera.position)) {
            camera.translateZ(-moveZ);
        }
    }

    // Map Arena Boundary Collisions (+/- 140 units from center)
    function isOutOfBounds(pos) {
        const BOUND = 140;
        return Math.abs(pos.x) > BOUND || Math.abs(pos.z) > BOUND;
    }

    function checkCollision(cam, objects) {
        const playerBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cam.position.x, 1.6, cam.position.z),
            new THREE.Vector3(0.6, 1.8, 0.6)
        );

        for (let obj of objects) {
            const objBox = new THREE.Box3().setFromObject(obj);
            if (playerBox.intersectsBox(objBox)) {
                return true;
            }
        }
        return false;
    }

    return { update };
}