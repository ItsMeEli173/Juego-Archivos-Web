import { getTerrainHeight } from './terrain.js';

export const colliders = [];

export function checkWallCollision(newX, newZ, currentY) {
    const pMinX = newX - 0.4; const pMaxX = newX + 0.4;
    const pMinZ = newZ - 0.4; const pMaxZ = newZ + 0.4;
    const pMinY = currentY - 0.5; 
    const pMaxY = currentY + 0.9; 

    for (let box of colliders) {
        if (pMaxX > box.min.x && pMinX < box.max.x &&
            pMaxZ > box.min.z && pMinZ < box.max.z &&
            pMaxY > box.min.y && pMinY < box.max.y) {
            return true;
        }
    }
    return false;
}

// Función unificada de suelo para Jugadores y Bots
export function getGroundY(x, z, currentY) {
    let groundY = getTerrainHeight(x, z) + 1; // Suelo base del bosque
    const pMinX = x - 0.4; const pMaxX = x + 0.4;
    const pMinZ = z - 0.4; const pMaxZ = z + 0.4;

    for (let box of colliders) {
        if (pMaxX > box.min.x && pMinX < box.max.x &&
            pMaxZ > box.min.z && pMinZ < box.max.z) {
            // Tolerancia aumentada a 1.5 para subir la rampa fluidamente
            if (box.max.y <= currentY - 1 + 1.5) { 
                groundY = Math.max(groundY, box.max.y + 1);
            }
        }
    }
    return groundY;
}