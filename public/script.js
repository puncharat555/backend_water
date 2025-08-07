const fixedDepth = 120;

// โหลดข้อมูลปัจจุบันแสดงใน node และตาราง
async function loadData() {
  try {
    const url = `https://backend-water-rf88.onrender.com/distance?_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

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

// โหลดข้อมูลย้อนหลัง (สมมติ API รองรับ ?range=30d หรือ 1h)
async function fetchHistoricalData(range = '30d') {
  const url = `https://backend-water-rf88.onrender.com/distance?range=${range}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  return data;
}

// แปลงข้อมูลสำหรับกราฟ
function parseChartData(data) {
  const labels = [];
  const waterLevels = [];
  const voltagesNode1 = [];
  const voltagesNode2 = [];

  data.forEach(item => {
    const timeLabel = item.time_node1 || item.time_node2 || '';
    labels.push(timeLabel);

    const level = item.distance > 0 ? (120 - item.distance).toFixed(2) : null;
    waterLevels.push(level);

    voltagesNode1.push(item.v_node1 || null);
    voltagesNode2.push(item.v_node2 || null);
  });

  return { labels, waterLevels, voltagesNode1, voltagesNode2 };
}

async function createCharts() {
  try {
    const data30d = await fetchHistoricalData('30d');
    const data1h = await fetchHistoricalData('1h');

    const parsed30d = parseChartData(data30d);
    const parsed1h = parseChartData(data1h);

    // กราฟระดับน้ำ 30 วัน
    const ctx30d = document.getElementById('waterLevelChart30d').getContext('2d');
    new Chart(ctx30d, {
      type: 'line',
      data: {
        labels: parsed30d.labels,
        datasets: [{
          label: 'ระดับน้ำ (cm)',
          data: parsed30d.waterLevels,
          borderColor: '#00c0ff',
          backgroundColor: 'rgba(0,192,255,0.2)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        }],
      },
      options: {
        scales: {
          x: { 
            ticks: { color: 'white', maxRotation: 45, minRotation: 30 },
            title: { display: true, text: 'เวลา', color: 'white' }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'ระดับน้ำ (cm)', color: 'white' },
            ticks: { color: 'white' }
          }
        },
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false }
        },
        responsive: true,
        maintainAspectRatio: false,
      }
    });

    // กราฟระดับน้ำ 1 ชั่วโมง
    const ctx1h = document.getElementById('waterLevelChart1h').getContext('2d');
    new Chart(ctx1h, {
      type: 'line',
      data: {
        labels: parsed1h.labels,
        datasets: [{
          label: 'ระดับน้ำ (cm)',
          data: parsed1h.waterLevels,
          borderColor: '#0f0',
          backgroundColor: 'rgba(0,255,0,0.2)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        }],
      },
      options: {
        scales: {
          x: { ticks: { color: 'white' }, title: { display: true, text: 'เวลา', color: 'white' } },
          y: { beginAtZero: true, ticks: { color: 'white' } }
        },
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false }
        },
        responsive: true,
        maintainAspectRatio: false,
      }
    });

    // กราฟแรงดันแบตเตอรี่ Node 1 และ Node 2 (30 วัน)
    const ctxBattery = document.getElementById('batteryChart').getContext('2d');
    new Chart(ctxBattery, {
      type: 'line',
      data: {
        labels: parsed30d.labels,
        datasets: [
          {
            label: 'แรงดัน Node 1 (V)',
            data: parsed30d.voltagesNode1,
            borderColor: '#ff7f00',
            backgroundColor: 'rgba(255,127,0,0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: 'แรงดัน Node 2 (V)',
            data: parsed30d.voltagesNode2,
            borderColor: '#007fff',
            backgroundColor: 'rgba(0,127,255,0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
          }
        ],
      },
      options: {
        scales: {
          x: { ticks: { color: 'white' }, title: { display: true, text: 'เวลา', color: 'white' } },
          y: { beginAtZero: false, ticks: { color: 'white' }, title: { display: true, text: 'แรงดัน (V)', color: 'white' } }
        },
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false }
        },
        responsive: true,
        maintainAspectRatio: false,
      }
    });

  } catch(err) {
    console.error('Error creating charts:', err);
  }
}

// โหลดข้อมูลทุก 5 วินาที
loadData();
setInterval(loadData, 5000);

// สร้างกราฟตอนโหลดหน้าเว็บ
createCharts();
