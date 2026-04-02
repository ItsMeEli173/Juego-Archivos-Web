import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { colliders } from './colliders.js';

export function createCastle(scene) {
    const castle = new THREE.Group();
    
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x555555, flatShading: true });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x777777, flatShading: true });
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x666666, flatShading: true });
    const stairMat = new THREE.MeshStandardMaterial({ color: 0x444444, flatShading: true });

    const castleX = 0;
    const castleZ = -100; 
    const groupBaseHeight = 3.5; 
    castle.position.set(castleX, groupBaseHeight, castleZ);

    function addPart(geo, mat, x, y, z) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        castle.add(mesh);
    }

    // --- CORRECCIÓN: CIMIENTOS PROFUNDOS ---
    // Altura 10, centro en Y=-5 (llega desde el nivel del castillo Y=0 hasta Y=-10 relativo)
    // En el mundo absoluto, esto entierra el bloque hasta Y = -6.5, tapando cualquier valle procedural.
    const floorGeo = new THREE.BoxGeometry(50, 10, 50);
    addPart(floorGeo, floorMat, 0, -5, 0);

    const transitableWallHeight = 15;
    const wallY = transitableWallHeight / 2; 
    
    const wallXGeo = new THREE.BoxGeometry(42, transitableWallHeight, 4);
    const wallZGeo = new THREE.BoxGeometry(4, transitableWallHeight, 42);
    
    addPart(wallXGeo, wallMat, 0, wallY, -21); 
    addPart(wallZGeo, wallMat, -21, wallY, 0); 
    addPart(wallZGeo, wallMat, 21, wallY, 0);  

    const frontWallGeo = new THREE.BoxGeometry(14.5, transitableWallHeight, 4);
    addPart(frontWallGeo, wallMat, -13.75, wallY, 21); 
    addPart(frontWallGeo, wallMat, 13.75, wallY, 21);  

    const garitaGeo = new THREE.BoxGeometry(13, 8, 6);
    addPart(garitaGeo, towerMat, 0, 11, 21); 

    const transitableTowerHeight = 17;
    const towerY = transitableTowerHeight / 2; 
    const towerGeo = new THREE.BoxGeometry(8, transitableTowerHeight, 8);
    addPart(towerGeo, towerMat, -21, towerY, -21); 
    addPart(towerGeo, towerMat, 21, towerY, -21);  
    addPart(towerGeo, towerMat, -21, towerY, 21);  
    addPart(towerGeo, towerMat, 21, towerY, 21);   

    const totalInternalSteps = 20;
    const stepDepth = 1.2;
    const stairWidth = 6;
    const stairX = 16; 
    const topStepZ = -18.4;

    for (let i = 1; i <= totalInternalSteps; i++) {
        const height = (transitableWallHeight / totalInternalSteps) * i;
        const yPos = height / 2; 
        const zPos = topStepZ + (totalInternalSteps - i) * stepDepth; 
        const stepGeo = new THREE.BoxGeometry(stairWidth, height, stepDepth);
        addPart(stepGeo, stairMat, stairX, yPos, zPos);
    }

    const rampSlices = 30;
    const rampLength = 30;
    const rampWidth = 14; 
    const totalDrop = 7.5; 
    const sliceDepth = rampLength / rampSlices; 
    const sliceDrop = totalDrop / rampSlices;   
    const gateOuterFaceZ = 23; 
    
    for (let i = 0; i < rampSlices; i++) {
        const sliceTopY = 0 - (i * sliceDrop); 
        const geoHeight = 10; 
        const yPos = sliceTopY - (geoHeight / 2); 
        const zPos = gateOuterFaceZ + (i * sliceDepth) + (sliceDepth / 2);
        
        const sliceGeo = new THREE.BoxGeometry(rampWidth, geoHeight, sliceDepth);
        addPart(sliceGeo, stairMat, 0, yPos, zPos);
    }

    scene.add(castle);

    castle.updateMatrixWorld(true);
    castle.children.forEach(child => {
        const box = new THREE.Box3().setFromObject(child);
        colliders.push(box);
    });

    return castle;
}