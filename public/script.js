const fixedDepth = 120;

// โหลดข้อมูลปัจจุบันแสดงใน node และตาราง
async function loadData() {
  try {
    const url = `https://backend-water-rf88.onrender.com/distance?_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';

    // กรองข้อมูล distance > 0 เท่านั้น
    const filteredData = data.filter(item => item.distance > 0);

    filteredData.forEach(item => {
      const level = (fixedDepth - item.distance).toFixed(1);
      const distanceRaw = item.distance.toFixed(1);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${distanceRaw}</td>
        <td>${level}</td>
        <td>${(item.rssi_node1 && item.rssi_node1 !== 0) ? item.rssi_node1 : '-'}</td>
        <td>${(item.rssi_node2 && item.rssi_node2 !== 0) ? item.rssi_node2 : '-'}</td>
        <td>${(item.v_node1 && item.v_node1 > 0) ? item.v_node1 + ' V' : '-'}</td>
        <td>${(item.i_node1 && item.i_node1 > 0) ? item.i_node1 + ' mA' : '-'}</td>
        <td>${(item.v_node2 && item.v_node2 > 0) ? item.v_node2 + ' V' : '-'}</td>
        <td>${(item.i_node2 && item.i_node2 > 0) ? item.i_node2 + ' mA' : '-'}</td>
        <td>${item.time_node1 || '-'}</td>
        <td>${item.time_node2 || '-'}</td>
      `;
      tbody.appendChild(tr);
    });

    // อัปเดตกล่อง error
    updateErrorList(data);

    const latest = filteredData[0];
    if (latest) {
      const level = (fixedDepth - latest.distance).toFixed(1);

      document.getElementById('waterLevelNode1').innerText = `ระดับน้ำ: ${level} cm`;
      document.getElementById('rssiNode1').innerText = (latest.rssi_node1 && latest.rssi_node1 !== 0) ? `RSSI: ${latest.rssi_node1}` : 'RSSI: -';
      document.getElementById('voltageNode1').innerText = (latest.v_node1 && latest.v_node1 > 0) ? `แรงดัน: ${latest.v_node1} V` : 'แรงดัน: -';
      document.getElementById('currentNode1').innerText = (latest.i_node1 && latest.i_node1 > 0) ? `กระแส: ${latest.i_node1} mA` : 'กระแส: -';
      document.getElementById('timeNode1').innerText = latest.time_node1 || 'เวลาวัด: -';

      document.getElementById('rssiNode2').innerText = (latest.rssi_node2 && latest.rssi_node2 !== 0) ? `RSSI: ${latest.rssi_node2}` : 'RSSI: -';
      document.getElementById('voltageNode2').innerText = (latest.v_node2 && latest.v_node2 > 0) ? `แรงดัน: ${latest.v_node2} V` : 'แรงดัน: -';
      document.getElementById('currentNode2').innerText = (latest.i_node2 && latest.i_node2 > 0) ? `กระแส: ${latest.i_node2} mA` : 'กระแส: -';
      document.getElementById('timeNode2').innerText = latest.time_node2 || 'เวลาวัด: -';
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

// โหลดข้อมูลย้อนหลัง
async function fetchHistoricalData(range = '30d') {
  const url = `https://backend-water-rf88.onrender.com/distance?range=${range}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  return data.filter(item => item.distance > 0);
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

    const level = (item.distance && item.distance > 0) ? Number((fixedDepth - item.distance).toFixed(2)) : NaN;
    waterLevels.push(level);

    voltagesNode1.push(item.v_node1 > 0 ? item.v_node1 : NaN);
    voltagesNode2.push(item.v_node2 > 0 ? item.v_node2 : NaN);
  });

  return { labels, waterLevels, voltagesNode1, voltagesNode2 };
}

async function createCharts() {
  try {
    const data30d = await fetchHistoricalData('30d');
    const data1h = await fetchHistoricalData('1h');

    const parsed30d = parseChartData(data30d);
    const parsed1h = parseChartData(data1h);

    // Chart 30d
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
        spanGaps: true,
        scales: {
          x: { ticks: { display: false }, grid: { drawTicks: false } },
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
        maintainAspectRatio: true,
      }
    });

    // Chart 1h
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
        spanGaps: true,
        scales: {
          x: { ticks: { display: false }, grid: { drawTicks: false } },
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

    // Battery chart
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
        spanGaps: true,
        scales: {
          x: { ticks: { display: false }, grid: { drawTicks: false } },
          y: {
            beginAtZero: false,
            ticks: { color: 'white' },
            title: { display: true, text: 'แรงดัน (V)', color: 'white' }
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

  } catch (err) {
    console.error('Error creating charts:', err);
  }
}

// ฟังก์ชัน toggle เพื่อเปิด/ปิด error box
function toggleErrorBox() {
  const errorBox = document.getElementById('errorBox');
  if (!errorBox) return;
  errorBox.classList.toggle('hidden');
}

// ฟังก์ชันอัปเดตรายการ error (เช่นข้อมูลที่ผิดปกติ)
function updateErrorList(data) {
  const errorList = document.getElementById('errorList');
  if (!errorList) return;

  // ตัวอย่าง: กรองข้อมูลที่มี distance <= 0
  const errorItems = data.filter(item => item.distance <= 0);

  if (errorItems.length === 0) {
    errorList.innerHTML = '<li>ไม่มีข้อมูลผิดปกติ</li>';
  } else {
    errorList.innerHTML = '';
    errorItems.forEach((item, i) => {
      const li = document.createElement('li');
      li.textContent = `แถวที่ ${i + 1}: ระดับน้ำดิบ = ${item.distance}`;
      errorList.appendChild(li);
    });
  }
}

// เริ่มโหลดข้อมูล และตั้ง interval
loadData();
setInterval(loadData, 5000);

// สร้างกราฟตอนโหลดหน้า
createCharts();
