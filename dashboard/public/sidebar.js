document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const botName = document.getElementById('bot-name');

    // Function to toggle sidebar
    const toggleSidebar = () => {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebar-collapsed', isCollapsed);
        updateToggleButton(isCollapsed);
    };

    // Function to update toggle button content
    const updateToggleButton = (isCollapsed) => {
        const toggleIcon = sidebarToggle.querySelector('i');
        const toggleText = sidebarToggle.querySelector('span');
        if (isCollapsed) {
            toggleIcon.textContent = 'menu';
            toggleText.textContent = i18n.t('nav_toggle_sidebar_expand');
        } else {
            toggleIcon.textContent = 'menu_open';
            toggleText.textContent = i18n.t('nav_toggle_sidebar_collapse');
        }
    };

    // Check for saved state in localStorage
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState === 'true') {
        sidebar.classList.add('collapsed');
        updateToggleButton(true);
    } else {
        updateToggleButton(false);
    }

    // Add event listener
    sidebarToggle.addEventListener('click', toggleSidebar);

    // Adjust bot name if it's too long for the sidebar
    const adjustBotName = () => {
        if (botName.scrollWidth > sidebar.clientWidth - 40) { // 40px for padding
            botName.style.fontSize = '1.2rem';
        }
    };

    // Initial check and on window resize
    adjustBotName();
    window.addEventListener('resize', adjustBotName);
});