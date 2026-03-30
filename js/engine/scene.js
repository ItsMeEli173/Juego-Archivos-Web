import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { createTerrain } from '../world/terrain.js';
import { generateForest } from '../world/trees.js';
import { createCastle } from '../world/castle.js';

let scene;

export function initScene() {
    scene = new THREE.Scene();
    
    // Añadimos un poco de niebla para esconder el borde del mapa y dar atmósfera
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 20, 80); 
    
    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);

    // --- GENERACIÓN DEL MUNDO (FASE 7) ---
    createTerrain(scene);
    generateForest(scene, 150); // Generar 150 árboles
    createCastle(scene);
}

export function getScene() {
    return scene;
}