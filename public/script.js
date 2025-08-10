/* ===== Water Dashboard (กราฟ + เกจ + ปุ่มแยก + เมนู) ===== */
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
function toNum(v) {
  if (v === null || v === undefined) return NaN;
  // รองรับค่าที่เป็นสตริงและมีหน่วย เช่น "12.6", "12.6 V", " 0 "
  const n = parseFloat(String(v).replace(/,/g, ' ').split(' ')[0]);
  return Number.isFinite(n) ? n : NaN;
}

function parseToDate(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)$/);
  if (m) return new Date(`${m[1]}T${m[2].length === 5 ? m[2] + ':00' : m[2]}`);
  m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})\.\d+$/);
  if (m) return new Date(`${m[1]}T${m[2]}:00`);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function fmtTime(ts) {
  const d = new Date(ts);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function movingAverage(arr, windowSize = 5) {
  if (!arr || arr.length === 0) return [];
  const res = [];
  let sum = 0;
  let q = [];
  for (const v of arr) {
    q.push(v);
    sum += v;
    if (q.length > windowSize) sum -= q.shift();
    res.push(sum / q.length);
  }
  return res;
}

function yBoundsFromData(points, pad = 0.1) {
  if (!points || points.length === 0) return { min: 0, max: 50 };
  const ys = points.map(p => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = Math.max(1, max - min), extra = span * pad;
  return {
    min: Math.floor((min - extra) * 10) / 10,
    max: Math.ceil((max + extra) * 10) / 10
  };
}

/* X axis options */
function xScaleOpts(range, xMin, xMax) {
  const MAP = {
    '1h':  { unit:'minute', step:5 },
    '1d':  { unit:'hour',   step:2 },
    '7d':  { unit:'day',    step:1 },
    '30d': { unit:'day',    step:2 },
  };
  const cfg = MAP[range] || { unit:'day', step:1 };
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
      displayFormats: { minute:'HH:mm', hour:'HH:mm', day:'MMM d' }
    },
    ticks: { color: 'white' },
    grid:  { color: 'rgba(255,255,255,0.22)' },
    title: { display: true, text: 'เวลา (Time)', color: 'white' }
  };
}

/* ---------- Data ---------- */
async function fetchLatestData() {
  // ตัวอย่าง mock — แทนที่ด้วย API จริง
  return fetch('/api/latest')
    .then(r => r.json())
    .catch(() => ({
      distance: 65, v_node1: 12.3, i_node1: 0.23, v_node2: 12.6, i_node2: 0.18,
      time_node1: fmtTime(Date.now()), time_node2: fmtTime(Date.now())
    }));
}

async function fetchHistoricalData(range = '1d') {
  // ตัวอย่าง mock — แทนที่ด้วย API จริงตามช่วง
  const url = `/api/history?range=${encodeURIComponent(range)}`;
  return fetch(url).then(r => r.json())
    .catch(() => {
      // สร้างข้อมูลจำลอง
      const now = Date.now();
      let points = [];
      let n = range === '1h' ? 12 : range === '1d' ? 24 : range === '7d' ? 42 : 120;
      for (let i = n - 1; i >= 0; i--) {
        const t = new Date(now - i * (range === '1h' ? 5*60e3 : 60*60e3));
        points.push({
          time_node1: fmtTime(t),
          time_node2: fmtTime(t),
          distance: 60 + Math.sin(i/5)*5 + (Math.random()*2-1),
          v_node1: 12.0 + Math.random()*0.6,
          v_node2: 12.1 + Math.random()*0.5,
          i_node1: Math.random()*0.5,
          i_node2: Math.random()*0.4
        });
      }
      return points;
    });
}

/* robust parse (ไม่ตัด 0 และไม่ push ซ้ำ) */
function parseChartData(rows) {
  const water = [], v1 = [], v2 = [], i1 = [], i2 = [];
  for (const item of rows) {
    const ts = parseToDate(item.time_node1 || item.time_node2);
    if (!ts) continue;

    // ระดับน้ำ = fixedDepth - distance (ยอมรับ 0 และ String)
    const d = toNum(item.distance);
    const levelRaw = Number.isFinite(d) ? Number((fixedDepth - d).toFixed(2)) : NaN;
    if (!Number.isNaN(levelRaw) && levelRaw >= 0 && levelRaw <= 100) {
      water.push({ x: ts, y: levelRaw });
    }

    const _v1 = toNum(item.v_node1);
    const _v2 = toNum(item.v_node2);
    const _i1 = toNum(item.i_node1);
    const _i2 = toNum(item.i_node2);
    if (Number.isFinite(_v1)) v1.push({ x: ts, y: _v1 });
    if (Number.isFinite(_v2)) v2.push({ x: ts, y: _v2 });
    if (Number.isFinite(_i1)) i1.push({ x: ts, y: _i1 });
    if (Number.isFinite(_i2)) i2.push({ x: ts, y: _i2 });
  }
  return { water, v1, v2, i1, i2 };
}

/* ---------- Gauges ---------- */
function updateWaterGauge(levelCm) {
  const el = document.getElementById('waterGauge');
  if (!el) return;
  el.style.setProperty('--level', Math.max(0, Math.min(100, levelCm)));
  el.querySelector('.gauge-value').textContent = `${levelCm.toFixed(1)} cm`;
}

function updateBatteryGauge(v) {
  const el = document.getElementById('batteryGauge');
  if (!el) return;
  const pct = Math.max(0, Math.min(100, (v - 11.0) / (12.6 - 11.0) * 100));
  el.style.setProperty('--battery', pct);
  el.querySelector('.gauge-value').textContent = `${v.toFixed(2)} V`;
}

/* ---------- Charts ---------- */
function createWaterLevelChart(range, dataPoints) {
  const canvas = document.getElementById('waterLevelChart');
  setupHiDPICanvas(canvas);
  if (waterLevelChartInstance) waterLevelChartInstance.destroy();

  const yB = yBoundsFromData(dataPoints, 0.1);
  waterLevelChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      datasets: [{
        label: `ระดับน้ำ (cm) ${range}`,
        data: dataPoints,
        borderColor: '#4fc3f7',
        backgroundColor: 'rgba(79,195,247,0.2)',
        fill: true,
        tension: 0.3,
        pointRadius: (dataPoints.length===1?3:0),
        cubicInterpolationMode: 'monotone'
      }]
    },
    options: {
      parsing: false,
      spanGaps: true,
      scales: {
        x: xScaleOpts(range),
        y: {
          min: yB.min, max: yB.max,
          ticks: { color: 'white' },
          grid:  { color: 'rgba(255,255,255,0.12)' },
          title: { display: true, text: 'ระดับน้ำ (cm)', color: 'white' }
        }
      },
      plugins: {
        legend:  { labels: { color: 'white' } },
        tooltip: { mode: 'index', intersect: false },
        subtitle: {
          display: dataPoints.length < 2,
          text: dataPoints.length === 0 ? 'ไม่มีข้อมูลในช่วงนี้' : 'มีข้อมูลเพียง 1 จุด',
          color: '#ddd'
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function createBatteryCurrentCharts(v1, v2, i1, i2) {
  const canvas = document.getElementById('batteryChart');
  const canvas2 = document.getElementById('currentChart');
  setupHiDPICanvas(canvas);
  setupHiDPICanvas(canvas2);
  if (batteryChartInstance) batteryChartInstance.destroy();
  if (currentChartInstance) currentChartInstance.destroy();

  batteryChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      datasets: [
        { label: 'V Node1', data: v1, borderColor: '#ffd54f', backgroundColor: 'rgba(255,213,79,0.2)', fill: true, tension: 0.3, pointRadius: (v1.length===1?3:0) },
        { label: 'V Node2', data: v2, borderColor: '#ffb74d', backgroundColor: 'rgba(255,183,77,0.2)', fill: true, tension: 0.3, pointRadius: (v2.length===1?3:0) }
      ]
    },
    options: {
      parsing: false,
      scales: {
        x: xScaleOpts('1d'),
        y: {
          ticks: { color: 'white' },
          grid:  { color: 'rgba(255,255,255,0.12)' },
          title: { display: true, text: 'Battery (V)', color: 'white' }
        }
      },
      plugins: { legend: { labels: { color: 'white' } } },
      responsive: true,
      maintainAspectRatio: false
    }
  });

  currentChartInstance = new Chart(canvas2.getContext('2d'), {
    type: 'line',
    data: {
      datasets: [
        { label: 'I Node1', data: i1, borderColor: '#a5d6a7', backgroundColor: 'rgba(165,214,167,0.2)', fill: true, tension: 0.3, pointRadius: (i1.length===1?3:0) },
        { label: 'I Node2', data: i2, borderColor: '#81c784', backgroundColor: 'rgba(129,199,132,0.2)', fill: true, tension: 0.3, pointRadius: (i2.length===1?3:0) }
      ]
    },
    options: {
      parsing: false,
      scales: {
        x: xScaleOpts('1d'),
        y: {
          ticks: { color: 'white' },
          grid:  { color: 'rgba(255,255,255,0.12)' },
          title: { display: true, text: 'Current (A)', color: 'white' }
        }
      },
      plugins: { legend: { labels: { color: 'white' } } },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

/* 1 ชั่วโมงย้อนหลัง (อิงข้อมูลล่าสุดจริง ๆ) */
async function createOneHourChart() {
  try {
    let rows = await fetchHistoricalData('1h');
    let { water } = parseChartData(rows);
    water.sort((a,b)=>a.x-b.x);

    // ถ้าชั่วโมงปัจจุบันไม่มีข้อมูล → ใช้หน้าต่าง 1 ชม. ย้อนจากเวลา record ล่าสุด
    if (water.length === 0) {
      const rowsWide = await fetchHistoricalData('30d');
      const parsedWide = parseChartData(rowsWide);
      const allWater = parsedWide.water.sort((a,b)=>a.x-b.x);
      const latestTs = allWater.at(-1)?.x;
      if (latestTs) {
        const start = new Date(latestTs.getTime() - 60*60*1000);
        water = allWater.filter(p => p.x >= start && p.x <= latestTs);
        if (water.length === 0) water = [ { x: latestTs, y: allWater.at(-1).y } ]; // อย่างน้อย 1 จุด
      }
    }

    const hasData = water.length > 0;
    const xMin = hasData ? water[0].x : new Date(Date.now() - 60*60*1000);
    const xMax = hasData ? water.at(-1).x : new Date();
    const yB   = hasData ? yBoundsFromData(water, 0.08) : { min:0, max:50 };

    const canvas = document.getElementById('waterLevelChart1h');
    setupHiDPICanvas(canvas);
    if (oneHourChartInstance) oneHourChartInstance.destroy();

    oneHourChartInstance = new Chart(canvas.getContext('2d'), {
      type:'line',
      data:{ datasets:[{
        label: 'ระดับน้ำ (cm) 1 ชั่วโมง (อิงข้อมูลล่าสุด)',
        data: water,
        borderColor:'#0f0',
        backgroundColor:'rgba(29,233,29,0.18)',
        fill:true, tension:0.3, pointRadius: (water.length===1?3:0), cubicInterpolationMode:'monotone'
      }]},
      options: {
        parsing:false,
        // 1 ชั่วโมง: อนุญาตเว้นช่องว่างได้ถึง 20 นาที (เพื่อไม่ลากเส้นลวง)
        spanGaps: 20*60*1000,
        layout:{ padding:{ top:0, bottom:0 } },
        scales:{
          x: xScaleOpts('1h', xMin, xMax),
          y: { beginAtZero:false, min:yB.min, max:yB.max, ticks:{ color:'white' }, grid:{ color:'rgba(255,255,255,0.12)' } }
        },
        plugins:{
          legend:{ labels:{ color:'white' } },
          tooltip:{ mode:'index', intersect:false },
          subtitle:{
            display: !hasData,
            text: 'ไม่พบข้อมูล 1 ชั่วโมงล่าสุด — กำลังรอข้อมูลใหม่',
            color:'#ddd'
          }
        },
        responsive:true, maintainAspectRatio:false
      }
    });
  } catch (e) {
    console.error('Error creating 1h chart (latest-window):', e);
  }
}

/* ---------- Table / Paging ---------- */
function updateTable(data) {
  const tbody = document.querySelector('#historyTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const start = currentIndex * pageSize;
  const end = Math.min(start + pageSize, data.length);
  for (let i = start; i < end; i++) {
    const row = data[i];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtTime(row.time_node1 || row.time_node2)}</td>
      <td>${Number.isFinite(toNum(row.distance)) ? (fixedDepth - toNum(row.distance)).toFixed(1) : '-'}</td>
      <td>${Number.isFinite(toNum(row.v_node1)) ? toNum(row.v_node1).toFixed(2) : '-'}</td>
      <td>${Number.isFinite(toNum(row.i_node1)) ? toNum(row.i_node1).toFixed(2) : '-'}</td>
      <td>${Number.isFinite(toNum(row.v_node2)) ? toNum(row.v_node2).toFixed(2) : '-'}</td>
      <td>${Number.isFinite(toNum(row.i_node2)) ? toNum(row.i_node2).toFixed(2) : '-'}</td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById('pageInfo').textContent =
    `${start + 1}-${end} / ${data.length}`;
}

function setupPagination(data) {
  document.getElementById('prevPage').onclick = () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateTable(data);
    }
  };
  document.getElementById('nextPage').onclick = () => {
    if ((currentIndex + 1) * pageSize < data.length) {
      currentIndex++;
      updateTable(data);
    }
  };
}

/* ---------- Buttons (range) ---------- */
function setupRangeButtons() {
  const ranges = ['1h','1d','7d','30d'];
  ranges.forEach(r => {
    const btn = document.getElementById(`btn-${r}`);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const rows = await fetchHistoricalData(r);
      const { water, v1, v2, i1, i2 } = parseChartData(rows);
      createWaterLevelChart(r, water);
      createBatteryCurrentCharts(v1, v2, i1, i2);
    });
  });
}

/* ---------- Main load ---------- */
async function loadData() {
  try {
    const latest = await fetchLatestData();
    const lv = Number.isFinite(toNum(latest.distance)) ? fixedDepth - toNum(latest.distance) : null;
    if (Number.isFinite(lv)) updateWaterGauge(lv);
    if (Number.isFinite(toNum(latest.v_node1))) updateBatteryGauge(toNum(latest.v_node1));
  } catch (e) { console.warn('latest data failed', e); }

  try {
    const rows = await fetchHistoricalData('1d');
    allData = rows.slice().sort((a,b) => (parseToDate(b.time_node1 || b.time_node2) - parseToDate(a.time_node1 || a.time_node2)));
    const { water, v1, v2, i1, i2 } = parseChartData(allData);
    createWaterLevelChart('1d', water);
    createBatteryCurrentCharts(v1, v2, i1, i2);
    currentIndex = 0;
    updateTable(allData);
    setupPagination(allData);
  } catch (e) {
    console.error('history load failed', e);
  }
}

/* ---------- Map (Leaflet) ---------- */
function initMap() {
  if (typeof L === 'undefined') return;
  const map = L.map('map').setView([13.7563, 100.5018], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(map);

  const points = [
    [13.75, 100.49],
    [13.76, 100.50],
    [13.77, 100.52]
  ];

  const markers = points.map((p, i) => {
    const m = L.marker(p).addTo(map);
    m.bindPopup(`Node ${i+1}`);
    return m;
  });

  const polyline = L.polyline(points, { color: 'blue' }).addTo(map);

  // เส้นแอนิเมชันแบบง่าย
  let idx = 0;
  setInterval(() => {
    idx = (idx + 1) % points.length;
    polyline.setLatLngs(points.slice(0, idx + 1));
  }, 1000);
}

/* ---------- Error Alert ---------- */
function showErrorIfNeeded(level) {
  const box = document.getElementById('errorBox');
  if (!box) return;
  const danger = Number.isFinite(level) && level > 90;
  box.style.display = danger ? 'block' : 'none';
  if (danger) {
    box.querySelector('.msg').textContent = `ระดับน้ำสูงผิดปกติ: ${level.toFixed(1)} cm`;
  }
}

/* ---------- Init ---------- */
async function initDashboard() {
  await loadData();
  await createOneHourChart();
  initMap();
}

/* ---------- Expose (for debug) ---------- */
window.DASH = {
  fetchLatestData, fetchHistoricalData, parseChartData,
  createWaterLevelChart, createBatteryCurrentCharts, createOneHourChart
};

/* polyfills (optional minimal) */
(() => {
  if (!Array.prototype.at) {
    Array.prototype.at = function(n) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      if (n < 0 || n >= this.length) return undefined;
      return this[n];
    };
  }
})();

/* boot */
window.onload = async () => { await initDashboard(); setupRangeButtons(); };
setInterval(() => {
  loadData();
  createOneHourChart(); // อัปเดตกราฟ 1 ชม. ตามข้อมูลล่าสุด
}, 60000);
