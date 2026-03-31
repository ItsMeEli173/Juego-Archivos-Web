import { initScene, getScene } from './engine/scene.js';
import { initCamera, updateCamera } from './engine/camera.js';
import { initRenderer, render } from './engine/renderer.js';
import { initPlayer, updatePlayer, playerState } from './gameplay/player.js';
import { initKeyboard, getKeyboardInput } from './input/keyboard.js';
import { initJoystick, getJoystickInput } from './input/joystick.js';
import { checkHit } from './gameplay/combat.js';
import { updateHUD, showGameOverScreen, updateMinimap } from './ui/hud.js';
import { createNPC, updateNPCs } from './ai/npc.js'; 
import { checkWallCollision, getGroundY } from './world/colliders.js'; 
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

let socket;
let myNetworkId = null;
const networkPlayers = {}; 

function connectToServer() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onopen = () => console.log("🟢 Conectado al servidor multijugador");

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'init') {
            myNetworkId = data.id;
            playerState.networkId = myNetworkId; 
        }
        else if (data.type === 'roomList') {
            const listDiv = document.getElementById('room-list');
            listDiv.innerHTML = '';
            
            if (Object.keys(data.rooms).length === 0) {
                listDiv.innerHTML = '<p>No hay partidas creadas. ¡Crea una!</p>';
            } else {
                for (let roomId in data.rooms) {
                    const r = data.rooms[roomId];
                    const btn = document.createElement('button');
                    btn.style.width = '100%'; btn.style.margin = '10px 0'; btn.style.padding = '10px';
                    btn.style.backgroundColor = '#444'; btn.style.color = '#fff'; btn.style.border = '1px solid #fff';
                    btn.style.cursor = 'pointer';
                    btn.innerText = `[${r.mode}] Sala ${roomId} - Jugadores: ${r.playerCount}`;
                    
                    btn.onclick = () => {
                        socket.send(JSON.stringify({ type: 'joinRoom', roomId: roomId }));
                    };
                    listDiv.appendChild(btn);
                }
            }
        }
        else if (data.type === 'roomJoined') {
            document.querySelectorAll('.menu-box').forEach(el => el.classList.add('hidden'));
            document.getElementById('screen-lobby').classList.remove('hidden');
            
            document.getElementById('lobby-mode-text').innerText = data.mode;
            document.getElementById('lobby-count').innerText = data.playerCount;
            
            if (data.isHost) {
                document.getElementById('lobby-status').innerText = "Eres el anfitrión. Inicia cuando estés listo.";
                document.getElementById('btn-start-match').classList.remove('hidden');
            } else {
                document.getElementById('lobby-status').innerText = "Esperando al anfitrión...";
                document.getElementById('btn-start-match').classList.add('hidden');
            }
        }
        else if (data.type === 'lobbyUpdate') {
            document.getElementById('lobby-count').innerText = data.playerCount;
        }
        else if (data.type === 'matchStarted') {
            startGame(data.mode);
        }
        // --- NUEVO: SI EL ANFITRIÓN CIERRA LA SALA ---
        else if (data.type === 'roomClosed') {
            const modal = document.getElementById('modal-msg');
            modal.classList.remove('hidden');
            document.getElementById('btn-modal-ok').onclick = () => {
            modal.classList.add('hidden');
            isGameOver = true;
            goToMenu();
        };
}
        else if (data.type === 'playerMoved') {
            if (!networkPlayers[data.id]) {
                networkPlayers[data.id] = createNetworkPlayer(data.color);
                // Crear etiqueta de nombre para el otro jugador
                networkPlayers[data.id].nameTag = createNameTag(data.name || "Enemigo");
                networkPlayers[data.id].mesh.add(networkPlayers[data.id].nameTag);
            }
            networkPlayers[data.id].mesh.position.set(data.x, data.y, data.z);
            networkPlayers[data.id].mesh.rotation.y = data.rotation;
            
            const isBlocking = data.isBlocking;
            networkPlayers[data.id].shield.position.z = isBlocking ? -0.8 : 0;
            networkPlayers[data.id].shield.position.x = isBlocking ? 0 : -0.8;
        }
        else if (data.type === 'playerDisconnected') {
            if (networkPlayers[data.id]) {
                getScene().remove(networkPlayers[data.id].mesh);
                delete networkPlayers[data.id];
            }
        }
    };
}

function createNetworkPlayer(teamColor) {
    const scene = getScene();
    const group = new THREE.Group();
    
    const bodyMat = new THREE.MeshStandardMaterial({ color: teamColor, flatShading: true }); 
    const bodyGeo = new THREE.BoxGeometry(1, 2, 1);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);
    
    const sword = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    sword.position.set(0.8, 0, -0.5);
    sword.rotation.x = Math.PI / 2;
    group.add(sword);

    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
    shield.position.set(-0.8, 0, 0);
    group.add(shield);

    scene.add(group);
    return { mesh: group, shield: shield, color: teamColor };
}

function init() {
    const container = document.getElementById('game-container');
    initScene(); initCamera(); initRenderer(container);
    initPlayer(); initKeyboard(); initJoystick();
    connectToServer();

    const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!isMobile) {
        document.getElementById('ui-layer').style.display = 'none';
    }

    const showScreen = (id) => {
        document.querySelectorAll('.menu-box').forEach(el => el.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
    };

    document.getElementById('btn-go-create').onclick = () => showScreen('screen-create');
    document.getElementById('btn-go-join').onclick = () => {
        showScreen('screen-join');
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'getRooms' })); 
        }
    };
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.onclick = () => showScreen('screen-main');
    });

    document.getElementById('btn-refresh-rooms').onclick = () => {
        if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'getRooms' }));
    };
    document.getElementById('btn-host-ffa').onclick = () => {
        if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'createRoom', mode: 'FFA' }));
    };
    document.getElementById('btn-host-siege').onclick = () => {
        if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'createRoom', mode: 'SIEGE' }));
    };
    document.getElementById('btn-start-match').onclick = () => {
        if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'requestStart' }));
    };
    
    const pauseMenu = document.getElementById('pause-menu');

    document.getElementById('btn-pause').onclick = () => {
        if (document.pointerLockElement) document.exitPointerLock();
        pauseMenu.classList.remove('hidden');
    };

    document.getElementById('btn-resume').onclick = () => {
        pauseMenu.classList.add('hidden');
        if (window.innerWidth > 800) document.body.requestPointerLock();
    };

    document.getElementById('btn-leave-match').onclick = () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'leaveRoom' })); 
        }
        pauseMenu.classList.add('hidden');
        isGameOver = true; 
        goToMenu(); 
    };

    document.addEventListener('pointerlockchange', () => {
        if (!document.pointerLockElement && isPlaying && !isGameOver) {
            pauseMenu.classList.remove('hidden');
        }
    });
    
    // Conectar el botón de abandonar el lobby
    document.getElementById('btn-leave-lobby').onclick = () => {
        if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'leaveRoom' }));
        goToMenu();
    };
    
    requestAnimationFrame(gameLoop);
}

function startGame(mode) {
    gameMode = mode;
    const nameInput = document.getElementById('player-name-input').value;
    playerState.name = nameInput || "Jugador"; // Guardar nombre
    
    document.getElementById('main-menu').classList.add('hidden');
    document.querySelectorAll('.menu-box').forEach(el => el.classList.add('hidden'));
    
    if (gameMode === 'SIEGE') {
        const selectedTeam = document.querySelector('input[name="team-choice"]:checked').value;
        playerState.team = selectedTeam;
        // Rojo para atacantes, Celeste para defensores
        playerState.baseColor = selectedTeam === 'defender' ? 0x00ffff : 0xff0000;
    }
    
    // Crear etiqueta de nombre propia si no existe
    if (!playerState.nameTag) {
        playerState.nameTag = createNameTag(playerState.name);
        playerState.mesh.add(playerState.nameTag);
    }

    restartGame();
    isPlaying = true;
}

function createNameTag(name) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256; canvas.height = 64;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(name, 128, 45);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.y = 1.5; // Sobre la cabeza
    return sprite;
}

function goToMenu() {
    isPlaying = false;
    document.getElementById('main-menu').classList.remove('hidden');
    
    document.querySelectorAll('.menu-box').forEach(el => el.classList.add('hidden'));
    document.getElementById('screen-main').classList.remove('hidden');
    
    activeNPCs.forEach(npc => getScene().remove(npc.mesh));
    activeNPCs = [];
    
    for (let id in networkPlayers) {
        getScene().remove(networkPlayers[id].mesh);
        delete networkPlayers[id];
    }
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
    const color = gameMode === 'FFA' ? Math.random() * 0xffffff : (team === 'defender' ? 0x0000ff : 0x800000);
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
    playerState.mesh.visible = true; 
    
    if(playerState.mesh && playerState.mesh.children[0]) playerState.mesh.children[0].material.color.setHex(playerState.baseColor);
    
    // --- CORRECCIÓN: Z Inicial según el bando ---
    let playerZ = 0;
    if (gameMode === 'SIEGE') {
        playerZ = (playerState.team === 'defender') ? -100 : 80;
    }
    
    playerState.mesh.position.set(0, getGroundY(0, playerZ, 20), playerZ); 
    
    activeNPCs.forEach(npc => getScene().remove(npc.mesh));
    activeNPCs = []; 
    
    if (gameMode === 'SIEGE') {
        for(let i=0; i<9; i++) spawnSpecific('attacker'); 
        for(let i=0; i<10; i++) spawnSpecific('defender'); 
    } else {
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

    if (socket && socket.readyState === WebSocket.OPEN && isPlaying && !playerState.isDead) {
        socket.send(JSON.stringify({
            type: 'move',
            x: playerState.mesh.position.x,
            y: playerState.mesh.position.y,
            z: playerState.mesh.position.z,
            rotation: playerState.mesh.rotation.y,
            isBlocking: playerState.isBlocking,
            color: playerState.baseColor,
            name: playerState.name
        }));
    }

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
                
                let respawnZ = 0;
                if (gameMode === 'SIEGE') {
                    respawnZ = (entity.team === 'defender') ? -100 : 80;
                }
                const pos = entity === playerState ? {x:0, z:respawnZ} : getSpawnPosition(entity.team);
                
                entity.mesh.position.set(pos.x, getGroundY(pos.x, pos.z, 20), pos.z);
                
                if (entity !== playerState) { entity.state = 'IDLE'; entity.target = null; }
            }, 2000); 
        }
    });

    updateNPCs(deltaTime, activeNPCs, playerState, gameMode);
    resolveCharacterCollisions();

    const timeDisplay = gameMode === 'FFA' ? formatTime(120 - gameTimeElapsed) : formatTime(gameTimeElapsed);
    updateHUD(playerState.health, playerState.kills, timeDisplay);

    updateMinimap(playerState, activeNPCs, gameMode, networkPlayers);

    render();
    requestAnimationFrame(gameLoop);
}

window.onload = init;