const fixedDepth = 120; // ความลึกตายตัว

// ฟังก์ชันช่วยแสดงค่าหากเป็น 0 หรือ undefined ให้แสดง "-"
function displayValue(val, unit = '') {
  if (val === undefined || val === null || val === 0) {
    return '-';
  }
  return `${val} ${unit}`.trim();
}

let waterLevelChart, waterLevelChart1h, batteryChart;

async function loadData() {
  try {
    const url = `https://backend-water-rf88.onrender.com/distance?_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    // console.log('Data from API:', data);

    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';

    data.forEach(item => {
      const level = (fixedDepth - item.distance).toFixed(1);
      const distanceRaw = (item.distance && item.distance !== 0) ? item.distance.toFixed(1) : '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${distanceRaw}</td>
        <td>${item.distance > 0 ? level : '-'}</td>
        <td>${item.rssi_node1 !== undefined && item.rssi_node1 !== 0 ? item.rssi_node1 : '-'}</td>
        <td>${item.rssi_node2 !== undefined && item.rssi_node2 !== 0 ? item.rssi_node2 : '-'}</td>
        <td>${item.v_node1 !== undefined && item.v_node1 !== 0 ? item.v_node1 + ' V' : '-'}</td>
        <td>${item.i_node1 !== undefined && item.i_node1 !== 0 ? item.i_node1 + ' mA' : '-'}</td>
        <td>${item.v_node2 !== undefined && item.v_node2 !== 0 ? item.v_node2 + ' V' : '-'}</td>
        <td>${item.i_node2 !== undefined && item.i_node2 !== 0 ? item.i_node2 + ' mA' : '-'}</td>
        <td>${item.time_node1 || '-'}</td>
        <td>${item.time_node2 || '-'}</td>
      `;
      tbody.appendChild(tr);
    });

    const latest = data[0];
    if (latest) {
      const level = (fixedDepth - latest.distance).toFixed(1);

      document.getElementById('waterLevelNode1').innerText =
        (latest.distance && latest.distance !== 0) ? `ระดับน้ำ: ${level} cm` : 'ระดับน้ำ: -';

      document.getElementById('rssiNode1').innerText =
        'RSSI: ' + displayValue(latest.rssi_node1);

      document.getElementById('voltageNode1').innerText =
        'แรงดัน: ' + displayValue(latest.v_node1, 'V');

      document.getElementById('currentNode1').innerText =
        'กระแส: ' + displayValue(latest.i_node1, 'mA');

      document.getElementById('timeNode1').innerText =
        latest.time_node1 || 'เวลาวัด: -';

      document.getElementById('rssiNode2').innerText =
        'RSSI: ' + displayValue(latest.rssi_node2);

      document.getElementById('voltageNode2').innerText =
        'แรงดัน: ' + displayValue(latest.v_node2, 'V');

      document.getElementById('currentNode2').innerText =
        'กระแส: ' + displayValue(latest.i_node2, 'mA');

      document.getElementById('timeNode2').innerText =
        latest.time_node2 || 'เวลาวัด: -';
    }

    updateCharts(data);

  } catch (error) {
    // ถ้าจะซ่อน error log ให้คอมเมนต์บรรทัดนี้
    // console.error('Load data error:', error);

    ['waterLevelNode1', 'rssiNode1', 'voltageNode1', 'currentNode1', 'timeNode1',
     'rssiNode2', 'voltageNode2', 'currentNode2', 'timeNode2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerText = '-';
    });

    const waterLevelEl = document.getElementById('waterLevelNode1');
    if (waterLevelEl) waterLevelEl.innerText = '-';
  }
}

// สร้างและอัพเดตกราฟ
function updateCharts(data) {
  // เตรียมข้อมูลกราฟย้อนหลัง 30 วัน (สมมติข้อมูลล่าสุด 100 รายการแทน)
  const labels30d = data.slice().reverse().map(item => item.time_node1 || '');
  const waterLevels30d = data.slice().reverse().map(item =>
    (item.distance && item.distance !== 0) ? (fixedDepth - item.distance).toFixed(1) : null
  );

  // กราฟย้อนหลัง 1 ชั่วโมง (สมมติข้อมูล 12 รายการหลังสุด)
  const recent1h = data.slice(0, 12).reverse();
  const labels1h = recent1h.map(item => item.time_node1 || '');
  const waterLevels1h = recent1h.map(item =>
    (item.distance && item.distance !== 0) ? (fixedDepth - item.distance).toFixed(1) : null
  );

  // กราฟแบตเตอรี่ (เอาแรงดัน node1 สมมติแทน)
  const batteryLevels = data.slice().reverse().map(item =>
    (item.v_node1 && item.v_node1 !== 0) ? item.v_node1 : null
  );

  // สร้างกราฟถ้ายังไม่มี หรืออัพเดตถ้ามีแล้ว
  if (!waterLevelChart) {
    waterLevelChart = new Chart(document.getElementById('waterLevelChart'), {
      type: 'line',
      data: {
        labels: labels30d,
        datasets: [{
          label: 'ระดับน้ำ (cm)',
          data: waterLevels30d,
          borderColor: '#00bfff',
          backgroundColor: 'rgba(0,191,255,0.2)',
          fill: true,
          tension: 0.3,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: {
            ticks: { display: false },
            grid: { drawTicks: false }
          },
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: { labels: { color: 'white' } }
        }
      }
    });
  } else {
    waterLevelChart.data.labels = labels30d;
    waterLevelChart.data.datasets[0].data = waterLevels30d;
    waterLevelChart.update();
  }

  if (!waterLevelChart1h) {
    waterLevelChart1h = new Chart(document.getElementById('waterLevelChart1h'), {
      type: 'line',
      data: {
        labels: labels1h,
        datasets: [{
          label: 'ระดับน้ำ 1 ชั่วโมง (cm)',
          data: waterLevels1h,
          borderColor: '#00ff7f',
          backgroundColor: 'rgba(0,255,127,0.2)',
          fill: true,
          tension: 0.3,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: {
            ticks: { display: false },
            grid: { drawTicks: false }
          },
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: { labels: { color: 'white' } }
        }
      }
    });
  } else {
    waterLevelChart1h.data.labels = labels1h;
    waterLevelChart1h.data.datasets[0].data = waterLevels1h;
    waterLevelChart1h.update();
  }

  if (!batteryChart) {
    batteryChart = new Chart(document.getElementById('batteryChart'), {
      type: 'line',
      data: {
        labels: labels30d,
        datasets: [{
          label: 'แรงดันแบตเตอรี่ Node1 (V)',
          data: batteryLevels,
          borderColor: '#ffa500',
          backgroundColor: 'rgba(255,165,0,0.2)',
          fill: true,
          tension: 0.3,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: {
            ticks: { display: false },
            grid: { drawTicks: false }
          },
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: { labels: { color: 'white' } }
        }
      }
    });
  } else {
    batteryChart.data.labels = labels30d;
    batteryChart.data.datasets[0].data = batteryLevels;
    batteryChart.update();
  }
}

// เริ่มโหลดข้อมูลและอัพเดตทุก 5 วินาที
loadData();
setInterval(loadData, 5000);
