let joyInput = { moveX: 0, moveZ: 0, attack: false, block: false, jump: false };

export function initJoystick() {
    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    const btnAttack = document.getElementById('btn-attack');
    const btnBlock = document.getElementById('btn-block');
    const btnJump = document.getElementById('btn-jump');

    let active = false;
    let origin = { x: 0, y: 0 };
    const maxRadius = 35; // Cuánto se puede mover el centro

    // Lógica del Joystick
    zone.addEventListener('touchstart', (e) => {
        active = true;
        const touch = e.touches[0];
        const rect = zone.getBoundingClientRect();
        origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        updateJoystick(touch.clientX, touch.clientY);
    });

    zone.addEventListener('touchmove', (e) => {
        if (!active) return;
        const touch = e.touches[0];
        updateJoystick(touch.clientX, touch.clientY);
    });

    const resetJoystick = () => {
        active = false;
        joyInput.moveX = 0;
        joyInput.moveZ = 0;
        knob.style.transform = `translate(-50%, -50%)`;
    };

    zone.addEventListener('touchend', resetJoystick);
    zone.addEventListener('touchcancel', resetJoystick);

    function updateJoystick(x, y) {
        let dx = x - origin.x;
        let dy = y - origin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Limitar movimiento al radio máximo
        if (distance > maxRadius) {
            dx = (dx / distance) * maxRadius;
            dy = (dy / distance) * maxRadius;
        }

        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        // Normalizar de -1 a 1
        joyInput.moveX = dx / maxRadius;
        joyInput.moveZ = dy / maxRadius;
    }

    // Lógica de botones
    btnAttack.addEventListener('touchstart', () => joyInput.attack = true);
    btnAttack.addEventListener('touchend', () => joyInput.attack = false);
    btnBlock.addEventListener('touchstart', () => joyInput.block = true);
    btnBlock.addEventListener('touchend', () => joyInput.block = false);
    btnJump.addEventListener('touchstart', () => joyInput.jump = true);
    btnJump.addEventListener('touchend', () => joyInput.jump = false);
}

export function getJoystickInput() {
    return joyInput;
}