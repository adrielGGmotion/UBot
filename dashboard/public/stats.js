document.addEventListener('DOMContentLoaded', () => {
    const totalCommandsElement = document.getElementById('total-commands');
    const chartCanvas = document.getElementById('command-chart').getContext('2d');
    let commandChart = null;

    async function fetchStats() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();

            totalCommandsElement.textContent = stats.totalCommands;
            
            // Prepara os dados para o gráfico
            const labels = stats.commandUsage.map(cmd => cmd._id);
            const data = stats.commandUsage.map(cmd => cmd.count);

            // Cria ou atualiza o gráfico
            if (commandChart) {
                commandChart.destroy(); // Destrói o gráfico antigo para criar um novo
            }
            
            commandChart = new Chart(chartCanvas, {
                type: 'bar', // Tipo do gráfico (barras)
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Vezes Utilizado',
                        data: data,
                        backgroundColor: 'rgba(153, 0, 255, 0.6)', // Cor das barras (accent1 com transparência)
                        borderColor: 'rgba(153, 0, 255, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    },
                    plugins: {
                        legend: {
                            display: false // Esconde a legenda para um visual mais limpo
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Failed to fetch stats:', error);
            totalCommandsElement.textContent = 'Erro';
        }
    }

    fetchStats();
});