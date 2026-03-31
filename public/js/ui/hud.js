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
                const isPlayer = p.name === 'Player-1' || p.name === document.getElementById('player-name-input')?.value ? 'player-row' : '';
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

export function updateMinimap(player, npcs, gameMode, networkPlayers) {
    const canvas = document.getElementById('minimap');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const scale = canvas.width / 300; 

    // 1. Castillo
    ctx.fillStyle = 'rgba(119, 119, 119, 0.8)'; 
    const castleW = 50 * scale; const castleH = 50 * scale;
    const castleX = cx + (0 * scale) - (castleW / 2);
    const castleZ = cy + (-100 * scale) - (castleH / 2);
    ctx.fillRect(castleX, castleZ, castleW, castleH);

    // 2. Bots (NPCs)
    npcs.forEach(npc => {
        if (npc.isDead || !npc.mesh) return;
        ctx.beginPath();
        const nx = cx + (npc.mesh.position.x * scale);
        const nz = cy + (npc.mesh.position.z * scale);
        ctx.arc(nx, nz, 3, 0, Math.PI * 2);
        
        if (gameMode === 'FFA') {
            ctx.fillStyle = '#' + npc.baseColor.toString(16).padStart(6, '0');
        } else {
            // Bots Atacantes = Guindo, Bots Defensores = Azul
            ctx.fillStyle = npc.team === 'defender' ? '#0000ff' : '#800000';
        }
        ctx.fill();
    });

    // 3. Jugadores de Red (Online)
    if (networkPlayers) {
        for (let id in networkPlayers) {
            const np = networkPlayers[id];
            ctx.beginPath();
            const nx = cx + (np.mesh.position.x * scale);
            const nz = cy + (np.mesh.position.z * scale);
            ctx.arc(nx, nz, 4, 0, Math.PI * 2);
            
            // Usamos el color real del jugador enviado por el servidor (Rojo, Celeste o Aleatorio)
            ctx.fillStyle = '#' + (np.color || 0x800000).toString(16).padStart(6, '0');
            ctx.fill();
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    // 4. Jugador Principal (Tú)
    if (!player.isDead && player.mesh) {
        ctx.beginPath();
        const px = cx + (player.mesh.position.x * scale);
        const pz = cy + (player.mesh.position.z * scale);
        ctx.arc(px, pz, 4, 0, Math.PI * 2);
        
        // Usamos tu color real elegido
        ctx.fillStyle = '#' + (player.baseColor || 0x00ff00).toString(16).padStart(6, '0');
        ctx.fill();
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke(); 
    }
}