document.addEventListener('DOMContentLoaded', async () => {
    // Wait for the i18n promise to resolve
    if (window.i18n) {
        await window.i18n.ready;
    }

    const totalCommandsElement = document.getElementById('total-commands');
    const chartCanvas = document.getElementById('command-chart').getContext('2d');
    let commandChart = null;

    function handleAuthError(response) {
        if (response.status === 401) {
            window.location.href = '/login.html';
            return true;
        }
        return false;
    }

    async function fetchStats() {
        try {
            const response = await fetch('/api/stats');

            if (handleAuthError(response)) return;

            const stats = await response.json();

            if (totalCommandsElement) {
                totalCommandsElement.textContent = stats.totalCommands;
            }

            if (stats.commandUsage && chartCanvas) {
                const labels = stats.commandUsage.map(cmd => cmd.commandName);
                const data = stats.commandUsage.map(cmd => cmd.count);

                const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '0, 255, 0';
                const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#888888';
                const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || 'rgba(255, 255, 255, 0.1)';


                if (commandChart) {
                    commandChart.destroy();
                }

                commandChart = new Chart(chartCanvas, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: i18n.t('dashboard_stats_command_usage'),
                            data: data,
                            backgroundColor: `rgba(${accentRgb}, 0.6)`,
                            borderColor: `rgba(${accentRgb}, 1)`,
                            borderWidth: 1,
                            borderRadius: 5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { color: textColor },
                                grid: { color: borderColor }
                            },
                            x: {
                                ticks: { color: textColor },
                                grid: { color: 'transparent' }
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

    fetchStats();
});