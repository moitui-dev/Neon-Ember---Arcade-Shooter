import * as THREE from 'three';

export function shootM16(scene, camera) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        console.log("M16 Hit target:", intersects[0].object);
        return intersects[0].point;
    }
    return null;
}

export function throwGrenade(scene, camera) {
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