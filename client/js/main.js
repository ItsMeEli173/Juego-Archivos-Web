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
import {
    connectToServer, getNetworkId, isConnected,
    sendMove, sendAttackPlayer, sendAttackBot,
    sendSyncBots, sendSyncTimer, sendSyncKills,
    sendGameOver, sendPlayerDied, sendPlayerRespawned,
    sendBotAttackPlayer, sendCreateRoom, sendJoinRoom,
    sendGetRooms, sendRequestStart, sendLeaveRoom
} from './network.js';
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

// =====================================================
// Estado Global del Juego
// =====================================================
const clock = new THREE.Clock();
let isRunning = true;
let isPlaying = false; 
let gameMode = ''; 
let gameTimeElapsed = 0;
let isGameOver = false;
let activeNPCs = [];      // Solo el HOST simula bots reales aquí
let ghostBots = [];       // Solo los GUESTS renderizan ghost bots aquí
let botCounter = 1; 
const PLAYER_COLOR = 0xcc0000;

// --- Multijugador ---
let isHost = false;
let humanPlayerCount = 1;
const networkPlayers = {}; 

// Constantes de bots
const MAX_TOTAL_ENTITIES_FFA = 20;      // 20 entidades total (humanos + bots)
const MAX_ATTACKERS_SIEGE = 10;
const MAX_DEFENDERS_SIEGE = 10;

// --- Kills globales sincronizadas (SIEGE) ---
let globalAttackerKills = 0;
let globalDefenderKills = 0;

// =====================================================
// Conectar al servidor y manejar mensajes
// =====================================================
function handleNetworkMessage(data) {
    // --- INIT ---
    if (data.type === 'init') {
        playerState.networkId = data.id;
    }

    else if (data.type === 'roomList') {
        const listDiv = document.getElementById('room-list');
        listDiv.innerHTML = '';
        
        if (Object.keys(data.rooms).length === 0) {
            listDiv.innerHTML = '<p>No hay partidas creadas. ¡Crea una!</p>';
        } else {
            for (let roomId in data.rooms) {
                const r = data.rooms[roomId];
                if (r.started) continue; // No mostrar partidas ya iniciadas
                const btn = document.createElement('button');
                btn.style.width = '100%'; btn.style.margin = '10px 0'; btn.style.padding = '10px';
                btn.style.backgroundColor = '#444'; btn.style.color = '#fff'; btn.style.border = '1px solid #fff';
                btn.style.cursor = 'pointer';
                btn.innerText = `[${r.mode}] Sala de ${r.hostName || "Jugador"} - Jugadores: ${r.playerCount}`;
                
                btn.onclick = () => sendJoinRoom(roomId);
                listDiv.appendChild(btn);
            }
        }
    }

    // --- ROOM JOINED ---
    else if (data.type === 'roomJoined') {
        document.querySelectorAll('.menu-box').forEach(el => el.classList.add('hidden'));
        document.getElementById('screen-lobby').classList.remove('hidden');
        
        document.getElementById('lobby-mode-text').innerText = data.mode;
        document.getElementById('lobby-count').innerText = data.playerCount;
        
        isHost = data.isHost;
        humanPlayerCount = data.playerCount;

        if (data.isHost) {
            document.getElementById('lobby-status').innerText = "Eres el anfitrión. Inicia cuando estés listo.";
            document.getElementById('btn-start-match').classList.remove('hidden');
            document.getElementById('host-settings').classList.remove('hidden');
        } else {
            document.getElementById('lobby-status').innerText = "Esperando al anfitrión...";
            document.getElementById('btn-start-match').classList.add('hidden');
            document.getElementById('host-settings').classList.add('hidden');
        }
    }

    // --- LOBBY UPDATE ---
    else if (data.type === 'lobbyUpdate') {
        document.getElementById('lobby-count').innerText = data.playerCount;
        humanPlayerCount = data.playerCount;
    }

    // --- MATCH STARTED ---
    else if (data.type === 'matchStarted') {
        humanPlayerCount = data.playerCount || humanPlayerCount;
        startGame(data.mode);
    }

    // --- ROOM CLOSED ---
    else if (data.type === 'roomClosed') {
        const modal = document.getElementById('modal-msg');
        modal.classList.remove('hidden');
        document.getElementById('btn-modal-ok').onclick = () => {
            modal.classList.add('hidden');
            isGameOver = true;
            goToMenu();
        };
    }

    // --- PLAYER MOVED ---
    else if (data.type === 'playerMoved') {
        if (!networkPlayers[data.id]) {
            networkPlayers[data.id] = createNetworkPlayer(data.color);
            networkPlayers[data.id].nameTag = createNameTag(data.name || "Enemigo");
            networkPlayers[data.id].mesh.add(networkPlayers[data.id].nameTag);
        }
        const np = networkPlayers[data.id];
        np.mesh.position.set(data.x, data.y, data.z);
        np.mesh.rotation.y = data.rotation;
        np.health = data.health !== undefined ? data.health : 100;
        np.isDead = data.isDead || false;
        np.isAttacking = data.isAttacking || false;
        np.attackFrame = data.attackFrame || false;
        np.name = data.name || "Enemigo";
        np.team = data.team || "attacker";
        
        // Visual del escudo
        np.shield.position.z = data.isBlocking ? -0.8 : 0;
        np.shield.position.x = data.isBlocking ? 0 : -0.8;

        // Visual de la espada cuando ataca
        np.sword.position.z = data.isAttacking ? -1.5 : -0.5;

        // Visibilidad según si está muerto
        np.mesh.visible = !np.isDead;
    }

    // --- PLAYER DISCONNECTED ---
    else if (data.type === 'playerDisconnected') {
        if (networkPlayers[data.id]) {
            getScene().remove(networkPlayers[data.id].mesh);
            delete networkPlayers[data.id];
        }
    }

    // --- PvP: ME GOLPEARON ---
    else if (data.type === 'playerHit') {
        if (!playerState.isDead) {
            // Verificar si estamos bloqueando
            if (playerState.isBlocking) {
                // Daño reducido o negado
            } else {
                playerState.health -= data.damage;
                // Flash blanco visual
                if (playerState.mesh && playerState.mesh.children[0]) {
                    playerState.mesh.children[0].material.color.setHex(0xffffff);
                    setTimeout(() => {
                        if (playerState.mesh && playerState.mesh.children[0])
                            playerState.mesh.children[0].material.color.setHex(playerState.baseColor);
                    }, 100);
                }
            }
        }
    }

    // --- HOST: Un guest atacó un bot ---
    else if (data.type === 'botHit') {
        if (isHost && activeNPCs[data.botIndex]) {
            const bot = activeNPCs[data.botIndex];
            if (!bot.isDead) {
                bot.health -= data.damage;
                // Flash blanco visual
                if (bot.mesh && bot.mesh.children[0]) {
                    bot.mesh.children[0].material.color.setHex(0xffffff);
                    setTimeout(() => {
                        if (bot.mesh && bot.mesh.children[0])
                            bot.mesh.children[0].material.color.setHex(bot.baseColor);
                    }, 100);
                }
                // Si el bot murió, el kill se contabiliza al atacante remoto
                if (bot.health <= 0 && !bot.isDead) {
                    bot.lastKillerNetworkId = data.attackerId;
                }
            }
        }
    }

    // --- GUEST: Recibir estado de bots del host ---
    else if (data.type === 'botStates') {
        if (!isHost) {
            updateGhostBots(data.bots);
        }
    }

    // --- GUEST: Recibir timer del host ---
    else if (data.type === 'timerSync') {
        if (!isHost) {
            gameTimeElapsed = data.elapsed;
        }
    }

    // --- Todos: Recibir kills sincronizadas ---
    else if (data.type === 'killsSync') {
        globalAttackerKills = data.attackerKills;
        globalDefenderKills = data.defenderKills;
    }

    // --- Jugador murió ---
    else if (data.type === 'playerDied') {
        if (networkPlayers[data.id]) {
            networkPlayers[data.id].isDead = true;
            networkPlayers[data.id].mesh.visible = false;
        }
    }

    // --- Jugador respawneó ---
    else if (data.type === 'playerRespawned') {
        if (networkPlayers[data.id]) {
            networkPlayers[data.id].isDead = false;
            networkPlayers[data.id].mesh.visible = true;
            networkPlayers[data.id].mesh.position.set(data.x, data.y, data.z);
        }
    }

    // --- GAME OVER forzado por el host ---
    else if (data.type === 'gameOver') {
        if (!isGameOver) {
            isGameOver = true;
            if (document.pointerLockElement) document.exitPointerLock();
            
            // Construir lista de jugadores para el scoreboard
            const allPlayers = buildAllPlayersList();
            showGameOverScreen(allPlayers, data.title, restartGame, goToMenu);
        }
    }

    // --- BOT ME ATACÓ (host me dice que un bot me golpeó) ---
    else if (data.type === 'botAttackPlayer') {
        if (!playerState.isDead) {
            if (playerState.isBlocking) {
                // Bloqueado
            } else {
                playerState.health -= data.damage;
                if (playerState.mesh && playerState.mesh.children[0]) {
                    playerState.mesh.children[0].material.color.setHex(0xffffff);
                    setTimeout(() => {
                        if (playerState.mesh && playerState.mesh.children[0])
                            playerState.mesh.children[0].material.color.setHex(playerState.baseColor);
                    }, 100);
                }
            }
        }
    }
}

// =====================================================
// Crear jugador de red visual (mesh)
// =====================================================
function createNetworkPlayer(teamColor, team = 'attacker') {
    const scene = getScene();
    const group = new THREE.Group();
    
    // Tronco
    const bodyMat = new THREE.MeshStandardMaterial({ color: teamColor, flatShading: true }); 
    const bodyGeo = new THREE.BoxGeometry(1, 1.2, 0.8);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = -0.4;
    group.add(body);
    
    // Cabeza
    const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, flatShading: true });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.5;
    group.add(head);

    // Casco
    const helmetGeo = new THREE.BoxGeometry(0.7, 0.4, 0.7);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 0.7;
    group.add(helmet);
    
    const sword = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    sword.position.set(0.8, 0, -0.5);
    sword.rotation.x = Math.PI / 2;
    group.add(sword);

    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
    shield.position.set(-0.8, 0, 0);
    group.add(shield);

    scene.add(group);
    return { mesh: group, sword: sword, shield: shield, color: teamColor, health: 100, isDead: false, isAttacking: false, name: '', team: team };
}

// =====================================================
// Crear nombre flotante
// =====================================================
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
    sprite.position.y = 1.5;
    return sprite;
}

// =====================================================
// Ghost Bots (solo guests — meshes sin IA)
// =====================================================
function createGhostBot(botData) {
    const scene = getScene();
    const group = new THREE.Group();
    
    // Tronco
    const bodyMat = new THREE.MeshStandardMaterial({ color: botData.col, flatShading: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.8), bodyMat);
    body.position.y = -0.4;
    group.add(body);
    
    // Cabeza
    const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, flatShading: true });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.5;
    group.add(head);

    // Casco
    const helmetGeo = new THREE.BoxGeometry(0.7, 0.4, 0.7);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 0.7;
    group.add(helmet);
    
    const sword = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    sword.position.set(0.8, 0, -0.5);
    sword.rotation.x = Math.PI / 2;
    group.add(sword);

    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
    shield.position.set(-0.8, 0, 0);
    group.add(shield);

    // Name tag
    const nameTag = createNameTag(botData.name || 'Bot');
    group.add(nameTag);

    group.position.set(botData.x, botData.y, botData.z);
    group.rotation.y = botData.rot || 0;
    scene.add(group);

    return { 
        mesh: group, sword, shield, 
        health: botData.hp, isDead: botData.dead, 
        team: botData.team, name: botData.name,
        kills: botData.kills || 0, deaths: botData.deaths || 0,
        baseColor: botData.col
    };
}

function updateGhostBots(botsData) {
    const scene = getScene();

    // Crear ghost bots si no existen todavía
    while (ghostBots.length < botsData.length) {
        const gb = createGhostBot(botsData[ghostBots.length]);
        ghostBots.push(gb);
    }

    // Remover extras si hay menos bots
    while (ghostBots.length > botsData.length) {
        const removed = ghostBots.pop();
        scene.remove(removed.mesh);
    }

    // Actualizar posiciones directamente (sin lerp, como indicó el usuario)
    for (let i = 0; i < botsData.length; i++) {
        const bd = botsData[i];
        const gb = ghostBots[i];

        gb.mesh.position.set(bd.x, bd.y, bd.z);
        gb.mesh.rotation.y = bd.rot;
        gb.health = bd.hp;
        gb.isDead = bd.dead;
        gb.team = bd.team;
        gb.name = bd.name;
        gb.kills = bd.kills;
        gb.deaths = bd.deaths;
        gb.baseColor = bd.col;

        // Visibilidad
        gb.mesh.visible = !bd.dead;

        // Espada
        gb.sword.position.z = bd.sZ || -0.5;

        // Escudo
        if (bd.blk) {
            gb.shield.position.z = -0.8;
            gb.shield.position.x = 0;
        } else {
            gb.shield.position.z = 0;
            gb.shield.position.x = -0.8;
        }

        // Color del cuerpo
        if (gb.mesh.children[0]) {
            const currentColor = gb.mesh.children[0].material.color.getHex();
            if (currentColor !== bd.col && !bd.dead) {
                gb.mesh.children[0].material.color.setHex(bd.col);
            }
        }
    }
}

// =====================================================
// Construir lista completa de jugadores para scoreboard
// =====================================================
function buildAllPlayersList() {
    const list = [playerState];
    
    // Jugadores de red
    for (let id in networkPlayers) {
        const np = networkPlayers[id];
        list.push({
            name: np.name || 'Jugador',
            kills: np.kills || 0,
            deaths: np.deaths || 0,
            team: np.team || playerState.team,
            health: np.health
        });
    }

    // Bots (del host o ghost bots del guest)
    const bots = isHost ? activeNPCs : ghostBots;
    bots.forEach(bot => {
        list.push({
            name: bot.name || 'Bot',
            kills: bot.kills || 0,
            deaths: bot.deaths || 0,
            team: bot.team,
            health: bot.health
        });
    });

    return list;
}

// =====================================================
// Inicialización
// =====================================================
function init() {
    const container = document.getElementById('game-container');
    initScene(); initCamera(); initRenderer(container);
    initPlayer(); initKeyboard(); initJoystick();
    connectToServer(handleNetworkMessage);

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
        if (isConnected()) sendGetRooms();
    };
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.onclick = () => showScreen('screen-main');
    });

    document.getElementById('btn-refresh-rooms').onclick = () => {
        if (isConnected()) sendGetRooms();
    };
    document.getElementById('btn-host-ffa').onclick = () => {
        if (isConnected()) {
            const hostName = document.getElementById('player-name-input').value || "Jugador";
            sendCreateRoom('FFA', hostName);
        }
    };
    document.getElementById('btn-host-siege').onclick = () => {
        if (isConnected()) {
            const hostName = document.getElementById('player-name-input').value || "Jugador";
            sendCreateRoom('SIEGE', hostName);
        }
    };
    
    document.getElementById('input-max-entities').addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (val > 100) e.target.value = 100;
    });
    
    document.getElementById('input-max-entities').addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val)) val = 2;
        if (val < 2) val = 2;
        if (val > 100) val = 100;
        e.target.value = val;
    });
    document.getElementById('btn-start-match').onclick = () => {
        if (isConnected()) sendRequestStart();
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
        if (isConnected()) sendLeaveRoom();
        pauseMenu.classList.add('hidden');
        isGameOver = true; 
        goToMenu(); 
    };

    document.addEventListener('pointerlockchange', () => {
        if (!document.pointerLockElement && isPlaying && !isGameOver) {
            pauseMenu.classList.remove('hidden');
        }
    });
    
    document.getElementById('btn-leave-lobby').onclick = () => {
        if (isConnected()) sendLeaveRoom();
        goToMenu();
    };
    
    requestAnimationFrame(gameLoop);
}

// =====================================================
// Iniciar Partida
// =====================================================
function startGame(mode) {
    gameMode = mode;
    const nameInput = document.getElementById('player-name-input').value;
    playerState.name = nameInput || "Jugador";
    
    document.getElementById('main-menu').classList.add('hidden');
    document.querySelectorAll('.menu-box').forEach(el => el.classList.add('hidden'));
    
    if (gameMode === 'SIEGE') {
        const selectedTeam = document.querySelector('input[name="team-choice"]:checked').value;
        playerState.team = selectedTeam;
        playerState.baseColor = selectedTeam === 'defender' ? 0x00ffff : 0xff0000;
    }
    
    // Crear etiqueta de nombre propia
    if (!playerState.nameTag) {
        playerState.nameTag = createNameTag(playerState.name);
        playerState.mesh.add(playerState.nameTag);
    }

    restartGame();
    isPlaying = true;
}

// =====================================================
// Volver al menú
// =====================================================
function goToMenu() {
    isPlaying = false;
    document.getElementById('main-menu').classList.remove('hidden');
    
    document.querySelectorAll('.menu-box').forEach(el => el.classList.add('hidden'));
    document.getElementById('screen-main').classList.remove('hidden');
    
    // Limpiar bots del host
    activeNPCs.forEach(npc => getScene().remove(npc.mesh));
    activeNPCs = [];
    
    // Limpiar ghost bots del guest
    ghostBots.forEach(gb => getScene().remove(gb.mesh));
    ghostBots = [];
    
    // Limpiar jugadores de red
    for (let id in networkPlayers) {
        getScene().remove(networkPlayers[id].mesh);
        delete networkPlayers[id];
    }
    playerState.mesh.visible = false;
}

// =====================================================
// Spawn
// =====================================================
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

// =====================================================
// Colisiones entre personajes
// =====================================================
function resolveCharacterCollisions() {
    const characters = [];
    if (!playerState.isDead && playerState.mesh && isPlaying) characters.push(playerState);
    
    // Incluir bots reales (host) o ghost bots (guest)
    const bots = isHost ? activeNPCs : ghostBots;
    bots.forEach(npc => { if(!npc.isDead) characters.push(npc); });

    // Incluir jugadores de red
    for (let id in networkPlayers) {
        const np = networkPlayers[id];
        if (!np.isDead && np.mesh) characters.push(np);
    }

    const minDistance = 1.2; 
    for (let i = 0; i < characters.length; i++) {
        for (let j = i + 1; j < characters.length; j++) {
            const charA = characters[i]; const charB = characters[j];
            if (!charA.mesh || !charB.mesh) continue;
            const dx = charB.mesh.position.x - charA.mesh.position.x;
            const dz = charB.mesh.position.z - charA.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < minDistance && dist > 0.001) {
                const overlap = minDistance - dist;
                const nx = dx / dist; const nz = dz / dist;
                
                const moveX = (nx * overlap) / 2; 
                const moveZ = (nz * overlap) / 2;

                // Solo empujar al jugador local y bots del host
                if (charA === playerState || (isHost && activeNPCs.includes(charA))) {
                    if (!checkWallCollision(charA.mesh.position.x - moveX, charA.mesh.position.z, charA.mesh.position.y)) charA.mesh.position.x -= moveX;
                    if (!checkWallCollision(charA.mesh.position.x, charA.mesh.position.z - moveZ, charA.mesh.position.y)) charA.mesh.position.z -= moveZ;
                }
                if (charB === playerState || (isHost && activeNPCs.includes(charB))) {
                    if (!checkWallCollision(charB.mesh.position.x + moveX, charB.mesh.position.z, charB.mesh.position.y)) charB.mesh.position.x += moveX;
                    if (!checkWallCollision(charB.mesh.position.x, charB.mesh.position.z + moveZ, charB.mesh.position.y)) charB.mesh.position.z += moveZ;
                }
            }
        }
    }
}

// =====================================================
// Input unificado
// =====================================================
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

// =====================================================
// Reiniciar Partida
// =====================================================
function restartGame() {
    gameTimeElapsed = 0; isGameOver = false; botCounter = 1;
    playerState.kills = 0; playerState.deaths = 0; playerState.health = 100; playerState.isDead = false;
    playerState.mesh.visible = true; 
    globalAttackerKills = 0;
    globalDefenderKills = 0;
    
    if(playerState.mesh && playerState.mesh.children[0]) playerState.mesh.children[0].material.color.setHex(playerState.baseColor);
    
    // Posición inicial según modo
    let playerZ = 0;
    if (gameMode === 'SIEGE') {
        playerZ = (playerState.team === 'defender') ? -100 : 80;
    }
    playerState.mesh.position.set(0, getGroundY(0, playerZ, 20), playerZ); 
    
    // Limpiar bots previos
    activeNPCs.forEach(npc => getScene().remove(npc.mesh));
    activeNPCs = []; 
    ghostBots.forEach(gb => getScene().remove(gb.mesh));
    ghostBots = [];

    // Solo el HOST crea bots reales
    if (isHost) {
        const numBots = calculateBotCount();
        if (gameMode === 'SIEGE') {
            // Distribuir bots reducidos proporcionalmente entre atacantes y defensores
            const attackerBots = Math.floor(numBots / 2);
            const defenderBots = numBots - attackerBots;
            for(let i = 0; i < attackerBots; i++) spawnSpecific('attacker'); 
            for(let i = 0; i < defenderBots; i++) spawnSpecific('defender'); 
        } else {
            for(let i = 0; i < numBots; i++) spawnSpecific('attacker'); 
        }
    }
    // Los guests NO crean bots — esperan botStates del host
    
    clock.getDelta(); 
}

// =====================================================
// Cálculo de bots proporcional
// =====================================================
function calculateBotCount() {
    let maxTotal = parseInt(document.getElementById('input-max-entities').value);
    if (isNaN(maxTotal)) maxTotal = 20;
    if (maxTotal > 100) maxTotal = 100;
    if (maxTotal < 2) maxTotal = 2;

    if (gameMode === 'FFA') {
        return Math.max(0, maxTotal - humanPlayerCount);
    } else {
        return Math.max(0, maxTotal - humanPlayerCount);
    }
}

// =====================================================
// Game Loop Principal
// =====================================================
function gameLoop() {
    if (!isRunning) return;
    if (!isPlaying || isGameOver) { render(); requestAnimationFrame(gameLoop); return; }

    const deltaTime = clock.getDelta();
    const input = getUnifiedInput();
    gameTimeElapsed += deltaTime;

    // ===========================================
    // HOST: Detectar fin de partida
    // ===========================================
    if (isHost) {
        let endTitle = "";
        if (gameMode === 'FFA') {
            if (gameTimeElapsed >= 120) { 
                isGameOver = true; 
                endTitle = "¡TIEMPO AGOTADO!"; 
            }
        } else if (gameMode === 'SIEGE') {
            // Calcular kills globales
            let atkKills = 0;
            let defKills = 0;

            // Kills del jugador local
            if (playerState.team === 'attacker') atkKills += playerState.kills;
            else defKills += playerState.kills;

            // Kills de los bots
            activeNPCs.forEach(npc => {
                if (npc.team === 'attacker') atkKills += npc.kills;
                if (npc.team === 'defender') defKills += npc.kills;
            });

            globalAttackerKills = atkKills;
            globalDefenderKills = defKills;

            // Enviar kills globales a todos
            sendSyncKills(atkKills, defKills);

            if (atkKills >= 50) { isGameOver = true; endTitle = "¡VICTORIA ATACANTE!"; }
            else if (defKills >= 50) { isGameOver = true; endTitle = "¡VICTORIA DEFENSORA!"; }
        }

        if (isGameOver && endTitle) {
            sendGameOver(endTitle);
            if (document.pointerLockElement) document.exitPointerLock();
            const allPlayers = buildAllPlayersList();
            showGameOverScreen(allPlayers, endTitle, restartGame, goToMenu);
            requestAnimationFrame(gameLoop); 
            return; 
        }

        // Enviar timer sincronizado
        sendSyncTimer(gameTimeElapsed);
    }

    // ===========================================
    // GUEST: Verificar fin local (respaldado por timerSync)
    // ===========================================
    if (!isHost && gameMode === 'FFA') {
        // El game over llega via mensaje 'gameOver' del host
        // Pero por seguridad, si el timer local excede, forzamos
        if (gameTimeElapsed >= 125) { // 5s de gracia extra
            isGameOver = true;
            if (document.pointerLockElement) document.exitPointerLock();
            const allPlayers = buildAllPlayersList();
            showGameOverScreen(allPlayers, "¡TIEMPO AGOTADO!", restartGame, goToMenu);
            requestAnimationFrame(gameLoop);
            return;
        }
    }

    // ===========================================
    // Actualizar jugador local
    // ===========================================
    updatePlayer(deltaTime, input);
    updateCamera(playerState.mesh);

    // Enviar posición al servidor
    if (isConnected() && isPlaying && !playerState.isDead) {
        sendMove(playerState);
    }

    // ===========================================
    // COMBATE: Jugador local ataca
    // ===========================================
    if (playerState.isAttacking && playerState.attackCooldown === 0.5 && !playerState.isDead) { 
        
        // --- Atacar jugadores de red (PvP) ---
        for (let id in networkPlayers) {
            const np = networkPlayers[id];
            if (np.isDead) continue;
            if (checkHit(playerState.mesh.position, np.mesh.position, playerState.attackRange)) {
                sendAttackPlayer(id, playerState.damage);
            }
        }

        // --- Atacar bots ---
        if (isHost) {
            // Host golpea sus propios bots directamente
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
        } else {
            // Guest golpea ghost bots → enviar al host
            ghostBots.forEach((gb, index) => {
                const isEnemy = gameMode === 'FFA' ? true : (gb.team !== playerState.team);
                if (!gb.isDead && isEnemy && checkHit(playerState.mesh.position, gb.mesh.position, playerState.attackRange)) {
                    sendAttackBot(index, playerState.damage);
                    // Flash visual local inmediato para feedback
                    if (gb.mesh && gb.mesh.children[0]) {
                        gb.mesh.children[0].material.color.setHex(0xffffff);
                        setTimeout(() => {
                            if (gb.mesh && gb.mesh.children[0]) gb.mesh.children[0].material.color.setHex(gb.baseColor);
                        }, 100);
                    }
                    // Asumimos el kill localmente para UI responsiva
                    if (gb.health - playerState.damage <= 0 && !gb.isDead) {
                        playerState.kills++;
                    }
                }
            });
        }
    }

    // ===========================================
    // Muerte y Respawn de entidades
    // ===========================================
    const localEntities = isHost ? [playerState, ...activeNPCs] : [playerState];
    localEntities.forEach(entity => {
        if (entity.health <= 0 && !entity.isDead) {
            entity.isDead = true; 
            entity.deaths++; 
            entity.mesh.visible = false;

            // Notificar al servidor si es el jugador local
            if (entity === playerState) {
                sendPlayerDied();
            }

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

                // Notificar respawn
                if (entity === playerState) {
                    sendPlayerRespawned(entity.mesh.position.x, entity.mesh.position.y, entity.mesh.position.z);
                }
            }, 2000); 
        }
    });

    // ===========================================
    // HOST: Actualizar IA de bots y verificar ataques de bots a jugadores remotos
    // ===========================================
    if (isHost) {
        // Preparar lista de targets que incluye jugadores de red
        updateNPCs(deltaTime, activeNPCs, playerState, gameMode, networkPlayers);
        
        // Verificar si algún bot atacó a un jugador de red
        activeNPCs.forEach(npc => {
            if (npc.isDead || npc.state !== 'ATTACKING' || npc.attackCooldown !== 1.5) return;
            // El bot acaba de atacar (cooldown recién puesto en 1.5 en su último brain step)
            
            for (let id in networkPlayers) {
                const np = networkPlayers[id];
                if (np.isDead) continue;
                const isEnemy = gameMode === 'FFA' ? true : (np.team !== npc.team);
                if (isEnemy && checkHit(npc.mesh.position, np.mesh.position, npc.attackRange)) {
                    sendBotAttackPlayer(id, npc.damage, npc.name);
                }
            }
        });

        // Enviar estado de bots al servidor (throttled a 60ms)
        sendSyncBots(activeNPCs);
    }

    // ===========================================
    // Colisiones y HUD
    // ===========================================
    resolveCharacterCollisions();

    const timeDisplay = gameMode === 'FFA' ? formatTime(120 - gameTimeElapsed) : formatTime(gameTimeElapsed);
    updateHUD(playerState.health, playerState.kills, timeDisplay);

    // Minimap: pasar bots correctos según rol
    const minimapBots = isHost ? activeNPCs : ghostBots;
    updateMinimap(playerState, minimapBots, gameMode, networkPlayers);

    render();
    requestAnimationFrame(gameLoop);
}

window.onload = init;