import * as THREE from 'three';

export function initFirstPersonControls(camera, environmentObjects) {
    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;

    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();

    // Mouse Look via Pointer Lock API
    document.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement !== document.body) return;

        const movementX = event.movementX || event.mozMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || 0;

        camera.rotation.y -= movementX * 0.002;
        camera.rotation.x -= movementY * 0.002;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    });

    // Keyboard Listeners with immediate stop on keyup
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
        // Friction / Deceleration to prevent infinite sliding
        velocity.x -= velocity.x * 12.0 * delta;
        velocity.z -= velocity.z * 12.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 40.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 40.0 * delta;

        const oldPosition = camera.position.clone();

        camera.translateX(-velocity.x * delta);
        camera.translateZ(velocity.z * delta);
        camera.position.y = 1.6; // Lock eye-level height

        // Basic Bounding Box Collision Detection against environment objects
        const playerBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(camera.position.x, 1.6, camera.position.z),
            new THREE.Vector3(0.8, 1.8, 0.8)
        );

        for (let obj of environmentObjects) {
            const objBox = new THREE.Box3().setFromObject(obj);
            if (playerBox.intersectsBox(objBox)) {
                camera.position.copy(oldPosition); // Revert position on collision
                break;
            }
        }
    }

    return { update };
}