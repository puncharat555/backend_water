/* =======================
   Water Monitoring Script
   ======================= */

/* ---- ค่าคงที่ปรับได้ ---- */
const API_BASE = 'https://backend-water-rf88.onrender.com';
const REFRESH_MS = 60_000;      // รีเฟรชทุก 60 วิ
const fixedDepth = 120;         // ความลึกบ่อสูงสุด (cm)
const pageSize = 10;            // รายการต่อหน้าในตาราง

/* ---- ตัวแปรสถานะ ---- */
let allData = [];               // ข้อมูลทั้งหมดที่โหลดมา
let currentIndex = 0;           // index สำหรับตาราง
let waterLevelChartInstance = null;
let oneHourChartInstance = null;
let batteryChartInstance = null;
let currentChartInstance = null;

/* =======================
   Utils
   ======================= */

/* รองรับจอ HiDPI */
function setupHiDPICanvas(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  ctx.scale(dpr, dpr);
}

/* parse string → Date ที่ทนฟอร์แมตทั่วไป */
function parseToDate(s) {
  if (!s) return null;
  const t = String(s).trim();
  // รูปแบบทั่วไป: 2025-08-09 17:21:24 หรือ 2025-08-09T17:21:24Z
  let m = t.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)(Z)?$/);
  if (m) return new Date(`${m[1]}T${m[2]}${m[4] || ''}`);
  // ISO / millis
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

/* จัดรูปข้อมูลจาก API → array เรียงตามเวลา */
function parseChartData(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const r of rows) {
    const ts = parseToDate(r.time || r.timestamp || r.createdAt);
    if (!ts) continue;
    out.push({
      time: ts,
      node: Number(r.node || r.nodeId || r.node_id || 1),
      distance: Number(r.distance),
      voltage: Number(r.voltage),
      current: Number(r.current),
      rssi: Number(r.rssi),
      raw: r
    });
  }
  // เรียงเวลา
  out.sort((a, b) => a.time - b.time);
  return out;
}

/* ปลอดภัย: getElementById (อาจไม่มี element นั้น ๆ) */
function byId(id) {
  return document.getElementById(id);
}

/* ตั้งข้อความถ้ามี element */
function setText(id, text) {
  const el = byId(id);
  if (el) el.textContent = text;
}

/* =======================
   วาดเกจ/หลอด SVG
   ======================= */

/** Battery Gauge ครึ่งวงกลม (โหนด 10.0–12.9V)
 *  โซน: <11.0 แดง, 11.0–12.0 ส้ม, ≥12.0 เขียว
 */
function drawBatteryGauge(containerId, value, min = 10.0, max = 12.9) {
  const el = byId(containerId);
  if (!el) return;

  const v = Math.max(min, Math.min(max, Number(value) || 0));
  const ratio = (v - min) / (max - min);

  let color = '#4caf50'; // green
  if (v < 11.0) color = '#f44336'; // red
  else if (v < 12.0) color = '#ff9800'; // orange

  const start = Math.PI;         // 180°
  const end = 2 * Math.PI;       // 360°
  const theta = start + ratio * (end - start);

  const R = 220, CX = 250, CY = 270;

  const svg = `
  <svg viewBox="0 0 500 320" preserveAspectRatio="xMidYMid meet">
    <!-- ขอบโค้งพื้นหลัง -->
    <path d="M ${CX-R},${CY}
             A ${R} ${R} 0 1 1 ${CX+R},${CY}"
          fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="24"/>

    <!-- โซนสี: แดง -->
    <path d="M ${CX-R},${CY}
             A ${R} ${R} 0 0 1 ${CX - R*Math.cos(Math.PI/6)},${CY - R*Math.sin(Math.PI/6)}"
          fill="none" stroke="#f44336" stroke-width="24" stroke-linecap="round"/>
    <!-- โซนสี: ส้ม -->
    <path d="M ${CX - R*Math.cos(Math.PI/6)},${CY - R*Math.sin(Math.PI/6)}
             A ${R} ${R} 0 0 1 ${CX + R*Math.cos(Math.PI/6)},${CY - R*Math.sin(Math.PI/6)}"
          fill="none" stroke="#ff9800" stroke-width="24" stroke-linecap="round"/>
    <!-- โซนสี: เขียว -->
    <path d="M ${CX + R*Math.cos(Math.PI/6)},${CY - R*Math.sin(Math.PI/6)}
             A ${R} ${R} 0 0 1 ${CX+R},${CY}"
          fill="none" stroke="#4caf50" stroke-width="24" stroke-linecap="round"/>

    <!-- เข็มค่าปัจจุบัน -->
    <line x1="${CX}" y1="${CY}" x2="${CX + (R-10)*Math.cos(theta)}" y2="${CY + (R-10)*Math.sin(theta)}"
          stroke="${color}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="${CX}" cy="${CY}" r="9" fill="#fff"/>

    <text x="${CX}" y="120" text-anchor="middle" font-size="26" font-weight="700" fill="#fff">${v.toFixed(2)} V</text>
    <text x="${CX}" y="300" text-anchor="middle" font-size="14" fill="rgba(255,255,255,0.8)">ช่วง ${min.toFixed(1)}–${max.toFixed(1)} V</text>
  </svg>`;
  el.innerHTML = svg;
}

/** หลอดระดับน้ำแนวนอน (เต็มแถว)
 *   โซนสีตามที่ต้องการ:
 *   0–40 เขียว, 40–70 ส้ม, 70–120 แดง
 */
function drawWaterTube(containerId, value, min = 0, max = fixedDepth) {
  const el = byId(containerId);
  if (!el) return;

  const v = Math.max(min, Math.min(max, Number(value) || 0));
  const ratio = (v - min) / (max - min);

  // สีทั้งแท่งตามค่า
  let zoneColor;
  if (v < 40) zoneColor = '#00e676';          // เขียว
  else if (v < 70) zoneColor = '#ff9800';     // ส้ม
  else zoneColor = '#f44336';                 // แดง

  // ตำแหน่ง x ของปลายของเหลว
  const xFill = 20 + 960 * ratio;

  const svg = `
    <svg viewBox="0 0 1000 120" preserveAspectRatio="none">
      <!-- ท่อพื้นหลัง -->
      <rect x="20" y="30" width="960" height="40" rx="20" ry="20"
            fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" stroke-width="3"/>
      <!-- ของเหลว (สีตามโซน) -->
      <clipPath id="tubeClip">
        <rect x="20" y="30" width="960" height="40" rx="20" ry="20"/>
      </clipPath>
      <rect x="20" y="30" width="${xFill}" height="40" clip-path="url(#tubeClip)" fill="${zoneColor}"/>

      <!-- สเกล min / max -->
      <text x="20"  y="95" style="font-weight:700;font-size:14px;fill:#fff;text-anchor:start;">${min.toFixed(0)} cm</text>
      <text x="980" y="95" style="font-weight:700;font-size:14px;fill:#fff;text-anchor:end;">${max.toFixed(0)} cm</text>

      <!-- เข็มชี้ค่า -->
      <line x1="${xFill}" y1="18" x2="${xFill}" y2="82"
            stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${xFill}" cy="18" r="4" fill="#fff"/>

      <!-- ตัวเลข -->
      <text x="${xFill}" y="22" style="font-weight:700;font-size:16px;fill:#fff;text-anchor:middle;">${v.toFixed(1)} cm</text>

      <!-- แถบโซนพื้นหลัง (เสริม: ให้เห็นช่วงสีบนหลอด) -->
      <rect x="20" y="80" width="${(960*(40-min))/(max-min)}" height="6" fill="#00e676" opacity="0.7"/>
      <rect x="${20 + (960*(40-min))/(max-min)}" y="80" width="${(960*(70-40))/(max-min)}" height="6" fill="#ff9800" opacity="0.7"/>
      <rect x="${20 + (960*(70-min))/(max-min)}" y="80" width="${(960*(max-70))/(max-min)}" height="6" fill="#f44336" opacity="0.7"/>
    </svg>`;
  el.innerHTML = svg;
}

/* =======================
   กราฟ Chart.js
   ======================= */

function makeLineChart(ctx, labels, series, label, yTitle) {
  if (!ctx) return null;
  setupHiDPICanvas(ctx);

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data: series,
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { maxRotation: 0, autoSkip: true }, grid: { display: false } },
        y: { beginAtZero: true, title: { display: !!yTitle, text: yTitle } }
      },
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }
    }
  });
}

function destroyChart(inst) {
  if (inst && typeof inst.destroy === 'function') inst.destroy();
}

/* =======================
   การโหลดข้อมูล + อัปเดต UI
   ======================= */

async function fetchRange(range = '30d') {
  const url = `${API_BASE}/distance?range=${encodeURIComponent(range)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : (json?.data || []);
}

function groupByNode(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.node || r.nodeId || r.node_id || 1;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  for (const [, arr] of map) arr.sort((a, b) => a.time - b.time);
  return map;
}

function latestOf(arr) {
  return arr && arr.length ? arr[arr.length - 1] : null;
}

function updateHeaderWater(levelCm) {
  // รองรับได้หลาย id ตามหน้าเก่าๆ
  const ids = ['main-water-level', 'mainWaterLevel', 'currentWaterLevel'];
  for (const id of ids) {
    const el = byId(id);
    if (el) el.textContent = `ระดับน้ำปัจจุบัน: ${Number(levelCm).toFixed(1)} cm`;
  }
}

/* เติมข้อมูลกล่องโหนด */
function fillNodeBox(prefix, row) {
  if (!row) return;
  setText(`${prefix}-rssi`, `RSSI: ${isFinite(row.rssi) ? row.rssi : '-'}${isFinite(row.rssi) ? '' : ''}`);
  setText(`${prefix}-voltage`, `แรงดัน: ${isFinite(row.voltage) ? row.voltage.toFixed(2) : '-'} V`);
  setText(`${prefix}-current`, `กระแส: ${isFinite(row.current) ? row.current.toFixed(1) : '-'} mA`);
  const ts = row.time instanceof Date ? row.time : parseToDate(row.time);
  setText(`${prefix}-time`, ts ? ts.toISOString().replace('T', ' ').slice(0, 19) : '-');
}

function buildTable(rows) {
  const tbody = byId('history-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  const slice = rows.slice(currentIndex, currentIndex + pageSize);
  for (const r of slice) {
    const tr = document.createElement('tr');
    const dt = r.time instanceof Date ? r.time : parseToDate(r.time);
    tr.innerHTML = `
      <td>${dt ? dt.toLocaleString() : '-'}</td>
      <td>${r.node ?? '-'}</td>
      <td>${isFinite(r.distance) ? r.distance.toFixed(1) : '-'}</td>
      <td>${isFinite(r.voltage) ? r.voltage.toFixed(2) : '-'}</td>
      <td>${isFinite(r.current) ? r.current.toFixed(1) : '-'}</td>
      <td>${isFinite(r.rssi) ? r.rssi : '-'}</td>
    `;
    tbody.appendChild(tr);
  }
  setText('history-count', `แสดง ${Math.min(rows.length, currentIndex + pageSize)} / ${rows.length} รายการ`);
}

/* เรนเดอร์กราฟหลัก */
function renderCharts(rows) {
  // เตรียมแกนเวลาและระดับน้ำ
  const labels = rows.map(r => r.time);
  const levels = rows.map(r => (fixedDepth - (Number(r.distance)||0)).toFixed ? fixedDepth - Number(r.distance||0) : 0);

  // กราฟน้ำรวมช่วง (30 วันหรือที่เลือก)
  destroyChart(waterLevelChartInstance);
  const wlCanvas = byId('waterLevelChart');
  waterLevelChartInstance = makeLineChart(
    wlCanvas,
    labels,
    levels,
    'Water Level (cm)',
    'cm'
  );

  // กราฟ 1 ชั่วโมงล่าสุด
  const cutoff = Date.now() - 60 * 60 * 1000;
  const last1h = rows.filter(r => r.time.getTime() >= cutoff);
  destroyChart(oneHourChartInstance);
  const ohCanvas = byId('oneHourChart');
  oneHourChartInstance = makeLineChart(
    ohCanvas,
    last1h.map(r => r.time),
    last1h.map(r => fixedDepth - (Number(r.distance)||0)),
    'Water Level (Last 1h)',
    'cm'
  );

  // กราฟแรงดันแบต (สองโหนด)
  const byNode = groupByNode(rows);
  const n1 = byNode.get(1) || [];
  const n2 = byNode.get(2) || [];
  destroyChart(batteryChartInstance);
  const batCanvas = byId('batteryChart');
  if (batCanvas) {
    setupHiDPICanvas(batCanvas);
    batteryChartInstance = new Chart(batCanvas, {
      type: 'line',
      data: {
        labels: n1.map(r => r.time),
        datasets: [
          { label: 'Node 1 (V)', data: n1.map(r => r.voltage), borderWidth: 2, tension: 0.25, pointRadius: 0 },
          { label: 'Node 2 (V)', data: n2.map(r => r.voltage), borderWidth: 2, tension: 0.25, pointRadius: 0 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: false, title: { display: true, text: 'Volt' }, suggestedMin: 10, suggestedMax: 13 } },
        plugins: { legend: { display: true }, tooltip: { mode: 'index', intersect: false } }
      }
    });
  }

  // กราฟกระแส (mA) รวมสองโหนด
  destroyChart(currentChartInstance);
  const curCanvas = byId('currentChart');
  currentChartInstance = makeLineChart(
    curCanvas,
    labels,
    rows.map(r => r.current),
    'Current (mA)',
    'mA'
  );
}

/* โหลด + อัปเดตทุกส่วน */
async function loadData(range = '30d') {
  try {
    const raw = await fetchRange(range);
    allData = parseChartData(raw);

    if (!allData.length) {
      // กรณีไม่มีข้อมูลเลย
      updateHeaderWater(0);
      drawWaterTube('waterTube', 0, 0, fixedDepth);
      drawBatteryGauge('batteryGauge1', 10.0);
      drawBatteryGauge('batteryGauge2', 10.0);
      buildTable([]);
      renderCharts([]);
      return;
    }

    // แยกตามโหนด
    const grouped = groupByNode(allData);
    const last1 = latestOf(grouped.get(1) || allData); // ถ้าไม่มี node 1 ใช้รายการล่าสุด
    const last2 = latestOf(grouped.get(2) || []);

    // ระดับน้ำปัจจุบันจากระยะล่าสุดของ "รายการล่าสุดสุด" (สมมุติจาก node ใด node หนึ่ง)
    const latest = latestOf(allData);
    const level = fixedDepth - (Number(latest?.distance) || 0);

    // อัปเดต header + หลอด
    updateHeaderWater(level);
    drawWaterTube('waterTube', level, 0, fixedDepth);

    // เติมกล่อง Node 1 / 2
    fillNodeBox('node1', last1);
    fillNodeBox('node2', last2);

    // วาดเกจแบต 2 โหนด
    drawBatteryGauge('batteryGauge1', isFinite(last1?.voltage) ? last1.voltage : 10.0);
    drawBatteryGauge('batteryGauge2', isFinite(last2?.voltage) ? last2.voltage : 10.0);

    // ตาราง
    currentIndex = 0;
    buildTable([...allData].reverse()); // ล่าสุดอยู่บน

    // กราฟ
    renderCharts(allData);
  } catch (err) {
    console.error('loadData error:', err);
    // fallback UI
    drawWaterTube('waterTube', 0, 0, fixedDepth);
    drawBatteryGauge('batteryGauge1', 10.0);
    drawBatteryGauge('batteryGauge2', 10.0);
  }
}

/* =======================
   การเชื่อมกับปุ่ม / การเริ่มทำงาน
   ======================= */

function hookRangeButtons() {
  const btns = document.querySelectorAll('.range-btn[data-range]');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const r = btn.getAttribute('data-range') || '24h';
      loadData(r);
    });
  });
}

function hookTableButtons() {
  const more = byId('load-more');
  if (!more) return;
  more.addEventListener('click', () => {
    currentIndex += pageSize;
    if (currentIndex >= allData.length) currentIndex = 0;
    buildTable([...allData].reverse());
  });
}

function initHiDPICanvases() {
  ['waterLevelChart', 'oneHourChart', 'batteryChart', 'currentChart']
    .map(id => byId(id))
    .filter(Boolean)
    .forEach(setupHiDPICanvas);
}

function startAutoRefresh() {
  setInterval(() => {
    const active = document.querySelector('.range-btn.active')?.getAttribute('data-range') || '30d';
    loadData(active);
  }, REFRESH_MS);
}

/* เริ่มทำงานเมื่อ DOM พร้อม */
document.addEventListener('DOMContentLoaded', () => {
  hookRangeButtons();
  hookTableButtons();
  initHiDPICanvases();
  loadData('30d');
  startAutoRefresh();
});
