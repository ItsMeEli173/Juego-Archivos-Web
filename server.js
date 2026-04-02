const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto'); 

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// =====================================================
// Estado global de salas
// =====================================================
const rooms = {}; 

// =====================================================
// Utilidades
// =====================================================
function broadcastToRoom(roomId, jsonObject, excludeWs = null) {
    const packet = JSON.stringify(jsonObject);
    wss.clients.forEach((client) => {
        if (client.roomId === roomId && client.readyState === WebSocket.OPEN && client !== excludeWs) {
            client.send(packet);
        }
    });
}

function sendTo(ws, obj) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
    }
}

function findClientById(playerId, roomId) {
    for (const client of wss.clients) {
        if (client.playerId === playerId && client.roomId === roomId && client.readyState === WebSocket.OPEN) {
            return client;
        }
    }
    return null;
}

function getPlayersInRoom(roomId) {
    let count = 0;
    wss.clients.forEach(client => {
        if (client.roomId === roomId && client.readyState === WebSocket.OPEN) count++;
    });
    return count;
}

// =====================================================
// Manejo de desconexiones
// =====================================================
function handlePlayerLeave(ws) {
    if (ws.roomId) {
        const currentRoom = ws.roomId;
        const room = rooms[currentRoom];
        if (room) {
            const playerCount = getPlayersInRoom(currentRoom) - 1; // -1 porque este ws se va

            // Si el anfitrión se va, o ya no queda nadie, cerramos la sala
            if (playerCount <= 0 || room.host === ws.playerId) {
                broadcastToRoom(currentRoom, { type: 'roomClosed' }, ws);
                delete rooms[currentRoom];
                console.log(`Sala ${currentRoom} cerrada.`);
            } else {
                // Asignar nuevo host si es necesario (el siguiente jugador conectado)
                broadcastToRoom(currentRoom, { type: 'lobbyUpdate', playerCount }, ws);
                broadcastToRoom(currentRoom, { type: 'playerDisconnected', id: ws.playerId }, ws);
            }
        }
        ws.roomId = null; 
    }
}

// =====================================================
// Conexión WebSocket
// =====================================================
wss.on('connection', (ws) => {
    const playerId = crypto.randomUUID();
    ws.playerId = playerId; 
    ws.roomId = null; 

    console.log(`[+] Jugador conectado: ${playerId}`);
    sendTo(ws, { type: 'init', id: playerId });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());

            // ===========================================
            // 1. GESTIÓN DE SALAS (LOBBIES)
            // ===========================================
            if (data.type === 'createRoom') {
                const newRoomId = crypto.randomBytes(2).toString('hex').toUpperCase();
                rooms[newRoomId] = { 
                    host: playerId, 
                    mode: data.mode, 
                    started: false
                };
                ws.roomId = newRoomId; 
                
                sendTo(ws, { 
                    type: 'roomJoined', 
                    roomId: newRoomId, 
                    isHost: true, 
                    mode: data.mode, 
                    playerCount: 1 
                });
                console.log(`Sala ${newRoomId} creada por ${playerId} en modo ${data.mode}`);
            } 
            else if (data.type === 'getRooms') {
                // Construir resumen liviano de salas
                const roomSummary = {};
                for (let id in rooms) {
                    roomSummary[id] = {
                        mode: rooms[id].mode,
                        playerCount: getPlayersInRoom(id),
                        started: rooms[id].started
                    };
                }
                sendTo(ws, { type: 'roomList', rooms: roomSummary });
            }
            else if (data.type === 'joinRoom') {
                const targetRoom = data.roomId;
                const room = rooms[targetRoom];
                if (room) {
                    ws.roomId = targetRoom;
                    const playerCount = getPlayersInRoom(targetRoom);
                    
                    sendTo(ws, { 
                        type: 'roomJoined', 
                        roomId: targetRoom, 
                        isHost: false, 
                        mode: room.mode, 
                        playerCount: playerCount 
                    });
                    broadcastToRoom(targetRoom, { type: 'lobbyUpdate', playerCount });
                }
            }

            // ===========================================
            // 2. INICIO DEL JUEGO
            // ===========================================
            else if (data.type === 'requestStart') {
                const room = rooms[ws.roomId];
                if (ws.roomId && room && room.host === playerId) {
                    room.started = true;
                    const playerCount = getPlayersInRoom(ws.roomId);
                    broadcastToRoom(ws.roomId, { 
                        type: 'matchStarted', 
                        mode: room.mode,
                        playerCount: playerCount
                    });
                }
            }

            // ===========================================
            // 3. MOVIMIENTO — reenviar a toda la sala
            // ===========================================
            else if (data.type === 'move') {
                if (!ws.roomId) return; 
                broadcastToRoom(ws.roomId, {
                    type: 'playerMoved',
                    id: playerId,
                    x: data.x, y: data.y, z: data.z, 
                    rotation: data.rotation,
                    isBlocking: data.isBlocking,
                    isAttacking: data.isAttacking,
                    attackFrame: data.attackFrame,
                    color: data.color,
                    name: data.name,
                    health: data.health,
                    isDead: data.isDead
                }, ws);
            }

            // ===========================================
            // 4. COMBATE PvP — Jugador ataca a otro jugador
            // ===========================================
            else if (data.type === 'attackPlayer') {
                if (!ws.roomId) return;
                const targetWs = findClientById(data.targetId, ws.roomId);
                if (targetWs) {
                    sendTo(targetWs, { 
                        type: 'playerHit', 
                        attackerId: playerId, 
                        damage: data.damage 
                    });
                }
            }

            // ===========================================
            // 5. COMBATE Guest vs Bot — redirigir al Host
            // ===========================================
            else if (data.type === 'attackBot') {
                if (!ws.roomId) return;
                const room = rooms[ws.roomId];
                if (room) {
                    const hostWs = findClientById(room.host, ws.roomId);
                    if (hostWs) {
                        sendTo(hostWs, { 
                            type: 'botHit', 
                            botIndex: data.botIndex, 
                            damage: data.damage, 
                            attackerId: playerId 
                        });
                    }
                }
            }

            // ===========================================
            // 6. SYNC BOTS — Host envía estado de bots
            // ===========================================
            else if (data.type === 'syncBots') {
                if (!ws.roomId) return;
                broadcastToRoom(ws.roomId, { 
                    type: 'botStates', 
                    bots: data.bots 
                }, ws);
            }

            // ===========================================
            // 7. SYNC TIMER — Host envía temporizador
            // ===========================================
            else if (data.type === 'syncTimer') {
                if (!ws.roomId) return;
                broadcastToRoom(ws.roomId, { 
                    type: 'timerSync', 
                    elapsed: data.elapsed 
                }, ws);
            }

            // ===========================================
            // 8. SYNC KILLS — Host envía kills globales
            // ===========================================
            else if (data.type === 'syncKills') {
                if (!ws.roomId) return;
                broadcastToRoom(ws.roomId, { 
                    type: 'killsSync', 
                    attackerKills: data.attackerKills, 
                    defenderKills: data.defenderKills 
                }, ws);
            }

            // ===========================================
            // 9. MUERTE DE JUGADOR — broadcast
            // ===========================================
            else if (data.type === 'playerDied') {
                if (!ws.roomId) return;
                broadcastToRoom(ws.roomId, { 
                    type: 'playerDied', 
                    id: playerId 
                }, ws);
            }

            // ===========================================
            // 10. RESPAWN DE JUGADOR — broadcast
            // ===========================================
            else if (data.type === 'playerRespawned') {
                if (!ws.roomId) return;
                broadcastToRoom(ws.roomId, { 
                    type: 'playerRespawned', 
                    id: playerId, 
                    x: data.x, y: data.y, z: data.z 
                }, ws);
            }

            // ===========================================
            // 11. GAME OVER — Host fuerza fin de partida
            // ===========================================
            else if (data.type === 'gameOver') {
                if (!ws.roomId) return;
                broadcastToRoom(ws.roomId, { 
                    type: 'gameOver', 
                    title: data.title 
                });
            }

            // ===========================================
            // 12. BOT ATACÓ A JUGADOR REMOTO
            // ===========================================
            else if (data.type === 'botAttackPlayer') {
                if (!ws.roomId) return;
                const targetWs = findClientById(data.targetPlayerId, ws.roomId);
                if (targetWs) {
                    sendTo(targetWs, { 
                        type: 'botAttackPlayer', 
                        damage: data.damage, 
                        botName: data.botName 
                    });
                }
            }

            // ===========================================
            // 13. SALIR DE SALA
            // ===========================================
            else if (data.type === 'leaveRoom') {
                handlePlayerLeave(ws);
                console.log(`Jugador ${playerId} abandonó la sala manualmente.`);
            }
        } catch (e) {
            console.error("Error leyendo mensaje:", e);
        }
    });

    ws.on('close', () => {
        console.log(`[-] Jugador desconectado: ${playerId}`);
        handlePlayerLeave(ws);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor Multijugador corriendo en http://localhost:${PORT}`);
});