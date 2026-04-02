const WebSocket = require('ws');

function broadcastToRoom(wss, roomId, jsonObject, excludeWs = null) {
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

function findClientById(wss, playerId, roomId) {
    for (const client of wss.clients) {
        if (client.playerId === playerId && client.roomId === roomId && client.readyState === WebSocket.OPEN) {
            return client;
        }
    }
    return null;
}

function getPlayersInRoom(wss, roomId) {
    let count = 0;
    wss.clients.forEach(client => {
        if (client.roomId === roomId && client.readyState === WebSocket.OPEN) count++;
    });
    return count;
}

module.exports = {
    broadcastToRoom,
    sendTo,
    findClientById,
    getPlayersInRoom
};
