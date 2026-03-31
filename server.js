const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto'); 

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Memoria global
const rooms = {}; 

// Función centralizada para manejar cuando alguien sale o se desconecta
function handlePlayerLeave(ws) {
    if (ws.roomId) {
        const currentRoom = ws.roomId;
        if (rooms[currentRoom]) {
            rooms[currentRoom].playerCount--;
            
            // Si el anfitrión se va, o ya no queda nadie, cerramos la sala
            if (rooms[currentRoom].playerCount <= 0 || rooms[currentRoom].host === ws.playerId) {
                broadcastToRoom(currentRoom, { type: 'roomClosed' });
                delete rooms[currentRoom];
                console.log(`Sala ${currentRoom} cerrada.`);
            } else {
                // Si era un invitado normal, solo avisamos que se fue
                broadcastToRoom(currentRoom, { type: 'lobbyUpdate', playerCount: rooms[currentRoom].playerCount });
                broadcastToRoom(currentRoom, { type: 'playerDisconnected', id: ws.playerId });
            }
        }
        ws.roomId = null; 
    }
}

wss.on('connection', (ws) => {
    const playerId = crypto.randomUUID();
    ws.playerId = playerId; 
    ws.roomId = null; 
    
    console.log(`[+] Jugador conectado: ${playerId}`);
    ws.send(JSON.stringify({ type: 'init', id: playerId }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            // --- 1. GESTIÓN DE SALAS (LOBBIES) ---
            if (data.type === 'createRoom') {
                const newRoomId = crypto.randomBytes(2).toString('hex').toUpperCase();
                rooms[newRoomId] = { host: playerId, mode: data.mode, playerCount: 1 };
                ws.roomId = newRoomId; 
                
                ws.send(JSON.stringify({ type: 'roomJoined', roomId: newRoomId, isHost: true, mode: data.mode, playerCount: 1 }));
                console.log(`Sala ${newRoomId} creada por ${playerId} en modo ${data.mode}`);
            } 
            else if (data.type === 'getRooms') {
                ws.send(JSON.stringify({ type: 'roomList', rooms: rooms }));
            }
            else if (data.type === 'joinRoom') {
                const targetRoom = data.roomId;
                if (rooms[targetRoom]) {
                    ws.roomId = targetRoom;
                    rooms[targetRoom].playerCount++;
                    
                    ws.send(JSON.stringify({ type: 'roomJoined', roomId: targetRoom, isHost: false, mode: rooms[targetRoom].mode, playerCount: rooms[targetRoom].playerCount }));
                    broadcastToRoom(targetRoom, { type: 'lobbyUpdate', playerCount: rooms[targetRoom].playerCount });
                }
            }
            
            // --- 2. GESTIÓN DEL JUEGO ---
            else if (data.type === 'requestStart') {
                if (ws.roomId && rooms[ws.roomId] && rooms[ws.roomId].host === playerId) {
                    broadcastToRoom(ws.roomId, { type: 'matchStarted', mode: rooms[ws.roomId].mode });
                }
            }
            else if (data.type === 'move') {
                if (!ws.roomId) return; 
                const broadcastData = {
                    type: 'playerMoved',
                    id: playerId,
                    x: data.x, y: data.y, z: data.z, rotation: data.rotation,
                    isBlocking: data.isBlocking,
                    color: data.color,
                    name: data.name // <-- AÑADIR ESTO
                };
                wss.clients.forEach((client) => {
                    if (client !== ws && client.roomId === ws.roomId && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(broadcastData));
                    }
                });
            }
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

function broadcastToRoom(roomId, jsonObject) {
    const packet = JSON.stringify(jsonObject);
    wss.clients.forEach((client) => {
        if (client.roomId === roomId && client.readyState === WebSocket.OPEN) {
            client.send(packet);
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor Multijugador corriendo en http://localhost:${PORT}`);
});