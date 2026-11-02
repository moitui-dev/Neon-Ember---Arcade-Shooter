import * as THREE from 'three';

export function initFirstPersonControls(camera, environmentObjects) {
    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;
    let isSprinting = false;
    let isAltLooking = false;

    let velocityY = 0;
    const gravity = 22.0;
    let isGrounded = true;

    let stamina = 100;
    const maxStamina = 100;

    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    let freeLookAngleY = 0;

    document.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement !== document.body) return;

        const movementX = event.movementX || event.mozMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || 0;

        if (isAltLooking) {
            freeLookAngleY -= movementX * 0.0025;
        } else {
            euler.setFromQuaternion(camera.quaternion);
            euler.y -= movementX * 0.0025;
            euler.x -= movementY * 0.0025;
            euler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, euler.x));
            euler.z = 0;
            camera.quaternion.setFromEuler(euler);
        }
    });

    document.addEventListener('keydown', (e) => {
        switch (e.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyD': moveRight = true; break;
            case 'ShiftLeft':
            case 'ShiftRight': isSprinting = true; break;
            case 'AltLeft':
            case 'AltRight':
                e.preventDefault();
                if (!isAltLooking) {
                    isAltLooking = true;
                    freeLookAngleY = Math.PI;
                }
                break;
            case 'Space':
                if (isGrounded && stamina >= 15) {
                    velocityY = 8.5;
                    isGrounded = false;
                    stamina -= 15;
                }
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyD': moveRight = false; break;
            case 'ShiftLeft':
            case 'ShiftRight': isSprinting = false; break;
            case 'AltLeft':
            case 'AltRight':
                isAltLooking = false;
                freeLookAngleY = 0;
                break;
        }
    });

    function update(delta) {
        const isMoving = moveForward || moveBackward || moveLeft || moveRight;

        if (isSprinting && isMoving && stamina > 0) {
            stamina = Math.max(0, stamina - 25 * delta);
        } else {
            stamina = Math.min(maxStamina, stamina + 18 * delta);
        }

        const staminaBar = document.getElementById('stamina-bar');
        if (staminaBar) {
            staminaBar.style.width = `${(stamina / maxStamina) * 100}%`;
        }

        const currentSpeed = (isSprinting && stamina > 5) ? 48.0 : 25.0;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * currentSpeed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * currentSpeed * delta;

        const moveX = -velocity.x * delta;
        const moveZ = velocity.z * delta;

        camera.translateX(moveX);
        if (checkCollision(camera, environmentObjects) || isOutOfBounds(camera.position)) {
            camera.translateX(-moveX);
        }

        camera.translateZ(moveZ);
        if (checkCollision(camera, environmentObjects) || isOutOfBounds(camera.position)) {
            camera.translateZ(-moveZ);
        }

        velocityY -= gravity * delta;
        camera.position.y += velocityY * delta;

        if (camera.position.y <= 1.6) {
            camera.position.y = 1.6;
            velocityY = 0;
            isGrounded = true;
        }

        if (isAltLooking) {
            const baseEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
            baseEuler.y += freeLookAngleY;
            camera.quaternion.setFromEuler(baseEuler);
        }
    }

    function isOutOfBounds(pos) {
        const BOUND = 140;
        return Math.abs(pos.x) > BOUND || Math.abs(pos.z) > BOUND;
    }

    function checkCollision(cam, objects) {
        const playerBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cam.position.x, cam.position.y, cam.position.z),
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