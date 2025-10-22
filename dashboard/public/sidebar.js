document.addEventListener('DOMContentLoaded', () => {
    // This script should not run on the login page.
    if (window.location.pathname.includes('/login.html')) {
        return;
    }

    const sidebarContainer = document.querySelector('.sidebar');
    if (!sidebarContainer) {
        return;
    }

    // Load the sidebar HTML and then initialize its functionality.
    fetch('/sidebar.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load sidebar.html');
            }
            return response.text();
        })
        .then(html => {
            sidebarContainer.innerHTML = html;
            initializeSidebar();
        })
        .catch(error => {
            console.error('Error loading sidebar:', error);
            sidebarContainer.innerHTML = '<p>Error loading sidebar.</p>';
        });
});

function initializeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const sidebarToggle = document.getElementById('sidebar-toggle');
    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('id');

    // --- Server Management Category ---
    const serverManagementCategory = document.getElementById('server-management-category');
    const serverLinks = [
        { id: 'server-overview-link', href: 'server.html' },
        { id: 'server-github-link', href: 'github.html' },
        { id: 'server-ai-features-link', href: 'ai_features.html' },
        { id: 'server-stats-link', href: 'server_stats.html' },
        { id: 'server-music-system-link', href: 'music_system.html' }
    ];

    const isServerContextPage = serverLinks.some(link => window.location.pathname.includes(`/${link.href}`));

    if (guildId && isServerContextPage) {
        if (serverManagementCategory) {
            serverManagementCategory.style.display = 'block';
        }

        serverLinks.forEach(linkInfo => {
            const linkElement = document.getElementById(linkInfo.id);
            if (linkElement) {
                linkElement.style.display = 'flex';
                linkElement.href = `${linkInfo.href}?id=${guildId}`;
            }
        });
    }

    // --- Active Page Highlighting ---
    const currentPagePath = window.location.pathname;
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        // Create a URL object to easily get the pathname, ignoring the domain.
        // link.href returns the full URL, e.g., "http://localhost:3000/profile.html"
        const linkPath = new URL(link.href).pathname;
        if (linkPath === currentPagePath) {
            link.classList.add('active');
        }
    });

    // --- Sidebar Toggle Functionality ---
    const updateToggleButton = (isCollapsed) => {
        if (!sidebarToggle) return;
        const toggleIcon = sidebarToggle.querySelector('i');
        const toggleText = sidebarToggle.querySelector('span');

        const applyText = () => {
            if (isCollapsed) {
                toggleIcon.textContent = 'menu';
                if (toggleText && window.i18n) toggleText.textContent = i18n.t('nav_toggle_sidebar_expand');
            } else {
                toggleIcon.textContent = 'menu_open';
                if (toggleText && window.i18n) toggleText.textContent = i18n.t('nav_toggle_sidebar_collapse');
            }
        };

        if (window.i18n && window.i18n.ready) {
            window.i18n.ready.then(applyText);
        } else {
            // Fallback if i18n isn't ready
            toggleIcon.textContent = isCollapsed ? 'menu' : 'menu_open';
        }
    };

    const toggleSidebar = () => {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebar-collapsed', isCollapsed);
        updateToggleButton(isCollapsed);
    };

    const savedState = localStorage.getItem('sidebar-collapsed');
    const isInitiallyCollapsed = savedState === 'true';
    if (isInitiallyCollapsed) {
        sidebar.classList.add('collapsed');
    }
    updateToggleButton(isInitiallyCollapsed);

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // --- Logout Button ---
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            // window.auth.logout is defined in auth.js and handles the full logout flow
            if (window.auth && typeof window.auth.logout === 'function') {
                window.auth.logout();
            } else {
                console.error('Logout function not found.');
                // Fallback redirect
                window.location.href = '/login.html';
            }
        });
    }

    // --- Re-apply translations ---
    // --- Fetch Bot Info ---
    async function fetchBotInfo() {
        try {
            const res = await fetch('/api/bot-info');
            if (!res.ok) throw new Error('Failed to fetch bot info');
            const botInfo = await res.json();

            const botNameHeader = document.getElementById('bot-name-header');
            if (botNameHeader) {
                botNameHeader.textContent = botInfo.name || 'Dashboard';
            }
        } catch (error) {
            console.error('Error fetching bot info:', error);
        }
    }

    // --- Initial Load ---
    fetchBotInfo();

    // --- Re-apply translations ---
    if (window.applyTranslations) {
        window.applyTranslations();
    }
}