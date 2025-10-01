document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // The sidebar should only be visible on the server management page.
    const isServerPage = window.location.pathname.includes('/server.html');

    if (!isServerPage) {
        sidebar.style.display = 'none';
        return; // Do not initialize sidebar logic on other pages.
    }

    const sidebarToggle = document.getElementById('sidebar-toggle');

    // Function to toggle sidebar
    const toggleSidebar = () => {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebar-collapsed', isCollapsed);
        // Defer button update until i18n is ready, if available
        if (window.i18n && window.i18n.ready) {
            window.i18n.ready.then(() => updateToggleButton(isCollapsed));
        } else {
            updateToggleButton(isCollapsed);
        }
    };

    // Function to update toggle button content
    const updateToggleButton = (isCollapsed) => {
        if (!sidebarToggle) return;
        const toggleIcon = sidebarToggle.querySelector('i');
        const toggleText = sidebarToggle.querySelector('span');

        try {
            if (isCollapsed) {
                toggleIcon.textContent = 'menu';
                if (toggleText && window.i18n) toggleText.textContent = i18n.t('nav_toggle_sidebar_expand');
            } else {
                toggleIcon.textContent = 'menu_open';
                if (toggleText && window.i18n) toggleText.textContent = i18n.t('nav_toggle_sidebar_collapse');
            }
        } catch (e) {
            // This can happen if i18n is not ready. The text will be updated once it is.
            console.warn("Could not set toggle button text, i18n may not be ready.", e);
        }
    };

    // Check for saved state in localStorage and initialize
    const savedState = localStorage.getItem('sidebar-collapsed');
    const isInitiallyCollapsed = savedState === 'true';
    if (isInitiallyCollapsed) {
        sidebar.classList.add('collapsed');
    }

    // Update button text after i18n is ready
    if (window.i18n && window.i18n.ready) {
        window.i18n.ready.then(() => updateToggleButton(isInitiallyCollapsed));
    } else {
        // Fallback if i18n is not used on the page
        updateToggleButton(isInitiallyCollapsed);
    }

    // Add event listener
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Adjust bot name if it's too long for the sidebar
    const adjustBotName = () => {
        // The h1 element may not have an ID, let's select it by tag inside the header
        const botNameElement = sidebar.querySelector('.sidebar-header h1');
        if (botNameElement && botNameElement.scrollWidth > sidebar.clientWidth - 40) { // 40px for padding
            botNameElement.style.fontSize = '1.2rem';
        }
    };

    // Initial check and on window resize
    adjustBotName();
    window.addEventListener('resize', adjustBotName);
});