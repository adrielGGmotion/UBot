// This script now provides a global logout function.
// Server-side middleware is responsible for protecting pages.

window.auth = {
    logout: async () => {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
            });
            if (!response.ok) {
                console.error('Logout request failed.');
            }
        } catch (error) {
            console.error('Error during logout:', error);
        } finally {
            // Always redirect to login page after attempting to log out.
            window.location.href = '/login.html';
        }
    }
};

// The old IIFE redirect is removed. The server now handles this.
// Any page that includes this script will have access to `window.auth.logout()`.