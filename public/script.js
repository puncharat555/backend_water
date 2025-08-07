const fixedDepth = 120;

let waterLevelChart, batteryChartNode1;

function createCharts() {
  const ctxWater = document.getElementById('waterLevelChart').getContext('2d');
  const ctxBattery = document.getElementById('batteryChartNode1').getContext('2d');

  waterLevelChart = new Chart(ctxWater, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'ระดับน้ำ (cm)',
        data: [],
        borderColor: 'rgba(54, 162, 235, 0.9)',
        backgroundColor: 'rgba(54, 162, 235, 0.3)',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 3,
        hoverBorderWidth: 4,
      }]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      animation: {
        duration: 800,
        easing: 'easeOutQuart'
      },
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'HH:mm:ss',
            displayFormats: {
              second: 'HH:mm:ss',
              minute: 'HH:mm',
              hour: 'HH:mm',
            }
          },
          title: {
            display: true,
            text: 'เวลา',
            color: '#aaa',
            font: { size: 14, weight: 'bold' }
          },
          ticks: {
            color: '#ddd',
          },
          grid: {
            color: 'rgba(255,255,255,0.1)',
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'ระดับน้ำ (cm)',
            color: '#aaa',
            font: { size: 14, weight: 'bold' }
          },
          ticks: {
            color: '#ddd',
            stepSize: 5,
          },
          grid: {
            color: 'rgba(255,255,255,0.1)',
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#eee',
            font: { size: 14, weight: 'bold' }
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleFont: { size: 16, weight: 'bold' },
          bodyFont: { size: 14 },
          callbacks: {
            label: ctx => `${ctx.parsed.y} cm`
          }
        }
      }
    }
  });

  batteryChartNode1 = new Chart(ctxBattery, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'แรงดันแบตเตอรี่ Node1 (V)',
        data: [],
        borderColor: 'rgba(255, 206, 86, 0.9)',
        backgroundColor: 'rgba(255, 206, 86, 0.3)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 3,
        hoverBorderWidth: 4,
      }]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      animation: {
        duration: 800,
        easing: 'easeOutQuart'
      },
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'HH:mm:ss',
            displayFormats: {
              second: 'HH:mm:ss',
              minute: 'HH:mm',
              hour: 'HH:mm',
            }
          },
          title: {
            display: true,
            text: 'เวลา',
            color: '#aaa',
            font: { size: 14, weight: 'bold' }
          },
          ticks: {
            color: '#ddd',
          },
          grid: {
            color: 'rgba(255,255,255,0.1)',
          }
        },
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: 'แรงดัน (V)',
            color: '#aaa',
            font: { size: 14, weight: 'bold' }
          },
          ticks: {
            color: '#ddd',
            stepSize: 0.1,
          },
          grid: {
            color: 'rgba(255,255,255,0.1)',
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#eee',
            font: { size: 14, weight: 'bold' }
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleFont: { size: 16, weight: 'bold' },
          bodyFont: { size: 14 },
          callbacks: {
            label: ctx => `${ctx.parsed.y} V`
          }
        }
      }
    }
  });
}

function updateCharts(data) {
  if (!waterLevelChart || !batteryChartNode1) createCharts();

  const labels = [];
  const waterLevels = [];
  const batteryVoltages = [];

  data.slice(0, 50).reverse().forEach(item => {
    const time = item.time_node1 ? new Date(item.time_node1) : new Date(item.timestamp);
    labels.push(time);
    waterLevels.push(item.distance > 0 ? (fixedDepth - item.distance).toFixed(1) : null);
    batteryVoltages.push(item.v_node1 || null);
  });

  waterLevelChart.data.labels = labels;
  waterLevelChart.data.datasets[0].data = waterLevels;
  waterLevelChart.update();

  batteryChartNode1.data.labels = labels;
  batteryChartNode1.data.datasets[0].data = batteryVoltages;
  batteryChartNode1.update();
}

async function loadData() {
  try {
    const url = `https://backend-water-rf88.onrender.com/distance?_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    console.log('Data from API:', data);

    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';

    data.forEach(item => {
      const level = (fixedDepth - item.distance).toFixed(1);
      const distanceRaw = item.distance > 0 ? item.distance.toFixed(1) : '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${distanceRaw}</td>
        <td>${item.distance > 0 ? level : '-'}</td>
        <td>${item.rssi_node1 !== undefined ? item.rssi_node1 : '-'}</td>
        <td>${item.rssi_node2 !== undefined ? item.rssi_node2 : '-'}</td>
        <td>${item.v_node1 !== undefined ? item.v_node1 + ' V' : '-'}</td>
        <td>${item.i_node1 !== undefined ? item.i_node1 + ' mA' : '-'}</td>
        <td>${item.v_node2 !== undefined ? item.v_node2 + ' V' : '-'}</td>
        <td>${item.i_node2 !== undefined ? item.i_node2 + ' mA' : '-'}</td>
        <td>${item.time_node1 || '-'}</td>
        <td>${item.time_node2 || '-'}</td>
      `;
      tbody.appendChild(tr);
    });

    const latest = data[0];
    if (latest) {
      const level = (fixedDepth - latest.distance).toFixed(1);

      document.getElementById('waterLevelNode1').innerText =
        latest.distance > 0 ? `ระดับน้ำ: ${level} cm` : 'ระดับน้ำ: -';

      document.getElementById('rssiNode1').innerText =
        latest.rssi_node1 !== undefined ? `RSSI: ${latest.rssi_node1}` : 'RSSI: -';

      document.getElementById('voltageNode1').innerText =
        latest.v_node1 !== undefined ? `แรงดัน: ${latest.v_node1} V` : 'แรงดัน: -';

      document.getElementById('currentNode1').innerText =
        latest.i_node1 !== undefined ? `กระแส: ${latest.i_node1} mA` : 'กระแส: -';

      document.getElementById('timeNode1').innerText =
        latest.time_node1 || 'เวลาวัด: -';

      document.getElementById('rssiNode2').innerText =
        latest.rssi_node2 !== undefined ? `RSSI: ${latest.rssi_node2}` : 'RSSI: -';

      document.getElementById('voltageNode2').innerText =
        latest.v_node2 !== undefined ? `แรงดัน: ${latest.v_node2} V` : 'แรงดัน: -';

      document.getElementById('currentNode2').innerText =
        latest.i_node2 !== undefined ? `กระแส: ${latest.i_node2} mA` : 'กระแส: -';

      document.getElementById('timeNode2').innerText =
        latest.time_node2 || 'เวลาวัด: -';
    }

    updateCharts(data);

  } catch (error) {
    console.error('Load data error:', error);

    ['waterLevelNode1', 'rssiNode1', 'voltageNode1', 'currentNode1', 'timeNode1',
     'rssiNode2', 'voltageNode2', 'currentNode2', 'timeNode2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerText = '-';
    });

    const waterLevelEl = document.getElementById('waterLevelNode1');
    if (waterLevelEl) waterLevelEl.innerText = 'โหลดข้อมูลล้มเหลว';
  }
}

loadData();
setInterval(loadData, 5000);
