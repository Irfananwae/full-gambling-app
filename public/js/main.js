// This file will be shared across pages

const token = localStorage.getItem('authToken');

// 1. JWT Decoder
function decodeJwt(t) {
    try {
        return JSON.parse(atob(t.split('.')[1]));
    } catch (e) {
        return null;
    }
}

// 2. Universal Logout Function
function logout() {
    localStorage.removeItem('authToken');
    window.location.href = '/login.html';
}

// 3. Dynamic Footer Navigation Renderer
document.addEventListener('DOMContentLoaded', () => {
    const user = decodeJwt(token);
    const navContainer = document.querySelector('.footer-nav');
    if (!navContainer) return;

    const path = window.location.pathname;

    let navHTML = `
        <a href="/lobby.html" class="nav-item ${path.includes('lobby') ? 'active' : ''}"><i class="fas fa-gamepad"></i><span>Games</span></a>
        <a href="/deposit.html" class="nav-item ${path.includes('deposit') ? 'active' : ''}"><i class="fas fa-wallet"></i><span>Deposit</span></a>
        <a href="/withdrawal.html" class="nav-item ${path.includes('withdrawal') ? 'active' : ''}"><i class="fas fa-money-bill-wave"></i><span>Withdraw</span></a>
        <a href="/profile.html" class="nav-item ${path.includes('profile') ? 'active' : ''}"><i class="fas fa-user"></i><span>Profile</span></a>
    `;

    // If the user is an admin, add the admin tab
    if (user && user.isAdmin) {
        navHTML += `<a href="/admin.html" class="nav-item ${path.includes('admin') ? 'active' : ''}"><i class="fas fa-user-shield"></i><span>Admin</span></a>`;
    }

    navContainer.innerHTML = navHTML;
});
