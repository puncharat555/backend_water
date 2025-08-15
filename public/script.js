/* =========================================================
   Water Dashboard (กราฟ + เกจ + ปุ่มแยก + เมนู)
   ========================================================= */
const fixedDepth = 120;
const pageSize = 10;

let allData = [];
let currentIndex = 0;

let waterLevelChartInstance = null;
let currentChartInstance    = null;
let batteryChartInstance    = null;
let oneHourChartInstance    = null;

/* ====== ค่าคงที่-ตัวช่วย ====== */
const RANGE_HOURS = { '1h': 1, '1d': 24, '7d': 24 * 7, '30d': 24 * 30 };
const msForRange  = (range) => (RANGE_HOURS[range] ?? 24) * 60 * 60 * 1000;

const isDef = (v) => v !== null && v !== undefined;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/* ====== HiDPI canvas ====== */
function setupHiDPICanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
}

/* ---------- Utils ---------- */
function parseToDate(s) {
  if (!s) return null;
  s = String(s).trim();

  // ตัด .sss หรือ .sssZ (ถ้ามี)
  s = s.replace(/\.\d+Z?$/, '');

  // YYYY-MM-DD HH:mm[:ss]
  let m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)$/);
  if (m) return new Date(`${m[1]}T${m[2]}`);

  // DD/MM/YYYY HH:mm[:ss]
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
  const ys = points.map(p => p.y).filter(v => Number.isFinite(v));
  if (!ys.length) return { min: 0, max: 1 };
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
    '30d': { unit:'day',    step:2 }
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
    ticks: {
      color: 'white',
      autoSkip: true,
      autoSkipPadding: 18,
      maxRotation: 0,
      padding: 6,
      callback: (value) =>
        new Intl.DateTimeFormat('th-TH', {
          month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false
        }).format(new Date(value))
    },
    grid:  { display:true, color:'rgba(255,255,255,0.22)', lineWidth:1, drawTicks:true },
    title: { display:true, text:'เวลา (Time)', color:'white', font:{ size:14, weight:'bold' } }
  };
}

/* ========= SVG Gauge แรงดันแบต (10–12.9V) ========= */
function drawVoltageGauge(containerId, value, min = 10, max = 12.9) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const v = clamp(Number(value) || min, min, max);
  const w = el.clientWidth || 280, h = el.clientHeight || 150;
  const cx = w/2, cy = h-12, r = Math.min(w*0.45, h*0.9);
  const start = -Math.PI, end = 0; // ครึ่งวง 180°
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
      <path d="${arc(start, toAng(z2), r)}" stroke="#e74c3c" stroke-width="12" fill="none" opacity="0.85"/>
      <path d="${arc(toAng(z2), toAng(z3), r)}" stroke="#f39c12" stroke-width="12" fill="none" opacity="0.9"/>
      <path d="${arc(toAng(z3), end, r)}" stroke="#2ecc71" stroke-width="12" fill="none" opacity="0.9"/>

      <line x1="${cx}" y1="${cy}" x2="${cx + (r-6)*Math.cos(angle)}" y2="${cy + (r-6)*Math.sin(angle)}"
            stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="4" fill="#fff"/>

      <text x="${cx}" y="${cy - r*0.55}" class="val-text">${v.toFixed(2)} V</text>
      <text x="${cx - r + 14}" y="${cy - 6}" class="tick-text">${min.toFixed(1)}V</text>
      <text x="${cx + r - 14}" y="${cy - 6}" class="tick-text">${max.toFixed(1)}V</text>
    </svg>`;
  el.innerHTML = svg;
}

/* ========= SVG Gauge ระดับน้ำ (0–40 G, 40–70 O, 70–120 R) ========= */
/* ========= Water Gauge แบบเดียวกับเกจแบต (ซ้ายต่ำ→ขวาสูง) ========= */
function drawWaterArc(containerId, value, min = 0, max = fixedDepth) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
  const v = clamp(Number(value) || 0, min, max);

  // left (ต่ำ) → right (สูง) เหมือนเกจแบต
  const start = -Math.PI;   // ซ้าย
  const end   = 0;          // ขวา

  // ขนาด (ปล่อยให้ .gauge กำหนดกล่องนอก)
  const w = el.clientWidth || 280;
  const h = el.clientHeight || 150;
  const cx = w / 2;
  const cy = h - 12;
  const r  = Math.min(w * 0.45, h * 0.9);
  const band = Math.max(14, Math.min(26, r * 0.14)); // ความหนาแถบ

  const toAng = x => start + (end - start) * ((x - min) / (max - min));
  const arcBand = (a0, a1) => {
    const ro = r, ri = r - band;
    const x0 = cx + ro * Math.cos(a0), y0 = cy + ro * Math.sin(a0);
    const x1 = cx + ro * Math.cos(a1), y1 = cy + ro * Math.sin(a1);
    const x2 = cx + ri * Math.cos(a1), y2 = cy + ri * Math.sin(a1);
    const x3 = cx + ri * Math.cos(a0), y3 = cy + ri * Math.sin(a0);
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    return `
      M ${x0} ${y0}
      A ${ro} ${ro} 0 ${large} 1 ${x1} ${y1}
      L ${x2} ${y2}
      A ${ri} ${ri} 0 ${large} 0 ${x3} ${y3}
      Z`;
  };

  // โซนสี (ซ้าย→ขวา)
  const a0   = toAng(0);
  const a40  = toAng(40);
  const a70  = toAng(70);
  const aMax = toAng(max);
  const aVal = toAng(v);

  const colG = '#2ecc71', colO = '#ffb300', colR = '#e74c3c';

  // เข็ม
  const nx = cx + (r - 8) * Math.cos(aVal);
  const ny = cy + (r - 8) * Math.sin(aVal);

  const svg = `
  <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <!-- พื้นหลังจาง -->
    <path d="${arcBand(a0, aMax)}" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>

    <!-- โซนสีต่อเนื่องเหมือนเกจแบต -->
    <path d="${arcBand(a0,  a40 )}" fill="${colG}" opacity="0.9"/>
    <path d="${arcBand(a40, a70 )}" fill="${colO}" opacity="0.9"/>
    <path d="${arcBand(a70, aMax)}" fill="${colR}" opacity="0.9"/>

    <!-- เส้นแบ่งโซนเล็ก ๆ -->
    <path d="M ${cx + r*Math.cos(a40)} ${cy + r*Math.sin(a40)}
             L ${cx + (r-band)*Math.cos(a40)} ${cy + (r-band)*Math.sin(a40)}"
          stroke="rgba(255,255,255,0.6)" stroke-width="2" />
    <path d="M ${cx + r*Math.cos(a70)} ${cy + r*Math.sin(a70)}
             L ${cx + (r-band)*Math.cos(a70)} ${cy + (r-band)*Math.sin(a70)}"
          stroke="rgba(255,255,255,0.6)" stroke-width="2" />

    <!-- เข็ม -->
    <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="#fff"/>

    <!-- ค่า -->
    <text x="${cx}" y="${cy - r*0.55}" class="val-text" style="font-weight:700;font-size:18px;" text-anchor="middle">${v.toFixed(1)} cm</text>

    <!-- ป้ายปลายซ้าย/ขวา -->
    <text x="${cx + (r+10)*Math.cos(a0)}"  y="${cy + (r+10)*Math.sin(a0)}"  class="tick-text" text-anchor="start">0</text>
    <text x="${cx + (r+10)*Math.cos(aMax)}" y="${cy + (r+10)*Math.sin(aMax)}" class="tick-text" text-anchor="end">${max}</text>
  </svg>`;
  el.innerHTML = svg;
}


function updateWaterGauge(levelCm) {
  drawWaterArc('waterGauge', Number(levelCm) || 0, 0, fixedDepth);
}

/* ---------- Data ---------- */
async function fetchHistoricalData(range = '30d') {
  const url = `https://backend-water-rf88.onrender.com/distance?range=${range}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return await res.json();
}

// แปลงข้อมูลสำหรับกราฟ (กันซ้ำ timestamp, รองรับสตริงมีหน่วย, รับค่า 0)
function parseChartData(rows) {
  const water = [], v1 = [], v2 = [], i1 = [], i2 = [];

  for (const item of rows) {
    const tsStr = item.time_node1 ?? item.time_node2 ?? item.timestamp;
    const ts = parseToDate(tsStr);
    if (!ts) continue;

    if (isDef(item.distance)) {
      const level = Number((fixedDepth - Number(item.distance)).toFixed(2));
      if (Number.isFinite(level) && level >= 0 && level <= fixedDepth) {
        water.push({ x: ts, y: level });
      }
    }

    const pushNum = (arr, v) => {
      if (!isDef(v)) return;
      const n = parseFloat(String(v).replace(/[^\d.+-eE]/g, '')); // "12.3 V" -> 12.3
      if (Number.isFinite(n) && n >= 0) arr.push({ x: ts, y: n });
    };
    pushNum(v1, item.v_node1);
    pushNum(v2, item.v_node2);
    pushNum(i1, item.i_node1);
    pushNum(i2, item.i_node2);
  }

  const sort = a => a.sort((p,q)=>p.x-q.x);
  const dedupe = a => {
    const seen = new Set();
    return a.filter(p => { const k=+p.x; if (seen.has(k)) return false; seen.add(k); return true; });
  };

  return {
    water: dedupe(sort(water)),
    v1: sort(v1), v2: sort(v2),
    i1: sort(i1), i2: sort(i2),
  };
}

/* ---------- Charts ---------- */
// กราฟระดับน้ำย้อนหลัง (ถ้าช่วงว่าง → ใช้หน้าต่างที่จบที่จุดล่าสุด)
async function createWaterLevelChart(range = '1d') {
  try {
    let rows = await fetchHistoricalData(range);
    let { water } = parseChartData(rows);

    if (water.length === 0) {
      const rowsWide = await fetchHistoricalData('30d');
      const allWater = parseChartData(rowsWide).water;
      const latest = allWater.at(-1);
      if (latest) {
        const start = new Date(latest.x.getTime() - msForRange(range));
        water = allWater.filter(p => p.x >= start && p.x <= latest.x);
      }
    }

    const xMin = water[0]?.x;
    const xMax = water.at(-1)?.x;
    const yB  = water.length ? yBoundsFromData(water, 0.2) : { min: 0, max: 50 };

    const canvas = document.getElementById('waterLevelChart30d');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (waterLevelChartInstance) waterLevelChartInstance.destroy();

    waterLevelChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: `ระดับน้ำย้อนหลัง ${range}`,
          data: water,
          borderColor:'#00c0ff',
          backgroundColor:'rgba(0,192,255,0.2)',
          fill:true, tension:0.3, pointRadius:0, cubicInterpolationMode:'monotone'
        }]
      },
      options: {
        parsing:false,
        spanGaps:true,
        layout:{ padding:{ top:0, bottom:0 } },
        scales:{
          x: xScaleOpts(range, xMin, xMax),
          y: { beginAtZero:false, min:yB.min, max:yB.max, ticks:{ color:'white' }, grid:{ color:'rgba(255,255,255,0.1)' } }
        },
        plugins:{
          legend:{ labels:{ color:'white' } },
          tooltip:{ mode:'index', intersect:false },
          subtitle:{ display: water.length===0, text:'ยังไม่เคยมีข้อมูลให้แสดง', color:'#ddd' }
        },
        responsive:true, maintainAspectRatio:false
      }
    });
  } catch (err) {
    console.error('Error creating water chart:', err);
  }
}

// กราฟ 1 ชั่วโมงล่าสุด (ถ้าไม่มีข้อมูลช่วงปัจจุบัน → ย้อนจากจุดล่าสุด 1 ชม.)
async function createOneHourChart() {
  try {
    let rows = await fetchHistoricalData('1h');
    let { water } = parseChartData(rows);

    if (water.length === 0) {
      const rowsWide = await fetchHistoricalData('30d');
      const allWater = parseChartData(rowsWide).water;
      const latestTs = allWater.at(-1)?.x;
      if (latestTs) {
        const start = new Date(latestTs.getTime() - msForRange('1h'));
        water = allWater.filter(p => p.x >= start && p.x <= latestTs);
        if (water.length === 0) water = [{ x: latestTs, y: allWater.at(-1).y }];
      }
    }

    // กรอง outlier ≤ 50 cm (ตามเดิม)
    water = water.filter(p => p.y <= 50);

    const hasData = water.length > 0;
    const xMin = hasData ? water[0].x : undefined;
    const xMax = hasData ? water.at(-1).x : undefined;
    const yB   = hasData ? yBoundsFromData(water, 0.08) : { min: 0, max: 50 };

    const canvas = document.getElementById('waterLevelChart1h');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (oneHourChartInstance) oneHourChartInstance.destroy();

    oneHourChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'ระดับน้ำ (cm) 1 ชั่วโมง (อิงข้อมูลล่าสุด)',
          data: water,
          borderColor:'#0f0',
          backgroundColor:'rgba(29,233,29,0.18)',
          fill:true, tension:0.3, pointRadius:0, cubicInterpolationMode:'monotone'
        }]
      },
      options: {
        parsing:false,
        spanGaps: 20*60*1000,
        layout:{ padding:{ top:0, bottom:0 } },
        scales:{
          x: xScaleOpts('1h', xMin, xMax),
          y: { beginAtZero:false, min:yB.min, max:yB.max, ticks:{ color:'white' }, grid:{ color:'rgba(255,255,255,0.12)' } }
        },
        plugins:{
          legend:{ labels:{ color:'white' } },
          tooltip:{ mode:'index', intersect:false },
          subtitle:{ display: !hasData, text: 'ยังไม่เคยมีข้อมูลให้แสดง', color:'#ddd' }
        },
        responsive:true, maintainAspectRatio:false
      }
    });
  } catch (err) {
    console.error('Error creating 1h chart (latest-window):', err);
  }
}

async function createBatteryChart(range = '1d') {
  try {
    const rows = await fetchHistoricalData(range);
    let { v1, v2 } = parseChartData(rows);

    let merged = (v1.length?v1:[]).concat(v2.length?v2:[]).sort((a,b)=>a.x-b.x);

    if (merged.length === 0) {
      const rowsWide = await fetchHistoricalData('30d');
      const p = parseChartData(rowsWide);
      const all = (p.v1.length?p.v1:[]).concat(p.v2.length?p.v2:[]).sort((a,b)=>a.x-b.x);
      const latest = all.at(-1);
      if (latest) {
        const start = new Date(latest.x.getTime() - msForRange(range));
        v1 = p.v1.filter(pt => pt.x >= start && pt.x <= latest.x);
        v2 = p.v2.filter(pt => pt.x >= start && pt.x <= latest.x);
        merged = v1.concat(v2).sort((a,b)=>a.x-b.x);
      }
    }

    const xMin = merged[0]?.x;
    const xMax = merged.at(-1)?.x;

    const canvas = document.getElementById('batteryChart');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (batteryChartInstance) batteryChartInstance.destroy();

    batteryChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          { label:'แรงดัน Node 1 (V)', data:v1, borderColor:'#ff7f00', backgroundColor:'rgba(255,127,0,0.2)', fill:true, tension:0.3, pointRadius:0 },
          { label:'แรงดัน Node 2 (V)', data:v2, borderColor:'#007fff', backgroundColor:'rgba(0,127,255,0.2)', fill:true, tension:0.3, pointRadius:0 }
        ]
      },
      options: {
        parsing:false,
        spanGaps:true,
        layout:{ padding:{ top:0, bottom:0 } },
        scales:{
          x: xScaleOpts(range, xMin, xMax),
          y: { beginAtZero:false, ticks:{ color:'white' }, title:{ display:true, text:'แรงดัน (V)', color:'white' }, grid:{ color:'rgba(255,255,255,0.1)' } }
        },
        plugins:{ legend:{ labels:{ color:'white' } }, tooltip:{ mode:'index', intersect:false } },
        responsive:true, maintainAspectRatio:false
      }
    });
  } catch (err) {
    console.error('Error creating battery chart:', err);
  }
}

async function createCurrentChart(range = '1d') {
  try {
    const rows = await fetchHistoricalData(range);
    let { i1, i2 } = parseChartData(rows);

    let merged = (i1.length?i1:[]).concat(i2.length?i2:[]).sort((a,b)=>a.x-b.x);

    if (merged.length === 0) {
      const rowsWide = await fetchHistoricalData('30d');
      const p = parseChartData(rowsWide);
      const all = (p.i1.length?p.i1:[]).concat(p.i2.length?p.i2:[]).sort((a,b)=>a.x-b.x);
      const latest = all.at(-1);
      if (latest) {
        const start = new Date(latest.x.getTime() - msForRange(range));
        i1 = p.i1.filter(pt => pt.x >= start && pt.x <= latest.x);
        i2 = p.i2.filter(pt => pt.x >= start && pt.x <= latest.x);
        merged = i1.concat(i2).sort((a,b)=>a.x-b.x);
      }
    }

    const xMin = merged[0]?.x;
    const xMax = merged.at(-1)?.x;
    const yB   = merged.length ? yBoundsFromData(merged, 0.2) : { min: 0, max: 500 };

    const canvas = document.getElementById('currentChart');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (currentChartInstance) currentChartInstance.destroy();

    currentChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          { label:'กระแส Node 1 (mA)', data:i1, borderColor:'#ff4500', backgroundColor:'rgba(255,69,0,0.2)', fill:true, tension:0.3, pointRadius:0 },
          { label:'กระแส Node 2 (mA)', data:i2, borderColor:'#1e90ff', backgroundColor:'rgba(30,144,255,0.2)', fill:true, tension:0.3, pointRadius:0 }
        ]
      },
      options: {
        parsing:false,
        spanGaps:true,
        layout:{ padding:{ top:0, bottom:0 } },
        scales:{
          x: xScaleOpts(range, xMin, xMax),
          y: { beginAtZero:false, min:yB.min, max:yB.max, ticks:{ color:'white' }, title:{ display:true, text:'กระแส (mA)', color:'white' }, grid:{ color:'rgba(255,255,255,0.1)' } }
        },
        plugins:{ legend:{ labels:{ color:'white' } }, tooltip:{ mode:'index', intersect:false } },
        responsive:true, maintainAspectRatio:false
      }
    });
  } catch (err) {
    console.error('Error creating current chart:', err);
  }
}

/* ---------- Live nodes/table ---------- */
async function loadData() {
  try {
    // backend ไม่ใส่ range → คืนล่าสุด N แถว
    const url = `https://backend-water-rf88.onrender.com/distance?_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();

    allData = (Array.isArray(data) ? data : []).filter(item => (isDef(item.distance)));

    // ใหม่ → เก่า
    allData.sort((a, b) => {
      const ta = parseToDate(a.time_node1 ?? a.time_node2 ?? a.timestamp)?.getTime() ?? 0;
      const tb = parseToDate(b.time_node1 ?? b.time_node2 ?? b.timestamp)?.getTime() ?? 0;
      return tb - ta;
    });
    currentIndex = 0;

    updateTable(true);
    updateErrorList(allData);

    const latest = allData[0];

    if (latest) {
      const level = (fixedDepth - latest.distance).toFixed(1);
      document.getElementById('waterLevelNode1').innerText = `ระดับน้ำปัจจุบัน: ${level} cm`;
      updateWaterGauge(level); // ⬅️ อัปเดตเกจน้ำ

      document.getElementById('rssiNode1').innerText    = (latest.rssi_node1 && latest.rssi_node1 !== 0) ? `RSSI: ${latest.rssi_node1}` : 'RSSI: -';
      document.getElementById('voltageNode1').innerText  = (isDef(latest.v_node1)) ? `แรงดัน: ${latest.v_node1} V` : 'แรงดัน: -';
      document.getElementById('currentNode1').innerText  = (isDef(latest.i_node1)) ? `กระแส: ${latest.i_node1} mA` : 'กระแส: -';
      document.getElementById('timeNode1').innerText     = latest.time_node1 || latest.timestamp || 'เวลาวัด: -';

      document.getElementById('rssiNode2').innerText    = (latest.rssi_node2 && latest.rssi_node2 !== 0) ? `RSSI: ${latest.rssi_node2}` : 'RSSI: -';
      document.getElementById('voltageNode2').innerText  = (isDef(latest.v_node2)) ? `แรงดัน: ${latest.v_node2} V` : 'แรงดัน: -';
      document.getElementById('currentNode2').innerText  = (isDef(latest.i_node2)) ? `กระแส: ${latest.i_node2} mA` : 'กระแส: -';
      document.getElementById('timeNode2').innerText     = latest.time_node2 || latest.timestamp || 'เวลาวัด: -';
    } else {
      // ถ้าไม่มีข้อมูลเลย รีเซ็ตเกจน้ำไปที่ 0
      updateWaterGauge(0);
    }

    drawVoltageGauge('voltGauge1', (latest?.v_node1 ?? 10), 10, 12.9);
    drawVoltageGauge('voltGauge2', (latest?.v_node2 ?? 10), 10, 12.9);

  } catch (error) {
    console.error('Load data error:', error);

    ['waterLevelNode1','rssiNode1','voltageNode1','currentNode1','timeNode1','rssiNode2','voltageNode2','currentNode2','timeNode2']
      .forEach(id => { const el = document.getElementById(id); if (el) el.innerText = '-'; });

    drawVoltageGauge('voltGauge1', 10, 10, 12.9);
    drawVoltageGauge('voltGauge2', 10, 10, 12.9);
    updateWaterGauge(0);

    const tbody = document.querySelector('#dataTable tbody'); if (tbody) tbody.innerHTML = '';
    const more  = document.getElementById('moreButtonContainer'); if (more) more.innerHTML = '';
    const box   = document.getElementById('errorList');
    if (box) box.innerHTML = `<div>Backend ไม่ตอบ: ${String(error.message || error)}</div>`;
  }
}

function updateTable(clear=false) {
  const tbody = document.querySelector('#dataTable tbody'); if (!tbody) return;
  if (clear) { tbody.innerHTML=''; currentIndex=0; }

  const sliceData = allData.slice(currentIndex, currentIndex + pageSize);
  sliceData.forEach(item => {
    const level  = (fixedDepth - item.distance).toFixed(1);
    const distRaw = Number(item.distance).toFixed(1);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${distRaw}</td><td>${level}</td>
      <td>${(item.rssi_node1 && item.rssi_node1 !== 0) ? item.rssi_node1 : '-'}</td>
      <td>${(item.rssi_node2 && item.rssi_node2 !== 0) ? item.rssi_node2 : '-'}</td>
      <td>${(isDef(item.v_node1)) ? item.v_node1 + ' V' : '-'}</td>
      <td>${(isDef(item.i_node1)) ? item.i_node1 + ' mA' : '-'}</td>
      <td>${(isDef(item.v_node2)) ? item.v_node2 + ' V' : '-'}</td>
      <td>${(isDef(item.i_node2)) ? item.i_node2 + ' mA' : '-'}</td>
      <td>${item.time_node1 || item.timestamp || '-'}</td>
      <td>${item.time_node2 || item.timestamp || '-'}</td>`;
    tbody.appendChild(tr);
  });

  currentIndex += sliceData.length;
  updateMoreButton();
}

function updateMoreButton() {
  const c = document.getElementById('moreButtonContainer'); if (!c) return;
  c.innerHTML = '';

  if (currentIndex < allData.length) {
    const btn = document.createElement('button');
    btn.innerText = 'ดูข้อมูลเพิ่มเติม';
    // (สไตล์ใช้ใน style.css: #moreButtonContainer button)
    btn.onclick = () => updateTable(false);
    c.appendChild(btn);
  }
}

/* ใช้คลาส .hidden ตาม CSS */
function toggleErrorBox() {
  const box = document.getElementById('errorBox');
  if (!box) return;
  box.classList.toggle('hidden');
}

function updateErrorList(data) {
  const box = document.getElementById('errorList');
  if (!box) return;
  box.innerHTML = '';
  data.forEach(item => {
    if (Number(item.distance) < 10) {
      const div = document.createElement('div');
      div.innerText = `Warning! ระดับน้ำต่ำเกินไป: ${Number(item.distance).toFixed(1)} cm เวลา: ${item.time_node1 || item.timestamp}`;
      box.appendChild(div);
    }
  });
}

/* ===== Sidebar / Hamburger ===== */
(function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const btn      = document.getElementById('hamburgerBtn');
  const backdrop = document.getElementById('backdrop');
  if (!sidebar || !btn || !backdrop) return;

  const open  = () => {
    sidebar.classList.add('open');
    backdrop.classList.add('show');
    btn.setAttribute('aria-expanded', 'true');
    sidebar.setAttribute('aria-hidden', 'false');
  };
  const close = () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
    btn.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'true');
  };

  btn.addEventListener('click', () => {
    sidebar.classList.contains('open') ? close() : open();
  });
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  sidebar.querySelectorAll('.nav-item').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = a.getAttribute('data-target');
      close();
      if (!targetId) return;
      const el = document.getElementById(targetId);
      if (el) {
        const topbarH = document.querySelector('.topbar')?.offsetHeight ?? 0;
        const y = el.getBoundingClientRect().top + window.scrollY - (topbarH + 12);
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });
})();

/* ===== Boot & Auto Refresh ===== */
window.onload = async () => {
  const initialRange = '1d';
  await loadData();
  await createWaterLevelChart(initialRange);
  await createOneHourChart();
  await createBatteryChart(initialRange);
  await createCurrentChart(initialRange);
  setActiveRange('timeRangeButtons', initialRange);
  setActiveRange('batteryTimeRangeButtons', initialRange);
  setActiveRange('currentTimeRangeButtons', initialRange);

  setupRangeButtons();
  setupSummaryToggle();
};
/* ===== Export helpers ===== */

// ดึงข้อมูลตารางเป็น array (ใช้ตัวแปร allData ที่มีอยู่แล้ว)
async function waitChartsReady() {
  const charts = [
    waterLevelChartInstance,
    oneHourChartInstance,
    batteryChartInstance,
    currentChartInstance
  ].filter(Boolean);

  charts.forEach(ch => {
    if (!ch) return;
    ch.options.animation = false;
    ch.resize();
    ch.update('none');
  });

  // รอสองเฟรมให้ layout/scale เสถียร
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// แปลง element → PNG (พื้นหลังขาว, useCORS, สเกลสูง)
async function elementToPngFixed(el, scale = 2) {
  if (!el) return null;
  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: false,
    scale
  });
  return canvas.toDataURL('image/png');
}

// แปลง Chart.js → PNG (มี fallback เป็น element capture)
async function chartToPNGFixed(chart) {
  if (!chart) return null;
  try {
    await waitChartsReady();
    const prev = chart.options.devicePixelRatio;
    chart.options.devicePixelRatio = 2;   // คมขึ้น
    chart.resize();
    const dataUrl = chart.toBase64Image('image/png', 1.0);
    chart.options.devicePixelRatio = prev;
    chart.resize();
    return dataUrl;
  } catch (e) {
    // เผื่อโดน CORS/block → จับภาพจาก DOM แทน
    const container = chart.canvas?.parentElement || chart.canvas;
    return elementToPngFixed(container, 2);
  }
}

// วางรูปแบบไหลขึ้นหน้าใหม่อัตโนมัติ
function addImageWithFlow(doc, imgData, x, y, w, h, margin) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + h + margin > pageH) {
    doc.addPage();
    y = margin;
  }
  doc.addImage(imgData, 'PNG', x, y, w, h);
  return y + h + 10; // เว้นบรรทัด
}

// header เป็น DOM ชั่วคราวเพื่อรองรับฟอนต์ไทย แล้วแคปเป็นรูป
async function buildHeaderImage() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:1024px;padding:16px 20px;background:#fff;color:#222;font-family:Sarabun,Segoe UI,Tahoma;';
  wrap.innerHTML = `
    <div style="font-size:22px;font-weight:700;line-height:1.4;">
      Water Level Monitoring — รายงานสรุป
    </div>
    <div style="font-size:13px;opacity:.8;">
      วันที่พิมพ์: ${new Intl.DateTimeFormat('th-TH',{ dateStyle:'medium', timeStyle:'short' }).format(new Date())}
    </div>
  `;
  document.body.appendChild(wrap);
  const png = await elementToPngFixed(wrap, 2);
  document.body.removeChild(wrap);
  return png;
}

// ===== main: ส่งออก PDF (แทนของเดิมชื่อเดียวกัน) =====
async function exportDashboardPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });

  const margin = 28;
  const pageW  = doc.internal.pageSize.getWidth();
  let y = margin;

  // Header
  const headPng = await buildHeaderImage();
  if (headPng) y = addImageWithFlow(doc, headPng, margin, y, pageW - margin*2, 60, margin);

  // เกจระดับน้ำ (ทั้งการ์ด) — ถ้าไม่มี .water-gauge-card จะ fallback เป็น #waterGauge
  const waterCard = document.querySelector('.water-gauge-card') || document.getElementById('waterGauge');
  if (waterCard) {
    const waterPng = await elementToPngFixed(waterCard, 2);
    if (waterPng) y = addImageWithFlow(doc, waterPng, margin, y, pageW - margin*2, 180, margin);
  }

  // กราฟ (ทีละรูป)
  const graphs = [
    await chartToPNGFixed(waterLevelChartInstance),
    await chartToPNGFixed(oneHourChartInstance),
    await chartToPNGFixed(batteryChartInstance),
    await chartToPNGFixed(currentChartInstance)
  ].filter(Boolean);

  for (const g of graphs) {
    y = addImageWithFlow(doc, g, margin, y, pageW - margin*2, 210, margin);
  }

  // สรุปล่าสุด (Text)
  const latest = allData[0];
  if (latest) {
    const pageH = doc.internal.pageSize.getHeight();
    if (y + 60 + margin > pageH) { doc.addPage(); y = margin; }
    const level = (fixedDepth - Number(latest.distance ?? 0)).toFixed(1);

    doc.setFont('Helvetica','bold'); doc.setFontSize(12);
    doc.text('สรุปล่าสุด', margin, y);
    doc.setFont('Helvetica','normal'); doc.setFontSize(11);

    const line = `ระดับน้ำ: ${level} cm | RSSI N1/N2: ${latest.rssi_node1 ?? '-'} / ${latest.rssi_node2 ?? '-'} | `
               + `V/I N1: ${latest.v_node1 ?? '-'}V / ${latest.i_node1 ?? '-'}mA | `
               + `V/I N2: ${latest.v_node2 ?? '-'}V / ${latest.i_node2 ?? '-'}mA | `
               + `เวลา: ${latest.time_node1 || latest.timestamp || '-'}`;

    // รองรับข้อความยาว — ตัดบรรทัดอัตโนมัติ
    const wrapped = doc.splitTextToSize(line, pageW - margin*2);
    doc.text(wrapped, margin, y + 16);
  }

  doc.save(`Water_Report_${new Date().toISOString().slice(0,10)}.pdf`);
}

/* ===== CSV Export (ใหม่) ===== */
function exportCSV() {
  try {
    if (!Array.isArray(allData) || allData.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const headers = [
      'ระดับน้ำดิบ (cm)', 'ระดับน้ำ (cm)',
      'RSSI Node1', 'RSSI Node2',
      'V Node1', 'I Node1',
      'V Node2', 'I Node2',
      'เวลาวัด Node1', 'เวลาวัด Node2'
    ];

    const rows = allData.map(item => {
      const level  = (fixedDepth - Number(item.distance ?? 0));
      return [
        Number(item.distance ?? '').toFixed(1),
        Number.isFinite(level) ? level.toFixed(1) : '',
        (item.rssi_node1 && item.rssi_node1 !== 0) ? String(item.rssi_node1) : '',
        (item.rssi_node2 && item.rssi_node2 !== 0) ? String(item.rssi_node2) : '',
        isDef(item.v_node1) ? `${item.v_node1}` : '',
        isDef(item.i_node1) ? `${item.i_node1}` : '',
        isDef(item.v_node2) ? `${item.v_node2}` : '',
        isDef(item.i_node2) ? `${item.i_node2}` : '',
        item.time_node1 || item.timestamp || '',
        item.time_node2 || item.timestamp || ''
      ];
    });

    const esc = (val) => {
      const s = String(val ?? '');
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    };

    const lines = [headers.map(esc).join(',')];
    rows.forEach(r => lines.push(r.map(esc).join(',')));

    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    const ts = new Date();
    a.href = url;
    a.download = `Water_Data_All_${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('CSV export error:', e);
    alert('ส่งออก CSV ไม่สำเร็จ');
  }
}


// รวมข้อมูลเป็นรายวัน/รายเดือน
function aggregateRows(rows, mode = 'day') {
  const fmt = (d) => {
    const dt = parseToDate(d);
    if (!dt) return null;
    const y = dt.getFullYear();
    const m = (dt.getMonth()+1).toString().padStart(2,'0');
    const dd = dt.getDate().toString().padStart(2,'0');
    return mode === 'day' ? `${y}-${m}-${dd}` : `${y}-${m}`;
  };

  const map = new Map();
  rows.forEach(it => {
    const key = fmt(it.time_node1 ?? it.time_node2 ?? it.timestamp);
    if (!key) return;
    const level = fixedDepth - Number(it.distance ?? NaN);
    const v1 = Number(it.v_node1 ?? NaN);
    const v2 = Number(it.v_node2 ?? NaN);
    const i1 = Number(it.i_node1 ?? NaN);
    const i2 = Number(it.i_node2 ?? NaN);

    if (!map.has(key)) map.set(key, {
      key, count:0,
      levelSum:0, levelMin:+Infinity, levelMax:-Infinity,
      v1Sum:0, v1Count:0, v2Sum:0, v2Count:0,
      i1Sum:0, i1Count:0, i2Sum:0, i2Count:0
    });
    const acc = map.get(key);
    acc.count++;

    if (Number.isFinite(level)) {
      acc.levelSum += level;
      acc.levelMin = Math.min(acc.levelMin, level);
      acc.levelMax = Math.max(acc.levelMax, level);
    }
    if (Number.isFinite(v1)) { acc.v1Sum += v1; acc.v1Count++; }
    if (Number.isFinite(v2)) { acc.v2Sum += v2; acc.v2Count++; }
    if (Number.isFinite(i1)) { acc.i1Sum += i1; acc.i1Count++; }
    if (Number.isFinite(i2)) { acc.i2Sum += i2; acc.i2Count++; }
  });

  const arr = [...map.values()].map(a => ({
    period: a.key,
    samples: a.count,
    level_avg: (a.levelSum / Math.max(1,a.count)).toFixed(1),
    level_min: (a.levelMin === +Infinity ? '-' : a.levelMin.toFixed(1)),
    level_max: (a.levelMax === -Infinity ? '-' : a.levelMax.toFixed(1)),
    v1_avg: (a.v1Count? (a.v1Sum/a.v1Count).toFixed(2) : '-'),
    v2_avg: (a.v2Count? (a.v2Sum/a.v2Count).toFixed(2) : '-'),
    i1_avg: (a.i1Count? (a.i1Sum/a.i1Count).toFixed(1) : '-'),
    i2_avg: (a.i2Count? (a.i2Sum/a.i2Count).toFixed(1) : '-'),
  }));

  // เรียงใหม่→เก่า แล้วตัดแค่ 20 แถว
  arr.sort((a,b) => (a.period < b.period ? 1 : -1));
  return arr.slice(0, 20);
}

// เรนเดอร์ตารางสรุป (แทนที่เนื้อหา tbody)
function renderSummaryTable(mode = 'day') {
  const tbody = document.querySelector('#dataTable tbody');
  const thead = document.querySelector('#dataTable thead tr');
  if (!tbody || !thead) return;

  // เปลี่ยนหัวตารางให้เหมาะกับสรุป
  thead.innerHTML = `
    <th>${mode === 'day' ? 'วันที่' : 'เดือน'}</th>
    <th>จำนวนตัวอย่าง</th>
    <th>ระดับน้ำเฉลี่ย (cm)</th>
    <th>ต่ำสุด</th>
    <th>สูงสุด</th>
    <th>V1 เฉลี่ย</th>
    <th>V2 เฉลี่ย</th>
    <th>I1 เฉลี่ย</th>
    <th>I2 เฉลี่ย</th>
  `;

  const summary = aggregateRows(allData, mode);
  tbody.innerHTML = '';
  summary.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.period}</td>
      <td>${r.samples}</td>
      <td>${r.level_avg}</td>
      <td>${r.level_min}</td>
      <td>${r.level_max}</td>
      <td>${r.v1_avg}</td>
      <td>${r.v2_avg}</td>
      <td>${r.i1_avg}</td>
      <td>${r.i2_avg}</td>
    `;
    tbody.appendChild(tr);
  });

  // ซ่อนปุ่ม "ดูข้อมูลเพิ่มเติม"
  const more = document.getElementById('moreButtonContainer');
  if (more) more.innerHTML = '';
}

// Hook ปุ่มสลับมุมมอง
function setupSummaryToggle() {
  const wrap = document.getElementById('summaryToggle');
  if (!wrap) return;
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if (!btn) return;
    const view = btn.getAttribute('data-view');
    // สลับ active
    wrap.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    if (view === 'raw') {
      // กลับไปตารางดิบ (หัวตารางเดิม + paginate)
      const thead = document.querySelector('#dataTable thead tr');
      if (thead) {
        thead.innerHTML = `
          <th>ระดับน้ำดิบ (cm)</th>
          <th>ระดับน้ำ (cm)</th>
          <th>RSSI Node1</th>
          <th>RSSI Node2</th>
          <th>V Node1</th>
          <th>I Node1</th>
          <th>V Node2</th>
          <th>I Node2</th>
          <th>เวลาวัด Node1</th>
          <th>เวลาวัด Node2</th>`;
      }
      const tbody = document.querySelector('#dataTable tbody');
      if (tbody) tbody.innerHTML = '';
      currentIndex = 0; updateTable(true);
    } else {
      renderSummaryTable(view); // 'day' หรือ 'month'
    }
  });
}




/* ===== Hook ปุ่ม ===== */
function setupExportButtons() {
  const pdfBtn = document.getElementById('exportPdfBtn');
  const csvBtn = document.getElementById('exportCsvBtn');

  if (pdfBtn) pdfBtn.addEventListener('click', exportDashboardPDF);
  if (csvBtn) csvBtn.addEventListener('click', exportCSV);
}

// เรียกหลัง DOM พร้อมแล้ว (มีอยู่แล้วใน onload → เติมบรรทัดนี้ก็พอ)
window.addEventListener('load', setupExportButtons);


// รีเฟรชทุก 60 วินาที (ข้อมูล Live + กราฟ 1 ชม.)
setInterval(() => {
  loadData();
  createOneHourChart();
}, 60000);

/* ===== Range Buttons ===== */
function setupRangeButtons() {
  // น้ำ
  const waterBtns = document.querySelectorAll('#timeRangeButtons .range-btn');
  waterBtns.forEach(button => {
    button.addEventListener('click', async () => {
      waterBtns.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      await createWaterLevelChart(button.getAttribute('data-range'));
    });
  });

  // กระแส
  const currentBtns = document.querySelectorAll('#currentTimeRangeButtons .range-btn');
  currentBtns.forEach(button => {
    button.addEventListener('click', async () => {
      currentBtns.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      await createCurrentChart(button.getAttribute('data-range'));
    });
  });

  // แบต
  const batteryBtns = document.querySelectorAll('#batteryTimeRangeButtons .range-btn');
  batteryBtns.forEach(button => {
    button.addEventListener('click', async () => {
      batteryBtns.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      await createBatteryChart(button.getAttribute('data-range'));
    });
  });
}
/* ================= Report (ตารางไม่ใช่กราฟ) – FULL BLOCK ================= */
let reportData = [];

/* ---------- Utils ---------- */
function getDateLocalStr(d){
  if (!(d instanceof Date) || isNaN(+d)) return '';
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  const hh=String(d.getHours()).padStart(2,'0'), mm=String(d.getMinutes()).padStart(2,'0');
  return `${y}-${m}-${dd}T${hh}:${mm}`;
}
function getInputDate(id){
  const el = document.getElementById(id);
  if (!el || !el.value) return null;
  const dt = new Date(el.value);
  return isNaN(+dt) ? null : dt;
}
function filterByRange(rows, startDT, endDT){
  const s = startDT ? +startDT : -Infinity;
  const e = endDT ? (+endDT + 59*1000) : +Infinity; // รวมถึงนาทีสุดท้าย
  return rows.filter(it=>{
    const ts = parseToDate(it.time_node1 ?? it.time_node2 ?? it.timestamp);
    if (!ts) return false;
    const t = +ts;
    return t >= s && t <= e;
  });
}
function renderReportTable(rows){
  const tb = document.querySelector('#reportTable tbody');
  if (!tb) return;
  tb.innerHTML = '';
  rows.forEach((it, idx)=>{
    const level = fixedDepth - Number(it.distance ?? 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${Number(it.distance ?? '').toFixed(1)}</td>
      <td>${Number.isFinite(level) ? level.toFixed(1) : ''}</td>
      <td>${(it.rssi_node1 && it.rssi_node1 !== 0) ? it.rssi_node1 : ''}</td>
      <td>${(it.rssi_node2 && it.rssi_node2 !== 0) ? it.rssi_node2 : ''}</td>
      <td>${isDef(it.v_node1) ? it.v_node1 : ''}</td>
      <td>${isDef(it.i_node1) ? it.i_node1 : ''}</td>
      <td>${isDef(it.v_node2) ? it.v_node2 : ''}</td>
      <td>${isDef(it.i_node2) ? it.i_node2 : ''}</td>
      <td>${it.time_node1 || it.timestamp || ''}</td>
      <td>${it.time_node2 || it.timestamp || ''}</td>`;
    tb.appendChild(tr);
  });
}

/* ---------- Quick-range buttons & search ---------- */
function setupReportQuickRanges(){
  const now = new Date();
  const inS = document.getElementById('reportStart');
  const inE = document.getElementById('reportEnd');
  if (inS) inS.value = getDateLocalStr(new Date(now.setHours(0,0,0,0)));
  if (inE) inE.value = getDateLocalStr(new Date());

  document.getElementById('reportQuickToday')?.setAttribute('type','button');
  document.getElementById('reportQuickYest')?.setAttribute('type','button');
  document.getElementById('reportQuick7d')?.setAttribute('type','button');
  document.getElementById('reportSearchBtn')?.setAttribute('type','button');
  document.getElementById('reportExportCsv')?.setAttribute('type','button');
  document.getElementById('reportExportPdf')?.setAttribute('type','button');

  document.getElementById('reportQuickToday')?.addEventListener('click', ()=>{
    const s = new Date(); s.setHours(0,0,0,0);
    const e = new Date();
    inS.value = getDateLocalStr(s); inE.value = getDateLocalStr(e);
  });
  document.getElementById('reportQuickYest')?.addEventListener('click', ()=>{
    const s = new Date(); s.setDate(s.getDate()-1); s.setHours(0,0,0,0);
    const e = new Date(); e.setDate(e.getDate()-1); e.setHours(23,59,0,0);
    inS.value = getDateLocalStr(s); inE.value = getDateLocalStr(e);
  });
  document.getElementById('reportQuick7d')?.addEventListener('click', ()=>{
    const e = new Date(); const s = new Date(e.getTime() - 7*24*60*60*1000);
    inS.value = getDateLocalStr(s); inE.value = getDateLocalStr(e);
  });
}
async function runReportSearch(){
  try{
    if (!Array.isArray(allData) || allData.length===0) await loadData();
    const s = getInputDate('reportStart'), e = getInputDate('reportEnd');

    let src = allData.slice().sort((a,b)=>{
      const ta = +parseToDate(a.time_node1 ?? a.time_node2 ?? a.timestamp) || 0;
      const tb = +parseToDate(b.time_node1 ?? b.time_node2 ?? b.timestamp) || 0;
      return ta - tb;
    });
    if (src.length===0){ const rows = await fetchHistoricalData('30d'); src = Array.isArray(rows)?rows:[]; }

    reportData = filterByRange(src, s, e);
    renderReportTable(reportData);
    if (!reportData.length) alert('ไม่พบข้อมูลในช่วงเวลาที่เลือก');
  }catch(err){
    console.error('[Report] search error:', err);
    alert('ค้นหารายงานไม่สำเร็จ');
  }
}

/* ---------- CSV (ทุกแถวใน reportData) ---------- */
function exportReportCSV(){
  if (!reportData?.length){ alert('ยังไม่มีข้อมูลในตารางรายงาน'); return; }
  const headers = ['#','ระดับน้ำดิบ (cm)','ระดับน้ำ (cm)','RSSI Node1','RSSI Node2',
    'V Node1','I Node1','V Node2','I Node2','เวลาวัด Node1','เวลาวัด Node2'];
  const rows = reportData.map((it,idx)=>{
    const level = fixedDepth - Number(it.distance ?? 0);
    return [
      idx+1,
      Number(it.distance ?? '').toFixed(1),
      Number.isFinite(level) ? level.toFixed(1) : '',
      (it.rssi_node1&&it.rssi_node1!==0)?it.rssi_node1:'',
      (it.rssi_node2&&it.rssi_node2!==0)?it.rssi_node2:'',
      isDef(it.v_node1)?it.v_node1:'', isDef(it.i_node1)?it.i_node1:'',
      isDef(it.v_node2)?it.v_node2:'', isDef(it.i_node2)?it.i_node2:'',
      it.time_node1 || it.timestamp || '', it.time_node2 || it.timestamp || ''
    ];
  });
  const esc = s=>{ const t=String(s??''); return /[",\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t; };
  const csv = '\uFEFF' + [headers.map(esc).join(',')].concat(rows.map(r=>r.map(esc).join(','))).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'})),
    download: `Water_Report_Table_${new Date().toISOString().slice(0,10)}.csv`
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ---------- PDF (ประกาศก่อน setupReportBox เพื่อไม่ให้ undefined) ---------- */
/* ตั้งค่าหัวรายงาน */
window.REPORT_BRAND = window.REPORT_BRAND || {
  logoSrc: 'PATH/LOGO.png', // <— ใส่โลโก้จริงที่โหลดได้
  orgName: '200/1 ถนนอุตรกิจ ต.เวียง อ.เมือง จ.เชียงราย 57000',
  title: 'รายงานประวัติการวัดระดับน้ำ',
  rightDatePrefix: 'วันที่พิมพ์'
};
async function buildFormalHeaderImage(widthPx){
  const host = document.createElement('div');
  host.style.cssText = `width:${widthPx}px;padding:24px 24px 8px;background:#fff;color:#111;
    font-family:Sarabun,Segoe UI,Tahoma,sans-serif;line-height:1.45;`;
  host.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div style="display:flex;align-items:center;gap:16px;">
        <img src="${window.REPORT_BRAND.logoSrc||''}" style="height:72px;object-fit:contain"/>
        <div style="font-size:16px;font-weight:600;">${window.REPORT_BRAND.orgName||''}</div>
      </div>
      <div style="font-size:12px;opacity:.8;">
        ${(window.REPORT_BRAND.rightDatePrefix||'วันที่พิมพ์')}: ${
          new Intl.DateTimeFormat('th-TH',{dateStyle:'full',timeStyle:'short'}).format(new Date())
        }
      </div>
    </div>
    <div style="text-align:center;margin-top:12px;font-weight:700;font-size:18px;">
      ${window.REPORT_BRAND.title||'รายงาน'}
    </div>`;
  document.body.appendChild(host);
  const img = await html2canvas(host, { backgroundColor:'#fff', useCORS:true, scale:2 });
  document.body.removeChild(host);
  return img.toDataURL('image/png');
}
async function buildReportTableImage(rows, startIdx, endIdx, widthPx){
  const host = document.createElement('div');
  host.style.cssText = `width:${widthPx}px;background:#fff;color:#111;padding:0 24px 12px;
    font-family:Sarabun,Segoe UI,Tahoma,sans-serif;`;
  const hdrBg='#0b1220', hdrCol='#f5f7ff', border='1px solid #d6dbe3';
  let body=''; for(let i=startIdx;i<endIdx;i++){ const it=rows[i]; const level=fixedDepth-Number(it.distance??0);
    body += `<tr>
      <td>${i+1}</td>
      <td>${Number(it.distance ?? '').toFixed(1)}</td>
      <td>${Number.isFinite(level) ? level.toFixed(1) : ''}</td>
      <td>${(it.rssi_node1&&it.rssi_node1!==0)?it.rssi_node1:''}</td>
      <td>${(it.rssi_node2&&it.rssi_node2!==0)?it.rssi_node2:''}</td>
      <td>${isDef(it.v_node1)?it.v_node1:''}</td>
      <td>${isDef(it.i_node1)?it.i_node1:''}</td>
      <td>${isDef(it.v_node2)?it.v_node2:''}</td>
      <td>${isDef(it.i_node2)?it.i_node2:''}</td>
      <td>${it.time_node1 || it.timestamp || ''}</td>
      <td>${it.time_node2 || it.timestamp || ''}</td></tr>`;
  }
  host.innerHTML = `
    <style>
      #__tbl__{width:100%;border-collapse:collapse;font-size:12px;}
      #__tbl__ th,#__tbl__ td{border:${border};padding:6px 8px;vertical-align:top;}
      #__tbl__ thead th{background:${hdrBg};color:${hdrCol};}
      #__tbl__ tbody tr:nth-child(even){background:#f6f8fb;}
    </style>
    <table id="__tbl__">
      <thead><tr>
        <th>#</th><th>ระดับน้ำดิบ (cm)</th><th>ระดับน้ำ (cm)</th>
        <th>RSSI Node1</th><th>RSSI Node2</th>
        <th>V Node1</th><th>I Node1</th>
        <th>V Node2</th><th>I Node2</th>
        <th>เวลาวัด Node1</th><th>เวลาวัด Node2</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  document.body.appendChild(host);
  const img = await html2canvas(host, { backgroundColor:'#fff', useCORS:true, scale:2 });
  document.body.removeChild(host);
  return img.toDataURL('image/png');
}
function drawSignatureLines(doc, margin, y, pageW){
  const lineW=210, leftX=margin, rightX=pageW-margin-lineW;
  doc.setLineWidth(0.7); doc.setDrawColor(150);
  doc.line(leftX,y,leftX+lineW,y); doc.line(rightX,y,rightX+lineW,y);
  doc.setFont('Helvetica','normal'); doc.setFontSize(11);
  doc.text('ผู้จัดทำรายงาน', leftX, y+16); doc.text('ผู้รับรอง', rightX, y+16);
  doc.setFontSize(10);
  doc.text('( .................................. )', leftX+10, y+44);
  doc.text('( .................................. )', rightX+10, y+44);
  doc.text('ตำแหน่ง..................................', leftX, y+64);
  doc.text('ตำแหน่ง..................................', rightX, y+64);
  return y+64+20;
}
async function exportReportPDF(){
  if (!reportData?.length){ alert('ยังไม่มีข้อมูลในตารางรายงาน'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'pt', format:'a4' });
  const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin=36;

  // Header
  const head = await buildFormalHeaderImage(Math.floor(pageW - margin*2));
  let y = margin;
  doc.addImage(head,'PNG',margin,y,pageW-margin*2,110); y += 120;

  // ช่วงเวลา
  doc.setFont('Helvetica','normal'); doc.setFontSize(11);
  const s = document.getElementById('reportStart')?.value || '-';
  const e = document.getElementById('reportEnd')?.value || '-';
  doc.text(`ช่วงเวลา: ${s} ถึง ${e}`, margin, y); y += 16;

  // ตาราง (แบ่งหน้า)
  const rowsPerChunk = 18;
  for(let i=0;i<reportData.length;i+=rowsPerChunk){
    const tbl = await buildReportTableImage(reportData, i, Math.min(i+rowsPerChunk, reportData.length), Math.floor(pageW-margin*2));
    const tblH = (pageW - margin*2) * 0.62; // สัดส่วนโดยประมาณ
    if (y + tblH > pageH - 140){ doc.addPage(); y = margin; }
    doc.addImage(tbl,'PNG',margin,y,pageW-margin*2,tblH); y += tblH + 14;
  }

  if (y + 120 > pageH - margin){ doc.addPage(); y = margin; }
  drawSignatureLines(doc, margin, y+10, pageW);
  doc.save(`Water_Report_${new Date().toISOString().slice(0,10)}.pdf`);
}

/* ---------- Hook ปุ่ม (ประกาศหลัง exportReportPDF เพื่อไม่ undefined) ---------- */
function setupReportQuickDomTypes(){
  // กันกรณีปุ่มอยู่ใน <form> จะเผลอ submit
  ['reportQuickToday','reportQuickYest','reportQuick7d','reportSearchBtn','reportExportCsv','reportExportPdf']
    .forEach(id=>document.getElementById(id)?.setAttribute('type','button'));
}
function setupReportBox(){
  setupReportQuickDomTypes();
  setupReportQuickRanges();
  document.getElementById('reportSearchBtn')?.addEventListener('click', runReportSearch);
  document.getElementById('reportExportCsv')?.addEventListener('click', exportReportCSV);
  document.getElementById('reportExportPdf')?.addEventListener('click', exportReportPDF);
}
window.addEventListener('load', setupReportBox);
