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
  if (m) return new Date(`${m[1]}T${m[2]}`); // local (ไม่ใส่ Z)
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
      color:'white',
      autoSkip:true,
      autoSkipPadding:18,
      maxRotation:0,
      padding:6,
      callback: (value) =>
        new Intl.DateTimeFormat('th-TH', {
          month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false
        }).format(new Date(value))
    },
    grid: { display:true, color:'rgba(255,255,255,0.22)', lineWidth:1, drawTicks:true },
    title: { display:true, text:'เวลา (Time)', color:'white', font:{ size:14, weight:'bold' } }
  };
}

/* ========= SVG Gauge (10–12.9V) ========= */
function drawVoltageGauge(containerId, value, min = 10, max = 12.9) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const v = Math.max(min, Math.min(max, Number(value) || min));
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

/* ---------- Data ---------- */
async function fetchHistoricalData(range = '30d') {
  const url = `https://backend-water-rf88.onrender.com/distance?range=${range}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  return data; // ไม่กรองที่นี่
}


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


/* ---------- Charts ---------- */
async function createWaterLevelChart(range = '1d') {
  try {
    const rows = await fetchHistoricalData(range);
    const { water } = parseChartData(rows);
    water.sort((a,b)=>a.x-b.x);

    const now = new Date();
    const xMin = water[0]?.x ?? new Date(now.getTime() - 24*60*60*1000);
    const xMax = water.at(-1)?.x ?? now;
    const yB = water.length ? yBoundsFromData(water, 0.2) : { min: 0, max: 50 };

    const canvas = document.getElementById('waterLevelChart30d');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (waterLevelChartInstance) waterLevelChartInstance.destroy();

    waterLevelChartInstance = new Chart(ctx, {
      type: 'line',
      data: { datasets: [{
        label: `ระดับน้ำย้อนหลัง ${range}`,
        data: water,
        borderColor:'#00c0ff',
        backgroundColor:'rgba(0,192,255,0.2)',
        fill:true, tension:0.3, pointRadius: (water.length===1?3:0), cubicInterpolationMode:'monotone'
      }]},
      options: {
        parsing:false,
        // >>> แก้ตรงนี้: เชื่อมช่องว่างทั้งหมด (ไม่ให้กราฟขาด)
        spanGaps: true,
        layout:{ padding:{ top:0, bottom:0 } },
        scales:{
          x: xScaleOpts(range, xMin, xMax),
          y: { beginAtZero:false, min:yB.min, max:yB.max, ticks:{ color:'white' }, grid:{ color:'rgba(255,255,255,0.1)' } }
        },
        plugins:{
          legend:{ labels:{ color:'white' } },
          tooltip:{ mode:'index', intersect:false },
          subtitle:{ display: water.length===0, text:'ไม่มีข้อมูลในช่วงนี้', color:'#ddd' }
        },
        responsive:true, maintainAspectRatio:false
      }
    });
  } catch (err) { console.error('Error creating water chart:', err); }
}

// 1 ชั่วโมง (อิง “ข้อมูลล่าสุด” ถ้าชั่วโมงปัจจุบันว่าง)
async function createOneHourChart() {
  try {
    let rows = await fetchHistoricalData('1h');
    let { water } = parseChartData(rows);
    water.sort((a,b)=>a.x-b.x);

    if (water.length === 0) {
      const rowsWide = await fetchHistoricalData('30d');
      const parsedWide = parseChartData(rowsWide);
      const allWater = parsedWide.water.sort((a,b)=>a.x-b.x);
      const latestTs = allWater.at(-1)?.x;
      if (latestTs) {
        const start = new Date(latestTs.getTime() - 60*60*1000);
        water = allWater.filter(p => p.x >= start && p.x <= latestTs);
        if (water.length === 0) water = [ { x: latestTs, y: allWater.at(-1).y } ];
      }
    }

    const hasData = water.length > 0;
let xMin, xMax;

if (hasData) {
  // ตัดช่องว่างด้านซ้าย: เริ่มที่เวลาของจุดแรกจริง ๆ
  xMin = water[0].x;
  xMax = water.at(-1).x;
} else {
  // ไม่มีข้อมูลเลย: ใช้หน้าต่าง 1 ชม. ตามปกติ
  const now = new Date();
  xMin = new Date(now.getTime() - 60*60*1000);
  xMax = now;
}

const yB = hasData ? yBoundsFromData(water, 0.08) : { min: 0, max: 50 };

    const canvas = document.getElementById('waterLevelChart1h');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (oneHourChartInstance) oneHourChartInstance.destroy();

    oneHourChartInstance = new Chart(ctx, {
      type: 'line',
      data: { datasets: [{
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
  } catch (err) { console.error('Error creating 1h chart (latest-window):', err); }
}

async function createBatteryChart(range = '1d') {
  try {
    const rows = await fetchHistoricalData(range);
    const { v1, v2 } = parseChartData(rows);
    v1.sort((a,b)=>a.x-b.x); v2.sort((a,b)=>a.x-b.x);

    const merged = (v1.length?v1:[]).concat(v2.length?v2:[]).sort((a,b)=>a.x-b.x);
    const now = new Date();
    const xMin = merged[0]?.x ?? new Date(now.getTime() - 24*60*60*1000);
    const xMax = merged.at(-1)?.x ?? now;

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
        spanGaps:true,   // เชื่อมช่องว่างทั้งหมดสำหรับกราฟแบต
        layout:{ padding:{ top:0, bottom:0 } },
        scales:{
          x: xScaleOpts(range, xMin, xMax),
          y: { beginAtZero:false, ticks:{ color:'white' }, title:{ display:true, text:'แรงดัน (V)', color:'white' }, grid:{ color:'rgba(255,255,255,0.1)' } }
        },
        plugins:{ legend:{ labels:{ color:'white' } }, tooltip:{ mode:'index', intersect:false } },
        responsive:true, maintainAspectRatio:false
      }
    });
  } catch (err) { console.error('Error creating battery chart:', err); }
}

async function createCurrentChart(range = '1d') {
  try {
    const rows = await fetchHistoricalData(range);
    const { i1, i2 } = parseChartData(rows);
    i1.sort((a,b)=>a.x-b.x); i2.sort((a,b)=>a.x-b.x);

    const merged = (i1.length?i1:[]).concat(i2.length?i2:[]).sort((a,b)=>a.x-b.x);
    const now = new Date();
    const xMin = merged[0]?.x ?? new Date(now.getTime() - 24*60*60*1000);
    const xMax = merged.at(-1)?.x ?? now;
    const yB = merged.length ? yBoundsFromData(merged, 0.2) : { min: 0, max: 500 };

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
        spanGaps:true,   // เชื่อมช่องว่างทั้งหมดสำหรับกราฟกระแส
        layout:{ padding:{ top:0, bottom:0 } },
        scales:{
          x: xScaleOpts(range, xMin, xMax),
          y: { beginAtZero:false, min:yB.min, max:yB.max, ticks:{ color:'white' }, title:{ display:true, text:'กระแส (mA)', color:'white' }, grid:{ color:'rgba(255,255,255,0.1)' } }
        },
        plugins:{ legend:{ labels:{ color:'white' } }, tooltip:{ mode:'index', intersect:false } },
        responsive:true, maintainAspectRatio:false
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

      document.getElementById('rssiNode1').innerText   = (latest.rssi_node1 && latest.rssi_node1 !== 0) ? `RSSI: ${latest.rssi_node1}` : 'RSSI: -';
      document.getElementById('voltageNode1').innerText = (latest.v_node1 && latest.v_node1 > 0) ? `แรงดัน: ${latest.v_node1} V` : 'แรงดัน: -';
      document.getElementById('currentNode1').innerText = (latest.i_node1 && latest.i_node1 > 0) ? `กระแส: ${latest.i_node1} mA` : 'กระแส: -';
      document.getElementById('timeNode1').innerText    = latest.time_node1 || 'เวลาวัด: -';

      document.getElementById('rssiNode2').innerText   = (latest.rssi_node2 && latest.rssi_node2 !== 0) ? `RSSI: ${latest.rssi_node2}` : 'RSSI: -';
      document.getElementById('voltageNode2').innerText = (latest.v_node2 && latest.v_node2 > 0) ? `แรงดัน: ${latest.v_node2} V` : 'แรงดัน: -';
      document.getElementById('currentNode2').innerText = (latest.i_node2 && latest.i_node2 > 0) ? `กระแส: ${latest.i_node2} mA` : 'กระแส: -';
      document.getElementById('timeNode2').innerText    = latest.time_node2 || 'เวลาวัด: -';
    }

    drawVoltageGauge('voltGauge1', (latest?.v_node1 > 0 ? latest.v_node1 : 10), 10, 12.9);
    drawVoltageGauge('voltGauge2', (latest?.v_node2 > 0 ? latest.v_node2 : 10), 10, 12.9);

  } catch (error) {
    console.error('Load data error:', error);

    ['waterLevelNode1','rssiNode1','voltageNode1','currentNode1','timeNode1','rssiNode2','voltageNode2','currentNode2','timeNode2']
      .forEach(id => { const el = document.getElementById(id); if (el) el.innerText = '-'; });

    drawVoltageGauge('voltGauge1', 10, 10, 12.9);
    drawVoltageGauge('voltGauge2', 10, 10, 12.9);

    const tbody = document.querySelector('#dataTable tbody'); if (tbody) tbody.innerHTML = '';
    const more = document.getElementById('moreButtonContainer'); if (more) more.innerHTML = '';
  }
}

function updateTable(clear=false) {
  const tbody = document.querySelector('#dataTable tbody'); if (!tbody) return;
  if (clear) { tbody.innerHTML=''; currentIndex=0; }
  const sliceData = allData.slice(currentIndex, currentIndex + pageSize);
  sliceData.forEach(item => {
    const level = (fixedDepth - item.distance).toFixed(1), distRaw = item.distance.toFixed(1);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${distRaw}</td><td>${level}</td>
      <td>${(item.rssi_node1 && item.rssi_node1 !== 0) ? item.rssi_node1 : '-'}</td>
      <td>${(item.rssi_node2 && item.rssi_node2 !== 0) ? item.rssi_node2 : '-'}</td>
      <td>${(item.v_node1 && item.v_node1 > 0) ? item.v_node1 + ' V' : '-'}</td>
      <td>${(item.i_node1 && item.i_node1 > 0) ? item.i_node1 + ' mA' : '-'}</td>
      <td>${(item.v_node2 && item.v_node2 > 0) ? item.v_node2 + ' V' : '-'}</td>
      <td>${(item.i_node2 && item.i_node2 > 0) ? item.i_node2 + ' mA' : '-'}</td>
      <td>${item.time_node1 || '-'}</td>
      <td>${item.time_node2 || '-'}</td>`;
    tbody.appendChild(tr);
  });
  currentIndex += sliceData.length; updateMoreButton();
}

function updateMoreButton() {
  const c = document.getElementById('moreButtonContainer'); if (!c) return; c.innerHTML='';
  if (currentIndex < allData.length) {
    const btn = document.createElement('button');
    btn.innerText='ดูข้อมูลเพิ่มเติม';
    btn.style.padding='8px 16px'; btn.style.margin='10px auto';
    btn.style.display='inline-block'; btn.style.cursor='pointer';
    btn.onclick=()=>updateTable(false); c.appendChild(btn);
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
  setActiveRange('timeRangeButtons', initialRange);
  setActiveRange('batteryTimeRangeButtons', initialRange);
  setActiveRange('currentTimeRangeButtons', initialRange);
}

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

/* boot */
window.onload = async () => { await initDashboard(); setupRangeButtons(); };
setInterval(() => {
  loadData();
  createOneHourChart(); // อัปเดตกราฟ 1 ชม. ตามข้อมูลล่าสุด
}, 60000);
