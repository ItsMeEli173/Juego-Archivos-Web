let camera;
// Posición relativa: un poco atrás y arriba del jugador
const offset = new THREE.Vector3(0, 5, 10); 

export function initCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
}

export function updateCamera(target) {
    if (!target) return;

    // Calcular posición detrás del jugador basada en su rotación actual
    const rotatedOffset = offset.clone().applyMatrix4(new THREE.Matrix4().makeRotationY(target.rotation.y));
    const targetPosition = target.position.clone().add(rotatedOffset);

    // Movimiento fluido de la cámara
    camera.position.lerp(targetPosition, 0.1);

    // Mirar al centro de masa del jugador (un poco arriba de sus pies)
    const lookTarget = target.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    camera.lookAt(lookTarget);
}

export function getCamera() {
    return camera;
}