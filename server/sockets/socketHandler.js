const crypto = require('crypto');
const roomManager = require('../state/roomManager');
const { broadcastToRoom, sendTo, findClientById, getPlayersInRoom } = require('../utils/networkUtils');

function handleConnection(wss) {
    wss.on('connection', (ws) => {
        const playerId = crypto.randomUUID();
        ws.playerId = playerId; 
        ws.roomId = null; 

        console.log(`[+] Jugador conectado: ${playerId}`);
        sendTo(ws, { type: 'init', id: playerId });

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());

                if (data.type === 'createRoom') {
                    const newRoomId = crypto.randomBytes(2).toString('hex').toUpperCase();
                    roomManager.createRoom(newRoomId, playerId, data.mode, data.hostName);
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
                    sendTo(ws, { type: 'roomList', rooms: roomManager.getAllRoomsSummary(wss) });
                }
                else if (data.type === 'joinRoom') {
                    const targetRoom = data.roomId;
                    const room = roomManager.getRoom(targetRoom);
                    if (room) {
                        ws.roomId = targetRoom;
                        const playerCount = getPlayersInRoom(wss, targetRoom);
                        
                        sendTo(ws, { 
                            type: 'roomJoined', 
                            roomId: targetRoom, 
                            isHost: false, 
                            mode: room.mode, 
                            playerCount: playerCount 
                        });
                        broadcastToRoom(wss, targetRoom, { type: 'lobbyUpdate', playerCount });
                    }
                }
                else if (data.type === 'requestStart') {
                    const room = roomManager.getRoom(ws.roomId);
                    if (ws.roomId && room && room.host === playerId) {
                        roomManager.startRoom(ws.roomId);
                        const playerCount = getPlayersInRoom(wss, ws.roomId);
                        broadcastToRoom(wss, ws.roomId, { 
                            type: 'matchStarted', 
                            mode: room.mode,
                            playerCount: playerCount
                        });
                    }
                }
                else if (data.type === 'move') {
                    if (!ws.roomId) return; 
                    broadcastToRoom(wss, ws.roomId, {
                        type: 'playerMoved',
                        id: playerId,
                        x: data.x, y: data.y, z: data.z, 
                        rotation: data.rotation,
                        isBlocking: data.isBlocking,
                        isAttacking: data.isAttacking,
                        attackFrame: data.attackFrame,
                        color: data.color,
                        name: data.name,
                        team: data.team,
                        health: data.health,
                        isDead: data.isDead
                    }, ws);
                }
                else if (data.type === 'attackPlayer') {
                    if (!ws.roomId) return;
                    const targetWs = findClientById(wss, data.targetId, ws.roomId);
                    if (targetWs) {
                        sendTo(targetWs, { type: 'playerHit', attackerId: playerId, damage: data.damage });
                    }
                }
                else if (data.type === 'attackBot') {
                    if (!ws.roomId) return;
                    const room = roomManager.getRoom(ws.roomId);
                    if (room) {
                        const hostWs = findClientById(wss, room.host, ws.roomId);
                        if (hostWs) {
                            sendTo(hostWs, { type: 'botHit', botIndex: data.botIndex, damage: data.damage, attackerId: playerId });
                        }
                    }
                }
                else if (data.type === 'syncBots') {
                    if (!ws.roomId) return;
                    broadcastToRoom(wss, ws.roomId, { type: 'botStates', bots: data.bots }, ws);
                }
                else if (data.type === 'syncTimer') {
                    if (!ws.roomId) return;
                    broadcastToRoom(wss, ws.roomId, { type: 'timerSync', elapsed: data.elapsed }, ws);
                }
                else if (data.type === 'syncKills') {
                    if (!ws.roomId) return;
                    broadcastToRoom(wss, ws.roomId, { type: 'killsSync', attackerKills: data.attackerKills, defenderKills: data.defenderKills }, ws);
                }
                else if (data.type === 'playerDied') {
                    if (!ws.roomId) return;
                    broadcastToRoom(wss, ws.roomId, { type: 'playerDied', id: playerId }, ws);
                }
                else if (data.type === 'playerRespawned') {
                    if (!ws.roomId) return;
                    broadcastToRoom(wss, ws.roomId, { type: 'playerRespawned', id: playerId, x: data.x, y: data.y, z: data.z }, ws);
                }
                else if (data.type === 'gameOver') {
                    if (!ws.roomId) return;
                    broadcastToRoom(wss, ws.roomId, { type: 'gameOver', title: data.title });
                }
                else if (data.type === 'botAttackPlayer') {
                    if (!ws.roomId) return;
                    const targetWs = findClientById(wss, data.targetPlayerId, ws.roomId);
                    if (targetWs) {
                        sendTo(targetWs, { type: 'botAttackPlayer', damage: data.damage, botName: data.botName });
                    }
                }
                else if (data.type === 'leaveRoom') {
                    roomManager.handlePlayerLeave(wss, ws);
                    console.log(`Jugador ${playerId} abandonó la sala manualmente.`);
                }
            } catch (e) {
                console.error("Error leyendo mensaje:", e);
            }
        });

        ws.on('close', () => {
            console.log(`[-] Jugador desconectado: ${playerId}`);
            roomManager.handlePlayerLeave(wss, ws);
        });
    });
}

module.exports = {
    handleConnection
};
