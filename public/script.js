/* ===== Water Dashboard (time scale + sync buttons + x-axis title) ===== */
const fixedDepth = 120;
let allData = [];
let currentIndex = 0;
const pageSize = 10;

let waterLevelChartInstance = null;
let currentChartInstance = null;
let batteryChartInstance = null;
let oneHourChartInstance = null;

/* HiDPI canvas */
function setupHiDPICanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
}

/* ---------- Utils ---------- */
function parseToDate(s) {
  if (!s) return null;
  s = String(s).trim();

  // 1) 2025-08-09 12:34(:56)
  let m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/);
  if (m) return new Date(`${m[1]}T${m[2]}Z`); // ตีความเป็น UTC ถ้าไม่มีโซน

  // 2) DD/MM/YYYY HH:MM(:SS)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{2}:\d{2}(?::\d{2})?)$/);
  if (m) {
    const [, d, mo, y, t] = m;
    return new Date(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T${t}Z`);
  }

  // 3) ISO หรืออื่น ๆ
  const d2 = new Date(s);
  return isNaN(d2) ? null : d2;
}

function setActiveRange(containerId, range) {
  const btns = document.querySelectorAll(`#${containerId} .range-btn`);
  btns.forEach(b => b.classList.toggle('active', b.getAttribute('data-range') === range));
}

function yBoundsFromData(points, pad = 0.08) {
  const ys = points.map(p => p.y).filter(v => !isNaN(v));
  if (!ys.length) return { min: 0, max: 1 };
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = Math.max(1, max - min);
  const extra = span * pad;
  const niceMin = Math.floor((min - extra) * 10) / 10;
  const niceMax = Math.ceil((max + extra) * 10) / 10;
  return { min: niceMin, max: niceMax };
}

/* X axis options (มีชื่อแกน: เวลา (Time)) + คุมจำนวนคอลัมน์ใกล้กัน */
function xScaleOpts(range, xMin, xMax) {
  const MAP = {
    '1h':  { unit: 'minute', step: 5  }, // ~12 ช่อง
    '1d':  { unit: 'hour',   step: 2  }, // ~12 ช่อง
    '7d':  { unit: 'day',    step: 1  }, // 7 ช่อง
    '30d': { unit: 'day',    step: 2  }  // ~15 ช่อง
  };
  const cfg = MAP[range] || { unit: 'day', step: 1 };

  return {
    type: 'time',
    bounds: 'data',
    min: xMin ?? undefined,
    max: xMax ?? undefined,
    offset: false,
    time: {
      unit: cfg.unit,
      stepSize: cfg.step,
      round: cfg.unit,
      displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: 'MMM d' }
    },
    ticks: {
      color: 'white',
      autoSkip: true,
      autoSkipPadding: 18,
      maxRotation: 0,
      padding: 6,
      callback: (value) => {
        const d = new Date(value);
        return new Intl.DateTimeFormat('th-TH', {
          month: 'short', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
          hour12: false
        }).format(d);
      }
    },
    grid: { display: true, color: 'rgba(255,255,255,0.22)', lineWidth: 1, drawTicks: true },
    title: { display: true, text: 'เวลา (Time)', color: 'white', font: { size: 14, weight: 'bold' } }
  };
}

/* ---------- Data ---------- */
async function fetchHistoricalData(range = '30d') {
  const url = `https://backend-water-rf88.onrender.com/distance?range=${range}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  return data.filter(item => item.distance > 0);
}

/* คืนค่าเป็นชุด {x,y} เพื่อกันเวลาเพี้ยน */
function parseChartData(rows) {
  const water = [];
  const v1 = [], v2 = [];
  const i1 = [], i2 = [];

  for (const item of rows) {
    const ts = parseToDate(item.time_node1 || item.time_node2);
    if (!ts) continue;

    const level = (item.distance && item.distance > 0)
      ? Number((fixedDepth - item.distance).toFixed(2)) : NaN;

    if (!isNaN(level)) water.push({ x: ts, y: level });
    if (item.v_node1 > 0) v1.push({ x: ts, y: item.v_node1 });
    if (item.v_node2 > 0) v2.push({ x: ts, y: item.v_node2 });
    if (item.i_node1 > 0) i1.push({ x: ts, y: item.i_node1 });
    if (item.i_node2 > 0) i2.push({ x: ts, y: item.i_node2 });
  }
  return { water, v1, v2, i1, i2 };
}

/* ---------- Charts ---------- */
async function createWaterLevelChart(range = '1d') {
  try {
    const rows = await fetchHistoricalData(range);
    const { water } = parseChartData(rows);
    water.sort((a, b) => a.x - b.x);

    const xMin = water[0]?.x, xMax = water.at(-1)?.x;
    const yB = yBoundsFromData(water, 0.08);

    const canvas = document.getElementById('waterLevelChart30d');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (waterLevelChartInstance) waterLevelChartInstance.destroy();

    waterLevelChartInstance = new Chart(ctx, {
      type: 'line',
      data: { datasets: [{
        label: `ระดับน้ำย้อนหลัง ${range}`,
        data: water, borderColor: '#00c0ff', backgroundColor: 'rgba(0,192,255,0.2)',
        fill: true, tension: 0.3, pointRadius: 0
      }]},
      options: {
        parsing: false,
        spanGaps: true,
        layout: { padding: { top: 0, bottom: 0 } },
        scales: {
          x: xScaleOpts(range, xMin, xMax),
          y: {
            beginAtZero: false,
            min: yB.min,
            max: yB.max,
            ticks: { color: 'white' },
            grid: { color: 'rgba(255,255,255,0.1)' }
          }
        },
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false }
        },
        responsive: true, maintainAspectRatio: false
      }
    });
  } catch (err) { console.error('Error creating water level chart:', err); }
}

async function createOneHourChart() {
  try {
    const rows = await fetchHistoricalData('1h');
    const { water } = parseChartData(rows);
    water.sort((a,b) => a.x - b.x);

    const xMin = water[0]?.x, xMax = water.at(-1)?.x;
    const yB = yBoundsFromData(water, 0.08);

    const canvas = document.getElementById('waterLevelChart1h');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (oneHourChartInstance) oneHourChartInstance.destroy();

    oneHourChartInstance = new Chart(ctx, {
      type: 'line',
      data: { datasets: [{
        label: 'ระดับน้ำ (cm) 1 ชั่วโมง',
        data: water, borderColor: '#0f0', backgroundColor: 'rgba(29, 233, 29, 0.2)',
        fill: true, tension: 0.3, pointRadius: 0
      }]},
      options: {
        parsing: false,
        spanGaps: true,
        scales: { x: xScaleOpts('1h', xMin, xMax), y: { beginAtZero: true, ticks: { color: 'white' } } },
        plugins: { legend: { labels: { color: 'white' } }, tooltip: { mode: 'index', intersect: false } },
        responsive: true, maintainAspectRatio: false
      }
    });
  } catch (err) { console.error('Error creating 1h chart:', err); }
}

async function createBatteryChart(range = '1d') {
  try {
    const rows = await fetchHistoricalData(range);
    const { v1, v2 } = parseChartData(rows);
    v1.sort((a,b)=>a.x-b.x); v2.sort((a,b)=>a.x-b.x);

    const merged = (v1.length ? v1 : []).concat(v2.length ? v2 : []).sort((a,b)=>a.x-b.x);
    const xMin = merged[0]?.x, xMax = merged.at(-1)?.x;

    const canvas = document.getElementById('batteryChart');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (batteryChartInstance) batteryChartInstance.destroy();

    batteryChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          { label: 'แรงดัน Node 1 (V)', data: v1, borderColor: '#ff7f00', backgroundColor: 'rgba(255,127,0,0.2)', fill: true, tension: 0.3, pointRadius: 0 },
          { label: 'แรงดัน Node 2 (V)', data: v2, borderColor: '#007fff', backgroundColor: 'rgba(0,127,255,0.2)', fill: true, tension: 0.3, pointRadius: 0 }
        ]
      },
      options: {
        parsing: false,
        spanGaps: true,
        layout: { padding: { top: 0, bottom: 0 } },
        scales: {
          x: xScaleOpts(range, xMin, xMax),
          y: {
            beginAtZero: false, ticks: { color: 'white' },
            title: { display: true, text: 'แรงดัน (V)', color: 'white' },
            grid: { color: 'rgba(255,255,255,0.1)' }
          }
        },
        plugins: { legend: { labels: { color: 'white' } }, tooltip: { mode: 'index', intersect: false } },
        responsive: true, maintainAspectRatio: false
      }
    });
  } catch (err) { console.error('Error creating battery chart:', err); }
}

async function createCurrentChart(range = '1d') {
  try {
    const rows = await fetchHistoricalData(range);
    const { i1, i2 } = parseChartData(rows);
    i1.sort((a,b)=>a.x-b.x); i2.sort((a,b)=>a.x-b.x);

    const merged = (i1.length ? i1 : []).concat(i2.length ? i2 : []).sort((a,b)=>a.x-b.x);
    const xMin = merged[0]?.x, xMax = merged.at(-1)?.x;

    const yB = yBoundsFromData(merged, 0.08);

    const canvas = document.getElementById('currentChart');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (currentChartInstance) currentChartInstance.destroy();

    currentChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          { label: 'กระแส Node 1 (mA)', data: i1, borderColor: '#ff4500', backgroundColor: 'rgba(255,69,0,0.2)', fill: true, tension: 0.3, pointRadius: 0 },
          { label: 'กระแส Node 2 (mA)', data: i2, borderColor: '#1e90ff', backgroundColor: 'rgba(30,144,255,0.2)', fill: true, tension: 0.3, pointRadius: 0 }
        ]
      },
      options: {
        parsing: false,
        spanGaps: true,
        layout: { padding: { top: 0, bottom: 0 } },
        scales: {
          x: xScaleOpts(range, xMin, xMax),
          y: {
            beginAtZero: false,
            min: yB.min,
            max: yB.max,
            ticks: { color: 'white' },
            title: { display: true, text: 'กระแส (mA)', color: 'white' },
            grid: { color: 'rgba(255,255,255,0.1)' }
          }
        },
        plugins: { legend: { labels: { color: 'white' } }, tooltip: { mode: 'index', intersect: false } },
        responsive: true, maintainAspectRatio: false
      }
    });
  } catch (err) { console.error('Error creating current chart:', err); }
}

/* ---------- Live nodes/table ---------- */
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
    ['waterLevelNode1','rssiNode1','voltageNode1','currentNode1','timeNode1','rssiNode2','voltageNode2','currentNode2','timeNode2']
      .forEach(id => { const el = document.getElementById(id); if (el) el.innerText = '-'; });
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

  if (clear) { tbody.innerHTML = ''; currentIndex = 0; }

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
  const c = document.getElementById('moreButtonContainer');
  if (!c) return;
  c.innerHTML = '';
  if (currentIndex < allData.length) {
    const btn = document.createElement('button');
    btn.innerText = 'ดูข้อมูลเพิ่มเติม';
    btn.style.padding = '8px 16px';
    btn.style.margin = '10px auto';
    btn.style.display = 'inline-block';
    btn.style.cursor = 'pointer';
    btn.onclick = () => updateTable(false);
    c.appendChild(btn);
  }
}

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

/* ---------- Init & Buttons ---------- */
async function initDashboard() {
  const initialRange = '1d';

  await loadData();
  await createWaterLevelChart(initialRange);
  await createOneHourChart();
  await createBatteryChart(initialRange);
  await createCurrentChart(initialRange);

  // sync ปุ่มให้ตรงกับช่วงที่โหลดจริง
  setActiveRange('timeRangeButtons', initialRange);
  setActiveRange('batteryTimeRangeButtons', initialRange);
  setActiveRange('currentTimeRangeButtons', initialRange);
}

function setupRangeButtons() {
  // ปุ่มกราฟน้ำ — อัปเดตเฉพาะกราฟน้ำเท่านั้น
  const waterBtns = document.querySelectorAll('#timeRangeButtons .range-btn');
  waterBtns.forEach(button => {
    button.addEventListener('click', async () => {
      waterBtns.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      const range = button.getAttribute('data-range');
      await createWaterLevelChart(range);
      // ❌ ไม่เรียก createCurrentChart(range) อีกแล้ว
    });
  });

  // ปุ่มกราฟกระแส — อัปเดตเฉพาะกราฟกระแส
  const currentBtns = document.querySelectorAll('#currentTimeRangeButtons .range-btn');
  currentBtns.forEach(button => {
    button.addEventListener('click', async () => {
      currentBtns.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      const range = button.getAttribute('data-range');
      await createCurrentChart(range);
    });
  });

  // ปุ่มกราฟแบตเตอรี่ — อัปเดตเฉพาะกราฟแบต
  const batteryBtns = document.querySelectorAll('#batteryTimeRangeButtons .range-btn');
  batteryBtns.forEach(button => {
    button.addEventListener('click', async () => {
      batteryBtns.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      const range = button.getAttribute('data-range');
      await createBatteryChart(range);
    });
  });
}

/* boot */
window.onload = async () => {
  await initDashboard();
  setupRangeButtons();
};
setInterval(() => { loadData(); }, 60000);
