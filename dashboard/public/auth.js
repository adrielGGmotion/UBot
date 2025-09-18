(function() {
    const token = localStorage.getItem('dashboard-token');
    if (!token && !window.location.pathname.endsWith('/login.html')) {
        window.location.href = '/login.html';
    }
})();