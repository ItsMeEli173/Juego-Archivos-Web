const { broadcastToRoom, getPlayersInRoom } = require('../utils/networkUtils');

class RoomManager {
    constructor() {
        this.rooms = {};
    }

    createRoom(id, hostId, mode, hostName) {
        this.rooms[id] = {
            host: hostId,
            hostName: hostName || "Jugador",
            mode: mode,
            started: false
        };
        return this.rooms[id];
    }

    getRoom(id) {
        return this.rooms[id];
    }

    getAllRoomsSummary(wss) {
        const roomSummary = {};
        for (let id in this.rooms) {
            roomSummary[id] = {
                mode: this.rooms[id].mode,
                hostName: this.rooms[id].hostName,
                playerCount: getPlayersInRoom(wss, id),
                started: this.rooms[id].started
            };
        }
        return roomSummary;
    }

    startRoom(id) {
        if (this.rooms[id]) {
            this.rooms[id].started = true;
            return true;
        }
        return false;
    }

    handlePlayerLeave(wss, ws) {
        if (ws.roomId) {
            const currentRoom = ws.roomId;
            const room = this.rooms[currentRoom];
            if (room) {
                const playerCount = getPlayersInRoom(wss, currentRoom) - 1; // -1 porque este ws se va

                if (playerCount <= 0 || room.host === ws.playerId) {
                    broadcastToRoom(wss, currentRoom, { type: 'roomClosed' }, ws);
                    delete this.rooms[currentRoom];
                    console.log(`Sala ${currentRoom} cerrada.`);
                } else {
                    broadcastToRoom(wss, currentRoom, { type: 'lobbyUpdate', playerCount }, ws);
                    broadcastToRoom(wss, currentRoom, { type: 'playerDisconnected', id: ws.playerId }, ws);
                }
            }
            ws.roomId = null; 
        }
    }
}

module.exports = new RoomManager();
