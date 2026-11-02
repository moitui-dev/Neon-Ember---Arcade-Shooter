import * as THREE from 'three';

export function initFirstPersonControls(camera, environmentObjects) {
    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;

    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();

    document.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement !== document.body) return;

        const movementX = event.movementX || event.mozMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || 0;

        camera.rotation.y -= movementX * 0.002;
        camera.rotation.x -= movementY * 0.002;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
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

        if (moveForward || moveBackward) velocity.z -= direction.z * 35.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 35.0 * delta;

        // Separate X and Z movement for smooth sliding against walls (prevents getting stuck)
        const moveX = -velocity.x * delta;
        const moveZ = velocity.z * delta;

        // Test X movement
        camera.translateX(moveX);
        camera.position.y = 1.6;
        if (checkCollision(camera, environmentObjects)) {
            camera.translateX(-moveX); // Revert X if colliding
        }

        // Test Z movement
        camera.translateZ(moveZ);
        camera.position.y = 1.6;
        if (checkCollision(camera, environmentObjects)) {
            camera.translateZ(-moveZ); // Revert Z if colliding
        }
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