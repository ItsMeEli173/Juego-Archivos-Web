export function checkHit(attackerPos, targetPos, attackRange) {
    // Calculamos distancia 3D real
    const dx = attackerPos.x - targetPos.x;
    const dy = attackerPos.y - targetPos.y;
    const dz = attackerPos.z - targetPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    return distance <= attackRange;
}

export function applyDamage(target, baseDamage) {
    // Si el objetivo está bloqueando, anula o reduce el daño
    if (target.isBlocking) {
        console.log("¡Golpe bloqueado!");
        return 0; // O podrías devolver baseDamage * 0.2 para que traspase un poco
    } else {
        target.health -= baseDamage;
        console.log(`Daño aplicado. Vida restante: ${target.health}`);
        return baseDamage;
    }
}