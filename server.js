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
const rooms = {}; // Guarda la info de las salas: { "A1B2": { host: "id1", mode: "FFA", playerCount: 1 } }

wss.on('connection', (ws) => {
    const playerId = crypto.randomUUID();
    ws.playerId = playerId; 
    ws.roomId = null; // Al conectar, no están en ninguna sala
    
    console.log(`[+] Jugador conectado: ${playerId}`);
    ws.send(JSON.stringify({ type: 'init', id: playerId }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            // --- 1. GESTIÓN DE SALAS (LOBBIES) ---
            if (data.type === 'createRoom') {
                const newRoomId = crypto.randomBytes(2).toString('hex').toUpperCase(); // Ej: "4F9A"
                rooms[newRoomId] = { host: playerId, mode: data.mode, playerCount: 1 };
                ws.roomId = newRoomId; // Metemos al jugador en su sala
                
                ws.send(JSON.stringify({ type: 'roomJoined', roomId: newRoomId, isHost: true, mode: data.mode, playerCount: 1 }));
                console.log(`Sala ${newRoomId} creada por ${playerId} en modo ${data.mode}`);
            } 
            else if (data.type === 'getRooms') {
                // Le enviamos al jugador la lista de salas activas
                ws.send(JSON.stringify({ type: 'roomList', rooms: rooms }));
            }
            else if (data.type === 'joinRoom') {
                const targetRoom = data.roomId;
                if (rooms[targetRoom]) {
                    ws.roomId = targetRoom;
                    rooms[targetRoom].playerCount++;
                    
                    ws.send(JSON.stringify({ type: 'roomJoined', roomId: targetRoom, isHost: false, mode: rooms[targetRoom].mode, playerCount: rooms[targetRoom].playerCount }));
                    
                    // Avisar a todos los de esa sala que alguien entró
                    broadcastToRoom(targetRoom, { type: 'lobbyUpdate', playerCount: rooms[targetRoom].playerCount });
                }
            }
            
            // --- 2. GESTIÓN DEL JUEGO (Solo afecta a la sala del jugador) ---
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
                    isBlocking: data.isBlocking
                };
                wss.clients.forEach((client) => {
                    if (client !== ws && client.roomId === ws.roomId && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(broadcastData));
                    }
                });
            }
            // ABANDONAR LA SALA ACTUAL ---
            else if (data.type === 'leaveRoom') {
                if (ws.roomId) {
                    const currentRoom = ws.roomId;
                    if (rooms[currentRoom]) {
                        rooms[currentRoom].playerCount--;
                        if (rooms[currentRoom].playerCount <= 0) {
                            delete rooms[currentRoom]; // Destruir sala vacía
                        } else {
                            broadcastToRoom(currentRoom, { type: 'lobbyUpdate', playerCount: rooms[currentRoom].playerCount });
                            broadcastToRoom(currentRoom, { type: 'playerDisconnected', id: playerId });
                        }
                    }
                    ws.roomId = null; // Liberamos al jugador para que vuelva al menú principal
                    console.log(`Jugador ${playerId} abandonó la sala ${currentRoom}`);
                }
            }
        } catch (e) {
            console.error("Error leyendo mensaje:", e);
        }
    });

    ws.on('close', () => {
        console.log(`[-] Jugador desconectado: ${playerId}`);
        
        // Si estaba en una sala, avisar a los demás y actualizar contadores
        if (ws.roomId) {
            const currentRoom = ws.roomId;
            if (rooms[currentRoom]) {
                rooms[currentRoom].playerCount--;
                if (rooms[currentRoom].playerCount <= 0) {
                    delete rooms[currentRoom]; // Destruir sala vacía
                } else {
                    broadcastToRoom(currentRoom, { type: 'lobbyUpdate', playerCount: rooms[currentRoom].playerCount });
                    broadcastToRoom(currentRoom, { type: 'playerDisconnected', id: playerId });
                }
            }
        }
    });
});

// Función de ayuda para gritarle solo a una sala específica
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