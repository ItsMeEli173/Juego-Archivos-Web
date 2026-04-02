import { getScene } from './scene.js';
import { getCamera } from './camera.js';

let renderer;

export function initRenderer(container) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Ajustar si la ventana cambia de tamaño
    window.addEventListener('resize', () => {
        const camera = getCamera();
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

export function render() {
    renderer.render(getScene(), getCamera());
}