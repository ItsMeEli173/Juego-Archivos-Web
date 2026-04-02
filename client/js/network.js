// =====================================================
// network.js — Módulo de Red Multijugador
// Encapsula toda la comunicación WebSocket
// =====================================================

let socket = null;
let myNetworkId = null;
let messageCallback = null;

// --- Throttle state ---
let lastBotSyncTime = 0;
let lastTimerSyncTime = 0;
const BOT_SYNC_INTERVAL = 30;   // ms — baja latencia, sin lerp
const TIMER_SYNC_INTERVAL = 1000; // ms

export function connectToServer(onMessageCb) {
    messageCallback = onMessageCb;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onopen = () => console.log("🟢 Conectado al servidor multijugador");

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'init') {
                myNetworkId = data.id;
            }
            if (messageCallback) messageCallback(data);
        } catch (e) {
            console.error("Error parseando mensaje de red:", e);
        }
    };

    socket.onclose = () => console.log("🔴 Desconectado del servidor");
}

function send(obj) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(obj));
    }
}

// --- Getters ---
export function getNetworkId() { return myNetworkId; }
export function isConnected() { return socket && socket.readyState === WebSocket.OPEN; }
export function getSocket() { return socket; }

// --- Lobby ---
export function sendCreateRoom(mode, hostName) { send({ type: 'createRoom', mode, hostName }); }
export function sendJoinRoom(roomId) { send({ type: 'joinRoom', roomId }); }
export function sendGetRooms() { send({ type: 'getRooms' }); }
export function sendRequestStart() { send({ type: 'requestStart' }); }
export function sendLeaveRoom() { send({ type: 'leaveRoom' }); }

// --- Movimiento (cada frame) ---
export function sendMove(playerState) {
    send({
        type: 'move',
        x: playerState.mesh.position.x,
        y: playerState.mesh.position.y,
        z: playerState.mesh.position.z,
        rotation: playerState.mesh.rotation.y,
        isBlocking: playerState.isBlocking,
        isAttacking: playerState.isAttacking,
        attackFrame: playerState.attackCooldown > 0.45, // true solo en el frame exacto del golpe
        color: playerState.baseColor,
        name: playerState.name,
        team: playerState.team,
        health: playerState.health,
        isDead: playerState.isDead
    });
}

// --- Combate PvP ---
export function sendAttackPlayer(targetId, damage) {
    send({ type: 'attackPlayer', targetId, damage });
}

// --- Combate Guest vs Bot ---
export function sendAttackBot(botIndex, damage) {
    send({ type: 'attackBot', botIndex, damage });
}

// --- Host: Sync Bots (throttled 60ms) ---
export function sendSyncBots(activeNPCs) {
    const now = performance.now();
    if (now - lastBotSyncTime < BOT_SYNC_INTERVAL) return;
    lastBotSyncTime = now;

    const bots = activeNPCs.map(npc => ({
        x: npc.mesh.position.x,
        y: npc.mesh.position.y,
        z: npc.mesh.position.z,
        rot: npc.mesh.rotation.y,
        hp: npc.health,
        dead: npc.isDead,
        team: npc.team,
        name: npc.name,
        kills: npc.kills,
        deaths: npc.deaths,
        col: npc.baseColor,
        st: npc.state,
        sZ: npc.sword ? npc.sword.position.z : -0.5,
        blk: npc.isBlocking || false
    }));
    send({ type: 'syncBots', bots });
}

// --- Host: Sync Timer (throttled 1s) ---
export function sendSyncTimer(elapsed) {
    const now = performance.now();
    if (now - lastTimerSyncTime < TIMER_SYNC_INTERVAL) return;
    lastTimerSyncTime = now;
    send({ type: 'syncTimer', elapsed });
}

// --- Host: Sync Kills (SIEGE) ---
export function sendSyncKills(attackerKills, defenderKills) {
    send({ type: 'syncKills', attackerKills, defenderKills });
}

// --- Host: Game Over ---
export function sendGameOver(title) {
    send({ type: 'gameOver', title });
}

// --- Muerte y Respawn ---
export function sendPlayerDied() {
    send({ type: 'playerDied' });
}

export function sendPlayerRespawned(x, y, z) {
    send({ type: 'playerRespawned', x, y, z });
}

// --- Host: Bot atacó a jugador remoto ---
export function sendBotAttackPlayer(targetPlayerId, damage, botName) {
    send({ type: 'botAttackPlayer', targetPlayerId, damage, botName });
}
