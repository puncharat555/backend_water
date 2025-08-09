/* ===== Water Dashboard (แก้ให้กราฟขึ้นแม้ไม่มีข้อมูล) ===== */
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
  let m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)$/);
  if (m) return new Date(`${m[1]}T${m[2]}`);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{2}:\d{2}(:\d{2})?)$/);
  if (m) {
    const [, d, mo, y, t] = m;
    return new Date(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T${t}`);
  }
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
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = Math.max(1, max - min), extra = span * pad;
  return { min: Math.floor((min - extra) * 10) / 10, max: Math.ceil((max + extra) * 10) / 10 };
}

function xScaleOpts(range, xMin, xMax) {
  const MAP = { '1h': { unit:'minute', step:5 }, '1d':{ unit:'hour', step:2 }, '7d':{ unit:'day', step:1 }, '30d':{ unit:'day', step:2 } };
  const cfg = MAP[range] || { unit:'day', step:1 };
  return {
    type: 'time',
    bounds: 'data',
    min: xMin ?? undefined, max: xMax ?? undefined,
    offset: false,
    time: { unit: cfg.unit, stepSize: cfg.step, round: cfg.unit, displayFormats:{ minute:'HH:mm', hour:'HH:mm', day:'MMM d' } },
    ticks: {
      color:'white', autoSkip:true, autoSkipPadding:18, maxRotation:0, padding:6,
      callback: (value) => new Intl.DateTimeFormat('th-TH',{ month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(value))
    },
    grid: { display:true, color:'rgba(255,255,255,0.22)', lineWidth:1, drawTicks:true },
    title: { display:true, text:'เวลา (Time)', color:'white', font:{ size:14, weight:'bold' } }
  };
}

/* เกจแรงดัน */
function drawVoltageGauge(containerId, value, min = 10, max = 12.9) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const v = Math.max(min, Math.min(max, Number(value) || min));
  const w = el.clientWidth || 280, h = el.clientHeight || 150;
  const cx = w/2, cy = h-12, r = Math.min(w*0.45, h*0.9);
  const start = -Math.PI, end = 0;
  const t = (v - min) / (max - min);
  const angle = start + (end - start) * t;
  const arc = (sa, ea, rr) => {
    const x1 = cx + rr*Math.cos(sa), y1 = cy + rr*Math.sin(sa);
    const x2 = cx + rr*Math.cos(ea), y2 = cy + rr*Math.sin(ea);
    const large = (ea - sa) % (2*Math.PI) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${rr} ${rr} 0 ${large} 1 ${x2} ${y2}`;
  };
  const z2 = Math.min(max, 11.5), z3 = Math.min(max, 12.3);
  const toAng = x => start + (end - start) * ((x - min)/(max - min));
  const svg = `
    <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
      <path d="${arc(start, toAng(z2), r)}" stroke="#e74c3c" stroke-width="12" fill="none"/>
      <path d="${arc(toAng(z2), toAng(z3), r)}" stroke="#f39c12" stroke-width="12" fill="none"/>
      <path d="${arc(toAng(z3), end, r)}" stroke="#2ecc71" stroke-width="12" fill="none"/>
      <line x1="${cx}" y1="${cy}" x2="${cx + (r-6)*Math.cos(angle)}" y2="${cy + (r-6)*Math.sin(angle)}" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="4" fill="#fff"/>
      <text x="${cx}" y="${cy - r*0.55}" class="val-text">${v.toFixed(2)} V</text>
      <text x="${cx - r + 14}" y="${cy - 6}" class="tick-text">${min.toFixed(1)}V</text>
      <text x="${cx + r - 14}" y="${cy - 6}" class="tick-text">${max.toFixed(1)}V</text>
    </svg>`;
  el.innerHTML = svg;
}

/* ---------- Data ---------- */
async function fetchHistoricalData(range = '30d') {
  const url = `https://backend-water-rf88.onrender.com/distance?range=${range}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  console.log('[fetch]', range, 'rows=', data.length);
  return data;
}

function parseChartData(rows) {
  const water = [], v1 = [], v2 = [], i1 = [], i2 = [];
  for (const item of rows) {
    const ts = parseToDate(item.time_node1 || item.time_node2);
    if (!ts) continue;
    const levelRaw = (item.distance || item.distance === 0) ? Number((fixedDepth - item.distance).toFixed(2)) : NaN;
    if (!isNaN(levelRaw) && levelRaw >= 0) water.push({ x: ts, y: levelRaw });
    if (item.v_node1 > 0) v1.push({ x: ts, y: item.v_node1 });
    if (item.v_node2 > 0) v2.push({ x: ts, y: item.v_node2 });
    if (item.i_node1 > 0) i1.push({ x: ts, y: item.i_node1 });
    if (item.i_node2 > 0) i2.push({ x: ts, y: item.i_node2 });
  }
  return { water, v1, v2, i1, i2 };
}

/* ---------- Charts ---------- */
function createLineChart(canvasId, datasets, range, xMin, xMax, yB, yTitle, noDataMsg) {
  const canvas = document.getElementById(canvasId);
  setupHiDPICanvas(canvas);
  return new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { datasets },
    options: {
      parsing: false,
      spanGaps: true,
      scales: {
        x: xScaleOpts(range, xMin, xMax),
        y: { beginAtZero:false, min:yB.min, max:yB.max, ticks:{ color:'white' }, title: yTitle ? { display:true, text:yTitle, color:'white' } : undefined, grid:{ color:'rgba(255,255,255,0.1)' } }
      },
      plugins: {
        legend: { labels:{ color:'white' } },
        tooltip: { mode:'index', intersect:false },
        subtitle: { display: datasets[0].data.length === 0, text: noDataMsg, color: '#ddd' }
      },
      responsive: true, maintainAspectRatio: false
    }
  });
}

async function createWaterLevelChart(range = '1d') {
  const rows = await fetchHistoricalData(range);
  const { water } = parseChartData(rows);
  water.sort((a,b)=>a.x-b.x);
  const now = new Date();
  const xMin = water[0]?.x ?? new Date(now - 24*60*60*1000);
  const xMax = water.at(-1)?.x ?? now;
  const yB = water.length ? yBoundsFromData(water) : { min:0, max:50 };
  if (waterLevelChartInstance) waterLevelChartInstance.destroy();
  waterLevelChartInstance = createLineChart('waterLevelChart30d', [{
    label: `ระดับน้ำย้อนหลัง ${range}`, data: water, borderColor:'#00c0ff', backgroundColor:'rgba(0,192,255,0.2)', fill: true, tension: 0.3, pointRadius: 0
  }], range, xMin, xMax, yB, null, 'ไม่มีข้อมูลน้ำในช่วงนี้');
}

async function createOneHourChart() {
  const rows = await fetchHistoricalData('1h');
  const { water } = parseChartData(rows);
  water.sort((a,b)=>a.x-b.x);
  const now = new Date();
  const xMin = water[0]?.x ?? new Date(now - 60*60*1000);
  const xMax = water.at(-1)?.x ?? now;
  const yB = water.length ? yBoundsFromData(water) : { min:0, max:50 };
  if (oneHourChartInstance) oneHourChartInstance.destroy();
  oneHourChartInstance = createLineChart('waterLevelChart1h', [{
    label: 'ระดับน้ำ (cm) 1 ชั่วโมง', data: water, borderColor:'#0f0', backgroundColor:'rgba(29,233,29,0.18)', fill:true, tension:0.3, pointRadius:0
  }], '1h', xMin, xMax, yB, null, 'ไม่มีข้อมูลน้ำใน 1 ชั่วโมง');
}

async function createBatteryChart(range = '1d') {
  const rows = await fetchHistoricalData(range);
  const { v1, v2 } = parseChartData(rows);
  v1.sort((a,b)=>a.x-b.x); v2.sort((a,b)=>a.x-b.x);
  const merged = [...v1, ...v2].sort((a,b)=>a.x-b.x);
  const now = new Date();
  const xMin = merged[0]?.x ?? new Date(now - 24*60*60*1000);
  const xMax = merged.at(-1)?.x ?? now;
  const yB = merged.length ? yBoundsFromData(merged) : { min:10, max:13 };
  if (batteryChartInstance) batteryChartInstance.destroy();
  batteryChartInstance = createLineChart('batteryChart', [
    { label:'แรงดัน Node 1 (V)', data:v1, borderColor:'#ff7f00', backgroundColor:'rgba(255,127,0,0.2)', fill:true, tension:0.3, pointRadius:0 },
    { label:'แรงดัน Node 2 (V)', data:v2, borderColor:'#007fff', backgroundColor:'rgba(0,127,255,0.2)', fill:true, tension:0.3, pointRadius:0 }
  ], range, xMin, xMax, yB, 'แรงดัน (V)', 'ไม่มีข้อมูลแรงดันในช่วงนี้');
}

async function createCurrentChart(range = '1d') {
  const rows = await fetchHistoricalData(range);
  const { i1, i2 } = parseChartData(rows);
  i1.sort((a,b)=>a.x-b.x); i2.sort((a,b)=>a.x-b.x);
  const merged = [...i1, ...i2].sort((a,b)=>a.x-b.x);
  const now = new Date();
  const xMin = merged[0]?.x ?? new Date(now - 24*60*60*1000);
  const xMax = merged.at(-1)?.x ?? now;
  const yB = merged.length ? yBoundsFromData(merged) : { min:0, max:500 };
  if (currentChartInstance) currentChartInstance.destroy();
  currentChartInstance = createLineChart('currentChart', [
    { label:'กระแส Node 1 (mA)', data:i1, borderColor:'#ff4500', backgroundColor:'rgba(255,69,0,0.2)', fill:true, tension:0.3, pointRadius:0 },
    { label:'กระแส Node 2 (mA)', data:i2, borderColor:'#1e90ff', backgroundColor:'rgba(30,144,255,0.2)', fill:true, tension:0.3, pointRadius:0 }
  ], range, xMin, xMax, yB, 'กระแส (mA)', 'ไม่มีข้อมูลกระแสในช่วงนี้');
}

/* ---------- Init & Buttons ---------- */
async function initDashboard() {
  const initialRange = '1d';
  await loadData();
  await createWaterLevelChart(initialRange);
  await createOneHourChart();
  await createBatteryChart(initialRange);
  await createCurrentChart(initialRange);
  setActiveRange('timeRangeButtons', initialRange);
  setActiveRange('batteryTimeRangeButtons', initialRange);
  setActiveRange('currentTimeRangeButtons', initialRange);
}

function setupRangeButtons() {
  document.querySelectorAll('#timeRangeButtons .range-btn').forEach(button => {
    button.addEventListener('click', async () => {
      setActiveRange('timeRangeButtons', button.getAttribute('data-range'));
      await createWaterLevelChart(button.getAttribute('data-range'));
    });
  });
  document.querySelectorAll('#currentTimeRangeButtons .range-btn').forEach(button => {
    button.addEventListener('click', async () => {
      setActiveRange('currentTimeRangeButtons', button.getAttribute('data-range'));
      await createCurrentChart(button.getAttribute('data-range'));
    });
  });
  document.querySelectorAll('#batteryTimeRangeButtons .range-btn').forEach(button => {
    button.addEventListener('click', async () => {
      setActiveRange('batteryTimeRangeButtons', button.getAttribute('data-range'));
      await createBatteryChart(button.getAttribute('data-range'));
    });
  });
}

window.onload = async () => { await initDashboard(); setupRangeButtons(); };
setInterval(() => { loadData(); }, 60000);
