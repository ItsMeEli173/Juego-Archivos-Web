const keys = { w: false, a: false, s: false, d: false, ' ': false };
let mouseInput = { attack: false, block: false, deltaX: 0 };

export function initKeyboard() {
    // Teclas WASD
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) keys[key] = true;
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) keys[key] = false;
    });

    // Clicks del Mouse
    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) mouseInput.attack = true; // Click Izquierdo
        if (e.button === 2) mouseInput.block = true;  // Click Derecho
    });
    
    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) mouseInput.attack = false;
        if (e.button === 2) mouseInput.block = false;
    });

    // Evitar menú de navegador al hacer click derecho
    window.addEventListener('contextmenu', e => e.preventDefault());

    // Atrapar el Mouse en la pantalla (Pointer Lock)
    document.getElementById('game-container').addEventListener('click', () => {
        document.body.requestPointerLock();
    });

    // Leer movimiento del mouse solo si está atrapado
    window.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === document.body) {
            mouseInput.deltaX = e.movementX || 0;
        }
    });
}

export function getKeyboardInput() {
    const input = {
        moveX: (keys.d ? 1 : 0) - (keys.a ? 1 : 0),
        moveZ: (keys.s ? 1 : 0) - (keys.w ? 1 : 0),
        attack: mouseInput.attack,
        block: mouseInput.block,
        deltaX: mouseInput.deltaX,
        jump: keys[' ']
    };
    // Limpiar el delta del mouse después de leerlo en este frame
    mouseInput.deltaX = 0; 
    return input;
}