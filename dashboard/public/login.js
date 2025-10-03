document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const passwordInput = document.getElementById('password');
    const loginStatus = document.getElementById('login-status');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginStatus.textContent = 'Verificando...';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: passwordInput.value })
            });

            if (response.ok) {
                // O token agora é gerenciado por um cookie httpOnly seguro.
                // Apenas redirecionamos em caso de sucesso.
                window.location.href = '/';
            } else {
                throw new Error('Senha incorreta.');
            }
        } catch (error) {
            loginStatus.textContent = error.message;
            loginStatus.style.color = '#f87171';
        }
    });
});