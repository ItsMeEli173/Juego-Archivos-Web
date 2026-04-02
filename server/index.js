const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { handleConnection } = require('./sockets/socketHandler');

const app = express();

// Servimos la carpeta 'client' que contiene todos los estáticos
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Delegar el manejo de los sockets
handleConnection(wss);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor Multijugador corriendo en http://localhost:${PORT}`);
});
