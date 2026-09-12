// Configuration for Chart.js Defaults
Chart.defaults.color = '#9CA3AF';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';

// Chart Instances
let memoryChart, latencyChart, qualityChart;

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
});

async function fetchData() {
    try {
        const response = await fetch('/api/compare');
        const data = await response.json();
        
        if (data.status === 'success' || data.status === 'mock') {
            document.getElementById('connection-status').textContent = data.status === 'mock' ? 'Demo Mode' : 'Connected';
            document.getElementById('connection-status').style.color = '#10B981';
            
            updateDashboard(data.data);
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        document.getElementById('connection-status').textContent = 'Error fetching data';
        document.getElementById('connection-status').style.color = '#F43F5E';
        console.error('Failed to fetch compare data:', error);
    }
}

function updateDashboard(rows) {
    // Process Data
    const labels = [];
    const memoryData = [];
    const latencyData = [];
    const qualityData = [];
    
    let fp16_memory = 16.0;
    let bestLatency = Infinity;
    let maxCompression = 1;
    let quality4bit = "--";

    rows.forEach(row => {
        // Pretty labels
        const nameMap = {
            'fp_passthrough': 'FP16 Baseline',
            'har_fixed': '4-bit HAR',
            'har_fixed_4bit': '4-bit HAR',
            'har_fixed_3bit': '3-bit HAR',
            'har_fixed_2bit': '2-bit HAR'
        };
        const label = nameMap[row.strategy] || row.strategy;
        labels.push(label);
        
        const bits = row.avg_bits_per_dim || 16.0;
        memoryData.push(bits);
        if (row.strategy === 'fp_passthrough') fp16_memory = bits;
        else {
            const compression = fp16_memory / bits;
            if (compression > maxCompression) maxCompression = compression;
        }

        const latency = row.avg_latency_us || 0;
        latencyData.push(latency);
        
        const throughput = row.n_tokens / (row.wall_time_ms / 1000);
        if (row.wall_time_ms > 0 && throughput > 0 && row.wall_time_ms < bestLatency) {
            bestLatency = throughput;
        }

        const quality = row.avg_quality || 0;
        qualityData.push(quality);
        
        if (row.strategy.includes('4bit') || row.strategy === 'har_fixed') {
            quality4bit = quality.toFixed(3);
        }
    });

    // Update KPI Cards
    animateValue("val-compression", 1, maxCompression, 1000, "x");
    animateValue("val-throughput", 0, bestLatency === Infinity ? 0 : Math.round(bestLatency), 1000, "");
    document.getElementById("val-quality").textContent = quality4bit;

    // Render Charts
    renderMemoryChart(labels, memoryData);
    renderLatencyChart(labels, latencyData);
    renderQualityChart(labels, qualityData);
}

function renderMemoryChart(labels, data) {
    const ctx = document.getElementById('memoryChart').getContext('2d');
    
    if (memoryChart) memoryChart.destroy();
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.8)'); // Purple
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.1)');
    
    memoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Bits per Dimension',
                data: data,
                backgroundColor: gradient,
                borderColor: '#8B5CF6',
                borderWidth: 1,
                borderRadius: 8,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, max: 18 }
            },
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            }
        }
    });
}

function renderLatencyChart(labels, data) {
    const ctx = document.getElementById('latencyChart').getContext('2d');
    
    if (latencyChart) latencyChart.destroy();
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.8)'); // Cyan
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
    
    latencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Latency (µs)',
                data: data,
                backgroundColor: gradient,
                borderColor: '#06B6D4',
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#06B6D4',
                pointRadius: 5,
                pointHoverRadius: 8,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            },
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            }
        }
    });
}

function renderQualityChart(labels, data) {
    const ctx = document.getElementById('qualityChart').getContext('2d');
    
    if (qualityChart) qualityChart.destroy();
    
    qualityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cosine Similarity',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.6)', // Emerald
                borderColor: '#10B981',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bar chart
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.raw.toFixed(4);
                        }
                    }
                }
            },
            scales: {
                x: { min: 0.5, max: 1.0 }
            },
            animation: {
                duration: 1500,
                delay: 500,
                easing: 'easeOutQuart'
            }
        }
    });
}

// Utility to animate numbers counting up
function animateValue(id, start, end, duration, suffix) {
    if (start === end) return;
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // Easing out
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = start + easeOut * (end - start);
        obj.innerHTML = (Number.isInteger(end) ? Math.floor(current) : current.toFixed(1)) + suffix;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
