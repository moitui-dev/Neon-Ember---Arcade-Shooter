for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    const distToPlayer = enemy.position.distanceTo(camera.position);

    // Zombies sprint faster when close to the player
    let currentRunSpeed = distToPlayer < 18 ? enemy.userData.speed * 1.8 : enemy.userData.speed;

    if (distToPlayer > 1.4) {
        const dir = new THREE.Vector3().subVectors(camera.position, enemy.position);
        dir.y = 0;
        dir.normalize();
        enemy.position.addScaledVector(dir, currentRunSpeed * delta);

        enemy.userData.walkCycle += delta * (distToPlayer < 18 ? 14 : 7); // Faster leg/arm swing when running
        const cycle = enemy.userData.walkCycle;

        enemy.userData.leftArmGroup.rotation.x = Math.sin(cycle) * 0.8;
        enemy.userData.rightArmGroup.rotation.x = -Math.sin(cycle) * 0.8;
        enemy.userData.leftLegGroup.rotation.x = -Math.sin(cycle) * 0.8;
        enemy.userData.rightLegGroup.rotation.x = Math.sin(cycle) * 0.8;
    }

    enemy.lookAt(camera.position.x, 0, camera.position.z);

    if (distToPlayer < 1.6) {
        health = Math.max(0, health - 0.4);
        document.getElementById('health-val').innerText = Math.floor(health);
        playSound('damage');
    }
}