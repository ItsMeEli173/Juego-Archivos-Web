import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { checkHit } from '../gameplay/combat.js';
import { getScene } from '../engine/scene.js';
import { checkWallCollision, getGroundY } from '../world/colliders.js';

export function createNPC(x, z, color = 0xff8800, team = 'defender', name = 'Bot') {
    const scene = getScene();
    const npc = {
        mesh: new THREE.Group(), sword: null, shield: null, health: 100,
        speed: 6, damage: 15, attackRange: 3.5,
        target: null, thinkTimer: 0, reactionTime: 0.6 + Math.random() * 0.4, 
        attackCooldown: 0, state: 'IDLE',
        team: team, name: name, kills: 0, deaths: 0, isDead: false,
        baseColor: color, 
        roamAngle: Math.random() * Math.PI * 2,
        roamTimer: 0,
        avoidanceDir: Math.random() > 0.5 ? 1 : -1
    };

    const bodyGeo = new THREE.BoxGeometry(1, 2, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    npc.mesh.add(body);

    npc.sword = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    npc.sword.position.set(0.8, 0, -0.5);
    npc.sword.rotation.x = Math.PI / 2;
    npc.mesh.add(npc.sword);

    npc.shield = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
    npc.shield.position.set(-0.8, 0, 0);
    npc.mesh.add(npc.shield);

    // Damos un Y inicial alto (20) para que "caiga" y se asiente en la superficie correcta
    npc.mesh.position.set(x, getGroundY(x, z, 20), z);
    scene.add(npc.mesh);
    return npc;
}

export function updateNPCs(deltaTime, npcs, playerState, gameMode) {
    for (let i = npcs.length - 1; i >= 0; i--) {
        let npc = npcs[i];
        if (npc.isDead) continue; 

        npc.thinkTimer -= deltaTime;
        if (npc.attackCooldown > 0) npc.attackCooldown -= deltaTime;

        if (npc.target && (npc.target.health <= 0 || npc.target.isDead)) {
            npc.target = null;
            npc.state = 'IDLE';
        }

        if (npc.thinkTimer <= 0) {
            npc.thinkTimer = npc.reactionTime; 
            npc.avoidanceDir = Math.random() > 0.5 ? 1 : -1; 
            
            let potentialTargets = [];
            
            if (!playerState.isDead && playerState.health > 0) {
                if (gameMode === 'FFA' || playerState.team !== npc.team) potentialTargets.push(playerState);
            }

            npcs.forEach(otherNpc => {
                if (otherNpc !== npc && !otherNpc.isDead && otherNpc.health > 0) {
                    if (gameMode === 'FFA' || otherNpc.team !== npc.team) potentialTargets.push(otherNpc);
                }
            });

            let closestDist = Infinity;
            npc.target = null;
            potentialTargets.forEach(potTarget => {
                const dx = potTarget.mesh.position.x - npc.mesh.position.x;
                const dz = potTarget.mesh.position.z - npc.mesh.position.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                if (dist < closestDist) { closestDist = dist; npc.target = potTarget; }
            });

            const visionLimit = gameMode === 'SIEGE' ? Infinity : 60;

            if (npc.target) {
                if (closestDist <= npc.attackRange) {
                    npc.state = 'ATTACKING';
                } else if (closestDist <= visionLimit) {
                    npc.state = 'CHASING';
                } else {
                    npc.state = 'IDLE';
                }
            } else {
                npc.state = 'IDLE';
            }
        }

        if (npc.state === 'IDLE') {
            npc.roamTimer -= deltaTime;
            if (npc.roamTimer <= 0) {
                npc.roamAngle = Math.random() * Math.PI * 2;
                npc.roamTimer = 2 + Math.random() * 3; 
            }
            
            const dirX = Math.sin(npc.roamAngle) * (npc.speed * 0.4) * deltaTime;
            const dirZ = Math.cos(npc.roamAngle) * (npc.speed * 0.4) * deltaTime;
            npc.mesh.rotation.y = npc.roamAngle;

            let nextX = npc.mesh.position.x + dirX;
            if (!checkWallCollision(nextX, npc.mesh.position.z, npc.mesh.position.y)) npc.mesh.position.x = nextX;
            else npc.roamAngle += Math.PI;

            let nextZ = npc.mesh.position.z + dirZ;
            if (!checkWallCollision(npc.mesh.position.x, nextZ, npc.mesh.position.y)) npc.mesh.position.z = nextZ;
            else npc.roamAngle += Math.PI;

            npc.mesh.position.y = getGroundY(npc.mesh.position.x, npc.mesh.position.z, npc.mesh.position.y);
            npc.sword.position.z = -0.5;

        } else if (npc.state === 'CHASING' && npc.target) {
            const dx = npc.target.mesh.position.x - npc.mesh.position.x;
            const dz = npc.target.mesh.position.z - npc.mesh.position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            npc.mesh.rotation.y = Math.atan2(-dx, -dz);

            if (dist > 0) {
                const dirX = (dx / dist) * npc.speed * deltaTime;
                const dirZ = (dz / dist) * npc.speed * deltaTime;

                let hitX = checkWallCollision(npc.mesh.position.x + dirX, npc.mesh.position.z, npc.mesh.position.y);
                let hitZ = checkWallCollision(npc.mesh.position.x, npc.mesh.position.z + dirZ, npc.mesh.position.y);

                if (!hitX) npc.mesh.position.x += dirX;
                if (!hitZ) npc.mesh.position.z += dirZ;

                if (hitX && !hitZ) {
                    let slideZ = npc.avoidanceDir * npc.speed * deltaTime;
                    if (!checkWallCollision(npc.mesh.position.x, npc.mesh.position.z + slideZ, npc.mesh.position.y)) npc.mesh.position.z += slideZ;
                }
                if (hitZ && !hitX) {
                    let slideX = npc.avoidanceDir * npc.speed * deltaTime;
                    if (!checkWallCollision(npc.mesh.position.x + slideX, npc.mesh.position.z, npc.mesh.position.y)) npc.mesh.position.x += slideX;
                }
            }
            npc.mesh.position.y = getGroundY(npc.mesh.position.x, npc.mesh.position.z, npc.mesh.position.y);
            npc.sword.position.z = -0.5;

        } else if (npc.state === 'ATTACKING' && npc.target) {
            const dx = npc.target.mesh.position.x - npc.mesh.position.x;
            const dz = npc.target.mesh.position.z - npc.mesh.position.z;
            npc.mesh.rotation.y = Math.atan2(-dx, -dz);

            if (npc.attackCooldown <= 0) {
                npc.attackCooldown = 1.5; 
                npc.sword.position.z = -1.5; 
                
                if (checkHit(npc.mesh.position, npc.target.mesh.position, npc.attackRange)) {
                    npc.target.health -= npc.damage;
                    if (npc.target.health <= 0 && !npc.target.isDead) npc.kills++;
                    
                    if (npc.target.mesh && npc.target.mesh.children[0]) {
                        npc.target.mesh.children[0].material.color.setHex(0xffffff);
                        const targetColor = npc.target.baseColor || 0xcc0000;
                        setTimeout(() => {
                            if (npc.target && npc.target.mesh && npc.target.mesh.children[0]) {
                                npc.target.mesh.children[0].material.color.setHex(targetColor);
                            }
                        }, 150);
                    }
                }
            } else if (npc.attackCooldown < 1.0) {
                npc.sword.position.z = -0.5;
            }
        }
    }
}