import { initScene, getScene } from './engine/scene.js';
import { initCamera, updateCamera } from './engine/camera.js';
import { initRenderer, render } from './engine/renderer.js';
import { initPlayer, updatePlayer, playerState } from './gameplay/player.js';
import { initKeyboard, getKeyboardInput } from './input/keyboard.js';
import { initJoystick, getJoystickInput } from './input/joystick.js';
import { checkHit } from './gameplay/combat.js';
import { updateHUD, showGameOverScreen, updateMinimap } from './ui/hud.js';
import { createNPC, updateNPCs } from './ai/npc.js'; // Eliminamos la vieja importación de getNPCGroundY
import { checkWallCollision, getGroundY } from './world/colliders.js'; // Importamos el nuevo getGroundY universal
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

const clock = new THREE.Clock();
let isRunning = true;
let isPlaying = false; 
let gameMode = ''; 
let gameTimeElapsed = 0;
let isGameOver = false;
let activeNPCs = [];
let botCounter = 1; 
const PLAYER_COLOR = 0xcc0000;

function init() {
    const container = document.getElementById('game-container');
    initScene(); initCamera(); initRenderer(container);
    initPlayer(); initKeyboard(); initJoystick();
    document.getElementById('btn-ffa').onclick = () => startGame('FFA');
    document.getElementById('btn-siege').onclick = () => startGame('SIEGE');
    requestAnimationFrame(gameLoop);
}

function startGame(mode) {
    gameMode = mode;
    document.getElementById('main-menu').classList.add('hidden');
    if (window.innerWidth > 800) document.body.requestPointerLock();
    restartGame();
    isPlaying = true;
}

function goToMenu() {
    isPlaying = false;
    document.getElementById('main-menu').classList.remove('hidden');
    activeNPCs.forEach(npc => getScene().remove(npc.mesh));
    activeNPCs = [];
    playerState.mesh.visible = false;
}

function getSpawnPosition(team) {
    if (gameMode === 'FFA') {
        return { x: (Math.random() - 0.5) * 260, z: (Math.random() - 0.5) * 260 };
    } else {
        if (team === 'defender') {
            return { x: (Math.random() - 0.5) * 30, z: -100 + (Math.random() - 0.5) * 30 };
        } else {
            return { x: (Math.random() - 0.5) * 40, z: 80 + (Math.random() - 0.5) * 20 };
        }
    }
}

function spawnSpecific(team) {
    const pos = getSpawnPosition(team);
    const color = gameMode === 'FFA' ? Math.random() * 0xffffff : (team === 'defender' ? 0x0044ff : 0xff8800);
    const name = 'Bot-' + (botCounter++);
    activeNPCs.push(createNPC(pos.x, pos.z, color, team, name));
}

function resolveCharacterCollisions() {
    const characters = [];
    if (!playerState.isDead && playerState.mesh && isPlaying) characters.push(playerState);
    activeNPCs.forEach(npc => { if(!npc.isDead) characters.push(npc); });

    const minDistance = 1.2; 
    for (let i = 0; i < characters.length; i++) {
        for (let j = i + 1; j < characters.length; j++) {
            const charA = characters[i]; const charB = characters[j];
            const dx = charB.mesh.position.x - charA.mesh.position.x;
            const dz = charB.mesh.position.z - charA.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < minDistance && dist > 0.001) {
                const overlap = minDistance - dist;
                const nx = dx / dist; const nz = dz / dist;
                
                const moveX = (nx * overlap) / 2; 
                const moveZ = (nz * overlap) / 2;

                if (!checkWallCollision(charA.mesh.position.x - moveX, charA.mesh.position.z, charA.mesh.position.y)) charA.mesh.position.x -= moveX;
                if (!checkWallCollision(charA.mesh.position.x, charA.mesh.position.z - moveZ, charA.mesh.position.y)) charA.mesh.position.z -= moveZ;
                
                if (!checkWallCollision(charB.mesh.position.x + moveX, charB.mesh.position.z, charB.mesh.position.y)) charB.mesh.position.x += moveX;
                if (!checkWallCollision(charB.mesh.position.x, charB.mesh.position.z + moveZ, charB.mesh.position.y)) charB.mesh.position.z += moveZ;
            }
        }
    }
}

function getUnifiedInput() {
    const kb = getKeyboardInput(); const joy = getJoystickInput();
    const isJoyActive = joy.moveX !== 0 || joy.moveZ !== 0;
    return {
        moveX: isJoyActive ? joy.moveX : kb.moveX, moveZ: isJoyActive ? joy.moveZ : kb.moveZ,
        attack: kb.attack || joy.attack, block: kb.block || joy.block,
        deltaX: kb.deltaX || 0, jump: kb.jump || joy.jump, isMobile: isJoyActive
    };
}

function formatTime(secondsTotal) {
    if (secondsTotal < 0) secondsTotal = 0;
    const m = Math.floor(secondsTotal / 60); const s = Math.floor(secondsTotal % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function restartGame() {
    gameTimeElapsed = 0; isGameOver = false; botCounter = 1;
    playerState.kills = 0; playerState.deaths = 0; playerState.health = 100; playerState.isDead = false;
    playerState.mesh.visible = true; playerState.baseColor = PLAYER_COLOR;
    if(playerState.mesh && playerState.mesh.children[0]) playerState.mesh.children[0].material.color.setHex(PLAYER_COLOR);
    
    const playerZ = gameMode === 'SIEGE' ? 80 : 0;
    
    // --- CORRECCIÓN: El jugador reaparece cayendo suavemente sobre la altura correcta ---
    playerState.mesh.position.set(0, getGroundY(0, playerZ, 20), playerZ); 
    
    activeNPCs.forEach(npc => getScene().remove(npc.mesh));
    activeNPCs = []; 
    
    if (gameMode === 'SIEGE') {
        playerState.team = 'attacker';
        for(let i=0; i<9; i++) spawnSpecific('attacker'); 
        for(let i=0; i<10; i++) spawnSpecific('defender'); 
    } else {
        playerState.team = 'attacker'; 
        for(let i=0; i<19; i++) spawnSpecific('attacker'); 
    }
    clock.getDelta(); 
}

function gameLoop() {
    if (!isRunning) return;
    if (!isPlaying || isGameOver) { render(); requestAnimationFrame(gameLoop); return; }

    const deltaTime = clock.getDelta();
    const input = getUnifiedInput();
    gameTimeElapsed += deltaTime;

    let endTitle = "";
    if (gameMode === 'FFA') {
        if (gameTimeElapsed >= 120) { isGameOver = true; endTitle = "¡TIEMPO AGOTADO!"; }
    } else if (gameMode === 'SIEGE') {
        let atkKills = playerState.team === 'attacker' ? playerState.kills : 0;
        let defKills = playerState.team === 'defender' ? playerState.kills : 0;
        activeNPCs.forEach(npc => {
            if (npc.team === 'attacker') atkKills += npc.kills;
            if (npc.team === 'defender') defKills += npc.kills;
        });
        
        // --- CAMBIO APLICADO: Ahora la victoria se alcanza a las 50 kills ---
        if (atkKills >= 50) { isGameOver = true; endTitle = "¡VICTORIA ATACANTE!"; }
        else if (defKills >= 50) { isGameOver = true; endTitle = "¡VICTORIA DEFENSORA!"; }
    }

    if (isGameOver) {
        if (document.pointerLockElement) document.exitPointerLock();
        const allPlayers = [playerState, ...activeNPCs];
        showGameOverScreen(allPlayers, endTitle, restartGame, goToMenu);
        requestAnimationFrame(gameLoop); return; 
    }

    updatePlayer(deltaTime, input);
    updateCamera(playerState.mesh);

    if (playerState.isAttacking && playerState.attackCooldown === 0.5 && !playerState.isDead) { 
        activeNPCs.forEach(npc => {
            const isEnemy = gameMode === 'FFA' ? true : (npc.team !== playerState.team);
            if (!npc.isDead && isEnemy && checkHit(playerState.mesh.position, npc.mesh.position, playerState.attackRange)) {
                npc.health -= playerState.damage;
                if (npc.mesh && npc.mesh.children[0]) {
                    npc.mesh.children[0].material.color.setHex(0xffffff);
                    setTimeout(() => {
                        if (npc.mesh && npc.mesh.children[0]) npc.mesh.children[0].material.color.setHex(npc.baseColor);
                    }, 100);
                }
                if (npc.health <= 0 && !npc.isDead) playerState.kills++; 
            }
        });
    }

    const allEntities = [playerState, ...activeNPCs];
    allEntities.forEach(entity => {
        if (entity.health <= 0 && !entity.isDead) {
            entity.isDead = true; entity.deaths++; entity.mesh.visible = false;
            setTimeout(() => {
                if (!isPlaying || isGameOver) return; 
                entity.health = 100; entity.isDead = false; entity.mesh.visible = true;
                if (entity.mesh && entity.mesh.children[0]) entity.mesh.children[0].material.color.setHex(entity.baseColor || PLAYER_COLOR);
                
                const pos = entity === playerState ? (gameMode === 'SIEGE' ? {x:0, z:80} : {x:0, z:0}) : getSpawnPosition(entity.team);
                
                // --- CORRECCIÓN: Los NPCs y el jugador reaparecen usando getGroundY universal ---
                entity.mesh.position.set(pos.x, getGroundY(pos.x, pos.z, 20), pos.z);
                
                if (entity !== playerState) { entity.state = 'IDLE'; entity.target = null; }
            }, 2000); 
        }
    });

    updateNPCs(deltaTime, activeNPCs, playerState, gameMode);
    resolveCharacterCollisions();

    const timeDisplay = gameMode === 'FFA' ? formatTime(120 - gameTimeElapsed) : formatTime(gameTimeElapsed);
    updateHUD(playerState.health, playerState.kills, timeDisplay);

    updateMinimap(playerState, activeNPCs, gameMode);

    render();
    requestAnimationFrame(gameLoop);
}

window.onload = init;