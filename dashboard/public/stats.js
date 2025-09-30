document.addEventListener('DOMContentLoaded', () => {
    const totalCommandsElement = document.getElementById('total-commands');
    const chartCanvas = document.getElementById('command-chart').getContext('2d');
    let commandChart = null;

    function handleAuthError(response) {
        if (response.status === 401) {
            localStorage.removeItem('dashboard-token');
            window.location.href = '/login.html';
            return true;
        }
        return false;
    }

    async function fetchStats() {
        try {
            const token = localStorage.getItem('dashboard-token');
            if (!token) {
                window.location.href = '/login.html';
                return;
            }

            const response = await fetch('/api/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (handleAuthError(response)) return;

            const stats = await response.json();

            if (totalCommandsElement) {
                totalCommandsElement.textContent = stats.totalCommands;
            }

            if (stats.commandUsage && chartCanvas) {
                const labels = stats.commandUsage.map(cmd => cmd.commandName); // Corrected from cmd._id
                const data = stats.commandUsage.map(cmd => cmd.count);

                const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();

                if (commandChart) {
                    commandChart.destroy();
                }

                commandChart = new Chart(chartCanvas, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Command Usage', // This will be translated by i18n if key is set
                            data: data,
                            backgroundColor: `rgba(${accentColor}, 0.6)`,
                            borderColor: `rgba(${accentColor}, 1)`,
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { color: 'var(--text-secondary)' },
                                grid: { color: 'var(--border-color)' }
                            },
                            x: {
                                ticks: { color: 'var(--text-secondary)' },
                                grid: { color: 'var(--border-color)' }
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        }
                    }
                });
            }

        } catch (error) {
            console.error('Failed to fetch or render stats:', error);
            if (totalCommandsElement) {
                totalCommandsElement.textContent = 'Error';
            }
        }
    }

    // We need to ensure translations are loaded before fetching stats that use them
    // A simple timeout can work for this, or a more robust event-based system.
    // For now, let's assume translator.js handles this or we call it after a delay.
    setTimeout(fetchStats, 200); // Give translator a moment to load
});