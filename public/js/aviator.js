if (!token) window.location.href = '/login.html';
const socket = io();
socket.on('connect', () => socket.emit('authenticate', token));

const balanceEl = document.getElementById('balance'), historyEl = document.getElementById('aviator-history'), multiplierEl = document.getElementById('aviator-multiplier'), planeEl = document.getElementById('aviator-plane'), canvas = document.getElementById('aviator-canvas'), ctx = canvas.getContext('2d'), liveBetsEl = document.getElementById('live-bets-list'), myBetsEl = document.getElementById('my-bets-list');
let currentMultiplier = 1.00, pathPoints = [], animationFrameId = null;

const panels = {
    panel1: { id: 'panel1', el: document.getElementById('panel1'), input: document.querySelector('#panel1 .bet-input'), btn: document.querySelector('#panel1 .bet-btn'), state: 'idle', betAmount: 0 },
    panel2: { id: 'panel2', el: document.getElementById('panel2'), input: document.querySelector('#panel2 .bet-input'), btn: document.querySelector('#panel2 .bet-btn'), state: 'idle', betAmount: 0 }
};
function resizeCanvas() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

function renderAnimation() {
    if(!planeEl.style.display || planeEl.style.display === 'none') return;
    const w = canvas.width, h = canvas.height;
    const curve = (x) => Math.pow(x, 0.6) * 0.9;
    const planeX = Math.min((currentMultiplier - 1) * (w / 15), w - 40);
    const planeY = h - curve(planeX / w) * h - 25;
    const prevPoint = pathPoints.length > 0 ? pathPoints[pathPoints.length - 1] : [0, h];
    const angle = Math.atan2(planeY - prevPoint[1], planeX - prevPoint[0]);
    planeEl.style.transform = `translate(${planeX}px, ${planeY}px) rotate(${angle + Math.PI / 2}rad)`;
    ctx.clearRect(0, 0, w, h); pathPoints.push([planeX, planeY]);
    const gradient = ctx.createLinearGradient(0, h, 0, 0);
    gradient.addColorStop(0, "rgba(255, 85, 85, 0)"); gradient.addColorStop(1, "rgba(255, 85, 85, 0.8)");
    ctx.strokeStyle = gradient; ctx.lineWidth = 4; ctx.shadowColor = '#ff5555'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(pathPoints[0][0], pathPoints[0][1]);
    for (let i = 1; i < pathPoints.length; i++) ctx.lineTo(pathPoints[i][0], pathPoints[i][1]);
    ctx.stroke();
    animationFrameId = requestAnimationFrame(renderAnimation);
}

socket.on('aviatorState', (state) => {
    if (state.phase === 'waiting') {
        if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null;
        const waitTime = Math.ceil((state.startTime - Date.now()) / 1000);
        multiplierEl.innerHTML = `<div>Starting in ${waitTime > 0 ? waitTime : 0}s</div>`;
        multiplierEl.className = 'waiting'; planeEl.style.display = 'none'; pathPoints = [];
        Object.values(panels).forEach(p => updatePanelUI(p, 'idle')); updateHistory(state.history);
    } else if (state.phase === 'playing') {
        planeEl.style.display = 'block'; multiplierEl.className = 'playing';
        multiplierEl.textContent = `${state.multiplier.toFixed(2)}x`;
        currentMultiplier = state.multiplier;
        Object.values(panels).forEach(p => { if (p.state === 'waiting_for_round') updatePanelUI(p, 'in_game'); });
        if (!animationFrameId) animationFrameId = requestAnimationFrame(renderAnimation);
    } else if (state.phase === 'crashed') {
        if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null;
        multiplierEl.className = 'crashed';
        multiplierEl.innerHTML = `<span class="flew-away-text">FLEW AWAY!</span>${state.multiplier.toFixed(2)}x`;
        planeEl.style.display = 'none';
        Object.values(panels).forEach(p => { if (p.state === 'in_game') updatePanelUI(p, 'idle'); });
    }
});

socket.on('aviatorNewBet', data => { if(!data.email) return; const betDiv = document.createElement('div'); betDiv.className = 'live-bet-item'; betDiv.innerHTML = `<span>${data.email}</span><span>₹${Number(data.betAmount).toFixed(2)}</span>`; liveBetsEl.prepend(betDiv); if (liveBetsEl.children.length > 10) liveBetsEl.lastChild.remove(); });

function updatePanelUI(panel, newState, multiplier = 0) {
    panel.state = newState;
    const controlsDisabled = newState !== 'idle';
    panel.input.disabled = controlsDisabled;
    panel.el.querySelectorAll('.adjust-btn, .quick-bet-btn').forEach(b => b.disabled = controlsDisabled);
    switch (newState) {
        case 'idle': panel.btn.textContent = `BET (₹${panel.input.value})`; panel.btn.className = 'bet-btn'; panel.btn.disabled = false; break;
        case 'waiting_for_round': panel.btn.textContent = 'WAITING'; panel.btn.className = 'bet-btn waiting'; panel.btn.disabled = true; break;
        case 'in_game': panel.btn.textContent = `CASH OUT`; panel.btn.className = 'bet-btn cashout'; panel.btn.disabled = false; break;
        case 'cashed_out': panel.btn.textContent = `CASHED OUT @ ${multiplier.toFixed(2)}x`; panel.btn.className = 'bet-btn cashed-out'; panel.btn.disabled = true; break;
    }
}

Object.values(panels).forEach(panel => {
    const betBtn = panel.btn, input = panel.input;
    betBtn.onclick = () => {
        if (panel.state === 'idle') {
            const amount = Number(input.value); if (!amount || amount < 10) return;
            fetch('/api/aviator/place-bet', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: JSON.stringify({ betAmount: amount, betPanelId: panel.id }) }).then(r => r.json()).then(d => { if (d.newBalance !== undefined) { balanceEl.textContent = `₹${d.newBalance.toFixed(2)}`; panel.betAmount = amount; updatePanelUI(panel, 'waiting_for_round'); } else { alert(d.message); } });
        } else if (panel.state === 'in_game') {
            fetch('/api/aviator/cash-out', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: JSON.stringify({ betPanelId: panel.id }) }).then(r => r.json()).then(d => { if (d.newBalance !== undefined) { balanceEl.textContent = `₹${d.newBalance.toFixed(2)}`; updatePanelUI(panel, 'cashed_out', d.multiplier); } else { alert(d.message); } });
        }
    };
    input.oninput = () => { if (panel.state === 'idle') betBtn.textContent = `BET (₹${input.value})`; };
    panel.el.querySelector('.adjust-btn:first-of-type').onclick = () => { input.stepDown(); input.oninput(); };
    panel.el.querySelector('.adjust-btn:last-of-type').onclick = () => { input.stepUp(); input.oninput(); };
    panel.el.querySelectorAll('.quick-bet-btn').forEach(b => b.onclick = () => { input.value = b.textContent; input.oninput(); });
});

function updateHistory(history) { if(!history) return; historyEl.innerHTML = ''; history.slice(0, 15).forEach(m => { const item = document.createElement('div'); let colorClass = 'red'; if (m >= 2) colorClass = 'green'; else if (m >= 1.1) colorClass = 'orange'; item.className = `history-item ${colorClass}`; item.textContent = `${m.toFixed(2)}x`; historyEl.appendChild(item); }); }
socket.on('balanceUpdate', data => balanceEl.textContent = `₹${data.newBalance.toFixed(2)}`);
document.addEventListener('DOMContentLoaded', () => fetch('/api/game/balance', { headers: { 'x-auth-token': token }}).then(r=>r.json()).then(d=>balanceEl.textContent=`₹${d.balance.toFixed(2)}`));
