// ==============================
// Water Level Monitoring - script.js (rev: pretty charts + battery range buttons + default 1d)
// ==============================

// ---- Config + State ----
const fixedDepth = 120;
let allData = [];
let currentIndex = 0;
const pageSize = 10;

let waterLevelChartInstance = null;
let currentChartInstance = null;
let batteryChartInstance = null;
let oneHourChartInstance = null;

// ---- HiDPI Canvas ----
function setupHiDPICanvas(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  ctx.scale(dpr, dpr);
}

// ==============================
// Chart Look & Feel Helpers
// ==============================

function hexToRgba(hex, alpha = 1) {
  // supports #rgb, #rrggbb
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(ch => ch + ch).join('');
  }
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function makeGradient(ctx, color) {
  const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight || 180);
  g.addColorStop(0, hexToRgba(color, 0.28));
  g.addColorStop(1, hexToRgba(color, 0.02));
  return g;
}

function lineDataset({ label, data, color, ctx }) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: makeGradient(ctx, color),
    fill: true,
    tension: 0.38,       // เส้นโค้งนุ่ม
    borderWidth: 2,
    pointRadius: 0,      // ซ่อนจุดให้สะอาดตา
    pointHoverRadius: 5,
    pointHitRadius: 12
  };
}

function prettyOptions({ yTitle = '', beginAtZero = false } = {}) {
  return {
    spanGaps: true,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'white', font: { size: 13, weight: '600' } } },
      tooltip: {
        intersect: false,
        mode: 'index',
        backgroundColor: 'rgba(17,17,17,.86)',
        titleFont: { weight: '700' },
        bodyFont: { size: 12 },
        padding: 10,
        displayColors: true
      }
    },
    scales: {
      x: {
        ticks: { color: 'white', maxTicksLimit: 4 },
        grid: { color: 'rgba(255,255,255,0.08)' }
      },
      y: {
        beginAtZero,
        ticks: { color: 'white' },
        grid: { color: 'rgba(255,255,255,0.08)' },
        title: yTitle ? { display: true, text: yTitle, color: 'white' } : undefined
      }
    }
  };
}

// ==============================
// Data Loaders + Table
// ==============================

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
    btn.onclick = () => updateTable(false);
    moreButtonContainer.appendChild(btn);
  }
}

// ---- Historical data fetcher ----
async function fetchHistoricalData(range = '30d') {
  const url = `https://backend-water-rf88.onrender.com/distance?range=${range}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  return data.filter(item => item.distance > 0);
}

function parseChartData(data) {
  const labels = [];
  const waterLevels = [];
  const voltagesNode1 = [];
  const voltagesNode2 = [];
  const currentsNode1 = [];
  const currentsNode2 = [];

  data.forEach(item => {
    const timeLabel = item.time_node1 || item.time_node2 || '';
    labels.push(timeLabel);

    const level = (item.distance && item.distance > 0) ? Number((fixedDepth - item.distance).toFixed(2)) : NaN;
    waterLevels.push(level);

    voltagesNode1.push(item.v_node1 > 0 ? item.v_node1 : NaN);
    voltagesNode2.push(item.v_node2 > 0 ? item.v_node2 : NaN);

    currentsNode1.push(item.i_node1 > 0 ? item.i_node1 : NaN);
    currentsNode2.push(item.i_node2 > 0 ? item.i_node2 : NaN);
  });

  return { labels, waterLevels, voltagesNode1, voltagesNode2, currentsNode1, currentsNode2 };
}

// ==============================
// Charts
// ==============================

async function createWaterLevelChart(range = '1d') {
  try {
    const data = await fetchHistoricalData(range);
    const parsed = parseChartData(data);

    parsed.labels.reverse();
    parsed.waterLevels.reverse();

    const canvas = document.getElementById('waterLevelChart30d');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');

    if (waterLevelChartInstance) waterLevelChartInstance.destroy();

    waterLevelChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [
          lineDataset({
            label: `ระดับน้ำย้อนหลัง ${range}`,
            data: parsed.waterLevels,
            color: '#36A2EB',
            ctx
          })
        ]
      },
      options: prettyOptions({ yTitle: 'ระดับน้ำ (cm)', beginAtZero: true })
    });
  } catch (err) {
    console.error('Error creating water level chart:', err);
  }
}

async function createOneHourChart() {
  try {
    const data = await fetchHistoricalData('1h');
    const parsed = parseChartData(data);
    parsed.labels.reverse();
    parsed.waterLevels.reverse();

    const canvas1h = document.getElementById('waterLevelChart1h');
    setupHiDPICanvas(canvas1h);
    const ctx1h = canvas1h.getContext('2d');

    if (oneHourChartInstance) oneHourChartInstance.destroy();

    oneHourChartInstance = new Chart(ctx1h, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [
          lineDataset({
            label: 'ระดับน้ำ (cm) 1 ชั่วโมง',
            data: parsed.waterLevels,
            color: '#22c55e',
            ctx: ctx1h
          })
        ]
      },
      options: prettyOptions({ yTitle: 'ระดับน้ำ (cm)', beginAtZero: true })
    });
  } catch (err) {
    console.error('Error creating 1h chart:', err);
  }
}

async function createBatteryChart(range = '1d') {
  try {
    const data = await fetchHistoricalData(range);
    const parsed = parseChartData(data);
    parsed.labels.reverse();
    parsed.voltagesNode1.reverse();
    parsed.voltagesNode2.reverse();

    const canvasBattery = document.getElementById('batteryChart');
    setupHiDPICanvas(canvasBattery);
    const ctxBattery = canvasBattery.getContext('2d');

    if (batteryChartInstance) batteryChartInstance.destroy();

    batteryChartInstance = new Chart(ctxBattery, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [
          lineDataset({ label: 'แรงดัน Node 1 (V)', data: parsed.voltagesNode1, color: '#ff6b6b', ctx: ctxBattery }),
          lineDataset({ label: 'แรงดัน Node 2 (V)', data: parsed.voltagesNode2, color: '#3b82f6', ctx: ctxBattery })
        ]
      },
      options: prettyOptions({ yTitle: 'แรงดัน (V)' })
    });
  } catch (err) {
    console.error('Error creating battery chart:', err);
  }
}

function movingAverage(data, windowSize) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const windowData = data.slice(start, i + 1).filter(v => !isNaN(v));
    const avg = windowData.reduce((a, b) => a + b, 0) / (windowData.length || 1);
    result.push(avg);
  }
  return result;
}

async function createCurrentChart(range = '1d') {
  try {
    const data = await fetchHistoricalData(range);
    let parsed = parseChartData(data);

    parsed.labels.reverse();
    parsed.currentsNode1.reverse();
    parsed.currentsNode2.reverse();

    // กรองเฉพาะจุดที่ Node1 และ Node2 มีค่าทั้งคู่ (เหมือนเดิม)
    function filterValidPoints(labels, data1, data2) {
      const filteredLabels = [];
      const filteredData1 = [];
      const filteredData2 = [];
      for (let i = 0; i < labels.length; i++) {
        if (!isNaN(data1[i]) && !isNaN(data2[i])) {
          filteredLabels.push(labels[i]);
          filteredData1.push(data1[i]);
          filteredData2.push(data2[i]);
        }
      }
      return { labels: filteredLabels, currentsNode1: filteredData1, currentsNode2: filteredData2 };
    }
    parsed = filterValidPoints(parsed.labels, parsed.currentsNode1, parsed.currentsNode2);

    // (ถ้าต้องการความเรียบขึ้น: ใช้ moving average)
    // const ma1 = movingAverage(parsed.currentsNode1, 5);
    // const ma2 = movingAverage(parsed.currentsNode2, 5);

    const canvasCurrent = document.getElementById('currentChart');
    setupHiDPICanvas(canvasCurrent);
    const ctxCurrent = canvasCurrent.getContext('2d');

    if (currentChartInstance) currentChartInstance.destroy();

    currentChartInstance = new Chart(ctxCurrent, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [
          lineDataset({ label: 'กระแส Node 1 (mA)', data: parsed.currentsNode1, color: '#f59e0b', ctx: ctxCurrent }),
          lineDataset({ label: 'กระแส Node 2 (mA)', data: parsed.currentsNode2, color: '#60a5fa', ctx: ctxCurrent })
        ]
      },
      options: prettyOptions({ yTitle: 'กระแส (mA)' })
    });
  } catch (err) {
    console.error('Error creating current chart:', err);
  }
}

// ==============================
// Error Box
// ==============================
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

// ==============================
// Init + Range Buttons
// ==============================

async function initDashboard() {
  await loadData();
  // ค่าเริ่มต้น = 1 วัน สำหรับทุกกราฟหลัก
  await createWaterLevelChart('1d');
  await createOneHourChart();      // กราฟเฉพาะ 1 ชั่วโมง
  await createBatteryChart('1d');
  await createCurrentChart('1d');
}

function setupRangeButtons() {
  // ปุ่มช่วงเวลาของกราฟระดับน้ำย้อนหลัง (1/7/30 วัน + 1h แยกต่างหากในอีกกราฟ)
  const waterLevelButtons = document.querySelectorAll('#timeRangeButtons .range-btn');
  waterLevelButtons.forEach(button => {
    button.addEventListener('click', async () => {
      waterLevelButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const range = button.getAttribute('data-range');
      if (range === '1h') {
        await createOneHourChart();
      } else {
        await createWaterLevelChart(range);
      }
      // ให้กราฟกระแสเปลี่ยนตามช่วงเดียวกันด้วย
      await createCurrentChart(range);
    });
  });

  // ปุ่มช่วงเวลาของกราฟกระแส
  const currentButtons = document.querySelectorAll('#currentTimeRangeButtons .range-btn');
  currentButtons.forEach(button => {
    button.addEventListener('click', async () => {
      currentButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const range = button.getAttribute('data-range');
      await createCurrentChart(range);
    });
  });

  // ปุ่มช่วงเวลาของกราฟแบตเตอรี่ (ใหม่)
  const batteryButtons = document.querySelectorAll('#batteryTimeRangeButtons .range-btn');
  batteryButtons.forEach(button => {
    button.addEventListener('click', async () => {
      batteryButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const range = button.getAttribute('data-range');
      await createBatteryChart(range);
    });
  });
}

window.onload = async () => {
  await initDashboard();
  setupRangeButtons();
};

// รีเฟรชข้อมูลในกล่อง Node และตารางทุก 60 วินาที (กราฟไม่ต้อง redrawn ทุกนาทีเพื่อความลื่น)
setInterval(() => {
  loadData();
}, 60000);
