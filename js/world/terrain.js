import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

// Exportamos la función mágica para que el jugador y enemigos sepan dónde pisar
export function getTerrainHeight(x, z) {
    return Math.sin(x * 0.1) * Math.cos(z * 0.1) * 3;
}

export function createTerrain(scene) {
    const geometry = new THREE.PlaneGeometry(300, 300, 100, 100);
    const vertices = geometry.attributes.position.array;
    
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1]; 
        
        vertices[i + 2] = getTerrainHeight(x, y); 
    }
    
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ 
        color: 0x2d5a27,
        flatShading: true
    });
    
    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    
    scene.add(terrain);
    return terrain;
}