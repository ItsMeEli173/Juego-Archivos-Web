export function updateHUD(health, kills, timeString) {
    const healthBar = document.getElementById('health-bar');
    if (healthBar) healthBar.style.width = Math.max(0, health) + '%';
    
    const killsEl = document.getElementById('ui-kills');
    if (killsEl) killsEl.innerText = `Kills: ${kills}`;
    
    const timerEl = document.getElementById('ui-timer');
    if (timerEl) timerEl.innerText = timeString;
}

export function showGameOverScreen(allPlayers, titleText, onRestartCallback, onMenuCallback) {
    const screen = document.getElementById('game-over-screen');
    if(screen) screen.classList.remove('hidden');

    const title = document.getElementById('end-title');
    if (title) title.innerText = titleText;

    const listContainer = document.querySelector('.leaderboard-box');
    if(listContainer) {
        const attackers = allPlayers.filter(p => p.team === 'attacker').sort((a,b) => b.kills - a.kills);
        const defenders = allPlayers.filter(p => p.team === 'defender').sort((a,b) => b.kills - a.kills);

        const buildTable = (teamName, players, cssClass) => {
            let tableHtml = `<table class="score-table ${cssClass}">
                <thead><tr><th>${teamName}</th><th>K</th><th>D</th></tr></thead><tbody>`;
            players.forEach(p => {
                const isPlayer = p.name === 'Player-1' ? 'player-row' : '';
                tableHtml += `<tr class="${isPlayer}"><td>${p.name}</td><td>${p.kills}</td><td>${p.deaths}</td></tr>`;
            });
            return tableHtml + `</tbody></table>`;
        };

        if (defenders.length === 0) {
            listContainer.innerHTML = buildTable('JUGADORES (Todos contra Todos)', attackers, 'team-attacker');
        } else {
            listContainer.innerHTML = buildTable('ATACANTES', attackers, 'team-attacker') + buildTable('DEFENSORES', defenders, 'team-defender');
        }
    }

    document.getElementById('btn-restart').onclick = () => {
        screen.classList.add('hidden');
        onRestartCallback();
    };
    
    document.getElementById('btn-menu').onclick = () => {
        screen.classList.add('hidden');
        onMenuCallback();
    };
}

// --- NUEVO: FUNCIÓN DEL MINIMAPA ---
export function updateMinimap(player, npcs, gameMode) {
    const canvas = document.getElementById('minimap');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Limpiar frame anterior
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const scale = canvas.width / 300; // El mundo mide 300 (-150 a 150)

    // 1. Dibujar el Castillo (X=0, Z=-100)
    ctx.fillStyle = 'rgba(119, 119, 119, 0.8)'; // Gris castillo
    const castleW = 50 * scale;
    const castleH = 50 * scale;
    const castleX = cx + (0 * scale) - (castleW / 2);
    const castleZ = cy + (-100 * scale) - (castleH / 2);
    ctx.fillRect(castleX, castleZ, castleW, castleH);

    // 2. Dibujar Bots
    npcs.forEach(npc => {
        if (npc.isDead || !npc.mesh) return;
        ctx.beginPath();
        const nx = cx + (npc.mesh.position.x * scale);
        const nz = cy + (npc.mesh.position.z * scale);
        ctx.arc(nx, nz, 3, 0, Math.PI * 2);
        
        // Color según equipo
        if (gameMode === 'FFA') {
            ctx.fillStyle = '#' + npc.baseColor.toString(16).padStart(6, '0');
        } else {
            ctx.fillStyle = npc.team === 'defender' ? '#0088ff' : '#ff8800';
        }
        ctx.fill();
    });

    // 3. Dibujar Jugador Principal (Tú)
    if (!player.isDead && player.mesh) {
        ctx.beginPath();
        const px = cx + (player.mesh.position.x * scale);
        const pz = cy + (player.mesh.position.z * scale);
        ctx.arc(px, pz, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff00'; // Tú siempre eres el punto verde
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke(); // Borde blanco para resaltar
    }
}