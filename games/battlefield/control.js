export function initControls(camera, onMoveStateChange) {
    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;

    document.addEventListener('keydown', (e) => {
        switch (e.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyD': moveRight = true; break;
        }
        onMoveStateChange({ moveForward, moveBackward, moveLeft, moveRight });
    });

    document.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyD': moveRight = false; break;
        }
        onMoveStateChange({ moveForward, moveBackward, moveLeft, moveRight });
    });

    document.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement !== document.body) return;
        const movementX = event.movementX || event.mozMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || 0;

        camera.rotation.y -= movementX * 0.002;
        camera.rotation.x -= movementY * 0.002;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    });
}