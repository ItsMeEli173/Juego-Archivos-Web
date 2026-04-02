import { getScene } from '../engine/scene.js';
import { colliders, checkWallCollision, getGroundY } from '../world/colliders.js';
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export const playerState = {
    mesh: null, sword: null, shield: null,
    speed: 10, health: 100, kills: 0, deaths: 0,
    name: 'Player-1', team: 'attacker', isDead: false,
    baseColor: 0xcc0000,
    isBlocking: false, isAttacking: false, attackCooldown: 0,
    attackRange: 3.5, damage: 25,
    velocityY: 0, gravity: -25, jumpForce: 12, isGrounded: false
};

export function initPlayer() {
    const scene = getScene();
    playerState.mesh = new THREE.Group();

    // Tronco
    const bodyGeo = new THREE.BoxGeometry(1, 1.2, 0.8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: playerState.baseColor, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = -0.4;
    playerState.mesh.add(body);

    // Cabeza
    const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, flatShading: true });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.5;
    playerState.mesh.add(head);

    // Casco
    const helmetGeo = new THREE.BoxGeometry(0.7, 0.4, 0.7);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 0.7;
    playerState.mesh.add(helmet);

    playerState.sword = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    playerState.sword.position.set(0.8, 0, -0.5);
    playerState.sword.rotation.x = Math.PI / 2;
    playerState.mesh.add(playerState.sword);

    playerState.shield = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
    playerState.shield.position.set(-0.8, 0, 0);
    playerState.mesh.add(playerState.shield);

    // Lo instanciamos en alto para que caiga al suelo correctamente
    playerState.mesh.position.set(0, 20, 0);
    scene.add(playerState.mesh);
}

export function updatePlayer(deltaTime, input) {
    if (!playerState.mesh || playerState.isDead) return;

    let moveX = input.moveX; 
    let moveZ = input.moveZ;
    const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (length > 1) { moveX /= length; moveZ /= length; }

    let dirX = 0; let dirZ = 0;

    // Calcular dirección
    if (input.isMobile) {
        if (length > 0 && !input.block) {
            dirX = moveX * playerState.speed * deltaTime;
            dirZ = moveZ * playerState.speed * deltaTime;
            playerState.mesh.rotation.y = Math.atan2(-moveX, -moveZ);
        }
    } else {
        if (input.deltaX !== 0) {
            playerState.mesh.rotation.y -= input.deltaX * 0.003;
        }
        if (length > 0 && !input.block) {
            const direction = new THREE.Vector3(moveX, 0, moveZ);
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerState.mesh.rotation.y);
            dirX = direction.x * playerState.speed * deltaTime;
            dirZ = direction.z * playerState.speed * deltaTime;
        }
    }

    // --- MOVIMIENTO CON DESLIZAMIENTO DE COLISIÓN (Usa el colliders.js) ---
    const WORLD_LIMIT = 148; 

    if (dirX !== 0) {
        const nextX = playerState.mesh.position.x + dirX;
        if (nextX > -WORLD_LIMIT && nextX < WORLD_LIMIT && !checkWallCollision(nextX, playerState.mesh.position.z, playerState.mesh.position.y)) {
            playerState.mesh.position.x = nextX;
        }
    }
    if (dirZ !== 0) {
        const nextZ = playerState.mesh.position.z + dirZ;
        if (nextZ > -WORLD_LIMIT && nextZ < WORLD_LIMIT && !checkWallCollision(playerState.mesh.position.x, nextZ, playerState.mesh.position.y)) {
            playerState.mesh.position.z = nextZ;
        }
    }

    // --- FÍSICAS VERTICALES (Usa el getGroundY unificado) ---
    playerState.velocityY += playerState.gravity * deltaTime;
    playerState.mesh.position.y += playerState.velocityY * deltaTime;

    const groundY = getGroundY(playerState.mesh.position.x, playerState.mesh.position.z, playerState.mesh.position.y);

    if (playerState.mesh.position.y <= groundY) {
        playerState.mesh.position.y = groundY;
        playerState.velocityY = 0;
        playerState.isGrounded = true;
    } else {
        playerState.isGrounded = false;
    }

    if (input.jump && playerState.isGrounded && !input.block) {
        playerState.velocityY = playerState.jumpForce;
        playerState.isGrounded = false;
    }

    // --- ANIMACIONES DE COMBATE ---
    playerState.isBlocking = input.block;
    playerState.shield.position.z = playerState.isBlocking ? -0.8 : 0;
    playerState.shield.position.x = playerState.isBlocking ? 0 : -0.8;

    if (playerState.attackCooldown > 0) playerState.attackCooldown -= deltaTime;
    if (input.attack && playerState.attackCooldown <= 0 && !playerState.isBlocking) {
        playerState.isAttacking = true;
        playerState.attackCooldown = 0.5;
    } else {
        playerState.isAttacking = false;
    }
    playerState.sword.position.z = (playerState.attackCooldown > 0.3) ? -1.5 : -0.5;
}