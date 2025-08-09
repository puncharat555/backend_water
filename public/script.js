// ===== script.js (เวอร์ชันใช้กราฟเดียว สลับช่วงเวลาได้: 1h / 1d / 7d / 30d) =====
const fixedDepth = 120;
let allData = [];
let currentIndex = 0;
const pageSize = 10;

let waterLevelChartInstance = null;
let currentChartInstance = null;
let batteryChartInstance = null;

/* HiDPI (คงของเดิม) */
function setupHiDPICanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
}

/* Utils: เวลา + แกนเวลา */
function toDateSafe(str) {
  return str ? new Date(str.replace(' ', 'T')) : null; // "YYYY-MM-DD HH:mm:ss" -> Date
}
function getTimeStep(range) {
  switch (range) {
    case '1h':  return { unit: 'minute', stepSize: 20, tooltip: 'HH:mm' };
    case '1d':  return { unit: 'hour',   stepSize: 4,  tooltip: 'yyyy-MM-dd HH:mm' };
    case '7d':  return { unit: 'hour',   stepSize: 12, tooltip: 'yyyy-MM-dd HH:mm' };
    case '30d': return { unit: 'day',    stepSize: 1,  tooltip: 'yyyy-MM-dd' };
    default:    return { unit: 'hour',   stepSize: 1,  tooltip: 'yyyy-MM-dd HH:mm' };
  }
}

/* ---------- โหลดข้อมูลปัจจุบัน & ตาราง (ของเดิม) ---------- */
async function loadData() {
  try {
    const url = `https://backend-water-rf88.onrender.com/distance?_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    allData = data.filter(item => item.distance > 0);
    currentIndex = 0;

    updateTable(true);
    updateErrorList(data);

    const latest = allData[0];
    if (latest) {
      const level = (fixedDepth - latest.distance).toFixed(1);
      document.getElementById('waterLevelNode1').innerText = `ระดับน้ำปัจจุบัน: ${level} cm`;
      document.getElementById('rssiNode1').innerText   = (latest.rssi_node1 && latest.rssi_node1 !== 0) ? `RSSI: ${latest.rssi_node1}`   : 'RSSI: -';
      document.getElementById('voltageNode1').innerText = (latest.v_node1 && latest.v_node1 > 0) ? `แรงดัน: ${latest.v_node1} V`       : 'แรงดัน: -';
      document.getElementById('currentNode1').innerText = (latest.i_node1 && latest.i_node1 > 0) ? `กระแส: ${latest.i_node1} mA`      : 'กระแส: -';
      document.getElementById('timeNode1').innerText    = latest.time_node1 || 'เวลาวัด: -';

      document.getElementById('rssiNode2').innerText   = (latest.rssi_node2 && latest.rssi_node2 !== 0) ? `RSSI: ${latest.rssi_node2}`   : 'RSSI: -';
      document.getElementById('voltageNode2').innerText = (latest.v_node2 && latest.v_node2 > 0) ? `แรงดัน: ${latest.v_node2} V`       : 'แรงดัน: -';
      document.getElementById('currentNode2').innerText = (latest.i_node2 && latest.i_node2 > 0) ? `กระแส: ${latest.i_node2} mA`      : 'กระแส: -';
      document.getElementById('timeNode2').innerText    = latest.time_node2 || 'เวลาวัด: -';
    }

  } catch (error) {
    console.error('Load data error:', error);
    ['waterLevelNode1','rssiNode1','voltageNode1','currentNode1','timeNode1',
     'rssiNode2','voltageNode2','currentNode2','timeNode2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerText = '-';
    });
    const waterLevelEl = document.getElementById('waterLevelNode1');
    if (waterLevelEl) waterLevelEl.innerText = 'โหลดข้อมูลล้มเหลว';

    const tbody = document.querySelector('#dataTable tbody');
    if (tbody) tbody.innerHTML = '';
    const moreButtonContainer = document.getElementById('moreButtonContainer');
    if (moreButtonContainer) moreButtonContainer.innerHTML = '';
  }
}

function updateTable(clear = false) {
  const tbody = document.querySelector('#dataTable tbody');
  if (!tbody) return;

  if (clear) {
    tbody.innerHTML = '';
    currentIndex = 0;
  }

  const sliceData = allData.slice(currentIndex, currentIndex + pageSize);

  sliceData.forEach(item => {
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

  currentIndex += sliceData.length;
  updateMoreButton();
}

function updateMoreButton() {
  const moreButtonContainer = document.getElementById('moreButtonContainer');
  if (!moreButtonContainer) return;

  moreButtonContainer.innerHTML = '';

  if (currentIndex < allData.length) {
    const btn = document.createElement('button');
    btn.innerText = 'ดูข้อมูลเพิ่มเติม';
    btn.style.padding = '8px 16px';
    btn.style.margin = '10px auto';
    btn.style.display = 'inline-block';
    btn.style.cursor = 'pointer';
    btn.onclick = () => { updateTable(false); };
    moreButtonContainer.appendChild(btn);
  }
}

/* ---------- ประวัติ (ย้อนหลัง) ---------- */
async function fetchHistoricalData(range = '30d') {
  const url = `https://backend-water-rf88.onrender.com/distance?range=${range}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  return data.filter(item => item.distance > 0);
}

/* ---------- กราฟ: ระดับน้ำย้อนหลัง (แคนวาสเดียว) ---------- */
async function createWaterLevelChart(range = '30d') {
  try {
    const data = await fetchHistoricalData(range);
    const points = data
      .map(item => {
        const t = toDateSafe(item.time_node1 || item.time_node2);
        if (!t || !(item.distance > 0)) return null;
        return { x: t, y: Number((fixedDepth - item.distance).toFixed(2)) };
      })
      .filter(Boolean)
      .sort((a, b) => a.x - b.x);

    const labels = points.map(p => p.x);
    const values = points.map(p => p.y);

    const canvas = document.getElementById('waterLevelChart');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (waterLevelChartInstance) waterLevelChartInstance.destroy();

    const step = getTimeStep(range);

    waterLevelChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `ระดับน้ำย้อนหลัง ${range}`,
          data: values,
          borderColor: '#00c0ff',
          backgroundColor: 'rgba(0,192,255,0.2)',
          fill: true,
          tension: 0.3,
          pointRadius: 0
        }],
      },
      options: {
        spanGaps: true,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false },
          decimation: { enabled: true, algorithm: 'lttb', samples: 300 }
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: step.unit, stepSize: step.stepSize, tooltipFormat: step.tooltip },
            ticks: { color: 'white' },
            grid: { drawTicks: false, color: 'rgba(255,255,255,0.1)' }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'ระดับน้ำ (cm)', color: 'white' },
            ticks: { color: 'white' }
          }
        }
      }
    });
  } catch (err) {
    console.error('Error creating water level chart:', err);
  }
}

/* ---------- กราฟ: แบตเตอรี่ (30 วัน, tick รายวัน) ---------- */
async function createBatteryChart() {
  try {
    const data = await fetchHistoricalData('30d');

    const series = data
      .map(item => {
        const t = toDateSafe(item.time_node1 || item.time_node2);
        return {
          t,
          v1: item.v_node1 > 0 ? item.v_node1 : NaN,
          v2: item.v_node2 > 0 ? item.v_node2 : NaN
        };
      })
      .filter(s => s.t)
      .sort((a,b) => a.t - b.t);

    const labels = series.map(s => s.t);
    const v1 = series.map(s => s.v1);
    const v2 = series.map(s => s.v2);

    const canvas = document.getElementById('batteryChart');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (batteryChartInstance) batteryChartInstance.destroy();

    const step = getTimeStep('30d');

    batteryChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'แรงดัน Node 1 (V)', data: v1, borderColor: '#ff7f00', backgroundColor: 'rgba(255,127,0,0.15)', fill: true, tension: 0.3, pointRadius: 0 },
          { label: 'แรงดัน Node 2 (V)', data: v2, borderColor: '#007fff', backgroundColor: 'rgba(0,127,255,0.15)', fill: true, tension: 0.3, pointRadius: 0 }
        ],
      },
      options: {
        spanGaps: true,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false },
          decimation: { enabled: true, algorithm: 'lttb', samples: 300 }
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: step.unit, stepSize: step.stepSize, tooltipFormat: step.tooltip },
            ticks: { color: 'white' },
            grid: { drawTicks: false, color: 'rgba(255,255,255,0.1)' }
          },
          y: {
            beginAtZero: false,
            ticks: { color: 'white' },
            title: { display: true, text: 'แรงดัน (V)', color: 'white' }
          }
        }
      }
    });
  } catch (err) {
    console.error('Error creating battery chart:', err);
  }
}

/* ---------- กราฟ: กระแส (ตามช่วง) ---------- */
async function createCurrentChart(range = '30d') {
  try {
    const data = await fetchHistoricalData(range);

    const series = data
      .map(item => {
        const t = toDateSafe(item.time_node1 || item.time_node2);
        return {
          t,
          i1: item.i_node1 > 0 ? item.i_node1 : NaN,
          i2: item.i_node2 > 0 ? item.i_node2 : NaN
        };
      })
      .filter(s => s.t)
      .sort((a,b) => a.t - b.t);

    const labels = series.map(s => s.t);
    const i1 = series.map(s => s.i1);
    const i2 = series.map(s => s.i2);

    const canvas = document.getElementById('currentChart');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (currentChartInstance) currentChartInstance.destroy();

    const step = getTimeStep(range);

    currentChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'กระแส Node 1 (mA)', data: i1, borderColor: '#ff4500', backgroundColor: 'rgba(255,69,0,0.15)', fill: true, tension: 0.3, pointRadius: 0 },
          { label: 'กระแส Node 2 (mA)', data: i2, borderColor: '#1e90ff', backgroundColor: 'rgba(30,144,255,0.15)', fill: true, tension: 0.3, pointRadius: 0 }
        ],
      },
      options: {
        spanGaps: true,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false },
          decimation: { enabled: true, algorithm: 'lttb', samples: 300 }
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: step.unit, stepSize: step.stepSize, tooltipFormat: step.tooltip },
            ticks: { color: 'white' },
            grid: { drawTicks: false, color: 'rgba(255,255,255,0.1)' }
          },
          y: {
            beginAtZero: false,
            ticks: { color: 'white' },
            title: { display: true, text: 'กระแส (mA)', color: 'white' },
            grid: { color: 'rgba(255,255,255,0.1)' }
          }
        }
      }
    });
  } catch (err) {
    console.error('Error creating current chart:', err);
  }
}

/* ---------- Error box (ของเดิม) ---------- */
function toggleErrorBox() {
  const box = document.getElementById('errorBox');
  if (!box) return;
  box.style.display = (box.style.display === 'none' || box.style.display === '') ? 'block' : 'none';
}

function updateErrorList(data) {
  const box = document.getElementById('errorList');
  if (!box) return;
  box.innerHTML = '';
  data.forEach(item => {
    if (item.distance < 10) {
      const div = document.createElement('div');
      div.innerText = `Warning! ระดับน้ำต่ำเกินไป: ${item.distance.toFixed(1)} cm เวลา: ${item.time_node1}`;
      box.appendChild(div);
    }
  });
}

/* ---------- Init & ปุ่ม ---------- */
async function initDashboard() {
  await loadData();
  await createWaterLevelChart('30d'); // เริ่มต้นที่ 30 วัน
  await createBatteryChart();
  await createCurrentChart('30d');
}

function setupRangeButtons() {
  const waterLevelButtons = document.querySelectorAll('#timeRangeButtons .range-btn');
  waterLevelButtons.forEach(button => {
    button.addEventListener('click', async () => {
      waterLevelButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const range = button.getAttribute('data-range'); // 1h / 1d / 7d / 30d
      await createWaterLevelChart(range);   // ใช้แคนวาสเดียว
      await createCurrentChart(range);      // ให้กราฟกระแสตามช่วงเดียวกัน
    });
  });

  const currentButtons = document.querySelectorAll('#currentTimeRangeButtons .range-btn');
  currentButtons.forEach(button => {
    button.addEventListener('click', async () => {
      currentButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const range = button.getAttribute('data-range');
      await createCurrentChart(range);
    });
  });
}

window.onload = async () => {
  await initDashboard();
  setupRangeButtons();
};
setInterval(() => { loadData(); }, 60000);
