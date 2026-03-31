import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { colliders } from './colliders.js';
import { getTerrainHeight } from './terrain.js'; 

function createTree() {
    const tree = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.6, 3, 5); // Troncos más gruesos
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, flatShading: true });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5;
    tree.add(trunk);

    const leavesGeo = new THREE.ConeGeometry(2, 4, 5); // Copas más grandes
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x00aa00, flatShading: true });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 4.5;
    tree.add(leaves);

    return tree;
}

// Subimos la cantidad a 400 árboles
export function generateForest(scene, count = 400) {
    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 280;
        const z = (Math.random() - 0.5) * 280;
        
        // Zona segura inicio (radio de 20)
        if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;
        // Zona segura del castillo (no plantar árboles dentro o en los muros)
        if (x > -40 && x < 40 && z < -70 && z > -130) continue; 
        
        const distCastle = Math.sqrt(x*x + (z + 100)*(z + 100)); // Centro del castillo
        const distSpawn = Math.sqrt(x*x + (z - 80)*(z - 80));
        if (distCastle < 45 || distSpawn < 35) {
        i--; // Restamos 1 al contador para intentar plantar este árbol en otro lado
        continue; // Saltamos a la siguiente iteración
    }
        const tree = createTree();
        const y = getTerrainHeight(x, z);
        tree.position.set(x, y, z);
        
        tree.rotation.y = Math.random() * Math.PI;
        const scale = 0.7 + Math.random() * 0.8; // Más variabilidad de tamaño
        tree.scale.set(scale, scale, scale);
        
        scene.add(tree);

        tree.updateMatrixWorld(true);
        const trunkBox = new THREE.Box3().setFromObject(tree.children[0]);
        colliders.push(trunkBox);
    }
}